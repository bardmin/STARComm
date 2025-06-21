import crypto from 'crypto';

// Configuration constants
const KEY_LENGTH = 32; // 32 bytes for AES-256
const IV_LENGTH = 16; // Always 16 for AES
const SALT_LENGTH = 32; // 32 bytes for salt
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }; // Scrypt parameters

// Key management interface
interface KeyInfo {
  key: Buffer;
  salt?: Buffer;
  keyId?: string;
  derivedFrom?: 'random' | 'password' | 'env';
}

class SecureKeyManager {
  private keys: Map<string, KeyInfo> = new Map();
  private currentKeyId: string = 'default';

  /**
   * Generate a cryptographically secure random key
   */
  generateRandomKey(keyId: string = 'default'): Buffer {
    const key = crypto.randomBytes(KEY_LENGTH);
    
    this.keys.set(keyId, {
      key,
      keyId,
      derivedFrom: 'random'
    });
    
    this.currentKeyId = keyId;
    
    console.log(`Generated secure random key with ID: ${keyId}`);
    console.log(`Key (hex): ${key.toString('hex')}`);
    console.log('⚠️  Store this key securely! It cannot be recovered if lost.');
    
    return key;
  }

  /**
   * Derive a key from a password using PBKDF2
   */
  deriveKeyFromPassword(password: string, salt?: Buffer, keyId: string = 'default'): Buffer {
    if (!password || password.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }

    const keyDeriveSalt = salt || crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(password, keyDeriveSalt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
    
    this.keys.set(keyId, {
      key,
      salt: keyDeriveSalt,
      keyId,
      derivedFrom: 'password'
    });
    
    this.currentKeyId = keyId;
    
    console.log(`Derived key from password with ID: ${keyId}`);
    console.log(`Salt (hex): ${keyDeriveSalt.toString('hex')}`);
    console.log('💡 Store the salt securely alongside your encrypted data');
    
    return key;
  }

  /**
   * Derive a key from a password using scrypt (more secure, slower)
   */
  deriveKeyFromPasswordScrypt(password: string, salt?: Buffer, keyId: string = 'default'): Buffer {
    if (!password || password.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }

    const keyDeriveSalt = salt || crypto.randomBytes(SALT_LENGTH);
    const key = crypto.scryptSync(password, keyDeriveSalt, KEY_LENGTH, SCRYPT_OPTIONS);
    
    this.keys.set(keyId, {
      key,
      salt: keyDeriveSalt,
      keyId,
      derivedFrom: 'password'
    });
    
    this.currentKeyId = keyId;
    
    console.log(`Derived key from password using scrypt with ID: ${keyId}`);
    console.log(`Salt (hex): ${keyDeriveSalt.toString('hex')}`);
    
    return key;
  }

  /**
   * Load key from environment variable with validation
   */
  loadKeyFromEnv(envVarName: string = 'ENCRYPTION_KEY_HEX', keyId: string = 'default'): Buffer {
    const keyHex = process.env[envVarName];
    
    if (!keyHex) {
      throw new Error(`Environment variable ${envVarName} is not set`);
    }

    if (keyHex.length !== KEY_LENGTH * 2) {
      throw new Error(`Environment variable ${envVarName} must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
      throw new Error(`Environment variable ${envVarName} contains invalid hex characters`);
    }

    const key = Buffer.from(keyHex, 'hex');
    
    this.keys.set(keyId, {
      key,
      keyId,
      derivedFrom: 'env'
    });
    
    this.currentKeyId = keyId;
    
    console.log(`Loaded key from environment variable ${envVarName} with ID: ${keyId}`);
    
    return key;
  }

  /**
   * Get the current encryption key
   */
  getCurrentKey(): Buffer {
    const keyInfo = this.keys.get(this.currentKeyId);
    if (!keyInfo) {
      throw new Error(`No key found with ID: ${this.currentKeyId}`);
    }
    return keyInfo.key;
  }

  /**
   * Get a specific key by ID
   */
  getKey(keyId: string): Buffer {
    const keyInfo = this.keys.get(keyId);
    if (!keyInfo) {
      throw new Error(`No key found with ID: ${keyId}`);
    }
    return keyInfo.key;
  }

  /**
   * Set the current key ID for encryption/decryption
   */
  setCurrentKey(keyId: string): void {
    if (!this.keys.has(keyId)) {
      throw new Error(`No key found with ID: ${keyId}`);
    }
    this.currentKeyId = keyId;
  }

  /**
   * List all available keys
   */
  listKeys(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Get key information (without the actual key)
   */
  getKeyInfo(keyId: string): Omit<KeyInfo, 'key'> {
    const keyInfo = this.keys.get(keyId);
    if (!keyInfo) {
      throw new Error(`No key found with ID: ${keyId}`);
    }
    
    return {
      salt: keyInfo.salt,
      keyId: keyInfo.keyId,
      derivedFrom: keyInfo.derivedFrom
    };
  }

  /**
   * Securely clear a key from memory
   */
  clearKey(keyId: string): void {
    const keyInfo = this.keys.get(keyId);
    if (keyInfo) {
      // Overwrite the key buffer with random data before deletion
      keyInfo.key.fill(0);
      crypto.randomFillSync(keyInfo.key);
      this.keys.delete(keyId);
      
      if (this.currentKeyId === keyId) {
        this.currentKeyId = this.keys.size > 0 ? this.keys.keys().next().value : '';
      }
    }
  }

  /**
   * Clear all keys from memory
   */
  clearAllKeys(): void {
    for (const keyId of this.keys.keys()) {
      this.clearKey(keyId);
    }
  }
}

// Create a global key manager instance
const keyManager = new SecureKeyManager();

// Initialize key based on environment or generate new one
function initializeKey(): void {
  try {
    // Try to load from environment first
    keyManager.loadKeyFromEnv();
  } catch (error) {
    console.warn('Could not load key from environment:', (error as Error).message);
    console.log('Generating a new random key...');
    keyManager.generateRandomKey();
  }
}

// Auto-initialize on module load
initializeKey();

/**
 * Encrypt text using AES-256-GCM with the current key
 */
export function encrypt(text: string, keyId?: string): string | null {
  if (text === null || typeof text === 'undefined') {
    return null;
  }

  try {
    const key = keyId ? keyManager.getKey(keyId) : keyManager.getCurrentKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: keyId:iv:authTag:encryptedData (if keyId specified)
    // Format: iv:authTag:encryptedData (if using current key)
    const result = keyId 
      ? `${keyId}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
      : `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    return result;
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt text using AES-256-GCM
 */
export function decrypt(encryptedText: string): string | null {
  if (encryptedText === null || typeof encryptedText === 'undefined') {
    return null;
  }

  try {
    const parts = encryptedText.split(':');
    let iv: Buffer, authTag: Buffer, encrypted: string, key: Buffer;

    if (parts.length === 4) {
      // Format with keyId: keyId:iv:authTag:encryptedData
      const keyId = parts[0];
      iv = Buffer.from(parts[1], 'hex');
      authTag = Buffer.from(parts[2], 'hex');
      encrypted = parts[3];
      key = keyManager.getKey(keyId);
    } else if (parts.length === 3) {
      // Format without keyId: iv:authTag:encryptedData
      iv = Buffer.from(parts[0], 'hex');
      authTag = Buffer.from(parts[1], 'hex');
      encrypted = parts[2];
      key = keyManager.getCurrentKey();
    } else {
      console.error('Decryption failed: Invalid encrypted text format');
      return null;
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// Export the key manager for advanced usage
export { keyManager, SecureKeyManager };

// Utility functions for easy key generation
export const generateRandomKey = (keyId?: string) => keyManager.generateRandomKey(keyId);
export const deriveKeyFromPassword = (password: string, salt?: Buffer, keyId?: string) => 
  keyManager.deriveKeyFromPassword(password, salt, keyId);
export const deriveKeyFromPasswordScrypt = (password: string, salt?: Buffer, keyId?: string) => 
  keyManager.deriveKeyFromPasswordScrypt(password, salt, keyId);
export const loadKeyFromEnv = (envVar?: string, keyId?: string) => 
  keyManager.loadKeyFromEnv(envVar, keyId);

// Example usage:
/*
// Generate a new random key
generateRandomKey('mykey1');

// Derive key from password
deriveKeyFromPassword('mySecurePassword123!', undefined, 'mykey2');

// Use specific key for encryption
const encrypted = encrypt('Hello World!', 'mykey1');
const decrypted = decrypt(encrypted);

// Switch between keys
keyManager.setCurrentKey('mykey2');
const encrypted2 = encrypt('Hello World!'); // Uses mykey2

// Clear sensitive keys from memory when done
keyManager.clearKey('mykey1');
*/