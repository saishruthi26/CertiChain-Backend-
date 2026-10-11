const db = require('../src/config/db');
const { verifyCertificateIntegrity, createCanonicalString, calculateSHA256, generateChainHash } = require('../src/services/hashService');

async function debugCert() {
  const res = await db.query(
    `SELECT 
        c.*,
        s.student_name,
        s.student_id AS student_code,
        s.email AS student_email,
        s.course,
        s.department,
        s.graduation_year,
        i.institution_name,
        i.institution_code
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      JOIN institutions i ON c.institution_id = i.id
      WHERE c.certificate_id = $1`,
    ['CERT-2026-000001']
  );

  const cert = res.rows[0];
  console.log('--- DB Record ---');
  console.log('issue_date raw:', cert.issue_date, typeof cert.issue_date);
  console.log('stored certificate_hash:', cert.certificate_hash);
  console.log('stored current_hash:    ', cert.current_hash);

  const canonicalStr = createCanonicalString({
    certificate_id: cert.certificate_id,
    student_id: cert.student_code || cert.student_id,
    student_name: cert.student_name,
    course: cert.course,
    institution_name: cert.institution_name,
    issue_date: cert.issue_date,
    certificate_type: cert.certificate_type
  });

  const recomputedCertHash = calculateSHA256(canonicalStr);
  const recomputedChainHash = generateChainHash(recomputedCertHash, cert.previous_hash);

  console.log('\n--- Recomputed ---');
  console.log('Canonical String:      ', canonicalStr);
  console.log('recomputedCertHash:    ', recomputedCertHash);
  console.log('recomputedChainHash:   ', recomputedChainHash);

  console.log('\nMatches Cert Hash?:    ', recomputedCertHash === cert.certificate_hash);
  console.log('Matches Chain Hash?:   ', recomputedChainHash === cert.current_hash);

  process.exit(0);
}

debugCert().catch(err => {
  console.error(err);
  process.exit(1);
});
