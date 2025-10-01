const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const pRetry = require("p-retry");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 📦 x p-retry: Automatically retries a failed async function (like file upload)
// 👉 Useful when calling unstable external services (e.g. Cloudinary, APIs)
// 🔁 Helps handle temporary issues like network failure or rate limits

// Security comes from the fact that only your server (with your secret) can generate valid signatures.

// Cloudinary SDK uses your backend-stored API secret to generate a signed URL.
// This signed URL includes a secure signature and expiry time, preventing unauthorized access.
// The secret is never exposed; only valid, time-limited URLs can access protected media.


const uploadWithRetry = async (localFilePath, mimetype = 'image') => {
  const upload = async () => {
    try {
      // Generate a unique public_id
      const uniquePublicId = `upload/${uuidv4()}`;
      console.log("uniquePublicId: ", uniquePublicId);

      // Determine resource type based on mimetype
      let resourceType = "auto"; // Let Cloudinary auto-detect
      let uploadOptions = {
        public_id: uniquePublicId,
        type: "upload",        // Public access - no signed URL needed
      };

      // For images, force jpg format
      if (mimetype && mimetype.startsWith('image/')) {
        uploadOptions.resource_type = "image";
        uploadOptions.format = "jpg";
      } else {
        uploadOptions.resource_type = "raw"; // For non-image files
      }

      const result = await cloudinary.uploader.upload(localFilePath, uploadOptions);

      console.log("Uploaded to Cloudinary:", result);

      return result;
    } catch (err) {
      console.log(err);
      console.warn("Upload failed, retrying...");
      throw err;
    }
  };

  try {
    // Retry up to 3 times with exponential backoff if upload fails
    // ⏳ Exponential Backoff: Increases wait time after each failed retry (e.g. 1s, 2s, 4s)
    // 🎯 Reduces load on server, avoids hitting rate limits, gives time to recover
    // 🚀 Built-in to p-retry for smarter and safer retries in production
    const response = await pRetry(upload, { retries: 3 });

    // Delete local file after successful upload
    fs.unlink(localFilePath, (err) => {
      if (err) console.error("Failed to delete local file:", err);
    });

    return response;
  } catch (err) {
    console.error("Cloudinary upload failed after retries:", err);

    // Delete local file even on failure
    fs.unlink(localFilePath, (err) => {
      if (err) console.error("Failed to delete local file after failure:", err);
    });

    return null;
  }
};

// 🔐 Generate a public URL for accessing files
function generatePublicUrl(publicId, resourceType = "image") {
  const options = {
    secure: true,
    resource_type: resourceType
  };

  console.log("Generated Cloudinary public URL with:", { publicId, resourceType, options });

  return cloudinary.utils.url(publicId, options);
}

module.exports = {
  uploadWithRetry,
  generatePublicUrl,
};