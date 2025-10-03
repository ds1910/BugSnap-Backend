const File = require('../../model/file');
const Bug = require('../../model/bug');
const User = require('../../model/user');
const fs = require('fs').promises;
const path = require('path');

/**
 * File-related intent handlers for AI Agent
 * Handles file attachments, media management, and document operations
 */
class FileIntents {

  /**
   * Get files attached to a specific bug
   */
  static async getBugFiles(userId, bugId, options = {}) {
    try {
      // Verify user has access to the bug
      const bug = await Bug.findById(bugId).populate('team');
      if (!bug || bug.deleted) {
        return { success: false, message: 'Bug not found' };
      }

      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id.toString());
      
      if (!userTeamIds.includes(bug.team._id.toString())) {
        return { success: false, message: 'Access denied to this bug' };
      }

      // Build query
      const query = { bug: bugId, deleted: false };
      
      // Apply filters
      if (options.fileType) {
        query.type = options.fileType;
      }
      if (options.uploadedBy) {
        query.uploadedBy = options.uploadedBy;
      }
      if (options.dateFrom) {
        query.uploadedAt = { $gte: new Date(options.dateFrom) };
      }
      if (options.dateTo) {
        query.uploadedAt = { ...query.uploadedAt, $lte: new Date(options.dateTo) };
      }

      const files = await File.find(query)
        .populate('uploadedBy', 'name email avatar')
        .sort({ uploadedAt: -1 })
        .limit(options.limit || 50);

      // Get file statistics
      const [totalFiles, totalSize, filesByType] = await Promise.all([
        File.countDocuments({ bug: bugId, deleted: false }),
        File.aggregate([
          { $match: { bug: bugId, deleted: false } },
          { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]),
        File.aggregate([
          { $match: { bug: bugId, deleted: false } },
          { $group: { _id: '$type', count: { $sum: 1 }, totalSize: { $sum: '$size' } } }
        ])
      ]);

      return {
        success: true,
        files: files,
        statistics: {
          total: totalFiles,
          showing: files.length,
          totalSize: totalSize[0]?.totalSize || 0,
          byType: filesByType
        },
        bug: {
          id: bug._id,
          title: bug.title
        },
        message: `${files.length} files retrieved`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching files',
        error: error.message
      };
    }
  }

  /**
   * Upload a new file to a bug
   */
  static async uploadFile(userId, bugId, fileData) {
    try {
      // Verify user has access to the bug
      const bug = await Bug.findById(bugId).populate('team');
      if (!bug || bug.deleted) {
        return { success: false, message: 'Bug not found' };
      }

      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id.toString());
      
      if (!userTeamIds.includes(bug.team._id.toString())) {
        return { success: false, message: 'Access denied to this bug' };
      }

      // Validate file data
      if (!fileData.originalName || !fileData.filename || !fileData.size) {
        return { success: false, message: 'Invalid file data' };
      }

      // Check file size (e.g., 10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileData.size > maxSize) {
        return { success: false, message: 'File size exceeds 10MB limit' };
      }

      // Determine file type
      const fileType = this.getFileType(fileData.originalName, fileData.mimeType);

      const newFile = new File({
        originalName: fileData.originalName,
        filename: fileData.filename,
        path: fileData.path,
        size: fileData.size,
        type: fileType,
        mimeType: fileData.mimeType,
        bug: bugId,
        uploadedBy: userId,
        uploadedAt: new Date(),
        description: fileData.description || '',
        tags: fileData.tags || []
      });

      const savedFile = await newFile.save();
      await savedFile.populate('uploadedBy', 'name email avatar');

      // Update bug's last activity
      await Bug.findByIdAndUpdate(bugId, {
        updatedAt: new Date(),
        $push: { attachments: savedFile._id }
      });

