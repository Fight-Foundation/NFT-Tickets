import Database from 'better-sqlite3';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

// SQLite for development
let sqliteDb: Database.Database | null = null;

// PostgreSQL for production
let pgPool: pg.Pool | null = null;

export function initDatabase() {
  if (isDev) {
    const dbPath = join(__dirname, '../../data/dev.db');
    sqliteDb = new Database(dbPath);
    
    // Create tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        nft_id INTEGER NOT NULL UNIQUE,
        wallet_address TEXT NOT NULL,
        signature TEXT NOT NULL,
        metadata TEXT,
        claimed BOOLEAN DEFAULT FALSE,
        claimed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_claims_wallet ON claims(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_claims_nft_id ON claims(nft_id);
    `);
    
    console.log('✅ SQLite database initialized');
  } else {
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Create tables for PostgreSQL
    pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        wallet_address TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        nft_id INTEGER NOT NULL UNIQUE,
        wallet_address TEXT NOT NULL,
        signature TEXT NOT NULL,
        metadata TEXT,
        claimed BOOLEAN DEFAULT FALSE,
        claimed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_claims_wallet ON claims(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_claims_nft_id ON claims(nft_id);
    `).then(() => {
      console.log('✅ PostgreSQL database initialized');
    }).catch(err => {
      console.error('❌ PostgreSQL init error:', err);
    });
  }
}

export type DbConnection = 
  | { type: 'sqlite'; db: Database.Database }
  | { type: 'postgres'; pool: pg.Pool };

export function getDb(): DbConnection {
  if (isDev) {
    if (!sqliteDb) throw new Error('SQLite database not initialized');
    return { type: 'sqlite' as const, db: sqliteDb };
  } else {
    if (!pgPool) throw new Error('PostgreSQL pool not initialized');
    return { type: 'postgres' as const, pool: pgPool };
  }
}

// Helper functions for database operations
export async function createUser(walletAddress: string) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare('INSERT INTO users (wallet_address) VALUES (?) RETURNING id');
    return stmt.get(walletAddress) as { id: number };
  } else {
    const result = await db.pool.query(
      'INSERT INTO users (wallet_address) VALUES ($1) RETURNING id',
      [walletAddress]
    );
    return result.rows[0];
  }
}

export async function getUser(walletAddress: string) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare('SELECT * FROM users WHERE wallet_address = ?');
    return stmt.get(walletAddress);
  } else {
    const result = await db.pool.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    );
    return result.rows[0];
  }
}

export async function createClaim(userId: number, nftId: number, walletAddress: string, signature: string, metadata?: string) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare(
      'INSERT INTO claims (user_id, nft_id, wallet_address, signature, metadata) VALUES (?, ?, ?, ?, ?) RETURNING *'
    );
    return stmt.get(userId, nftId, walletAddress, signature, metadata || null);
  } else {
    const result = await db.pool.query(
      'INSERT INTO claims (user_id, nft_id, wallet_address, signature, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, nftId, walletAddress, signature, metadata || null]
    );
    return result.rows[0];
  }
}

export async function getClaim(nftId: number) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare('SELECT * FROM claims WHERE nft_id = ?');
    return stmt.get(nftId);
  } else {
    const result = await db.pool.query(
      'SELECT * FROM claims WHERE nft_id = $1',
      [nftId]
    );
    return result.rows[0];
  }
}

export async function markClaimAsUsed(nftId: number) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare(
      'UPDATE claims SET claimed = TRUE, claimed_at = CURRENT_TIMESTAMP WHERE nft_id = ?'
    );
    return stmt.run(nftId);
  } else {
    await db.pool.query(
      'UPDATE claims SET claimed = TRUE, claimed_at = CURRENT_TIMESTAMP WHERE nft_id = $1',
      [nftId]
    );
  }
}

export async function getUserClaims(walletAddress: string) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare('SELECT * FROM claims WHERE wallet_address = ? ORDER BY created_at DESC');
    return stmt.all(walletAddress);
  } else {
    const result = await db.pool.query(
      'SELECT * FROM claims WHERE wallet_address = $1 ORDER BY created_at DESC',
      [walletAddress]
    );
    return result.rows;
  }
}

export async function updateClaim(nftId: number, walletAddress: string, signature: string, metadata?: string) {
  const db = getDb();
  
  if (db.type === 'sqlite') {
    const stmt = db.db.prepare(
      'UPDATE claims SET wallet_address = ?, signature = ?, metadata = ? WHERE nft_id = ? AND claimed = FALSE RETURNING *'
    );
    return stmt.get(walletAddress, signature, metadata || null, nftId);
  } else {
    const result = await db.pool.query(
      'UPDATE claims SET wallet_address = $1, signature = $2, metadata = $3 WHERE nft_id = $4 AND claimed = FALSE RETURNING *',
      [walletAddress, signature, metadata || null, nftId]
    );
    return result.rows[0];
  }
}
