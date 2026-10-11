const assert = require('assert');
const { generateCertificateId, generateSequentialCertificateId } = require('../src/utils/idGenerator');
const { createCanonicalString, calculateSHA256, generateCertificateHash, generateChainHash, verifyCertificateIntegrity } = require('../src/services/hashService');
const { generateVerificationQRCode } = require('../src/services/qrService');

console.log('===================================================');
console.log(' Running CertiChain Comprehensive Verification Suite');
console.log('===================================================\n');

async function testUnitFunctions() {
  console.log('--- 1. Testing ID Generators ---');
  const certId1 = generateCertificateId();
  console.log('Generated Random Cert ID:', certId1);
  assert(certId1.startsWith('CERT-'), 'Cert ID must start with CERT-');

  const certIdSeq = generateSequentialCertificateId(1);
  console.log('Generated Sequential Cert ID:', certIdSeq);
  assert.strictEqual(certIdSeq, `CERT-${new Date().getFullYear()}-000001`, 'Sequential ID format check passed');
  console.log('✔ ID Generation Passed\n');

  console.log('--- 2. Testing SHA-256 Hashing & Tamper Detection ---');
  const sampleCert = {
    certificate_id: 'CERT-2026-000001',
    student_id: 'STU2026001',
    student_name: 'Rahul Kumar',
    course: 'B.Tech Computer Science',
    institution_name: 'ABC University',
    issue_date: '2026-10-07',
    certificate_type: 'Bachelor Degree'
  };

  const canonicalStr = createCanonicalString(sampleCert);
  console.log('Canonical Payload String:', canonicalStr);

  const certHash = generateCertificateHash(sampleCert);
  console.log('Computed SHA-256 Cert Hash:', certHash);

  const chainHash = generateChainHash(certHash, '0000000000000000000000000000000000000000000000000000000000000000');
  console.log('Computed SHA-256 Chain Hash:', chainHash);

  // Test integrity verification on intact data
  const intactCheck = verifyCertificateIntegrity({
    ...sampleCert,
    student_code: sampleCert.student_id,
    previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    certificate_hash: certHash,
    current_hash: chainHash
  }, 'ABC University');

  assert.strictEqual(intactCheck.isValid, true, 'Intact certificate integrity check must pass');
  console.log('✔ Intact Data Hash Verification Passed');

  // Test integrity verification on TAMPERED data (e.g. course changed to M.Tech)
  const tamperedCheck = verifyCertificateIntegrity({
    ...sampleCert,
    course: 'M.Tech Computer Science (Tampered Grade)', // Altered!
    student_code: sampleCert.student_id,
    previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    certificate_hash: certHash, // Old hash
    current_hash: chainHash
  }, 'ABC University');

  assert.strictEqual(tamperedCheck.isValid, false, 'Tampered certificate integrity check must fail');
  console.log('✔ Tampered Data Detection Check Passed (Integrity correctly failed)\n');

  console.log('--- 3. Testing QR Code Generator ---');
  const qrInfo = await generateVerificationQRCode('CERT-2026-000001', 'https://certichain-frontend.vercel.app');
  assert(qrInfo.qrDataUrl.startsWith('data:image/png;base64,'), 'QR Data URL must be a valid PNG base64 string');
  assert.strictEqual(qrInfo.verificationUrl, 'https://certichain-frontend.vercel.app/verify/CERT-2026-000001');
  console.log('Generated Verification URL:', qrInfo.verificationUrl);
  console.log('✔ QR Code Generation Passed\n');

  console.log('===================================================');
  console.log(' ALL CERTICHAIN CORE UNIT TESTS PASSED SUCCESSFULLY! ');
  console.log('===================================================');
}

testUnitFunctions().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
