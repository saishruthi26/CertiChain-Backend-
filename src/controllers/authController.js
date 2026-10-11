const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'certichain_jwt_secret_key_2026_dev_mode';

/**
 * Register Institution
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { institution_name, institution_code, email, phone, password, confirmPassword } = req.body;

    // Validation
    if (!institution_name || !institution_code || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide institution name, code, email, and password.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if email or institution_code already exists
    const existingCheck = await db.query(
      'SELECT id, email, institution_code FROM institutions WHERE email = $1 OR institution_code = $2',
      [email.toLowerCase(), institution_code.toUpperCase()]
    );

    if (existingCheck.rows.length > 0) {
      const match = existingCheck.rows[0];
      if (match.email === email.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'An institution with this email address is already registered.'
        });
      }
      return res.status(409).json({
        success: false,
        message: 'An institution with this institution code already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new institution
    const result = await db.query(
      `INSERT INTO institutions (institution_name, institution_code, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, institution_name, institution_code, email, phone, created_at`,
      [institution_name.trim(), institution_code.toUpperCase().trim(), email.toLowerCase().trim(), phone || null, passwordHash]
    );

    const institution = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        id: institution.id,
        name: institution.institution_name,
        code: institution.institution_code,
        email: institution.email,
        role: 'institution'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Institution registered successfully!',
      token,
      institution: {
        id: institution.id,
        institution_name: institution.institution_name,
        institution_code: institution.institution_code,
        email: institution.email,
        phone: institution.phone,
        created_at: institution.created_at
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Login Institution
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    // Find institution by email
    const result = await db.query(
      'SELECT id, institution_name, institution_code, email, phone, password_hash, created_at FROM institutions WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials.'
      });
    }

    const institution = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, institution.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: institution.id,
        name: institution.institution_name,
        code: institution.institution_code,
        email: institution.email,
        role: 'institution'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      institution: {
        id: institution.id,
        institution_name: institution.institution_name,
        institution_code: institution.institution_code,
        email: institution.email,
        phone: institution.phone,
        created_at: institution.created_at
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current logged in institution info
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, institution_name, institution_code, email, phone, created_at FROM institutions WHERE id = $1',
      [req.institution.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Institution profile not found.'
      });
    }

    res.status(200).json({
      success: true,
      institution: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe
};
