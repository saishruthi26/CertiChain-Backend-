const assert = require('assert');
const app = require('../src/index');
const http = require('http');

let server;
const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runEndpointTests() {
  console.log('===================================================');
  console.log(' Running Express REST API Endpoint Integration Tests');
  console.log('===================================================\n');

  server = app.listen(PORT, async () => {
    try {
      // 1. Health check
      console.log('--- 1. Testing GET /api/health ---');
      const healthRes = await makeRequest('GET', '/api/health');
      assert.strictEqual(healthRes.status, 200);
      assert.strictEqual(healthRes.data.status, 'online');
      console.log('✔ Health Check API Passed:', healthRes.data.service);

      // 2. Login Institution
      console.log('\n--- 2. Testing POST /api/auth/login ---');
      const loginRes = await makeRequest('POST', '/api/auth/login', {
        email: 'admin@abc.edu',
        password: 'password123'
      });
      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginRes.data.success, true);
      assert(loginRes.data.token, 'Must return JWT token');
      const token = loginRes.data.token;
      console.log('✔ Institution Login Passed! Received JWT Token');

      // 3. Verify Certificate Public API
      console.log('\n--- 3. Testing GET /api/verify/CERT-2026-000001 ---');
      const verifyRes = await makeRequest('GET', '/api/verify/CERT-2026-000001');
      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyRes.data.status, 'VALID');
      assert.strictEqual(verifyRes.data.integrity, 'PASSED');
      assert.strictEqual(verifyRes.data.certificate.student_name, 'Rahul Kumar');
      console.log('✔ Public Verification API Passed:', verifyRes.data.message);

      // 4. Issue New Certificate
      console.log('\n--- 4. Testing POST /api/certificates ---');
      const issueRes = await makeRequest('POST', '/api/certificates', {
        student_id: 'STU2026002',
        student_name: 'Priya Sharma',
        email: 'priya.sharma@abc.edu',
        course: 'B.Tech Electrical Engineering',
        department: 'EEE',
        graduation_year: 2026,
        certificate_type: 'Bachelor Degree',
        issue_date: '2026-10-08'
      }, { Authorization: `Bearer ${token}` });

      assert.strictEqual(issueRes.status, 201);
      assert.strictEqual(issueRes.data.success, true);
      assert(issueRes.data.certificate.certificate_id.startsWith('CERT-'), 'New Cert ID generated');
      const newCertId = issueRes.data.certificate.certificate_id;
      console.log('✔ Certificate Issued Successfully:', newCertId);

      // 5. Verify Newly Issued Certificate
      console.log(`\n--- 5. Testing GET /api/verify/${newCertId} ---`);
      const verifyNewRes = await makeRequest('GET', `/api/verify/${newCertId}`);
      assert.strictEqual(verifyNewRes.status, 200);
      assert.strictEqual(verifyNewRes.data.status, 'VALID');
      assert.strictEqual(verifyNewRes.data.certificate.student_name, 'Priya Sharma');
      console.log('✔ Newly Issued Certificate Verification Passed!');

      // 6. Test Revocation
      console.log(`\n--- 6. Testing POST /api/certificates/${newCertId}/revoke ---`);
      const revokeRes = await makeRequest('POST', `/api/certificates/${newCertId}/revoke`, {
        revocation_reason: 'Administrative verification audit test.'
      }, { Authorization: `Bearer ${token}` });

      assert.strictEqual(revokeRes.status, 200);
      assert.strictEqual(revokeRes.data.success, true);
      console.log('✔ Certificate Revocation Passed');

      // 7. Verify Revoked Certificate returns REVOKED status
      console.log(`\n--- 7. Testing GET /api/verify/${newCertId} (Post-Revocation) ---`);
      const verifyRevokedRes = await makeRequest('GET', `/api/verify/${newCertId}`);
      assert.strictEqual(verifyRevokedRes.status, 200);
      assert.strictEqual(verifyRevokedRes.data.status, 'REVOKED');
      console.log('✔ Post-Revocation Verification Status Check Passed!');

      console.log('\n===================================================');
      console.log(' ALL EXPRESS REST API ENDPOINT TESTS PASSED CLEANLY! ');
      console.log('===================================================');
    } catch (err) {
      console.error('Endpoint Integration Test Error:', err);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runEndpointTests();
