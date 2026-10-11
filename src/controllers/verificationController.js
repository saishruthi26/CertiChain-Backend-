const db = require('../config/db');
const { verifyCertificateIntegrity } = require('../services/hashService');
const { generateVerificationQRCode } = require('../services/qrService');

/**
 * Verify Certificate by Certificate ID or QR Code Scan
 * GET /api/verify/:certificate_id or POST /api/verify
 */
async function verifyCertificate(req, res, next) {
  try {
    const certificate_id = (req.params.certificate_id || req.body.certificate_id || '').trim();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Verifier';

    if (!certificate_id) {
      return res.status(400).json({
        success: false,
        message: 'Certificate ID is required for verification.'
      });
    }

    // Lookup certificate in DB
    const result = await db.query(
      `
      SELECT 
        c.*,
        s.student_name,
        s.student_id AS student_code,
        s.email AS student_email,
        s.course,
        s.department,
        s.graduation_year,
        i.institution_name,
        i.institution_code,
        i.email AS institution_email
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      JOIN institutions i ON c.institution_id = i.id
      WHERE c.certificate_id = $1 OR c.id::text = $1
      `,
      [certificate_id]
    );

    // Case 1: NOT FOUND
    if (result.rows.length === 0) {
      // Record verification log
      await db.query(
        `INSERT INTO verification_logs (certificate_id, verification_result, integrity_result, ip_address, user_agent)
         VALUES ($1, 'NOT_FOUND', 'N/A', $2, $3)`,
        [certificate_id, clientIp, userAgent]
      );

      return res.status(404).json({
        success: false,
        status: 'NOT_FOUND',
        message: 'Certificate Not Found. The provided Certificate ID is invalid or does not exist in our portal.',
        details: null
      });
    }

    const cert = result.rows[0];

    // Verify SHA-256 integrity
    const integrityCheck = verifyCertificateIntegrity(cert, cert.institution_name);

    // Generate QR Info for visual certificate display
    const qrInfo = await generateVerificationQRCode(cert.certificate_id, req.headers.origin || process.env.FRONTEND_URL);

    // Case 2: TAMPERED (Integrity check failed)
    if (!integrityCheck.isValid) {
      await db.query(
        `INSERT INTO verification_logs (certificate_id, verification_result, integrity_result, ip_address, user_agent)
         VALUES ($1, 'TAMPERED', 'FAILED', $2, $3)`,
        [cert.certificate_id, clientIp, userAgent]
      );

      return res.status(400).json({
        success: false,
        status: 'TAMPERED',
        integrity: 'FAILED',
        message: 'Certificate Integrity Check Failed! Data tampering detected. The stored security hash does not match.',
        certificate: {
          certificate_id: cert.certificate_id,
          student_name: cert.student_name,
          student_code: cert.student_code,
          course: cert.course,
          institution_name: cert.institution_name,
          issue_date: cert.issue_date,
          certificate_type: cert.certificate_type,
          status: cert.status,
          revoked_at: cert.revoked_at,
          revocation_reason: cert.revocation_reason,
          qr_code: qrInfo.qrDataUrl
        }
      });
    }

    // Case 3: REVOKED
    if (cert.status === 'REVOKED') {
      await db.query(
        `INSERT INTO verification_logs (certificate_id, verification_result, integrity_result, ip_address, user_agent)
         VALUES ($1, 'REVOKED', 'PASSED', $2, $3)`,
        [cert.certificate_id, clientIp, userAgent]
      );

      return res.status(200).json({
        success: true,
        status: 'REVOKED',
        integrity: 'PASSED',
        message: 'Certificate Has Been Revoked by the issuing institution.',
        certificate: {
          certificate_id: cert.certificate_id,
          student_name: cert.student_name,
          student_code: cert.student_code,
          course: cert.course,
          department: cert.department,
          graduation_year: cert.graduation_year,
          institution_name: cert.institution_name,
          institution_code: cert.institution_code,
          issue_date: cert.issue_date,
          certificate_type: cert.certificate_type,
          status: 'REVOKED',
          revoked_at: cert.revoked_at,
          revocation_reason: cert.revocation_reason,
          certificate_hash: cert.certificate_hash,
          current_hash: cert.current_hash,
          qr_code: qrInfo.qrDataUrl,
          verification_url: qrInfo.verificationUrl
        }
      });
    }

    // Case 4: VALID
    await db.query(
      `INSERT INTO verification_logs (certificate_id, verification_result, integrity_result, ip_address, user_agent)
       VALUES ($1, 'VALID', 'PASSED', $2, $3)`,
      [cert.certificate_id, clientIp, userAgent]
    );

    res.status(200).json({
      success: true,
      status: 'VALID',
      integrity: 'PASSED',
      message: 'Certificate Verified Successfully!',
      certificate: {
        certificate_id: cert.certificate_id,
        student_name: cert.student_name,
        student_code: cert.student_code,
        student_email: cert.student_email,
        course: cert.course,
        department: cert.department,
        graduation_year: cert.graduation_year,
        institution_name: cert.institution_name,
        institution_code: cert.institution_code,
        institution_email: cert.institution_email,
        issue_date: cert.issue_date,
        certificate_type: cert.certificate_type,
        status: 'VALID',
        certificate_hash: cert.certificate_hash,
        previous_hash: cert.previous_hash,
        current_hash: cert.current_hash,
        qr_code: qrInfo.qrDataUrl,
        verification_url: qrInfo.verificationUrl
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verifyCertificate
};
