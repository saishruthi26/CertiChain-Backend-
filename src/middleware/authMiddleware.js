const jwt = require('jsonwebtoken');

function authenticateInstitution(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'certichain_jwt_secret_key_2026_dev_mode';
    const decoded = jwt.verify(token, secret);
    
    if (decoded.role !== 'institution') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Institution privilege required.'
      });
    }

    req.institution = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.'
    });
  }
}

module.exports = {
  authenticateInstitution
};
