const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');

const router = express.Router();

/* ── Admin Auth Middleware ───────────────────────── */
const adminAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Admin token required' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/* ── POST /login ─────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username এবং password দিন।' });

    const [admins] = await db.query(
      'SELECT id, password_hash FROM admins WHERE username = ?', [username]
    );
    if (admins.length === 0)
      return res.status(401).json({ success: false, message: 'Admin not found' });

    const match = await bcrypt.compare(password, admins[0].password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Password ভুল।' });

    const token = jwt.sign(
      { id: admins[0].id, username, role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    res.json({ success: true, message: 'Admin login successful!', token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── GET /stats ──────────────────────────────────── */
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        COUNT(DISTINCT u.id)                                                      AS total_users,
        COUNT(c.id)                                                               AS total_cards,
        SUM(CASE WHEN c.status IN ('approved','issued')    THEN 1 ELSE 0 END)    AS issued_cards,
        SUM(CASE WHEN c.status IN ('applied','processing') THEN 1 ELSE 0 END)    AS pending_cards
      FROM users u
      LEFT JOIN cards c ON u.id = c.user_id
    `);

    const [cardsByType] = await db.query(`
      SELECT ct.type_name, COUNT(c.id) AS count
      FROM card_types ct
      LEFT JOIN cards c ON ct.id = c.card_type_id
      GROUP BY ct.type_name
    `);

    res.json({ success: true, stats: { ...stats, cards_by_type: cardsByType } });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── GET /users ──────────────────────────────────── */
router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const [users] = await db.query(
      `SELECT id, nid_number, full_name, phone, blood_group, status, created_at
       FROM users ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    res.json({ success: true, users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── GET /users/:id ──────────────────────────────── */
router.get('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, nid_number, full_name, date_of_birth, phone, blood_group,
              address, status, created_at
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    const [cards] = await db.query(
      `SELECT c.id, c.card_number, c.status, c.applied_at, c.issued_at, ct.type_name AS card_type
       FROM cards c
       LEFT JOIN card_types ct ON c.card_type_id = ct.id
       WHERE c.user_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, user: { ...users[0], cards } });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── PATCH /users/:id/status ─────────────────────── */
router.patch('/users/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'active', 'suspended'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── GET /cards ──────────────────────────────────── */
// ✅ NEW: সব card applications একসাথে দেখার জন্য
router.get('/cards', adminAuthMiddleware, async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 500;
    const status = req.query.status || null;
    const type   = req.query.type   || null;

    let query = `
      SELECT
        c.id,
        c.card_number,
        c.status,
        c.applied_at,
        c.issued_at,
        ct.type_name   AS card_type,
        u.id           AS user_id,
        u.full_name    AS user_name,
        u.nid_number   AS nid,
        u.phone,
        u.blood_group  AS blood
      FROM cards c
      LEFT JOIN card_types ct ON c.card_type_id  = ct.id
      LEFT JOIN users u       ON c.user_id        = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND c.status = ?';       params.push(status); }
    if (type)   { query += ' AND ct.type_name = ?';   params.push(type);   }

    query += ' ORDER BY c.applied_at DESC LIMIT ?';
    params.push(limit);

    const [cards] = await db.query(query, params);
    res.json({ success: true, cards });
  } catch (err) {
    console.error('Get admin cards error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── PATCH /cards/:id/status ─────────────────────── */
// ✅ FIX: Card status change করে (user status নয়)
router.patch('/cards/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['applied', 'processing', 'approved', 'issued', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    // ✅ Approved হলে card_number generate করো
    if (status === 'approved' || status === 'issued') {
      const [card] = await db.query('SELECT card_number FROM cards WHERE id = ?', [req.params.id]);
      if (card.length > 0 && !card[0].card_number) {
        const cardNumber = 'BD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);
        await db.query(
          'UPDATE cards SET status = ?, card_number = ? WHERE id = ?',
          [status, cardNumber, req.params.id]
        );
        return res.json({ success: true, message: `Card status updated to ${status}`, card_number: cardNumber });
      }
    }

    await db.query('UPDATE cards SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `Card status updated to ${status}` });
  } catch (err) {
    console.error('Update card status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── DELETE /users/:id ───────────────────────────── */
router.delete('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── PUT /change-password ────────────────────────── */
router.put('/change-password', adminAuthMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success: false, message: 'Both passwords required' });

    const [admins] = await db.query('SELECT password_hash FROM admins WHERE id = ?', [req.admin.id]);
    if (admins.length === 0)
      return res.status(404).json({ success: false, message: 'Admin not found' });

    const match = await bcrypt.compare(current_password, admins[0].password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Current password ভুল।' });

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hashed, req.admin.id]);
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change admin password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
/* ── POST /notifications ─────────────────────────── */
router.post('/notifications', adminAuthMiddleware, async (req, res) => {
  try {
    const { user_id, title, message } = req.body;

    if (!title || !message)
      return res.status(400).json({ success: false, message: 'Title এবং Message দিন।' });

    // user_id না থাকলে সব user কে পাঠাবে
    if (!user_id || user_id === 'all') {
      const [users] = await db.query('SELECT id FROM users');
      for (const user of users) {
        await db.query(
          'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
          [user.id, title, message]
        );
      }
      return res.json({ success: true, message: `✅ সব user কে notification পাঠানো হয়েছে।` });
    }

    // নির্দিষ্ট user কে পাঠাবে
    const [users] = await db.query('SELECT id FROM users WHERE nid_number = ?', [user_id]);
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'এই NID দিয়ে কোনো user পাওয়া যায়নি।' });

    await db.query(
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [users[0].id, title, message]
    );

    res.json({ success: true, message: '✅ Notification পাঠানো হয়েছে।' });
  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;