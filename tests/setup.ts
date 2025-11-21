import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

beforeAll(() => {
  console.log('🧪 Test environment initialized');
});

afterAll(() => {
  console.log('✅ Tests completed');
});
