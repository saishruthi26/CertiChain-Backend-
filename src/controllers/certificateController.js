const db = require('../config/db');
const { generateCertificateId, generateSequentialCertificateId } = require('../utils/idGenerator');
const { generateCertificateHash, generateChainHash, GENESIS_HASH } = require('../services/hashService');
const { generateVerificationQRCode } = require('../services/qrService');

/**
 * Issue new Digital Certificate
 * POST /api/certificates
 */
async function createCertificate(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const {
      student_id,
      student_name,
      email,
      course,
      department,
      graduation_year,
      certificate_type,
      issue_date
    } = req.body;

    // Validation
    if (!student_name || !course || !certificate_type || !issue_date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student name, course, certificate type, and issue date.'
      });
    }

    // Fetch institution info
    const instResult = await db.query(
      'SELECT id, institution_name, institution_code FROM institutions WHERE id = $1',
      [institution_id]
    );

    if (instResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Institution record not found.'
      });
    }

    const institution = instResult.rows[0];

    // Find or create student
    let dbStudentId;
    let studentCode = student_id || `STU-${Date.now()}`;

    const studentCheck = await db.query(
      'SELECT id, student_id FROM students WHERE institution_id = $1 AND (student_id = $2 OR email = $3)',
      [institution_id, studentCode, (email || '').toLowerCase()]
    );

    if (studentCheck.rows.length > 0) {
      dbStudentId = studentCheck.rows[0].id;
      studentCode = studentCheck.rows[0].student_id;
    } else {
      const newStudent = await db.query(
        `INSERT INTO students (institution_id, student_id, student_name, email, course, department, graduation_year)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, student_id`,
        [
          institution_id,
          studentCode,
          student_name.trim(),
          (email || `${studentCode.toLowerCase()}@${institution.institution_code.toLowerCase()}.edu`).trim(),
          course.trim(),
          department ? department.trim() : null,
          graduation_year ? parseInt(graduation_year, 10) : new Date().getFullYear()
        ]
      );
      dbStudentId = newStudent.rows[0].id;
    }

    // Count existing certificates for sequential ID or fallback generator
    const countResult = await db.query(
      'SELECT COUNT(*) FROM certificates'
    );
    const nextSeq = parseInt(countResult.rows[0].count, 10) + 1;
    const certId = generateSequentialCertificateId(nextSeq);

    // Get previous certificate's current_hash for hash-chaining
    const lastCertResult = await db.query(
      'SELECT current_hash FROM certificates ORDER BY id DESC LIMIT 1'
    );
    const previousHash = lastCertResult.rows.length > 0 ? lastCertResult.rows[0].current_hash : GENESIS_HASH;

    // Calculate SHA-256 certificate hash of canonical string representation
    const certificateHash = generateCertificateHash({
      certificate_id: certId,
      student_id: studentCode,
      student_name: student_name.trim(),
      course: course.trim(),
      institution_name: institution.institution_name,
      issue_date,
      certificate_type: certificate_type.trim()
    });

    // Calculate chain current_hash = SHA256(certificate_hash + previous_hash)
    const currentHash = generateChainHash(certificateHash, previousHash);

    // Save to Database
    const insertResult = await db.query(
      `INSERT INTO certificates (
        certificate_id,
        institution_id,
        student_id,
        certificate_type,
        issue_date,
        status,
        certificate_hash,
        previous_hash,
        current_hash
      )
      VALUES ($1, $2, $3, $4, $5, 'VALID', $6, $7, $8)
      RETURNING *`,
      [
        certId,
        institution_id,
        dbStudentId,
        certificate_type.trim(),
        issue_date,
        certificateHash,
        previousHash,
        currentHash
      ]
    );

    const savedCert = insertResult.rows[0];

    // Generate Verification QR Code
    const qrInfo = await generateVerificationQRCode(certId, req.headers.origin || process.env.FRONTEND_URL);

    res.status(201).json({
      success: true,
      message: 'Digital Certificate issued successfully!',
      certificate: {
        ...savedCert,
        student_name: student_name.trim(),
        student_code: studentCode,
        course: course.trim(),
        department: department || null,
        graduation_year: graduation_year || new Date().getFullYear(),
        institution_name: institution.institution_name,
        institution_code: institution.institution_code,
        qr_code: qrInfo.qrDataUrl,
        verification_url: qrInfo.verificationUrl
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get certificates list for institution
 * GET /api/certificates
 */
async function getCertificates(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const { search, status, course, sort } = req.query;

    let queryText = `
      SELECT 
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
      WHERE c.institution_id = $1
    `;
    let queryParams = [institution_id];
    let paramIndex = 2;

    if (status && status !== 'ALL') {
      queryText += ` AND c.status = $${paramIndex}`;
      queryParams.push(status.toUpperCase());
      paramIndex++;
    }

    if (course && course !== 'ALL') {
      queryText += ` AND s.course ILIKE $${paramIndex}`;
      queryParams.push(`%${course}%`);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (c.certificate_id ILIKE $${paramIndex} OR s.student_name ILIKE $${paramIndex} OR s.student_id ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (sort === 'oldest') {
      queryText += ' ORDER BY c.created_at ASC';
    } else {
      queryText += ' ORDER BY c.created_at DESC';
    }

    const result = await db.query(queryText, queryParams);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      certificates: result.rows
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single certificate details by certificate_id
 * GET /api/certificates/:certificate_id
 */
async function getCertificateById(req, res, next) {
  try {
    const { certificate_id } = req.params;

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
        i.email AS institution_email,
        i.phone AS institution_phone
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      JOIN institutions i ON c.institution_id = i.id
      WHERE c.certificate_id = $1 OR c.id::text = $1
      `,
      [certificate_id.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found.'
      });
    }

    const cert = result.rows[0];

    // Generate QR info
    const qrInfo = await generateVerificationQRCode(cert.certificate_id, req.headers.origin || process.env.FRONTEND_URL);

    res.status(200).json({
      success: true,
      certificate: {
        ...cert,
        qr_code: qrInfo.qrDataUrl,
        verification_url: qrInfo.verificationUrl
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke certificate
 * POST /api/certificates/:certificate_id/revoke
 */
async function revokeCertificate(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const { certificate_id } = req.params;
    const { revocation_reason } = req.body;

    if (!revocation_reason) {
      return res.status(400).json({
        success: false,
        message: 'Please state a reason for revoking this certificate.'
      });
    }

    // Check certificate exists & belongs to institution
    const certCheck = await db.query(
      'SELECT id, status FROM certificates WHERE (certificate_id = $1 OR id::text = $1) AND institution_id = $2',
      [certificate_id.trim(), institution_id]
    );

    if (certCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found or you do not have permission to revoke it.'
      });
    }

    const cert = certCheck.rows[0];

    if (cert.status === 'REVOKED') {
      return res.status(400).json({
        success: false,
        message: 'Certificate has already been revoked.'
      });
    }

    // Update status to REVOKED, set revoked_at & reason
    const result = await db.query(
      `UPDATE certificates 
       SET status = 'REVOKED', revoked_at = NOW(), revocation_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [revocation_reason.trim(), cert.id]
    );

    res.status(200).json({
      success: true,
      message: 'Certificate has been revoked successfully.',
      certificate: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Institution Dashboard Overview Stats
 * GET /api/certificates/stats/dashboard
 */
async function getDashboardStats(req, res, next) {
  try {
    const institution_id = req.institution.id;

    // Total Certificates
    const totalResult = await db.query(
      'SELECT COUNT(*) FROM certificates WHERE institution_id = $1',
      [institution_id]
    );
    const totalCertificates = parseInt(totalResult.rows[0].count, 10);

    // Valid Certificates
    const validResult = await db.query(
      "SELECT COUNT(*) FROM certificates WHERE institution_id = $1 AND status = 'VALID'",
      [institution_id]
    );
    const validCertificates = parseInt(validResult.rows[0].count, 10);

    // Revoked Certificates
    const revokedResult = await db.query(
      "SELECT COUNT(*) FROM certificates WHERE institution_id = $1 AND status = 'REVOKED'",
      [institution_id]
    );
    const revokedCertificates = parseInt(revokedResult.rows[0].count, 10);

    // Total Verifications across certificates of this institution
    const verificationsResult = await db.query(
      `SELECT COUNT(vl.id) 
       FROM verification_logs vl
       JOIN certificates c ON vl.certificate_id = c.certificate_id
       WHERE c.institution_id = $1`,
      [institution_id]
    );
    const totalVerifications = parseInt(verificationsResult.rows[0].count, 10);

    // Recent Certificates (Top 5)
    const recentCertificatesResult = await db.query(
      `SELECT 
        c.certificate_id,
        c.issue_date,
        c.status,
        s.student_name,
        s.course
       FROM certificates c
       JOIN students s ON c.student_id = s.id
       WHERE c.institution_id = $1
       ORDER BY c.created_at DESC
       LIMIT 5`,
      [institution_id]
    );

    // Recent Verification Activity (Top 5)
    const recentActivityResult = await db.query(
      `SELECT 
        vl.certificate_id,
        vl.verification_result,
        vl.integrity_result,
        vl.verified_at,
        s.student_name
       FROM verification_logs vl
       JOIN certificates c ON vl.certificate_id = c.certificate_id
       JOIN students s ON c.student_id = s.id
       WHERE c.institution_id = $1
       ORDER BY vl.verified_at DESC
       LIMIT 5`,
      [institution_id]
    );

    res.status(200).json({
      success: true,
      stats: {
        totalCertificates,
        validCertificates,
        revokedCertificates,
        totalVerifications
      },
      recentCertificates: recentCertificatesResult.rows,
      recentActivity: recentActivityResult.rows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCertificate,
  getCertificates,
  getCertificateById,
  revokeCertificate,
  getDashboardStats
};
