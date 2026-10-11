const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runMigration() {
  console.log('Starting CertiChain Database Migration...');
  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await db.query(sql);
    console.log('Database Migration Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
