const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

// ──────────────────────────────────────────────────
// 📝 REGISTER - Create new user
// ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { nid_number, full_name, date_of_birth, phone, password, blood_group, card_types } = req.body;

    if (!nid_number || !full_name || !date_of_birth || !phone || !password) {
      return res.status(400).json({ success: false, message: 'সব field পূরণ করুন।' });
    }

    const [existingUser] = await db.query('SELECT id FROM users WHERE nid_number = ? OR phone = ?', [nid_number, phone]);
    if (existingUser.length > 0) {
      return res.status(409).json({ success: false, message: 'এই NID বা Phone নম্বর ইতিমধ্যে registered।' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (nid_number, full_name, date_of_birth, phone, password_hash, blood_group, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nid_number, full_name, date_of_birth, phone, hashedPassword, blood_group || null, 'pending']
    );

    const userId = result.insertId;

    if (card_types && card_types.length > 0) {
      const cardArray = Array.isArray(card_types) ? card_types : card_types.split(',');
      for (const cardType of cardArray) {
        const [cardTypeRow] = await db.query('SELECT id FROM card_types WHERE type_name = ?', [cardType.trim()]);
        if (cardTypeRow.length > 0) {
          await db.query(
            'INSERT INTO cards (user_id, card_type_id, status) VALUES (?, ?, ?)',
            [userId, cardTypeRow[0].id, 'applied']
          );
        }
      }
    }

    res.json({ success: true, message: 'Registration successful! আপনার profile pending review-এ আছে।', user_id: userId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ──────────────────────────────────────────────────
// 🔐 LOGIN
// ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'NID/Phone এবং Password দিন।' });
    }

    const [users] = await db.query(
      'SELECT id, nid_number, full_name, password_hash, status FROM users WHERE nid_number = ? OR phone = ?',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'User found না।' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Password ভুল।' });
    }

    const token = jwt.sign(
      { id: user.id, nid_number: user.nid_number, full_name: user.full_name },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({ success: true, message: 'Login successful!', token, user_id: user.id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ──────────────────────────────────────────────────
// 📱 SEND OTP
// ──────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number দিন।' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    await db.query(
      'INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [phone, otp, 'registration', expiresAt]
    );

    console.log(`📱 OTP for ${phone}: ${otp}`);
    res.json({ success: true, message: `OTP পাঠানো হয়েছে ${phone} এ। Demo OTP: ${otp}` });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────
// ✅ VERIFY OTP
// ──────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone এবং OTP দিন।' });
    }

    const [otpRecords] = await db.query(
      'SELECT id FROM otp_verifications WHERE phone = ? AND otp_code = ? AND expires_at > NOW() AND is_used = FALSE',
      [phone, otp]
    );

    if (otpRecords.length === 0) {
      return res.status(401).json({ success: false, message: 'OTP invalid বা expired।' });
    }

    await db.query('UPDATE otp_verifications SET is_used = TRUE WHERE id = ?', [otpRecords[0].id]);
    res.json({ success: true, message: 'OTP verified successfully!' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────
// 🔑 RESET PASSWORD
// ──────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, new_password } = req.body;

    if (!phone || !new_password) {
      return res.status(400).json({ success: false, message: 'Phone এবং new password দিন।' });
    }

    const [users] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User found না।' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE phone = ?', [hashedPassword, phone]);

    res.json({ success: true, message: 'Password reset successful!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;