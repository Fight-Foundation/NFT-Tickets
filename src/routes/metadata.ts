import { Router } from 'express';
import { getClaim } from '../db/index.js';

export const metadataRouter = Router();

// Get metadata for an NFT by ID
metadataRouter.get('/:id.json', async (req, res, next) => {
  try {
    const nftId = parseInt(req.params.id);
    
    // Validate NFT ID
    if (isNaN(nftId) || nftId < 0 || nftId >= 10000) {
      return res.status(404).json({ error: 'Invalid NFT ID' });
    }
    
    // Try to find a claim with custom metadata
    const claim = await getClaim(nftId);
    
    if (claim && claim.metadata) {
      // Serve custom metadata from database
      const metadata = JSON.parse(claim.metadata);
      return res.json(metadata);
    }
    
    // Serve default metadata from environment
    const defaultMetadata = {
      name: process.env.DEFAULT_METADATA_NAME || `Fight Ticket #${nftId}`,
      description: process.env.DEFAULT_METADATA_DESCRIPTION || 'Soulbound NFT ticket for fight events',
      image: process.env.DEFAULT_METADATA_IMAGE || `https://ticketsnft.fight.foundation/images/${nftId}.png`,
      attributes: [
        {
          trait_type: 'NFT ID',
          value: nftId
        },
        {
          trait_type: 'Type',
          value: 'Soulbound Ticket'
        }
      ]
    };
    
    res.json(defaultMetadata);
    
  } catch (err) {
    next(err);
  }
});
