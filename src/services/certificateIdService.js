const pool = require('../db/pool');

async function generateCertificateId() {
  const year = new Date().getFullYear();
  // Get the count of certificates for this year
  const result = await pool.query(
    "SELECT COUNT(*) FROM certificates WHERE certificate_id LIKE $1",
    [`CERT-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  const paddedCount = String(count).padStart(6, '0');
  const certId = `CERT-${year}-${paddedCount}`;
  
  // Verify uniqueness
  const existing = await pool.query(
    'SELECT id FROM certificates WHERE certificate_id = $1',
    [certId]
  );
  if (existing.rows.length > 0) {
    // Fallback: use UUID-based suffix
    const { v4: uuidv4 } = require('uuid');
    return `CERT-${year}-${uuidv4().substring(0, 6).toUpperCase()}`;
  }
  return certId;
}

module.exports = { generateCertificateId };
