const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runSeed() {
  console.log('Seeding CertiChain Demo Data...');
  try {
    const seedPath = path.join(__dirname, '../../database/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    await db.query(sql);
    console.log('Demo Data Seeded Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
}

runSeed();
