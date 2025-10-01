// Test script to check file URL generation
require('dotenv').config();
const { generatePublicUrl } = require("./service/couldinary");

// Test with a sample file ID
const testFileId = "upload/test-image";

console.log("Testing URL generation:");
console.log("File ID:", testFileId);

try {
  const imageUrl = generatePublicUrl(testFileId, "image");
  console.log("Generated Image URL:", imageUrl);
  
  const rawUrl = generatePublicUrl(testFileId, "raw");
  console.log("Generated Raw URL:", rawUrl);
} catch (error) {
  console.error("Error generating URLs:", error);
}