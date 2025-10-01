const axios = require("axios");
const File = require("../model/file");
const {
  uploadWithRetry,
  generatePublicUrl,
} = require("../service/couldinary");

// Handle file upload to Cloudinary for bug attachments
const uploadBugAttachment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { bugId } = req.body;

    // Check if a file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Check if bugId is provided
    if (!bugId) {
      return res.status(400).json({ message: "Bug ID is required" });
    }

    const localFilePath = req.file.path;

    // Upload file to Cloudinary with retry logic
    const result = await uploadWithRetry(localFilePath);

    console.log("Bug attachment uploaded:", result);

    // Store metadata in the database
    const fileRecord = await File.create({
      fileId: result.public_id,
      ownerId: userId,
      bugId: bugId,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      cloudinaryUrl: result.secure_url,
    });

    return res.status(200).json({
      message: "Bug attachment uploaded successfully",
      file: {
        id: fileRecord._id,
        fileId: result.public_id,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedAt: fileRecord.createdAt,
      },
    });
  } catch (err) {
    console.error("Error uploading bug attachment:", err);
    next(err);
  }
};

// Get all attachments for a specific bug
const getBugAttachments = async (req, res, next) => {
  try {
    const { bugId } = req.params;
    const userId = req.user.id;

    // Fetch all files for the bug
    const files = await File.find({ bugId }).populate('ownerId', 'name email');

    if (!files || files.length === 0) {
      return res.status(200).json({ 
        message: "No attachments found for this bug",
        attachments: []
      });
    }

    // Generate public URLs for access
    const attachmentsWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          // Use the secure_url from Cloudinary directly
          let fileUrl = file.cloudinaryUrl;
          
          // If cloudinaryUrl is not available, generate URL from public_id
          if (!fileUrl) {
            // Determine resource type based on mimetype
            let resourceType = "raw"; // Default for documents/other files
            if (file.mimetype && file.mimetype.startsWith('image/')) {
              resourceType = "image";
            } else if (file.mimetype && file.mimetype.startsWith('video/')) {
              resourceType = "video";
            }
            
            fileUrl = generatePublicUrl(file.fileId, resourceType);
          }
          
          return {
            id: file._id,
            fileId: file.fileId,
            originalName: file.originalName,
            mimetype: file.mimetype,
            size: file.size,
            uploadedBy: file.ownerId.name,
            uploadedAt: file.createdAt,
            signedUrl: fileUrl, // Keep same property name for frontend compatibility
            url: fileUrl, // Also provide as 'url' for convenience
            cloudinaryUrl: file.cloudinaryUrl, // Original cloudinary URL
          };
        } catch (error) {
          console.error(`Error generating URL for file ${file.fileId}:`, error);
          return {
            id: file._id,
            fileId: file.fileId,
            originalName: file.originalName,
            mimetype: file.mimetype,
            size: file.size,
            uploadedBy: file.ownerId.name,
            uploadedAt: file.createdAt,
            signedUrl: null,
            url: null,
          };
        }
      })
    );

    return res.status(200).json({
      message: "Bug attachments retrieved successfully",
      attachments: attachmentsWithUrls,
    });
  } catch (err) {
    console.error("Error retrieving bug attachments:", err);
    next(err);
  }
};

// Handle file upload to Cloudinary
const handelUploadToCloud = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if a file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const localFilePath = req.file.path;

    // Upload file to Cloudinary with retry logic
    const result = await uploadWithRetry(localFilePath);

    console.log("File uploaded:", result);

    // Store metadata in the database
    await File.create({
      fileId: result.public_id,
      ownerId: userId,
    });

    return res.status(200).json({
      message: "File uploaded successfully",
      public_id: result.public_id,
    });
  } catch (err) {
    next(err);
  }
};

