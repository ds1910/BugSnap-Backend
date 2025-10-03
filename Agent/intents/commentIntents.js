const Comment = require('../../model/comment');
const Bug = require('../../model/bug');
const User = require('../../model/user');

/**
 * Comment-related intent handlers for AI Agent
 * Handles comment operations, discussions, and collaboration
 */
class CommentIntents {

  /**
   * Get comments for a specific bug
   */
  static async getBugComments(userId, bugId, options = {}) {
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
      if (options.author) query.author = options.author;
      if (options.dateFrom) {
        query.createdAt = { $gte: new Date(options.dateFrom) };
      }
      if (options.dateTo) {
        query.createdAt = { ...query.createdAt, $lte: new Date(options.dateTo) };
      }

      const comments = await Comment.find(query)
        .populate('author', 'name email avatar')
        .populate('mentions', 'name email')
        .sort({ createdAt: options.sortOrder === 'desc' ? -1 : 1 })
        .limit(options.limit || 50);

      // Get comment statistics
      const [totalComments, uniqueAuthors, recentComments] = await Promise.all([
        Comment.countDocuments({ bug: bugId, deleted: false }),
        Comment.distinct('author', { bug: bugId, deleted: false }),
        Comment.countDocuments({
          bug: bugId,
          deleted: false,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        success: true,
        comments: comments,
        statistics: {
          total: totalComments,
          showing: comments.length,
          uniqueAuthors: uniqueAuthors.length,
          recentComments
        },
        bug: {
          id: bug._id,
          title: bug.title,
          team: bug.team.name
        },
        message: `${comments.length} comments retrieved`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching comments',
        error: error.message
      };
    }
  }

  /**
   * Add a new comment to a bug
   */
  static async addComment(userId, bugId, commentData) {
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

      // Extract mentions from comment content (e.g., @username)
      const mentions = this.extractMentions(commentData.content);
      const mentionUserIds = [];

      if (mentions.length > 0) {
        const mentionedUsers = await User.find({
          $or: [
            { name: { $in: mentions } },
            { email: { $in: mentions } }
          ],
          teams: { $in: userTeamIds } // Only mention users in shared teams
        });
        
        mentionUserIds.push(...mentionedUsers.map(u => u._id));
      }

      const newComment = new Comment({
        content: commentData.content,
        author: userId,
        bug: bugId,
        mentions: mentionUserIds,
        attachments: commentData.attachments || [],
        type: commentData.type || 'comment', // comment, status_change, assignment, etc.
        createdAt: new Date()
      });

      const savedComment = await newComment.save();
      await savedComment.populate('author', 'name email avatar');
      await savedComment.populate('mentions', 'name email');

      // Update bug's last activity
      await Bug.findByIdAndUpdate(bugId, {
        updatedAt: new Date(),
        lastCommentAt: new Date()
      });

      return {
        success: true,
        comment: savedComment,
        mentionsCount: mentionUserIds.length,
        message: 'Comment added successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error adding comment',
        error: error.message
      };
    }
  }

  /**
   * Update an existing comment
   */
  static async updateComment(userId, commentId, updateData) {
    try {
      const comment = await Comment.findById(commentId).populate('bug');
      
      if (!comment || comment.deleted) {
        return { success: false, message: 'Comment not found' };
      }

      // Only author can edit their comment (within time limit)
      if (comment.author.toString() !== userId) {
        return { success: false, message: 'You can only edit your own comments' };
      }

      // Check if comment is too old to edit (e.g., 24 hours)
      const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - comment.createdAt.getTime() > editTimeLimit) {
        return { success: false, message: 'Comment is too old to edit' };
      }

      // Update allowed fields
      const allowedFields = ['content'];
      const updates = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      });

      if (Object.keys(updates).length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      // Re-extract mentions if content changed
      if (updates.content) {
        const mentions = this.extractMentions(updates.content);
        if (mentions.length > 0) {
          const bug = await Bug.findById(comment.bug._id).populate('team');
          const user = await User.findById(userId).populate('teams');
          const userTeamIds = user.teams.map(team => team._id.toString());
          
          const mentionedUsers = await User.find({
            $or: [
              { name: { $in: mentions } },
              { email: { $in: mentions } }
            ],
            teams: { $in: userTeamIds }
          });
          
          updates.mentions = mentionedUsers.map(u => u._id);
        }
      }

      updates.updatedAt = new Date();
      updates.edited = true;

      const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        updates,
        { new: true, runValidators: true }
      )
      .populate('author', 'name email avatar')
      .populate('mentions', 'name email');

