import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/index.js';
import { claimRouter } from './routes/claim.js';
import { webhookRouter } from './routes/webhook.js';
import { metadataRouter } from './routes/metadata.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiKeyAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Capture raw body for webhook signature verification before JSON parsing
app.use(express.json({
  verify: (req, _res, buf) => {
    // @ts-ignore attach rawBody for HMAC verification in webhook route
    req.rawBody = buf;
  }
}));

// Initialize database
initDatabase();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/claim', apiKeyAuth, claimRouter);
app.use('/api/webhook', webhookRouter);
app.use('/metadata', metadataRouter); // Public endpoint, no auth

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Solana RPC: ${process.env.SOLANA_RPC_URL}`);
});
