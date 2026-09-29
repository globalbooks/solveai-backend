# Nexa AI

A modern business support platform with AI-powered diagnostics, authentication, invoicing, and admin dashboard.

## Features

✨ **Core Features**
- Landing page with services, pricing, and contact sections
- Free preliminary AI diagnosis for logged-in users
- JWT-based authentication (signup/login)
- Password hashing with bcrypt
- Invoice generation for service packages
- Owner/admin dashboard for managing users, invoices, and leads
- Express API serving frontend and backend from one app

## Tech Stack

- **Runtime**: Node.js (>=18)
- **Framework**: Express.js
- **Authentication**: JWT + bcryptjs
- **Database**: JSON file storage (db.json)
- **API Integration**: Anthropic Claude for AI diagnostics
- **CORS**: Enabled for cross-origin requests

## Project Structure

```
nexa-ai-backend/
├── index.html          # Landing page & frontend
├── server.js           # Express API server
├── package.json        # Dependencies
├── Procfile            # Railway deployment config
├── README.md           # This file
└── db.json             # Auto-generated database (git ignored)
```

## Installation & Local Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/globalbooks/solveai-backend.git
cd solveai-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set environment variables**

Create a `.env` file:
```bash
JWT_SECRET=your-super-secret-jwt-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key
PORT=3000
ADMIN_EMAILS=owner@example.com
FREE_TRIAL_LIMIT=1
FEE_PCT=2
GAS_USDT=0.30
RECEIVE_ADDRESS=0x270eafea7449be0ebd4eb931e436dde3972dc1cf
ALLOWED_ORIGINS=http://localhost:3000
DATA_DIR=./
```

4. **Run locally**
```bash
node server.js
```

Visit `http://localhost:3000` in your browser.

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ Yes | - | Secret key for JWT signing. Generate a strong random string. |
| `ANTHROPIC_API_KEY` | ✅ Yes | - | Anthropic API key for Claude AI diagnostics |
| `PORT` | ❌ No | 3000 | Port for the Express server |
| `ADMIN_EMAILS` | ❌ No | - | Comma-separated owner emails (e.g., `owner1@example.com,owner2@example.com`) |
| `FREE_TRIAL_LIMIT` | ❌ No | 1 | Number of free diagnoses per user |
| `FEE_PCT` | ❌ No | 2 | Payment processing fee percentage |
| `GAS_USDT` | ❌ No | 0.30 | Blockchain network gas fee in USDT |
| `RECEIVE_ADDRESS` | ❌ No | 0x270eafea7449be0ebd4eb931e436dde3972dc1cf | Wallet address for receiving USDT payments |
| `ALLOWED_ORIGINS` | ❌ No | - | Comma-separated CORS origins. Leave empty to allow all. |
| `DATA_DIR` | ❌ No | ./ | Directory for storing db.json (use mounted volume in production) |

## Railway Deployment

### Quick Start

1. **Push to GitHub** (if not already done)
```bash
git add .
git commit -m "Initial Nexa AI setup"
git push origin main
```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Choose your `solveai-backend` repository
   - Railway will auto-detect the Procfile

3. **Add Environment Variables**
   - In Railway dashboard: **Variables** tab
   - Add all required environment variables:
     - `JWT_SECRET` (generate with: `openssl rand -hex 32`)
     - `ANTHROPIC_API_KEY`
     - `ADMIN_EMAILS`
     - etc.

4. **Deploy**
   - Railway will automatically build and deploy
   - Your app will be live at `https://your-railway-app.up.railway.app`

### Important Notes for Railway

- The `db.json` file will be created in the app's filesystem, but **it will be lost on redeploy** (stateless containers)
- **For production**, mount a persistent volume:
  - In Railway: **Resources** → Add **Volume**
  - Set mount path: `/app`
  - Set `DATA_DIR=/app` in variables

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login with email/password
- `GET /api/me` - Get current user info (requires auth)

### Free Trial
- `POST /api/trial` - Request free diagnosis (requires auth)

### Invoices
- `POST /api/invoices` - Create invoice (requires auth)
- `GET /api/invoices` - Get user's invoices (requires auth)

### Admin Only
- `GET /api/admin/users` - List all users
- `GET /api/admin/invoices` - List all invoices
- `PATCH /api/admin/invoices/:id` - Update invoice status
- `GET /api/admin/leads` - List all trial leads

### Health Check
- `GET /api/health` - Server status

## Usage Example

### Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepass123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepass123"}'
```

### Request Free Diagnosis
```bash
curl -X POST http://localhost:3000/api/trial \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"company":"Acme Inc","problem":"Customer churn has doubled"}'
```

## Pricing Packages

| Package | Price | Description |
|---------|-------|-------------|
| Starter Review | 50 USDT | Initial review and recommendations |
| Business Analysis | 250 USDT | Full analysis, scope, execution roadmap |
| Executive Support | 500 USDT | Deep review, team guidance, custom advisory |

## Payment Information

- **Accepted**: USDT (BEP-20) only
- **Network**: BNB Smart Chain (Chain ID 56)
- **Receiving Address**: `0x270eafea7449be0ebd4eb931e436dde3972dc1cf`

## Security

✅ **Best Practices**
- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens with 7-day expiry
- Rate limiting per IP and route
- CORS protection
- Input validation and sanitization
- Environment variable protection

⚠️ **To Do for Production**
- Use a proper database (PostgreSQL, MongoDB)
- Implement HTTPS/TLS
- Add audit logging
- Set up monitoring and alerts
- Use secrets management (Railway Secrets, Vault)
- Implement email verification
- Add 2FA support

## Support & Contact

- **Email**: almoizaledrisi@gmail.com
- **Issues**: [GitHub Issues](https://github.com/globalbooks/solveai-backend/issues)

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Last Updated**: 2026-09-29
