import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes IV is standard for AES-GCM

const getKey = (): Buffer => {
  const rawKey = process.env.ENCRYPTION_KEY || 'default_dev_encryption_key_32_bytes_long_minimum';
  // Hash the key to guarantee it is exactly 32 bytes (256 bits) for aes-256
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Encrypts cleartext using AES-256-GCM.
 * Output format is `iv:authTag:encryptedData` in hex.
 */
export const encrypt = (text: string): string => {
  if (!text) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a payload formatted as `iv:authTag:encryptedData`.
 * Falls back to returning the text as-is if it's not in the encrypted format.
 */
export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return '';
  
  // Backward compatibility: if it doesn't contain colons, it's not encrypted
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format (expected 3 parts)');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
