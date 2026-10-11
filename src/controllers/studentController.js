const db = require('../config/db');

/**
 * Add / Create Student
 * POST /api/students
 */
async function createStudent(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const { student_id, student_name, email, course, department, graduation_year } = req.body;

    if (!student_id || !student_name || !email || !course || !graduation_year) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student ID, student name, email, course, and graduation year.'
      });
    }

    // Check if student already exists for this institution
    const existing = await db.query(
      'SELECT id FROM students WHERE institution_id = $1 AND student_id = $2',
      [institution_id, student_id.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Student with ID '${student_id}' already exists for your institution.`
      });
    }

    const result = await db.query(
      `INSERT INTO students (institution_id, student_id, student_name, email, course, department, graduation_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        institution_id,
        student_id.trim(),
        student_name.trim(),
        email.toLowerCase().trim(),
        course.trim(),
        department ? department.trim() : null,
        parseInt(graduation_year, 10)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Student record created successfully.',
      student: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all students for logged-in institution
 * GET /api/students
 */
async function getStudents(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const { search } = req.query;

    let queryText = 'SELECT * FROM students WHERE institution_id = $1';
    let queryParams = [institution_id];

    if (search) {
      queryText += ' AND (student_name ILIKE $2 OR student_id ILIKE $2 OR course ILIKE $2)';
      queryParams.push(`%${search}%`);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await db.query(queryText, queryParams);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      students: result.rows
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get student by ID
 * GET /api/students/:id
 */
async function getStudentById(req, res, next) {
  try {
    const institution_id = req.institution.id;
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM students WHERE id = $1 AND institution_id = $2',
      [id, institution_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found.'
      });
    }

    res.status(200).json({
      success: true,
      student: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createStudent,
  getStudents,
  getStudentById
};
