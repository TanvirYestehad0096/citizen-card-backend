const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/db');

const router = express.Router();

/* ── Auth Middleware ─────────────────────────────── */
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/* ── GET /profile ────────────────────────────────── */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, nid_number, full_name, date_of_birth, phone, email,
              blood_group, address, status, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── GET /cards ──────────────────────────────────── */
router.get('/cards', authMiddleware, async (req, res) => {
  try {
    const [cards] = await db.query(
      `SELECT
         c.id,
         c.card_number,
         c.status,
         c.applied_at,
         c.issued_at,
         ct.type_name   AS card_type
       FROM cards c
       LEFT JOIN card_types ct ON c.card_type_id = ct.id
       WHERE c.user_id = ?
       ORDER BY c.applied_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, cards });
  } catch (err) {
    console.error('Get cards error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── POST /apply-card ────────────────────────────── */
// ✅ FIX: একই card type দুইবার apply করা যাবে না
router.post('/apply-card', authMiddleware, async (req, res) => {
  try {
    const { card_type } = req.body;
    if (!card_type)
      return res.status(400).json({ success: false, message: 'Card type required' });

    // Card type exist করে কিনা চেক
    const [cardTypes] = await db.query(
      'SELECT id FROM card_types WHERE type_name = ?',
      [card_type.trim().toLowerCase()]
    );
    if (cardTypes.length === 0)
      return res.status(404).json({ success: false, message: 'Invalid card type' });

    const cardTypeId = cardTypes[0].id;

    // ✅ Duplicate check — এই user এই card type আগে apply করেছে কিনা
    const [existing] = await db.query(
      'SELECT id, status FROM cards WHERE user_id = ? AND card_type_id = ?',
      [req.user.id, cardTypeId]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `আপনি আগেই "${card_type}" card এর জন্য apply করেছেন। Status: ${existing[0].status}`
      });
    }

    const [result] = await db.query(
      'INSERT INTO cards (user_id, card_type_id, status) VALUES (?, ?, ?)',
      [req.user.id, cardTypeId, 'applied']
    );

    res.json({
      success: true,
      message: 'Card application submitted! Admin অনুমোদন করলে download করতে পারবেন।',
      card_id: result.insertId
    });
  } catch (err) {
    console.error('Apply card error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── PUT /update-profile ─────────────────────────── */
// ✅ FIX: phone এবং email update support যোগ করা হয়েছে
router.put('/update-profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, phone, email, blood_group, address } = req.body;

    const updates = [];
    const values  = [];

    if (full_name)   { updates.push('full_name = ?');   values.push(full_name); }
    if (phone)       { updates.push('phone = ?');       values.push(phone); }
    if (email)       { updates.push('email = ?');       values.push(email); }
    if (blood_group) { updates.push('blood_group = ?'); values.push(blood_group); }
    if (address)     { updates.push('address = ?');     values.push(address); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, message: 'কোনো field দেওয়া হয়নি।' });

    // ✅ Phone duplicate check (নিজের phone বাদে)
    if (phone) {
      const [phoneCheck] = await db.query(
        'SELECT id FROM users WHERE phone = ? AND id != ?',
        [phone, req.user.id]
      );
      if (phoneCheck.length > 0)
        return res.status(409).json({ success: false, message: 'এই phone নম্বর অন্য account এ registered।' });
    }

    values.push(req.user.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Profile সফলভাবে update হয়েছে!' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── PUT /change-password ────────────────────────── */
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ success: false, message: 'Both passwords required' });

    const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    const match = await bcrypt.compare(current_password, users[0].password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Current password ভুল।' });

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ success: true, message: 'Password সফলভাবে পরিবর্তন হয়েছে!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── DELETE /delete-account ──────────────────────── */
router.delete('/delete-account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password)
      return res.status(400).json({ success: false, message: 'Password দিন।' });

    const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    const match = await bcrypt.compare(password, users[0].password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Password ভুল।' });

    await db.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, message: 'Account সফলভাবে delete হয়েছে।' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
/* ── GET /notifications ──────────────────────────── */
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT id, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread = notifications.filter(n => !n.is_read).length;
    res.json({ success: true, notifications, unread });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ── PUT /notifications/:id/read ─────────────────── */
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
/* ── PUT /notifications/read-all ─────────────────── */
router.put('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
module.exports = router;