import { Router } from 'express';
import { markClaimAsUsed } from '../db/index.js';
import crypto from 'crypto';

export const webhookRouter = Router();

// Alchemy webhook endpoint for Solana NFT events
webhookRouter.post('/alchemy', async (req, res) => {
  try {
    const rawBody: Buffer | undefined = (req as any).rawBody;
    const webhookSecret = process.env.ALCHEMY_WEBHOOK_SECRET;
    
    // Signature verification if webhook secret is configured
    if (webhookSecret && rawBody) {
      const receivedSig = req.headers['x-alchemy-signature'];
      if (!receivedSig || typeof receivedSig !== 'string') {
        console.warn('⚠️ Missing Alchemy signature header');
        return res.status(400).json({ error: 'Missing signature header' });
      }
      const computed = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      if (computed !== receivedSig) {
        console.warn('⚠️ Invalid Alchemy signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { webhookId, id, createdAt, type, event } = req.body;
    
    console.log(`\n📨 Alchemy webhook received`);
    console.log(`  Webhook ID: ${webhookId || id}`);
    console.log(`  Type: ${type}`);
    console.log(`  Created: ${createdAt}`);
    console.log('\nFull payload:', JSON.stringify(req.body, null, 2));

    let processed = 0;
    const programId = process.env.NFT_CONTRACT_ADDRESS || '6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG';

    // Handle NFT activity events
    if (event?.activity) {
      const activities = Array.isArray(event.activity) ? event.activity : [event.activity];
      
      for (const activity of activities) {
        console.log(`\n🔍 Processing activity:`);
        console.log(`  Type: ${activity.type}`);
        console.log(`  From: ${activity.fromAddress || 'N/A'}`);
        console.log(`  To: ${activity.toAddress || 'N/A'}`);
        console.log(`  Signature: ${activity.signature}`);

        // Check if this involves our program
        if (activity.source === programId || 
            activity.programId === programId ||
            (activity.signature && activity.toAddress)) {
          
          console.log(`  ✅ Our program detected`);
          
          let nftId: number | null = null;

          // Try to extract NFT ID from various fields
          // 1. From tokenId
          if (activity.tokenId && /^\d+$/.test(activity.tokenId)) {
            nftId = parseInt(activity.tokenId, 10);
            console.log(`  📝 Found NFT ID from tokenId: ${nftId}`);
          }
          
          // 2. From metadata name (e.g., "Fight Ticket #42")
          if (!nftId && activity.metadata?.name) {
            const match = activity.metadata.name.match(/#(\d+)/);
            if (match) {
              nftId = parseInt(match[1], 10);
              console.log(`  📝 Found NFT ID from metadata name: ${nftId}`);
            }
          }

          // 3. From NFT metadata object
          if (!nftId && activity.nftMetadata?.name) {
            const match = activity.nftMetadata.name.match(/#(\d+)/);
            if (match) {
              nftId = parseInt(match[1], 10);
              console.log(`  📝 Found NFT ID from nftMetadata: ${nftId}`);
            }
          }

          if (nftId !== null && !isNaN(nftId)) {
            try {
              await markClaimAsUsed(nftId);
              processed++;
              console.log(`  ✅ Marked claim ${nftId} as used`);
            } catch (e) {
              console.warn(`  ⚠️ Failed to mark claim ${nftId} as used:`, (e as Error).message);
            }
          } else {
            console.log(`  ⚠️ Could not extract NFT ID from activity`);
          }
        } else {
          console.log(`  ⏭️  Skipping - not our program`);
        }
      }
    }

    console.log(`\n📊 Processed ${processed} claim(s)\n`);
    res.json({ success: true, processed, webhookId: webhookId || id });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Health check for webhooks
webhookRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', endpoint: 'webhook' });
});
