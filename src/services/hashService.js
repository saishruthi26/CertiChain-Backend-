const crypto = require('crypto');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Creates canonical payload string for a certificate.
 */
function createCanonicalString(data) {
  const {
    certificate_id,
    student_id,
    student_name,
    course,
    institution_name,
    issue_date,
    certificate_type
  } = data;

  let formattedDate = '';
  if (issue_date) {
    if (typeof issue_date === 'string') {
      formattedDate = issue_date.split('T')[0];
    } else if (issue_date instanceof Date) {
      const y = issue_date.getFullYear();
      const m = String(issue_date.getMonth() + 1).padStart(2, '0');
      const d = String(issue_date.getDate()).padStart(2, '0');
      formattedDate = `${y}-${m}-${d}`;
    } else {
      formattedDate = String(issue_date).split('T')[0];
    }
  }

  return [
    certificate_id,
    student_id,
    (student_name || '').trim(),
    (course || '').trim(),
    (institution_name || '').trim(),
    formattedDate,
    (certificate_type || '').trim()
  ].join('|');
}

/**
 * Calculates SHA-256 hash of a string input.
 */
function calculateSHA256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generates initial certificate hash from canonical string.
 */
function generateCertificateHash(certificateData) {
  const canonicalString = createCanonicalString(certificateData);
  return calculateSHA256(canonicalString);
}

/**
 * Generates chain hash combining certificate hash and previous certificate's current_hash.
 */
function generateChainHash(certificateHash, previousHash = GENESIS_HASH) {
  const combined = `${certificateHash}:${previousHash || GENESIS_HASH}`;
  return calculateSHA256(combined);
}

/**
 * Verifies certificate integrity against stored hashes.
 */
function verifyCertificateIntegrity(storedCertificate, expectedInstitutionName) {
  const canonicalString = createCanonicalString({
    certificate_id: storedCertificate.certificate_id,
    student_id: storedCertificate.student_code || storedCertificate.student_id,
    student_name: storedCertificate.student_name,
    course: storedCertificate.course,
    institution_name: expectedInstitutionName || storedCertificate.institution_name,
    issue_date: storedCertificate.issue_date,
    certificate_type: storedCertificate.certificate_type
  });

  const recomputedCertHash = calculateSHA256(canonicalString);
  const recomputedCurrentHash = generateChainHash(recomputedCertHash, storedCertificate.previous_hash);

  const isCertHashValid = recomputedCertHash === storedCertificate.certificate_hash;
  const isChainHashValid = recomputedCurrentHash === storedCertificate.current_hash;

  return {
    isValid: isCertHashValid && isChainHashValid,
    isCertHashValid,
    isChainHashValid,
    recomputedCertHash,
    recomputedCurrentHash,
    storedCertHash: storedCertificate.certificate_hash,
    storedCurrentHash: storedCertificate.current_hash
  };
}

module.exports = {
  GENESIS_HASH,
  createCanonicalString,
  calculateSHA256,
  generateCertificateHash,
  generateChainHash,
  verifyCertificateIntegrity
};
