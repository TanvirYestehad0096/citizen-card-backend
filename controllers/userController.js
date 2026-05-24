const db = require('../config/db');

// ════════════════════════════════════════════
// GET /api/user/profile
// ════════════════════════════════════════════
const getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nid_number, full_name, date_of_birth, phone, status, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// GET /api/user/cards
// ════════════════════════════════════════════
const getMyCards = async (req, res) => {
  try {
    const [cards] = await db.query(
      'SELECT id, card_type, card_number, status, applied_at, issued_at FROM cards WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ success: true, cards });
  } catch (err) {
    console.error('Get cards error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// PUT /api/user/change-password
// ════════════════════════════════════════════
const bcrypt = require('bcryptjs');

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both passwords required.' });
    }

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProfile, getMyCards, changePassword };
