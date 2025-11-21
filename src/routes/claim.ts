import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createUser, getUser, createClaim, getUserClaims } from '../db/index.js';
import { generateClaimProof } from '../utils/signature.js';

export const claimRouter = Router();

// Generate claim proof for a user
claimRouter.post('/generate', async (req, res, next) => {
  try {
    const { walletAddress, nftId, metadata } = req.body;
    
    if (!walletAddress || nftId === undefined || !metadata) {
      return res.status(400).json({ error: 'walletAddress, nftId, and metadata are required' });
    }
    
    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }
    
    // Validate NFT ID range
    if (nftId < 0 || nftId >= 10000) {
      return res.status(400).json({ error: 'NFT ID must be between 0 and 9999' });
    }
    
    // Validate and stringify metadata
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      return res.status(400).json({ error: 'metadata must be a JSON object' });
    }
    const metadataString = JSON.stringify(metadata);
    
    // Get or create user
    let user = await getUser(walletAddress);
    if (!user) {
      user = await createUser(walletAddress);
    }
    
    // Generate Ed25519 signature proof
    const { signature, publicKey } = generateClaimProof(nftId, walletAddress);
    
    // Store claim in database with metadata
    const claim = await createClaim(user.id, nftId, walletAddress, signature, metadataString);
    
    res.json({
      nftId,
      walletAddress,
      signature,
      signerPublicKey: publicKey,
      claimId: claim.id,
      message: 'Claim proof generated successfully'
    });
    
  } catch (err) {
    next(err);
  }
});

// Get user's claims
claimRouter.get('/user/:walletAddress', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    
    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }
    
    const claims = await getUserClaims(walletAddress);
    
    res.json({
      walletAddress,
      claims: claims.map((claim: any) => ({
        nftId: claim.nft_id,
        signature: claim.signature,
        claimed: claim.claimed,
        claimedAt: claim.claimed_at,
        createdAt: claim.created_at
      }))
    });
    
  } catch (err) {
    next(err);
  }
});
