# SolveAI

A simple business support landing page and backend API for free diagnoses, package pricing, invoice generation, and admin dashboard access.

## Features

- Landing page with pricing and service sections
- Free diagnosis form for logged-in users
- Authentication with signup/login
- Invoice generation for package purchases
- Owner/admin dashboard for users, invoices, and leads
- Express API serving the frontend and backend from the same app

## Tech Stack

- Node.js
- Express
- PostgreSQL-like JSON storage in a local `db.json` file (for lightweight deployment)
- JWT auth
- bcrypt password hashing
- CORS support for front-end/back-end same origin or configured origins

## Local Setup

```bash
npm install
JWT_SECRET=your_secret_here node server.js
```

## Optional Environment Variables

```bash
PORT=3000
ALLOWED_ORIGINS=https://your-frontend.com
ADMIN_EMAILS=owner@example.com
FREE_TRIAL_LIMIT=1
FEE_PCT=2
GAS_USDT=0.30
RECEIVE_ADDRESS=0x270eafea7449be0ebd4eb931e436dde3972dc1cf
ANTHROPIC_API_KEY=your_key_here
DATA_DIR=./
```

## Notes

- If `ANTHROPIC_API_KEY` is not configured, the trial and support endpoints return a 503 error.
- The project is designed for deployment to platforms like Railway.
- The `public` folder is served by Express; if you want the page to live in a separate frontend repo, move `index.html` to `public/index.html` and update the frontend configuration.

## Deployment

This repository includes a `Procfile` for Railway:

```bash
web: node server.js
```

## File Structure

```text
solveai-backend/
├── index.html
├── package.json
├── Procfile
├── server.js
└── README.md
```

## Important

The current repository has a single-page frontend in the root `index.html` and the server code in `server.js`. For a production setup, you may want to move the frontend into a `public` folder or host static assets separately.
