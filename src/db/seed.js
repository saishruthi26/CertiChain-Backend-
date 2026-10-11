const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { generateCertificateHash, generateChainHash } = require('../services/hashService');

async function seed() {
  try {
    const hashedPassword = await bcrypt.hash('Demo@12345', 10);
    
    // Seed Institution
    const instResult = await pool.query(
      `INSERT INTO institutions (institution_code, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $4
       RETURNING id, name`,
      ['ABCU2026', 'ABC University', 'admin@abcuniversity.edu', hashedPassword]
    );
    const institutionId = instResult.rows[0].id;
    const institutionName = instResult.rows[0].name;

    // Seed Student
    const studentResult = await pool.query(
      `INSERT INTO students (student_id, name, course, institution_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id) DO UPDATE SET name = $2
       RETURNING id`,
      ['STU2026001', 'Rahul Kumar', 'B.Tech Computer Science', institutionId]
    );
    const studentId = studentResult.rows[0].id;

    // Prepare Certificate Data
    const certData = {
      certificate_id: 'CERT-2026-000001',
      student_roll: 'STU2026001',
      student_name: 'Rahul Kumar',
      course: 'B.Tech Computer Science',
      institution_name: institutionName,
      issue_date: new Date().toISOString().split('T')[0],
      certificate_type: 'DEGREE'
    };

    const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const certHash = generateCertificateHash(certData);
    const chainHash = generateChainHash(certData, previousHash);

    // Seed Certificate
    await pool.query(
      `INSERT INTO certificates 
       (certificate_id, student_id, institution_id, course, issue_date, 
        certificate_type, certificate_hash, previous_hash, current_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (certificate_id) DO NOTHING`,
      [
        certData.certificate_id,
        studentId,
        institutionId,
        certData.course,
        certData.issue_date,
        certData.certificate_type,
        certHash,
        previousHash,
        chainHash
      ]
    );

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
