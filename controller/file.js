const axios = require("axios");
const File = require("../model/file");
const {
  uploadWithRetry,
  generateSignedUrl,
} = require("../service/couldinary");

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

module.exports = {
  handelUploadToCloud,
  handelViewFromCloud,
  handelDownloadFromCloud,
};