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


// ── Helper: generate card number ─────────────
const generateCardNumber = (type) => {
  const prefix = { family: 'FAM', business: 'BUS', student: 'STU', vehicle: 'VEH', agriculture: 'AGR' };
  return `BD-${prefix[type] || 'GEN'}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// ════════════════════════════════════════════
// POST /api/user/apply-card
// ════════════════════════════════════════════
const applyCard = async (req, res) => {
  try {
    const { card_type } = req.body;
    const userId = req.user.id;

    const validTypes = ['family', 'business', 'student', 'vehicle', 'agriculture'];
    if (!card_type || !validTypes.includes(card_type.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid card type.' });
    }

    // Check if user already has a request for this card type
    const [existing] = await db.query(
      'SELECT id, status FROM cards WHERE user_id = ? AND card_type = ?',
      [userId, card_type.toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `আপনি ইতিমধ্যে ${card_type} কার্ডের জন্য আবেদন করেছেন (Status: ${existing[0].status}).`
      });
    }

    // Generate card number at insert time (same as registration)
    const cardNumber = generateCardNumber(card_type.toLowerCase());

    // Insert new card application
    await db.query(
      'INSERT INTO cards (user_id, card_type, card_number, status, applied_at) VALUES (?, ?, ?, ?, NOW())',
      [userId, card_type.toLowerCase(), cardNumber, 'applied']
    );

    res.json({ success: true, message: `${card_type} কার্ডের জন্য সফলভাবে আবেদন করা হয়েছে!` });
  } catch (err) {
    console.error('Apply card error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProfile, getMyCards, changePassword, applyCard };

