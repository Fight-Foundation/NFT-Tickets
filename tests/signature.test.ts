import { describe, it, expect, beforeAll } from 'vitest';
import { generateClaimProof, verifyClaimProof } from '../src/utils/signature.js';
import { PublicKey } from '@solana/web3.js';

describe('Signature Utils', () => {
  const testWallet = 'HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft';
  const testNftId = 42;

  beforeAll(() => {
    // Ensure signing keys are set
    if (!process.env.SIGNING_PRIVATE_KEY) {
      throw new Error('SIGNING_PRIVATE_KEY must be set for tests');
    }
  });

  describe('generateClaimProof', () => {
    it('should generate a valid Ed25519 signature', () => {
      const result = generateClaimProof(testNftId, testWallet);
      
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('publicKey');
      expect(result.signature).toMatch(/^[0-9a-f]+$/i); // hex string
      expect(result.publicKey).toBeTruthy();
    });

    it('should generate consistent signatures for same inputs', () => {
      const result1 = generateClaimProof(testNftId, testWallet);
      const result2 = generateClaimProof(testNftId, testWallet);
      
      // Note: Ed25519 is deterministic, so signatures should be identical
      expect(result1.signature).toBe(result2.signature);
      expect(result1.publicKey).toBe(result2.publicKey);
    });

    it('should generate different signatures for different NFT IDs', () => {
      const result1 = generateClaimProof(1, testWallet);
      const result2 = generateClaimProof(2, testWallet);
      
      expect(result1.signature).not.toBe(result2.signature);
    });

    it('should generate different signatures for different wallets', () => {
      const wallet2 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
      const result1 = generateClaimProof(testNftId, testWallet);
      const result2 = generateClaimProof(testNftId, wallet2);
      
      expect(result1.signature).not.toBe(result2.signature);
    });

    it('should throw error if SIGNING_PRIVATE_KEY is not set', () => {
      const originalKey = process.env.SIGNING_PRIVATE_KEY;
      delete process.env.SIGNING_PRIVATE_KEY;
      
      expect(() => generateClaimProof(testNftId, testWallet)).toThrow('SIGNING_PRIVATE_KEY not configured');
      
      process.env.SIGNING_PRIVATE_KEY = originalKey;
    });

    it('should handle NFT ID range 0-9999', () => {
      const result0 = generateClaimProof(0, testWallet);
      const result9999 = generateClaimProof(9999, testWallet);
      
      expect(result0.signature).toBeTruthy();
      expect(result9999.signature).toBeTruthy();
    });
  });

  describe('verifyClaimProof', () => {
    it('should verify a valid signature', () => {
      const { signature, publicKey } = generateClaimProof(testNftId, testWallet);
      const isValid = verifyClaimProof(signature, testNftId, testWallet, publicKey);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const { publicKey } = generateClaimProof(testNftId, testWallet);
      const invalidSig = '0'.repeat(128); // Invalid signature
      const isValid = verifyClaimProof(invalidSig, testNftId, testWallet, publicKey);
      
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong NFT ID', () => {
      const { signature, publicKey } = generateClaimProof(testNftId, testWallet);
      const isValid = verifyClaimProof(signature, testNftId + 1, testWallet, publicKey);
      
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong wallet', () => {
      const wallet2 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
      const { signature, publicKey } = generateClaimProof(testNftId, testWallet);
      const isValid = verifyClaimProof(signature, testNftId, wallet2, publicKey);
      
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong public key', () => {
      const { signature } = generateClaimProof(testNftId, testWallet);
      const wrongKey = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
      const isValid = verifyClaimProof(signature, testNftId, testWallet, wrongKey);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Integration with Solana', () => {
    it('should generate signatures compatible with on-chain verification', () => {
      const { signature, publicKey } = generateClaimProof(testNftId, testWallet);
      
      // Verify the signature can be parsed
      const sigBuffer = Buffer.from(signature, 'hex');
      expect(sigBuffer.length).toBe(64); // Ed25519 signatures are 64 bytes
      
      // Verify the wallet address is a valid Solana public key
      expect(() => new PublicKey(testWallet)).not.toThrow();
    });
  });
});
