import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { claimRouter } from '../src/routes/claim.js';
import { metadataRouter } from '../src/routes/metadata.js';
import { initDatabase } from '../src/db/index.js';

const app = express();
app.use(express.json());

// Metadata endpoint (public, no auth)
app.use('/metadata', metadataRouter);

// Mock API key middleware for protected routes
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'test_api_key') {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
};

app.use('/api/claim', apiKeyMiddleware, claimRouter);

describe('Claim API', () => {
  beforeAll(() => {
    // Set test environment
    process.env.API_KEY = 'test_api_key';
    process.env.NODE_ENV = 'development';
    initDatabase();
  });

  const validWallet = 'HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft';
  const validMetadata = {
    name: 'Fight Ticket #42',
    description: 'VIP access to the championship fight',
    image: 'https://example.com/ticket-42.png',
    attributes: [
      { trait_type: 'Event', value: 'Championship Fight' },
      { trait_type: 'Seat', value: 'VIP-A12' }
    ]
  };

  describe('POST /api/claim/generate', () => {
    it('should generate a claim proof with valid inputs', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 42,
          metadata: validMetadata
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('nftId', 42);
      expect(response.body).toHaveProperty('walletAddress', validWallet);
      expect(response.body).toHaveProperty('signature');
      expect(response.body).toHaveProperty('signerPublicKey');
      expect(response.body).toHaveProperty('claimId');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject request without API key', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .send({
          walletAddress: validWallet,
          nftId: 42,
          metadata: validMetadata
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with invalid API key', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'wrong_key')
        .send({
          walletAddress: validWallet,
          nftId: 42,
          metadata: validMetadata
        });

      expect(response.status).toBe(401);
    });

    it('should reject request without walletAddress', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          nftId: 42,
          metadata: validMetadata
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('walletAddress');
    });

    it('should reject request without nftId', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          metadata: validMetadata
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('nftId');
    });

    it('should reject invalid wallet address', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: 'invalid_wallet',
          nftId: 42,
          metadata: validMetadata
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Solana wallet address');
    });

    it('should reject NFT ID out of range (negative)', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: -1,
          metadata: validMetadata
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('NFT ID must be between 0 and 9999');
    });

    it('should reject NFT ID out of range (too high)', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 10000,
          metadata: validMetadata
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('NFT ID must be between 0 and 9999');
    });

    it('should accept NFT ID at lower boundary (0)', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 0,
          metadata: validMetadata
        });

      expect(response.status).toBe(200);
      expect(response.body.nftId).toBe(0);
    });

    it('should accept NFT ID at upper boundary (9999)', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 9999,
          metadata: validMetadata
        });

      expect(response.status).toBe(200);
      expect(response.body.nftId).toBe(9999);
    });

    it('should create user if not exists', async () => {
      const newWallet = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: newWallet,
          nftId: 123,
          metadata: validMetadata
        });

      expect(response.status).toBe(200);
      expect(response.body.walletAddress).toBe(newWallet);
    });

    it('should reject request without metadata', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 42
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('metadata');
    });

    it('should reject metadata as string', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 42,
          metadata: 'invalid string'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('metadata must be a JSON object');
    });

    it('should reject metadata as array', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 42,
          metadata: ['invalid', 'array']
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('metadata must be a JSON object');
    });

    it('should reject null metadata', async () => {
      const response = await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 42,
          metadata: null
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('metadata');
    });
  });

  describe('GET /api/claim/user/:walletAddress', () => {
    beforeAll(async () => {
      // Generate some claims for testing
      await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 100,
          metadata: validMetadata
        });

      await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 101,
          metadata: validMetadata
        });
    });

    it('should get user claims with valid wallet', async () => {
      const response = await request(app)
        .get(`/api/claim/user/${validWallet}`)
        .set('X-API-Key', 'test_api_key');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('walletAddress', validWallet);
      expect(response.body).toHaveProperty('claims');
      expect(Array.isArray(response.body.claims)).toBe(true);
      expect(response.body.claims.length).toBeGreaterThan(0);
    });

    it('should reject request without API key', async () => {
      const response = await request(app)
        .get(`/api/claim/user/${validWallet}`);

      expect(response.status).toBe(401);
    });

    it('should reject invalid wallet address', async () => {
      const response = await request(app)
        .get('/api/claim/user/invalid_wallet')
        .set('X-API-Key', 'test_api_key');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Solana wallet address');
    });

    it('should return empty claims for new wallet', async () => {
      const newWallet = 'GjJyeC1r3WzN7FmLkFN8Q3pwJwzBvN9H7jXKpN1gm2Ts';
      const response = await request(app)
        .get(`/api/claim/user/${newWallet}`)
        .set('X-API-Key', 'test_api_key');

      expect(response.status).toBe(200);
      expect(response.body.claims).toEqual([]);
    });

    it('should return claims with proper structure', async () => {
      const response = await request(app)
        .get(`/api/claim/user/${validWallet}`)
        .set('X-API-Key', 'test_api_key');

      expect(response.status).toBe(200);
      const claim = response.body.claims[0];
      expect(claim).toHaveProperty('nftId');
      expect(claim).toHaveProperty('signature');
      expect(claim).toHaveProperty('claimed');
      expect(claim).toHaveProperty('claimedAt');
      expect(claim).toHaveProperty('createdAt');
    });
  });

  describe('GET /metadata/:id.json', () => {
    beforeAll(() => {
      // Set default metadata env vars
      process.env.DEFAULT_METADATA_NAME = 'Fight Ticket #{id}';
      process.env.DEFAULT_METADATA_DESCRIPTION = 'Soulbound NFT ticket for fight events';
      process.env.DEFAULT_METADATA_IMAGE = 'https://ticketsnft.fight.foundation/images/{id}.png';
    });

    it('should return default metadata for unclaimed NFT', async () => {
      const nftId = 999;
      const response = await request(app)
        .get(`/metadata/${nftId}.json`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('image');
      expect(response.body).toHaveProperty('attributes');
      expect(Array.isArray(response.body.attributes)).toBe(true);
    });

    it('should return custom metadata for claimed NFT', async () => {
      const customMetadata = {
        name: 'VIP Championship Ticket #500',
        description: 'Premium ringside seat',
        image: 'https://custom.example.com/ticket-500.png',
        attributes: [
          { trait_type: 'Seat', value: 'Ringside A1' },
          { trait_type: 'Access', value: 'VIP' }
        ]
      };

      // Create a claim with custom metadata
      await request(app)
        .post('/api/claim/generate')
        .set('X-API-Key', 'test_api_key')
        .send({
          walletAddress: validWallet,
          nftId: 500,
          metadata: customMetadata
        });

      // Fetch metadata
      const response = await request(app)
        .get('/metadata/500.json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(customMetadata);
    });

    it('should reject invalid NFT ID (negative)', async () => {
      const response = await request(app)
        .get('/metadata/-1.json');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Invalid NFT ID');
    });

    it('should reject NFT ID out of range', async () => {
      const response = await request(app)
        .get('/metadata/10000.json');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Invalid NFT ID');
    });

    it('should handle non-numeric ID', async () => {
      const response = await request(app)
        .get('/metadata/abc.json');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Invalid NFT ID');
    });
  });
});
