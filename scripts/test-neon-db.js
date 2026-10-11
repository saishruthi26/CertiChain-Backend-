const path = require('path');
const dotenv = require('dotenv');

// Eagerly load .env from multiple potential working directory relative paths
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env')
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

const db = require('../src/config/db');

async function testNeon() {
  console.log('--- Testing PostgreSQL / Neon Connection ---');
  
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('Error: DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  try {
    const parsed = new URL(rawUrl);
    console.log(`Target Host: ${parsed.hostname}`);
    console.log(`Target Port: ${parsed.port || '5432'}`);
    console.log(`Database Name: ${parsed.pathname.replace(/^\//, '')}`);
    console.log(`SSL Parameter: ${parsed.searchParams.get('sslmode') || 'none'}`);
  } catch (err) {
    console.error('Error parsing DATABASE_URL format.');
  }

  console.log('Attempting TCP connection to PostgreSQL pool...');
  const isConnected = await db.testConnection();

  if (isConnected) {
    console.log('SUCCESS: Successfully connected to Neon PostgreSQL Database!');
    const res = await db.query('SELECT current_database(), current_user, version()');
    console.log('Connected Database Info:', {
      database: res.rows[0].current_database,
      user: res.rows[0].current_user,
      version: res.rows[0].version.split(' ')[0]
    });
    process.exit(0);
  } else {
    console.error('FAILED: Connection test failed.');
    process.exit(1);
  }
}

testNeon().catch(err => {
  console.error('Test script exception:', err.message);
  process.exit(1);
});
