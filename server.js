require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('./config/db');

const authRoutes  = require('./routes/auth');
const userRoutes  = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Auto Migration (adds new columns if not exist) ───
async function runMigrations() {
  try {
    const migrations = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email       VARCHAR(150) DEFAULT NULL AFTER phone`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL AFTER email`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS address     TEXT DEFAULT NULL AFTER blood_group`,
    ];
    for (const sql of migrations) {
      await db.query(sql);
    }
    console.log('✅ Database migrations applied successfully.');
  } catch (err) {
    console.error('⚠️  Migration warning:', err.message);
  }
}

// ── Middleware ───────────────────────────────
app.use(cors({
  origin: [
    'https://tanviryestehad0096.github.io',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));
app.use(express.json());

// ── Routes ───────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/user',  userRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ─────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🇧🇩 Bangladesh Citizen Card API is running.',
    version: '1.0.0',
  });
});

// ── 404 Handler ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ─────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start Server ─────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await runMigrations();
});
