const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const router = express.Router();

const adminAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Admin token required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username এবং password দিন।' });
    }
    const [admins] = await db.query('SELECT id, password_hash FROM admins WHERE username = ?', [username]);
    if (admins.length === 0) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }
    const passwordMatch = await bcrypt.compare(password, admins[0].password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Password incorrect' });
    }
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

router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(c.id) as total_cards,
        SUM(CASE WHEN c.status = 'issued' THEN 1 ELSE 0 END) as issued_cards,
        SUM(CASE WHEN c.status = 'applied' OR c.status = 'processing' THEN 1 ELSE 0 END) as pending_cards
      FROM users u
      LEFT JOIN cards c ON u.id = c.user_id
    `);
    const [cardsByType] = await db.query(`
      SELECT ct.type_name, COUNT(c.id) as count
      FROM card_types ct
      LEFT JOIN cards c ON ct.id = c.card_type_id
      GROUP BY ct.type_name
    `);
    res.json({
      success: true,
      stats: stats[0],
      cards_by_type: cardsByType
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const [users] = await db.query(`
      SELECT id, nid_number, full_name, phone, blood_group, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);
    res.json({ success: true, users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, nid_number, full_name, date_of_birth, phone, blood_group, address, status, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const [cards] = await db.query(`
      SELECT c.id, c.card_number, c.status, c.applied_at, c.issued_at, ct.type_name
      FROM cards c
      LEFT JOIN card_types ct ON c.card_type_id = ct.id
      WHERE c.user_id = ?
    `, [req.params.id]);
    res.json({ success: true, user: { ...users[0], cards } });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/users/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/cards/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['applied', 'processing', 'approved', 'issued', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await db.query('UPDATE cards SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `Card status updated to ${status}` });
  } catch (err) {
    console.error('Update card status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/change-password', adminAuthMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    }
    const [admins] = await db.query('SELECT password_hash FROM admins WHERE id = ?', [req.admin.id]);
    if (admins.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    const passwordMatch = await bcrypt.compare(current_password, admins[0].password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hashedPassword, req.admin.id]);
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change admin password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// TEMPORARY: hash generator
router.post('/generate-hash', async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  res.json({ hash });
});

module.exports = router;