const db = require('../db');

async function generateCertificateId(year) {
  // Count existing certificates for this year to get sequence
  const result = await db.query(
    'SELECT COUNT(*) FROM certificates WHERE certificate_id LIKE $1',
    [`CERT-${year}-%`]
  );
  const count = parseInt(result.rows[0].count, 10) + 1;
  const padded = String(count).padStart(6, '0');
  return `CERT-${year}-${padded}`;
}

module.exports = { generateCertificateId };
