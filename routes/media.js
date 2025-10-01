const express = require("express");
const {
  handelUploadToCloud,
  handelViewFromCloud,
  handelDownloadFromCloud,
  uploadBugAttachment,
  getBugAttachments,
  deleteAttachment,
} = require("../controller/file");

const upload = require("../middleware/multer");

const router = express.Router();

/**
 * @swagger
 * /file/:
 *   get:
 *     summary: Render file upload page
 *     tags: [File]
 *     description: Renders a form for uploading files using EJS view.
 *     responses:
 *       200:
 *         description: Upload page rendered
 */
router.get("/", (req, res) => {
  res.render("home.ejs");
});

/**
 * @swagger
 * /file/upload:
 *   post:
 *     summary: Upload a file to Cloudinary
 *     tags: [File]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: File upload failed
 */
router.post("/upload", upload.single("profileImage"), handelUploadToCloud);

/**
 * @swagger
 * /file/view/{id}:
 *   get:
 *     summary: View file stream from Cloudinary
 *     tags: [File]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID of the file in Cloudinary
 *     responses:
 *       200:
 *         description: File stream returned
 *       404:
 *         description: File not found
 */
router.get("/view/:id", handelViewFromCloud);

/**
 * @swagger
 * /file/download/{id}:
 *   get:
 *     summary: Download file from Cloudinary
 *     tags: [File]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID of the file in Cloudinary
 *     responses:
 *       200:
 *         description: File downloaded
 *       404:
 *         description: File not found
 */
router.get("/download/:id", handelDownloadFromCloud);

/**
 * @swagger
 * /file/bug/upload:
 *   post:
 *     summary: Upload attachment for a bug
 *     tags: [File]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachment:
 *                 type: string
 *                 format: binary
 *               bugId:
 *                 type: string
 *                 description: ID of the bug to attach file to
 *     responses:
 *       200:
 *         description: Bug attachment uploaded successfully
 *       400:
 *         description: Upload failed - missing file or bugId
 */
router.post("/bug/upload", upload.single("attachment"), uploadBugAttachment);

/**
 * @swagger
 * /file/bug/{bugId}/attachments:
 *   get:
 *     summary: Get all attachments for a specific bug
 *     tags: [File]
 *     parameters:
 *       - in: path
 *         name: bugId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the bug to get attachments for
 *     responses:
 *       200:
 *         description: Bug attachments retrieved successfully
 *       404:
 *         description: No attachments found
 */
router.get("/bug/:bugId/attachments", getBugAttachments);

/**
 * @swagger
 * /media/attachment/{fileId}:
 *   delete:
 *     summary: Delete a file attachment
 *     tags: [File]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the file to delete
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: File not found
 *       403:
 *         description: Not authorized to delete this file
 */
router.delete("/attachment/:fileId", deleteAttachment);

/* ====================== EXPORT ROUTER ====================== */
module.exports = router;
