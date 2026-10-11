const crypto = require('crypto');

/**
 * Generates a unique collision-safe Certificate ID.
 * Format: CERT-YYYY-XXXXXX (e.g. CERT-2026-000001 or CERT-2026-8A9F12)
 */
function generateCertificateId() {
  const currentYear = new Date().getFullYear();
  // Generate 6 uppercase random hex characters
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CERT-${currentYear}-${randomHex}`;
}

/**
 * Generates sequential formatted ID given a numeric count
 * Format: CERT-2026-000001
 */
function generateSequentialCertificateId(sequenceNumber) {
  const currentYear = new Date().getFullYear();
  const paddedSeq = String(sequenceNumber).padStart(6, '0');
  return `CERT-${currentYear}-${paddedSeq}`;
}

module.exports = {
  generateCertificateId,
  generateSequentialCertificateId
};
