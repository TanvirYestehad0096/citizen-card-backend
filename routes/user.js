const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, nid_number, full_name, date_of_birth, phone, blood_group, address, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/cards', authMiddleware, async (req, res) => {
  try {
    const [cards] = await db.query(`
      SELECT c.id, c.card_number, c.status, c.applied_at, c.issued_at, ct.type_name
      FROM cards c
      LEFT JOIN card_types ct ON c.card_type_id = ct.id
      WHERE c.user_id = ?
      ORDER BY c.applied_at DESC
    `, [req.user.id]);
    res.json({ success: true, cards });
  } catch (err) {
    console.error('Get cards error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/apply-card', authMiddleware, async (req, res) => {
  try {
    const { card_type } = req.body;
    if (!card_type) {
      return res.status(400).json({ success: false, message: 'Card type required' });
    }
    const [cardTypes] = await db.query('SELECT id FROM card_types WHERE type_name = ?', [card_type]);
    if (cardTypes.length === 0) {
      return res.status(404).json({ success: false, message: 'Card type not found' });
    }
    const [result] = await db.query(
      'INSERT INTO cards (user_id, card_type_id, status) VALUES (?, ?, ?)',
      [req.user.id, cardTypes[0].id, 'applied']
    );
    res.json({ success: true, message: 'Card application submitted!', card_id: result.insertId });
  } catch (err) {
    console.error('Apply card error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/update-profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, blood_group, address } = req.body;
    const updates = [];
    const values = [];
    if (full_name) { updates.push('full_name = ?'); values.push(full_name); }
    if (blood_group) { updates.push('blood_group = ?'); values.push(blood_group); }
    if (address) { updates.push('address = ?'); values.push(address); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(req.user.id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(query, values);
    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }
    const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const passwordMatch = await bcrypt.compare(current_password, users[0].password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;