      return {
        success: true,
        comment: updatedComment,
        message: 'Comment updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error updating comment',
        error: error.message
      };
    }
  }

  /**
   * Delete a comment
   */
  static async deleteComment(userId, commentId) {
    try {
      const comment = await Comment.findById(commentId).populate('bug');
      
      if (!comment || comment.deleted) {
        return { success: false, message: 'Comment not found' };
      }

      // Check if user can delete (author or bug creator or team admin)
      const canDelete = comment.author.toString() === userId ||
                       comment.bug.creator.toString() === userId;

      if (!canDelete) {
        // Check if user is team admin
        const bug = await Bug.findById(comment.bug._id).populate('team');
        const team = await Team.findById(bug.team._id);
        
        if (team.admin.toString() !== userId) {
          return { success: false, message: 'You do not have permission to delete this comment' };
        }
      }

      // Soft delete
      await Comment.findByIdAndUpdate(commentId, {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: userId
      });

      return {
        success: true,
        message: 'Comment deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error deleting comment',
        error: error.message
      };
    }
  }

  /**
   * Get user's recent comments across all bugs
   */
  static async getUserComments(userId, options = {}) {
    try {
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id);

      // Get bugs user has access to
      const accessibleBugs = await Bug.find({
        team: { $in: userTeamIds },
        deleted: false
      }).select('_id');

      const bugIds = accessibleBugs.map(bug => bug._id);

      // Build query
      const query = {
        bug: { $in: bugIds },
        deleted: false
      };

      if (options.author) {
        query.author = options.author;
      } else {
        query.author = userId; // Default to user's own comments
      }

      if (options.dateFrom) {
        query.createdAt = { $gte: new Date(options.dateFrom) };
      }

      const comments = await Comment.find(query)
        .populate('author', 'name email avatar')
        .populate('bug', 'title status priority')
        .populate('mentions', 'name email')
        .sort({ createdAt: -1 })
        .limit(options.limit || 25);

      const totalComments = await Comment.countDocuments(query);

      return {
        success: true,
        comments: comments,
        total: totalComments,
        showing: comments.length,
        message: `${comments.length} comments retrieved`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching user comments',
        error: error.message
      };
    }
  }

  /**
   * Search comments across accessible bugs
   */
  static async searchComments(userId, searchQuery, options = {}) {
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
        content: { $regex: searchQuery, $options: 'i' }
      };

      // Apply filters
      if (options.author) searchConditions.author = options.author;
      if (options.bugId) searchConditions.bug = options.bugId;
      if (options.dateFrom) {
        searchConditions.createdAt = { $gte: new Date(options.dateFrom) };
      }

      const comments = await Comment.find(searchConditions)
        .populate('author', 'name email avatar')
        .populate('bug', 'title status priority team')
        .populate('mentions', 'name email')
        .sort({ createdAt: -1 })
        .limit(options.limit || 20);

      return {
        success: true,
        comments: comments,
        count: comments.length,
        searchQuery: searchQuery,
        message: `Found ${comments.length} comments matching "${searchQuery}"`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error searching comments',
        error: error.message
      };
    }
  }

  /**
   * Get comment analytics for a team or bug
   */
  static async getCommentAnalytics(userId, context = {}) {
    try {
      const user = await User.findById(userId).populate('teams');
      const userTeamIds = user.teams.map(team => team._id);

      let baseQuery = { deleted: false };

      if (context.bugId) {
        // Analytics for specific bug
        const bug = await Bug.findById(context.bugId);
        if (!userTeamIds.includes(bug.team)) {
          return { success: false, message: 'Access denied to this bug' };
        }
        baseQuery.bug = context.bugId;
      } else if (context.teamId) {
        // Analytics for specific team
        if (!userTeamIds.includes(context.teamId)) {
          return { success: false, message: 'Access denied to this team' };
        }
        const teamBugs = await Bug.find({ team: context.teamId }).select('_id');
        baseQuery.bug = { $in: teamBugs.map(b => b._id) };
      } else {
        // Analytics for all accessible bugs
        const accessibleBugs = await Bug.find({
          team: { $in: userTeamIds },
          deleted: false
        }).select('_id');
        baseQuery.bug = { $in: accessibleBugs.map(b => b._id) };
      }

      const [
        totalComments,
        uniqueAuthors,
        recentComments,
        commentsByAuthor,
        commentsByDay,
        averageCommentsPerBug,
        mostCommentedBugs
      ] = await Promise.all([
        Comment.countDocuments(baseQuery),
        Comment.distinct('author', baseQuery),
        Comment.countDocuments({
          ...baseQuery,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        Comment.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$author', count: { $sum: 1 } } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'author' } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        Comment.aggregate([
          { $match: baseQuery },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: -1 } },
          { $limit: 30 }
        ]),
        Comment.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$bug', count: { $sum: 1 } } },
          { $group: { _id: null, avg: { $avg: '$count' } } }
        ]),
        Comment.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$bug', count: { $sum: 1 } } },
          { $lookup: { from: 'bugs', localField: '_id', foreignField: '_id', as: 'bug' } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
      ]);

      const analytics = {
        summary: {
          totalComments,
          uniqueAuthors: uniqueAuthors.length,
          recentComments,
          averageCommentsPerBug: averageCommentsPerBug[0]?.avg || 0
        },
        distributions: {
          commentsByAuthor: commentsByAuthor.map(item => ({
            author: {
              id: item.author[0]?._id,
              name: item.author[0]?.name,
              email: item.author[0]?.email
            },
            count: item.count
          })),
          commentsByDay,
          mostCommentedBugs: mostCommentedBugs.map(item => ({
            bug: {
              id: item.bug[0]?._id,
              title: item.bug[0]?.title,
              status: item.bug[0]?.status
            },
            commentCount: item.count
          }))
        }
      };

      return {
        success: true,
        analytics,
        context,
        message: 'Comment analytics retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching comment analytics',
        error: error.message
      };
    }
  }

  /**
   * Helper method to extract mentions from comment content
   */
  static extractMentions(content) {
    const mentionRegex = /@(\w+(?:\.\w+)*)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    
    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Get mentions for a user
   */
  static async getUserMentions(userId, options = {}) {
    try {
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
        mentions: userId,
        deleted: false
      };

      if (options.unreadOnly) {
        query.readBy = { $ne: userId };
      }

      const mentions = await Comment.find(query)
        .populate('author', 'name email avatar')
        .populate('bug', 'title status priority')
        .sort({ createdAt: -1 })
        .limit(options.limit || 20);

      const unreadCount = await Comment.countDocuments({
        ...query,
        readBy: { $ne: userId }
      });

      return {
        success: true,
        mentions: mentions,
        unreadCount: unreadCount,
        total: mentions.length,
        message: `${mentions.length} mentions found`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching mentions',
        error: error.message
      };
    }
  }
}

module.exports = CommentIntents;
