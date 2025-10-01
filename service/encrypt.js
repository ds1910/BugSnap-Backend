require('dotenv').config(); 
const crypto = require('crypto');

// AES-256-CBC encryption algorithm
const algorithm = 'aes-256-cbc';

// Secret key for encryption (32 bytes = 256 bits)
// Must be a valid 64-character hex string in .env file
const secretKey = process.env.ENCRYPTION_SECRET_KEY ? Buffer.from(process.env.ENCRYPTION_SECRET_KEY, 'hex') : null;

if (!secretKey) {
  console.error("ERROR: ENCRYPTION_SECRET_KEY not found in environment variables");
  process.exit(1);
}

// ============================ Encryption Function ============================ //
// Encrypts plain text and returns it in the format: iv:encrypted
function encrypt(text) {
  // Generate a random x16-byte Initialization Vector (IV) for AES-CBC
  const iv = crypto.randomBytes(16);

  // Create cipher instance using AES-256-CBC, secret key, and IV
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);   

  // Encrypt the text (returns a Buffer)
  let encrypted = cipher.update(text);

  // Finalize encryption and append any remaining bytes
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Return string as iv:encryptedData (both in hex)
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

module.exports = encrypt; 