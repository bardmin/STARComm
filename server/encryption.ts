import crypto from 'crypto';

// Ensure ENCRYPTION_KEY is a 32-byte key for AES-256
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY_HEX || 'your_super_secret_default_encryption_key_32_bytes_hex'; // 64 hex characters for 32 bytes
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
const IV_LENGTH = 16; // For AES, this is always 16

if (ENCRYPTION_KEY.length !== 32) {
  console.error("Encryption key must be 32 bytes (64 hex characters). Current key length:", ENCRYPTION_KEY.length, "bytes from hex:", ENCRYPTION_KEY_HEX);
  // In a real app, you might throw an error or exit if the key is invalid,
  // especially if not using the placeholder.
  // For this exercise, we'll proceed with a warning if it's the placeholder.
  if (ENCRYPTION_KEY_HEX === 'your_super_secret_default_encryption_key_32_bytes_hex') {
    console.warn("Using default placeholder encryption key. THIS IS NOT SECURE FOR PRODUCTION.");
  } else {
     throw new Error("Invalid ENCRYPTION_KEY_HEX length. Must be 64 hex characters for a 32-byte key.");
  }
}


export function encrypt(text: string): string | null {
  if (text === null || typeof text === 'undefined') {
    return null;
  }
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Prepend IV and AuthTag for storage, typically separated by a delimiter
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error("Encryption failed:", error);
    return null; // Or handle error appropriately
  }
}

export function decrypt(text: string): string | null {
  if (text === null || typeof text === 'undefined') {
    return null;
  }
  try {
    const parts = text.split(':');
    if (parts.length !== 3) {
      console.error("Decryption failed: Invalid encrypted text format (expected iv:authTag:encryptedData)");
      return null; // Or throw error
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    // It's common for decryption to fail if the key is wrong or data is corrupt.
    // Avoid leaking detailed error messages to clients unless for specific debugging.
    return null; // Or handle error appropriately
  }
}
