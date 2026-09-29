// Nexa AI backend — Express API for login, invoices, free-trial diagnosis, and owner dashboard.
// Run: npm install && node server.js
// Required env vars: JWT_SECRET, ANTHROPIC_API_KEY.
// Optional env vars: PORT, ALLOWED_ORIGINS, DATA_DIR, ADMIN_EMAILS, FEE_PCT, GAS_USDT,
//                    RECEIVE_ADDRESS, FREE_TRIAL_LIMIT.

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_DIR = process.env.DATA_DIR || __dirname; // point this at a mounted Volume in production
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FREE_TRIAL_LIMIT = Number(process.env.FREE_TRIAL_LIMIT || 1);

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET env var. Set it in Railway → Variables, then redeploy.');
  process.exit(1);
}

// ---------- tiny JSON "database" ----------
function loadDB() {
  let data = { users: [], invoices: [], leads: [] };
  if (fs.existsSync(DB_FILE)) {
    try { data = Object.assign(data, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
    catch (e) { console.error('Could not parse db.json, starting fresh:', e.message); }
  }
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.invoices)) data.invoices = [];
  if (!Array.isArray(data.leads)) data.leads = [];
  return data;
}
let db = loadDB();
let saving = false;
function saveDB() {
  if (saving) return; // simple guard against overlapping writes
  saving = true;
  fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), (err) => {
    saving = false;
    if (err) console.error('DB write failed:', err.message);
  });
}

// ---------- app setup ----------
const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (allowedOrigins.length === 0) return cb(null, true); // open until configured
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));

// basic in-memory rate limiting per IP + route
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many requests, slow down.' });
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function findUser(email) { return db.users.find(u => u.email === email); }

// Owner/admin accounts: comma-separated emails in ADMIN_EMAILS (Railway → Variables).
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function isAdminEmail(email) { return ADMIN_EMAILS.includes(String(email || '').toLowerCase()); }
function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.user.email)) return res.status(403).json({ error: 'Owner access only' });
  next();
}

// ---------- packages & fees (server-side source of truth) ----------
const PACKAGES = {
  'Starter Review': 50,
  'Business Analysis': 250,
  'Executive Support': 500,
};
const FEE_PCT = Number(process.env.FEE_PCT || 2);      // processing fee %
const GAS_USDT = Number(process.env.GAS_USDT || 0.30); // network fee estimate
const RECEIVE_ADDRESS = process.env.RECEIVE_ADDRESS || '0x270eafea7449be0ebd4eb931e436dde3972dc1cf';

// ---------- serve the site itself (same origin as the API — avoids CORS entirely) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- auth ----------
app.post('/api/auth/signup', rateLimit(10, 60_000), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const norm = String(email).trim().toLowerCase();
  if (findUser(norm)) return res.status(409).json({ error: 'Account already exists' });
  const hash = await bcrypt.hash(password, 10);
  db.users.push({ id: 'u_' + Date.now().toString(36), email: norm, hash, trialsUsed: 0, createdAt: new Date().toISOString() });
  saveDB();
  const token = jwt.sign({ email: norm }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email: norm });
});

app.post('/api/auth/login', rateLimit(10, 60_000), async (req, res) => {
  const { email, password } = req.body || {};
  const norm = String(email || '').trim().toLowerCase();
  const user = findUser(norm);
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' });
  const ok = await bcrypt.compare(password || '', user.hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });
  const token = jwt.sign({ email: norm }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email: norm });
});

app.get('/api/me', auth, (req, res) => {
  const user = findUser(req.user.email);
  const trialsUsed = user ? (user.trialsUsed || 0) : 0;
  res.json({
    email: req.user.email,
    isAdmin: isAdminEmail(req.user.email),
    trialsUsed,
    trialLimit: FREE_TRIAL_LIMIT,
    trialsRemaining: Math.max(0, FREE_TRIAL_LIMIT - trialsUsed),
  });
});