      return {
        success: true,
        file: savedFile,
        message: `File "${savedFile.originalName}" uploaded successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error uploading file',
        error: error.message
      };
    }
  }

  /**
   * Get file details by ID
   */
  static async getFileDetails(userId, fileId) {
    try {
      const file = await File.findById(fileId)
        .populate('uploadedBy', 'name email avatar')
        .populate('bug', 'title status team');

      if (!file || file.deleted) {
        return { success: false, message: 'File not found' };
      }

      // Check access to the bug
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id.toString());
      
      if (!userTeamIds.includes(file.bug.team.toString())) {
        return { success: false, message: 'Access denied to this file' };
      }

      // Get file metadata if it exists
      let metadata = {};
      try {
        if (file.path && await this.fileExists(file.path)) {
          const stats = await fs.stat(file.path);
          metadata = {
            exists: true,
            actualSize: stats.size,
            lastModified: stats.mtime,
            accessible: true
          };
        } else {
          metadata = {
            exists: false,
            accessible: false
          };
        }
      } catch (error) {
        metadata = {
          exists: false,
          accessible: false,
          error: error.message
        };
      }

      return {
        success: true,
        file: {
          ...file.toObject(),
          metadata
        },
        message: 'File details retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching file details',
        error: error.message
      };
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(userId, fileId) {
    try {
      const file = await File.findById(fileId).populate('bug');
      
      if (!file || file.deleted) {
        return { success: false, message: 'File not found' };
      }

      // Check if user can delete (uploader or bug creator or team admin)
      const canDelete = file.uploadedBy.toString() === userId ||
                       file.bug.creator.toString() === userId;

      if (!canDelete) {
        // Check if user is team admin
        const bug = await Bug.findById(file.bug._id).populate('team');
        const team = await Team.findById(bug.team._id);
        
        if (team.admin.toString() !== userId) {
          return { success: false, message: 'You do not have permission to delete this file' };
        }
      }

      // Soft delete
      await File.findByIdAndUpdate(fileId, {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: userId
      });

      // Remove from bug attachments
      await Bug.findByIdAndUpdate(file.bug._id, {
        $pull: { attachments: fileId },
        updatedAt: new Date()
      });

      return {
        success: true,
        message: `File "${file.originalName}" deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error deleting file',
        error: error.message
      };
    }
  }

  /**
   * Search files across accessible bugs
   */
  static async searchFiles(userId, searchQuery, options = {}) {
    try {
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id);

      // Get bugs user has access to
      const accessibleBugs = await Bug.find({
        team: { $in: userTeamIds },
        deleted: false
      }).select('_id');

      const bugIds = accessibleBugs.map(bug => bug._id);

      // Build search query
      const searchConditions = {
        bug: { $in: bugIds },
        deleted: false,
        $or: [
          { originalName: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { tags: { $regex: searchQuery, $options: 'i' } }
        ]
      };

      // Apply filters
      if (options.fileType) searchConditions.type = options.fileType;
      if (options.uploadedBy) searchConditions.uploadedBy = options.uploadedBy;
      if (options.bugId) searchConditions.bug = options.bugId;
      if (options.dateFrom) {
        searchConditions.uploadedAt = { $gte: new Date(options.dateFrom) };
      }

      const files = await File.find(searchConditions)
        .populate('uploadedBy', 'name email avatar')
        .populate('bug', 'title status priority')
        .sort({ uploadedAt: -1 })
        .limit(options.limit || 25);

      const totalSize = await File.aggregate([
        { $match: searchConditions },
        { $group: { _id: null, totalSize: { $sum: '$size' } } }
      ]);

      return {
        success: true,
        files: files,
        count: files.length,
        totalSize: totalSize[0]?.totalSize || 0,
        searchQuery: searchQuery,
        message: `Found ${files.length} files matching "${searchQuery}"`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error searching files',
        error: error.message
      };
    }
  }

  /**
   * Get file analytics for team or user
   */
  static async getFileAnalytics(userId, context = {}) {
    try {
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id);

      let baseQuery = { deleted: false };

      if (context.teamId) {
        // Analytics for specific team
        if (!userTeamIds.includes(context.teamId)) {
          return { success: false, message: 'Access denied to this team' };
        }
        const teamBugs = await Bug.find({ team: context.teamId }).select('_id');
        baseQuery.bug = { $in: teamBugs.map(b => b._id) };
      } else if (context.uploadedBy) {
        // Analytics for specific user
        baseQuery.uploadedBy = context.uploadedBy;
        // Also filter by accessible bugs
        const accessibleBugs = await Bug.find({
          team: { $in: userTeamIds },
          deleted: false
        }).select('_id');
        baseQuery.bug = { $in: accessibleBugs.map(b => b._id) };
      } else {
        // Analytics for all accessible files
        const accessibleBugs = await Bug.find({
          team: { $in: userTeamIds },
          deleted: false
        }).select('_id');
        baseQuery.bug = { $in: accessibleBugs.map(b => b._id) };
      }

      const [
        totalFiles,
        totalSize,
        filesByType,
        filesByUploader,
        recentFiles,
        largestFiles,
        storageByTeam
      ] = await Promise.all([
        File.countDocuments(baseQuery),
        File.aggregate([
          { $match: baseQuery },
          { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]),
        File.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$type', count: { $sum: 1 }, totalSize: { $sum: '$size' } } },
          { $sort: { count: -1 } }
        ]),
        File.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$uploadedBy', count: { $sum: 1 }, totalSize: { $sum: '$size' } } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        File.countDocuments({
          ...baseQuery,
          uploadedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        File.find(baseQuery)
          .sort({ size: -1 })
          .limit(5)
          .populate('uploadedBy', 'name')
          .populate('bug', 'title'),
        context.teamId ? null : File.aggregate([
          { $match: baseQuery },
          { $lookup: { from: 'bugs', localField: 'bug', foreignField: '_id', as: 'bugInfo' } },
          { $lookup: { from: 'teams', localField: 'bugInfo.team', foreignField: '_id', as: 'teamInfo' } },
          { $group: { 
            _id: '$teamInfo._id', 
            teamName: { $first: '$teamInfo.name' },
            count: { $sum: 1 }, 
            totalSize: { $sum: '$size' } 
          } },
          { $sort: { totalSize: -1 } }
        ])
      ]);

      const analytics = {
        summary: {
          totalFiles,
          totalSize: totalSize[0]?.totalSize || 0,
          recentFiles,
          averageFileSize: totalFiles > 0 ? Math.round((totalSize[0]?.totalSize || 0) / totalFiles) : 0
        },
        distributions: {
          filesByType: filesByType,
          filesByUploader: filesByUploader.map(item => ({
            user: {
              id: item.user[0]?._id,
              name: item.user[0]?.name,
              email: item.user[0]?.email
            },
            count: item.count,
            totalSize: item.totalSize
          })),
          largestFiles: largestFiles.map(file => ({
            id: file._id,
            name: file.originalName,
            size: file.size,
            uploader: file.uploadedBy?.name,
            bug: file.bug?.title
          }))
        }
      };

      if (storageByTeam) {
        analytics.distributions.storageByTeam = storageByTeam;
      }

      return {
        success: true,
        analytics,
        context,
        message: 'File analytics retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching file analytics',
        error: error.message
      };
    }
  }

  /**
   * Get files uploaded by a specific user
   */
  static async getUserFiles(userId, targetUserId = null, options = {}) {
    try {
      const searchUserId = targetUserId || userId;
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id);

      // Get bugs user has access to
      const accessibleBugs = await Bug.find({
        team: { $in: userTeamIds },
        deleted: false
      }).select('_id');

      const bugIds = accessibleBugs.map(bug => bug._id);

      const query = {
        bug: { $in: bugIds },
        uploadedBy: searchUserId,
        deleted: false
      };

      if (options.fileType) query.type = options.fileType;
      if (options.dateFrom) {
        query.uploadedAt = { $gte: new Date(options.dateFrom) };
      }

      const files = await File.find(query)
        .populate('bug', 'title status priority')
        .sort({ uploadedAt: -1 })
        .limit(options.limit || 25);

      const [totalFiles, totalSize] = await Promise.all([
        File.countDocuments(query),
        File.aggregate([
          { $match: query },
          { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ])
      ]);

      const targetUser = await User.findById(searchUserId).select('name email');

      return {
        success: true,
        files: files,
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email
        },
        statistics: {
          total: totalFiles,
          showing: files.length,
          totalSize: totalSize[0]?.totalSize || 0
        },
        message: `${files.length} files uploaded by ${targetUser.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching user files',
        error: error.message
      };
    }
  }

  /**
   * Update file metadata
   */
  static async updateFileMetadata(userId, fileId, updateData) {
    try {
      const file = await File.findById(fileId).populate('bug');
      
      if (!file || file.deleted) {
        return { success: false, message: 'File not found' };
      }

      // Check if user can update (uploader or team admin)
      const canUpdate = file.uploadedBy.toString() === userId;

      if (!canUpdate) {
        const bug = await Bug.findById(file.bug._id).populate('team');
        const team = await Team.findById(bug.team._id);
        
        if (team.admin.toString() !== userId) {
          return { success: false, message: 'You do not have permission to update this file' };
        }
      }

      // Filter allowed fields for update
      const allowedFields = ['description', 'tags'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      const updatedFile = await File.findByIdAndUpdate(
        fileId,
        { ...filteredData, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
      .populate('uploadedBy', 'name email avatar')
      .populate('bug', 'title');

      return {
        success: true,
        file: updatedFile,
        message: 'File metadata updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error updating file metadata',
        error: error.message
      };
    }
  }

  /**
   * Helper method to determine file type from name and mime type
   */
  static getFileType(filename, mimeType) {
    const extension = path.extname(filename).toLowerCase();
    
    // Image files
    if (mimeType?.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'].includes(extension)) {
      return 'image';
    }
    
    // Document files
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'].includes(extension)) {
      return 'document';
    }
    
    // Spreadsheet files
    if (['.xls', '.xlsx', '.csv', '.ods'].includes(extension)) {
      return 'spreadsheet';
    }
    
    // Presentation files
    if (['.ppt', '.pptx', '.odp'].includes(extension)) {
      return 'presentation';
    }
    
    // Archive files
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(extension)) {
      return 'archive';
    }
    
    // Video files
    if (mimeType?.startsWith('video/') || ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(extension)) {
      return 'video';
    }
    
    // Audio files
    if (mimeType?.startsWith('audio/') || ['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(extension)) {
      return 'audio';
    }
    
    // Code files
    if (['.js', '.html', '.css', '.php', '.py', '.java', '.cpp', '.c', '.sql'].includes(extension)) {
      return 'code';
    }
    
    return 'other';
  }

  /**
   * Helper method to check if file exists
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = FileIntents;