// Handle secure viewing of a file from Cloudinary
const handelViewFromCloud = async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    // Fetch file record from DB
    const file = await File.findById(fileId);
    if (!file) return res.status(400).json({ message: "No file found" });

    // Check if user owns the file
    if (file.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access Denied" });
    }

    const signedUrl = await generateSignedUrl(file.fileId);

    // Fetch file as a stream from Cloudinary
    const response = await axios.get(signedUrl, { responseType: "stream" });

    if (response.status !== 200) {
      console.log("Cloudinary response status:", response.status);
      console.log("Cloudinary response headers:", response.headers);
      return res.status(500).json({ message: "Failed to fetch file from Cloudinary" });
    }

    // Set headers and stream file to response
    res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader("Content-Length", response.headers["content-length"]);
    res.setHeader("Content-Disposition", `inline; filename="${file.fileId}"`);

    response.data.pipe(res);
  } catch (err) {
    next(err);
  }
};

// Handle secure download of a file from Cloudinary
const handelDownloadFromCloud = async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    // Fetch file record from DB
    const file = await File.findById(fileId);
    if (!file) return res.status(400).json({ message: "No file found" });

    // Check ownership
    if (file.ownerId.toString() !== userId) {
      return res.status(403).json({ message: "Access Denied" });
    }

    const signedUrl = await generateSignedUrl(file.fileId);
    const fullFileName = `myfile_${Date.now()}.png`;

    // Fetch file from Cloudinary
    const response = await axios.get(signedUrl, { responseType: "stream" });

    if (response.status !== 200) {
      console.log("Cloudinary response status:", response.status);
      console.log("Cloudinary response headers:", response.headers);
      return res.status(500).json({ message: "Failed to fetch file from Cloudinary" });
    }

    // Set headers for download
    res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader("Content-Length", response.headers["content-length"]);
    res.setHeader("Content-Disposition", `attachment; filename="${fullFileName}"`);

    response.data.pipe(res);
  } catch (err) {
    next(err);
  }
};

// Delete a file attachment
const deleteAttachment = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    console.log(`Delete request for file ${fileId} by user ${userId}`);

    // Find the file record
    const file = await File.findById(fileId);
    if (!file) {
      console.log(`File not found: ${fileId}`);
      return res.status(404).json({ message: "File not found" });
    }

    console.log(`Found file: ${file.originalName}, owner: ${file.ownerId}, cloudinary ID: ${file.fileId}`);

    // Check if user owns the file or has permission (you can add more permission checks here)
    if (file.ownerId.toString() !== userId) {
      console.log(`Unauthorized delete attempt: user ${userId} tried to delete file owned by ${file.ownerId}`);
      return res.status(403).json({ message: "Not authorized to delete this file" });
    }

    // Delete file from Cloudinary
    let cloudinaryDeleted = false;
    try {
      const cloudinary = require("cloudinary").v2;
      
      // Determine resource type based on mimetype
      let resourceType = "raw";
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        resourceType = "image";
      } else if (file.mimetype && file.mimetype.startsWith('video/')) {
        resourceType = "video";
      }
      
      console.log(`Attempting to delete from Cloudinary: ${file.fileId} as ${resourceType}`);
      const result = await cloudinary.uploader.destroy(file.fileId, { resource_type: resourceType });
      console.log(`Cloudinary deletion result:`, result);
      
      if (result.result === 'ok' || result.result === 'not found') {
        cloudinaryDeleted = true;
        console.log(`Successfully deleted file from Cloudinary: ${file.fileId}`);
      } else {
        console.warn(`Cloudinary deletion returned unexpected result: ${result.result}`);
      }
    } catch (cloudinaryError) {
      console.error("Error deleting from Cloudinary:", cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete file record from database
    await File.findByIdAndDelete(fileId);
    console.log(`Successfully deleted file record from database: ${fileId}`);

    return res.status(200).json({ 
      message: "File deleted successfully",
      fileId: fileId,
      cloudinaryDeleted: cloudinaryDeleted,
      fileName: file.originalName
    });
  } catch (err) {
    console.error("Error deleting file:", err);
    next(err);
  }
};

module.exports = {
  handelUploadToCloud,
  handelViewFromCloud,
  handelDownloadFromCloud,
  uploadBugAttachment,
  getBugAttachments,
  deleteAttachment,
};