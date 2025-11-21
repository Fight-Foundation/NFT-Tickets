import { Router } from 'express';
import { markClaimAsUsed, getClaim } from '../db/index.js';

export const webhookRouter = Router();

// Alchemy webhook endpoint for NFT mint events
webhookRouter.post('/alchemy', async (req, res) => {
  try {
    // Verify webhook signature if configured
    const webhookSecret = process.env.ALCHEMY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-alchemy-signature'];
      // TODO: Implement signature verification
    }
    
    const { event, webhookId } = req.body;
    
    console.log('📨 Alchemy webhook received:', webhookId);
    
    // Handle NFT mint/transfer events
    if (event?.activity) {
      const activities = Array.isArray(event.activity) ? event.activity : [event.activity];
      
      for (const activity of activities) {
        if (activity.category === 'token' && activity.toAddress) {
          // Extract NFT ID from metadata or token
          // This depends on your NFT structure
          console.log('🎫 NFT activity detected:', activity);
          
          // Mark claim as used if we can identify the NFT ID
          // const nftId = extractNftId(activity);
          // if (nftId !== null) {
          //   await markClaimAsUsed(nftId);
          // }
        }
      }
    }
    
    res.json({ success: true, processed: true });
    
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Health check for webhooks
webhookRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', endpoint: 'webhook' });
});
