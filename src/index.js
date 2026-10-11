const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const db = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const studentRoutes = require('./routes/studentRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://certichain-frontend.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive CORS for verification portal ease of access
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    if (db.pool) {
      await db.query('SELECT 1');
      dbStatus = 'connected';
    }
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  res.status(200).json({
    status: 'online',
    service: 'CertiChain Verification Portal Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/verification-logs', logRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to CertiChain Backend API',
    documentation: '/api/health',
    verify_endpoint: '/api/verify/:certificate_id'
  });
});

// Global Error Handler
app.use(errorHandler);

// Database Auto-Initialization helper
async function initializeDatabase() {
  if (!db.pool) return;
  try {
    // Check if institutions table exists
    const res = await db.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'institutions')"
    );

    if (!res.rows[0].exists) {
      console.log('Database tables missing. Automatically initializing PostgreSQL schema...');
      const schemaPath = path.join(__dirname, '../../database/schema.sql');
      const seedPath = path.join(__dirname, '../../database/seed.sql');

      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await db.query(schemaSql);
        console.log('Schema created successfully.');
      }

      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await db.query(seedSql);
        console.log('Seed data inserted successfully.');
      }
    }
  } catch (err) {
    console.warn('Auto database schema initialization warning:', err.message);
  }
}

// Start Server if run directly
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(` CertiChain API Server listening on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
    await initializeDatabase();
  });
}

// Export for Vercel Serverless Function
module.exports = app;
