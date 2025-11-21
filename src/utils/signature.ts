import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';

export function generateClaimProof(nftId: number, recipientAddress: string) {
  // Get signer keypair from environment
  const privateKeyBase58 = process.env.SIGNING_PRIVATE_KEY;
  if (!privateKeyBase58) {
    throw new Error('SIGNING_PRIVATE_KEY not configured');
  }
  
  // Decode private key from base58
  const privateKey = bs58.decode(privateKeyBase58);
  
  // Create message: hash(recipient + nftId)
  const recipientPubkey = new PublicKey(recipientAddress);
  const nftIdBytes = Buffer.alloc(4);
  nftIdBytes.writeUInt32LE(nftId, 0);
  
  const message = Buffer.concat([
    recipientPubkey.toBuffer(),
    nftIdBytes
  ]);
  
  // Hash the message with SHA-256
  const messageHash = crypto.createHash('sha256').update(message).digest();
  
  // Sign with Ed25519
  const signature = nacl.sign.detached(messageHash, privateKey);
  
  // Get public key from private key
  const keypair = nacl.sign.keyPair.fromSecretKey(privateKey);
  const publicKey = bs58.encode(keypair.publicKey);
  
  return {
    signature: Buffer.from(signature).toString('hex'),
    publicKey
  };
}

export function verifyClaimProof(
  signature: string,
  nftId: number,
  recipientAddress: string,
  signerPublicKey: string
): boolean {
  try {
    // Recreate the message
    const recipientPubkey = new PublicKey(recipientAddress);
    const nftIdBytes = Buffer.alloc(4);
    nftIdBytes.writeUInt32LE(nftId, 0);
    
    const message = Buffer.concat([
      recipientPubkey.toBuffer(),
      nftIdBytes
    ]);
    
    const messageHash = crypto.createHash('sha256').update(message).digest();
    
    // Verify signature
    const signatureBytes = Buffer.from(signature, 'hex');
    const publicKeyBytes = bs58.decode(signerPublicKey);
    
    return nacl.sign.detached.verify(messageHash, signatureBytes, publicKeyBytes);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}