// ---------- invoices ----------
app.post('/api/invoices', auth, rateLimit(20, 60_000), (req, res) => {
  const { package: pkgName } = req.body || {};
  const price = PACKAGES[pkgName];
  if (price === undefined) return res.status(400).json({ error: 'Unknown package' });
  const fee = +(price * FEE_PCT / 100).toFixed(2);
  const total = +(price + fee + GAS_USDT).toFixed(2);
  const invoice = {
    id: 'INV-' + Date.now().toString(36).toUpperCase(),
    email: req.user.email,
    package: pkgName,
    price, fee, gas: GAS_USDT, total,
    address: RECEIVE_ADDRESS,
    network: 'BNB Smart Chain (BEP-20), Chain ID 56',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.invoices.push(invoice);
  saveDB();
  res.json(invoice);
});

app.get('/api/invoices', auth, (req, res) => {
  res.json(db.invoices.filter(i => i.email === req.user.email));
});

// ---------- free trial: preliminary diagnosis only, full plan requires a paid package ----------
app.post('/api/trial', auth, rateLimit(10, 60_000), async (req, res) => {
  const { company, problem } = req.body || {};
  if (!problem || !problem.trim()) return res.status(400).json({ error: 'Describe the business problem first' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'This feature is not configured yet' });

  const user = findUser(req.user.email);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  const used = user.trialsUsed || 0;
  if (used >= FREE_TRIAL_LIMIT) {
    return res.status(403).json({ error: 'Free trial limit reached. Subscribe to a package to get the full solution.' });
  }

  const systemPrompt =
    `You are Nexa AI's free diagnostic assistant. A prospective client describes a business problem. ` +
    `Reply with ONLY a short preliminary diagnosis: a likely root cause and one or two general directions ` +
    `to investigate, in under 150 words. Do NOT provide a complete step-by-step action plan, specific ` +
    `implementation details, tool configurations, or a final recommendation — those are only delivered ` +
    `after the client subscribes to a paid package (Starter Review 50 USDT, Business Analysis 250 USDT, ` +
    `Executive Support 500 USDT). End with one sentence inviting them to subscribe for the full roadmap.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: ('Company: ' + (company || 'Not provided') + '\nProblem: ' + problem).slice(0, 4000) }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Anthropic API error:', r.status, t);
      return res.status(502).json({ error: 'The diagnostic assistant is temporarily unavailable' });
    }
    const data = await r.json();
    const text = (data.content || []).map(b => b.text || '').join('\n').trim();

    user.trialsUsed = used + 1;
    db.leads.push({
      id: 'LEAD-' + Date.now().toString(36).toUpperCase(),
      email: req.user.email,
      company: company || '',
      problem,
      preview: text,
      createdAt: new Date().toISOString(),
    });
    saveDB();

    res.json({ preview: text || 'Sorry, no response was generated.', trialsRemaining: Math.max(0, FREE_TRIAL_LIMIT - user.trialsUsed) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'The diagnostic assistant is temporarily unavailable' });
  }
});

// ---------- general AI support (for existing customers with an issue) ----------
app.post('/api/support', auth, rateLimit(15, 60_000), async (req, res) => {
  const { issue } = req.body || {};
  if (!issue || !issue.trim()) return res.status(400).json({ error: 'Describe your issue first' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI support is not configured yet' });

  const systemPrompt =
    `You are the support assistant for Nexa AI, a business consulting service. ` +
    `Packages: Starter Review 50 USDT, Business Analysis 250 USDT, Executive Support 500 USDT. ` +
    `Payment is USDT only on BNB Smart Chain (BEP-20), invoices issued after scope approval. ` +
    `Never ask for private keys or seed phrases. Give a short, practical reply: likely cause, ` +
    `2-4 concrete steps, and when to escalate to a human at almoizaledrisi@gmail.com.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: issue.slice(0, 4000) }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Anthropic API error:', r.status, t);
      return res.status(502).json({ error: 'AI support is temporarily unavailable' });
    }
    const data = await r.json();
    const text = (data.content || []).map(b => b.text || '').join('\n').trim();
    res.json({ text: text || 'Sorry, no response was generated.' });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'AI support is temporarily unavailable' });
  }
});

// ---------- owner/admin ----------
app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
  res.json(db.users.map(u => ({ email: u.email, trialsUsed: u.trialsUsed || 0, createdAt: u.createdAt })));
});

app.get('/api/admin/invoices', auth, requireAdmin, (req, res) => {
  res.json(db.invoices.slice().reverse());
});

app.patch('/api/admin/invoices/:id', auth, requireAdmin, (req, res) => {
  const inv = db.invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const { status } = req.body || {};
  if (!['pending', 'paid', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  inv.status = status;
  saveDB();
  res.json(inv);
});

app.get('/api/admin/leads', auth, requireAdmin, (req, res) => {
  res.json(db.leads.slice().reverse());
});

app.listen(PORT, () => console.log('Nexa AI backend listening on port ' + PORT));
