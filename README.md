# CertiChain Backend

Express.js + PostgreSQL backend API for the **CertiChain — Digital Certificate Verification Portal**.

## Tech Stack
- Node.js + Express.js
- Neon PostgreSQL (via `pg`)
- JWT Authentication (jsonwebtoken)
- bcryptjs
- SHA-256 Digital Fingerprint hashing
- QR Code generation (qrcode)

## Local Development

```bash
npm install
# Create .env file with:
# DATABASE_URL=your_neon_postgresql_connection_string
# JWT_SECRET=your_jwt_secret
# PORT=5000
# NODE_ENV=development
# FRONTEND_URL=http://localhost:5173
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/login` | No | Institution login |
| GET | `/api/verify/:id` | No | Verify certificate |
| GET | `/api/certificates` | Yes | List certificates |
| POST | `/api/certificates` | Yes | Issue certificate |
| POST | `/api/certificates/:id/revoke` | Yes | Revoke certificate |

## Production Deployment (Render)

- **Environment**: Node
- **Root Directory**: `/` (this repository root)
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

### Environment Variables to Set on Render:
- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV=production`
- `FRONTEND_URL=https://your-vercel-frontend-url.vercel.app`
