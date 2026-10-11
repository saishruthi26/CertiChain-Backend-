const path = require('path');
const dotenv = require('dotenv');

// Eagerly load .env from multiple potential working directory relative paths
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env')
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

let pool = null;
let useFallbackStore = false;
let dbConnected = false;

// Generate valid bcrypt hash for demo password "password123"
const DEMO_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

// In-memory demo store fallback (only used if PostgreSQL connection is completely unavailable)
const inMemoryStore = {
  institutions: [
    {
      id: 1,
      institution_name: 'ABC University',
      institution_code: 'ABCUNI',
      email: 'admin@abc.edu',
      phone: '+1-555-0199',
      password_hash: DEMO_PASSWORD_HASH,
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  students: [
    {
      id: 1,
      institution_id: 1,
      student_id: 'STU2026001',
      student_name: 'Rahul Kumar',
      email: 'rahul.kumar@abc.edu',
      course: 'B.Tech Computer Science',
      department: 'Computer Science & Engineering',
      graduation_year: 2026,
      created_at: new Date()
    }
  ],
  certificates: [
    {
      id: 1,
      certificate_id: 'CERT-2026-000001',
      institution_id: 1,
      student_id: 1,
      certificate_type: 'Bachelor Degree',
      issue_date: '2026-10-07',
      status: 'VALID',
      certificate_hash: 'd56af0b9de3bd2fbf277ae5c964c86989f0705c0098f3449a01d146eb7d1496e',
      previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      current_hash: 'ad8d8244625dc67146d1cc7ab84e7e06084e01645ac238e8b84464a33693e645',
      revoked_at: null,
      revocation_reason: null,
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  verification_logs: [
    {
      id: 1,
      certificate_id: 'CERT-2026-000001',
      verification_result: 'VALID',
      integrity_result: 'PASSED',
      verified_at: new Date(),
      ip_address: '127.0.0.1',
      user_agent: 'CertiChain Demo Verification Initializer'
    }
  ]
};

if (connectionString) {
  // SSL Configuration appropriate for Neon PostgreSQL & Remote PostgreSQL
  const isSSL = connectionString.includes('neon.tech') || 
                connectionString.includes('sslmode=') || 
                isProduction ||
                !connectionString.includes('localhost');

  pool = new Pool({
    connectionString,
    ssl: isSSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  });

  pool.on('connect', () => {
    dbConnected = true;
    useFallbackStore = false;
  });

  pool.on('error', (err) => {
    console.error('[CertiChain DB Error] PostgreSQL idle client error:', err.message);
  });
} else {
  console.warn('[CertiChain DB Warning] DATABASE_URL environment variable is not defined.');
  useFallbackStore = true;
}

/**
 * Tests the PostgreSQL connection on demand.
 */
async function testConnection() {
  if (!pool) return false;
  try {
    const res = await pool.query('SELECT 1');
    dbConnected = true;
    useFallbackStore = false;
    console.log('[CertiChain DB] Successfully connected to PostgreSQL / Neon Database!');
    return true;
  } catch (err) {
    const errorDetails = {
      code: err.code || 'UNKNOWN',
      syscall: err.syscall || 'N/A',
      address: err.address || 'N/A',
      port: err.port || 'N/A',
      message: err.message || String(err)
    };

    if (err.errors && Array.isArray(err.errors)) {
      errorDetails.aggregateErrors = err.errors.map(e => ({
        code: e.code,
        syscall: e.syscall,
        address: e.address,
        port: e.port,
        message: e.message
      }));
    }

    console.error('[CertiChain DB Error] Neon PostgreSQL connection test failed:', errorDetails);
    useFallbackStore = true;
    return false;
  }
}

/**
 * Universal query function supporting Neon PostgreSQL with automatic fallback if unreachable.
 */
const query = async (text, params = []) => {
  if (pool && !useFallbackStore) {
    try {
      const result = await pool.query(text, params);
      dbConnected = true;
      return result;
    } catch (err) {
      if (dbConnected) {
        throw err;
      }
      console.warn('[CertiChain DB Warning] PostgreSQL query failed, switching to fallback mode:', err.message);
      useFallbackStore = true;
    }
  }

  return executeInMemoryQuery(text, params);
};

function executeInMemoryQuery(sql, params) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // SELECT EXISTS information_schema.tables
  if (cleanSql.toLowerCase().includes('information_schema.tables')) {
    return { rows: [{ exists: true }] };
  }

  // INSTITUTIONS QUERY
  if (cleanSql.includes('FROM institutions')) {
    if (cleanSql.includes('WHERE email = $1 OR institution_code = $2')) {
      const emailMatch = inMemoryStore.institutions.find(i => i.email === params[0]);
      const codeMatch = inMemoryStore.institutions.find(i => i.institution_code === params[1]);
      const match = emailMatch || codeMatch;
      return { rows: match ? [match] : [] };
    }
    if (cleanSql.includes('WHERE email = $1')) {
      const match = inMemoryStore.institutions.find(i => i.email === params[0]);
      return { rows: match ? [match] : [] };
    }
    if (cleanSql.includes('WHERE id = $1')) {
      const match = inMemoryStore.institutions.find(i => i.id === Number(params[0]));
      return { rows: match ? [match] : [] };
    }
  }

  // INSERT INTO institutions
  if (cleanSql.includes('INSERT INTO institutions')) {
    const newInst = {
      id: inMemoryStore.institutions.length + 1,
      institution_name: params[0],
      institution_code: params[1],
      email: params[2],
      phone: params[3],
      password_hash: params[4],
      created_at: new Date(),
      updated_at: new Date()
    };
    inMemoryStore.institutions.push(newInst);
    return { rows: [newInst] };
  }

  // STUDENTS QUERY
  if (cleanSql.includes('FROM students')) {
    if (cleanSql.includes('WHERE institution_id = $1 AND (student_id = $2 OR email = $3)')) {
      const match = inMemoryStore.students.find(s => s.institution_id === Number(params[0]) && (s.student_id === params[1] || s.email === params[2]));
      return { rows: match ? [match] : [] };
    }
    if (cleanSql.includes('WHERE id = $1 AND institution_id = $2')) {
      const match = inMemoryStore.students.find(s => s.id === Number(params[0]) && s.institution_id === Number(params[1]));
      return { rows: match ? [match] : [] };
    }
    if (cleanSql.includes('WHERE institution_id = $1')) {
      let filtered = inMemoryStore.students.filter(s => s.institution_id === Number(params[0]));
      if (params[1]) {
        const search = params[1].replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(s => s.student_name.toLowerCase().includes(search) || s.student_id.toLowerCase().includes(search));
      }
      return { rows: filtered };
    }
  }

  // INSERT INTO students
  if (cleanSql.includes('INSERT INTO students')) {
    const newStudent = {
      id: inMemoryStore.students.length + 1,
      institution_id: Number(params[0]),
      student_id: params[1],
      student_name: params[2],
      email: params[3],
      course: params[4],
      department: params[5],
      graduation_year: Number(params[6]),
      created_at: new Date()
    };
    inMemoryStore.students.push(newStudent);
    return { rows: [newStudent] };
  }

  // CERTIFICATES COUNT
  if (cleanSql.includes('SELECT COUNT(*) FROM certificates') && !cleanSql.includes('WHERE')) {
    return { rows: [{ count: inMemoryStore.certificates.length }] };
  }
  if (cleanSql.includes('SELECT COUNT(*) FROM certificates WHERE institution_id = $1')) {
    const instId = Number(params[0]);
    if (cleanSql.includes("status = 'VALID'")) {
      const count = inMemoryStore.certificates.filter(c => c.institution_id === instId && c.status === 'VALID').length;
      return { rows: [{ count }] };
    }
    if (cleanSql.includes("status = 'REVOKED'")) {
      const count = inMemoryStore.certificates.filter(c => c.institution_id === instId && c.status === 'REVOKED').length;
      return { rows: [{ count }] };
    }
    const count = inMemoryStore.certificates.filter(c => c.institution_id === instId).length;
    return { rows: [{ count }] };
  }

  // VERIFICATION LOGS COUNT
  if (cleanSql.includes('SELECT COUNT(vl.id)')) {
    const instId = Number(params[0]);
    const certIds = inMemoryStore.certificates.filter(c => c.institution_id === instId).map(c => c.certificate_id);
    const count = inMemoryStore.verification_logs.filter(v => certIds.includes(v.certificate_id)).length;
    return { rows: [{ count }] };
  }

  // LAST CERTIFICATE CURRENT_HASH
  if (cleanSql.includes('SELECT current_hash FROM certificates ORDER BY id DESC LIMIT 1')) {
    const lastCert = inMemoryStore.certificates[inMemoryStore.certificates.length - 1];
    return { rows: lastCert ? [{ current_hash: lastCert.current_hash }] : [] };
  }

  // INSERT INTO certificates
  if (cleanSql.includes('INSERT INTO certificates')) {
    const newCert = {
      id: inMemoryStore.certificates.length + 1,
      certificate_id: params[0],
      institution_id: Number(params[1]),
      student_id: Number(params[2]),
      certificate_type: params[3],
      issue_date: params[4],
      status: 'VALID',
      certificate_hash: params[5],
      previous_hash: params[6],
      current_hash: params[7],
      revoked_at: null,
      revocation_reason: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    inMemoryStore.certificates.push(newCert);
    return { rows: [newCert] };
  }

  // SELECT CERTIFICATES WITH JOIN (Verification & Dashboard)
  if (cleanSql.includes('FROM certificates c') || cleanSql.includes('FROM certificates')) {
    if (cleanSql.includes('WHERE c.certificate_id = $1') || cleanSql.includes('WHERE (certificate_id = $1')) {
      const targetId = params[0];
      const cert = inMemoryStore.certificates.find(c => c.certificate_id === targetId || String(c.id) === targetId);
      if (!cert) return { rows: [] };

      const student = inMemoryStore.students.find(s => s.id === cert.student_id) || {};
      const inst = inMemoryStore.institutions.find(i => i.id === cert.institution_id) || {};

      return {
        rows: [{
          ...cert,
          student_name: student.student_name || 'Rahul Kumar',
          student_code: student.student_id || 'STU2026001',
          student_email: student.email || 'rahul@abc.edu',
          course: student.course || 'B.Tech Computer Science',
          department: student.department || 'CSE',
          graduation_year: student.graduation_year || 2026,
          institution_name: inst.institution_name || 'ABC University',
          institution_code: inst.institution_code || 'ABCUNI',
          institution_email: inst.email || 'admin@abc.edu',
          institution_phone: inst.phone || '+1-555-0199'
        }]
      };
    }

    if (cleanSql.includes('WHERE c.institution_id = $1')) {
      const instId = Number(params[0]);
      let certs = inMemoryStore.certificates.filter(c => c.institution_id === instId);

      const rows = certs.map(c => {
        const student = inMemoryStore.students.find(s => s.id === c.student_id) || {};
        const inst = inMemoryStore.institutions.find(i => i.id === c.institution_id) || {};
        return {
          ...c,
          student_name: student.student_name || 'Rahul Kumar',
          student_code: student.student_id || 'STU2026001',
          student_email: student.email || 'rahul@abc.edu',
          course: student.course || 'B.Tech Computer Science',
          department: student.department || 'CSE',
          graduation_year: student.graduation_year || 2026,
          institution_name: inst.institution_name || 'ABC University',
          institution_code: inst.institution_code || 'ABCUNI'
        };
      });

      return { rows };
    }
  }

  // UPDATE CERTIFICATES (Revocation)
  if (cleanSql.includes("UPDATE certificates SET status = 'REVOKED'")) {
    const reason = params[0];
    const certId = Number(params[1]);
    const certIndex = inMemoryStore.certificates.findIndex(c => c.id === certId);
    if (certIndex !== -1) {
      inMemoryStore.certificates[certIndex].status = 'REVOKED';
      inMemoryStore.certificates[certIndex].revoked_at = new Date();
      inMemoryStore.certificates[certIndex].revocation_reason = reason;
      return { rows: [inMemoryStore.certificates[certIndex]] };
    }
  }

  // INSERT INTO verification_logs
  if (cleanSql.includes('INSERT INTO verification_logs')) {
    const newLog = {
      id: inMemoryStore.verification_logs.length + 1,
      certificate_id: params[0],
      verification_result: params[1],
      integrity_result: params[2],
      ip_address: params[3],
      user_agent: params[4],
      verified_at: new Date()
    };
    inMemoryStore.verification_logs.push(newLog);
    return { rows: [newLog] };
  }

  // SELECT VERIFICATION LOGS
  if (cleanSql.includes('FROM verification_logs')) {
    const rows = inMemoryStore.verification_logs.map(log => {
      const cert = inMemoryStore.certificates.find(c => c.certificate_id === log.certificate_id);
      const student = cert ? inMemoryStore.students.find(s => s.id === cert.student_id) : null;
      return {
        ...log,
        student_name: student ? student.student_name : 'Rahul Kumar',
        course: student ? student.course : 'B.Tech Computer Science',
        certificate_type: cert ? cert.certificate_type : 'Bachelor Degree'
      };
    });
    return { rows };
  }

  return { rows: [] };
}

module.exports = {
  pool,
  query,
  testConnection
};
