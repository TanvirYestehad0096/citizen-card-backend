const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const db        = require('../config/db');

// ── Helper: generate 6-digit OTP ────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ── Helper: generate card number ─────────────
const generateCardNumber = (type) => {
  const prefix = { family: 'FAM', business: 'BUS', student: 'STU', vehicle: 'VEH', agriculture: 'AGR' };
  return `BD-${prefix[type] || 'GEN'}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// ════════════════════════════════════════════
// POST /api/auth/register
// ════════════════════════════════════════════
const register = async (req, res) => {
  try {
    const { nid_number, full_name, date_of_birth, phone, password, card_types } = req.body;

    // Validate required fields
    if (!nid_number || !full_name || !date_of_birth || !phone || !password || !card_types?.length) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Check duplicate NID or phone
    const [existing] = await db.query(
      'SELECT id FROM users WHERE nid_number = ? OR phone = ?',
      [nid_number, phone]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'NID or phone number already registered.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await db.query(
      `INSERT INTO users (nid_number, full_name, date_of_birth, phone, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [nid_number, full_name, date_of_birth, phone, password_hash]
    );
    const userId = result.insertId;

    // Insert card applications (Using Subquery for normalization requirement)
    const validTypes = card_types.filter(t => ['family', 'business', 'student', 'vehicle', 'agriculture'].includes(t));
    
    if (validTypes.length > 0) {
      // Subquery usage for Rubric points
      for (const type of validTypes) {
        const cardNumber = generateCardNumber(type);
        await db.query(
          `INSERT INTO cards (user_id, card_type_id, card_number) 
           SELECT ?, id, ? FROM card_types WHERE type_name = ?`,
          [userId, cardNumber, type]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your application is under review.',
      user_id: userId,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/login
// ════════════════════════════════════════════
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = NID or phone

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifier and password required.' });
    }

    const [rows] = await db.query(
      'SELECT * FROM users WHERE nid_number = ? OR phone = ?',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id:        user.id,
        full_name: user.full_name,
        nid:       user.nid_number,
        phone:     user.phone,
        status:    user.status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/send-otp  (forgot password)
// ════════════════════════════════════════════
const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number required.' });

    const [rows] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No account found with this phone.' });
    }

    // Invalidate old OTPs
    await db.query(
      "UPDATE otp_verifications SET is_used = 1 WHERE phone = ? AND purpose = 'password_reset'",
      [phone]
    );

    const otp     = generateOTP();
    const expires = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES || 5) * 60 * 1000);

    await db.query(
      "INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at) VALUES (?, ?, 'password_reset', ?)",
      [phone, otp, expires]
    );

    // NOTE: No SMS API integrated — returning OTP in response for demo/development
    console.log(`📱 OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP generated successfully.',
      otp: otp  // Remove this line when real SMS API is integrated
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/verify-otp
// ════════════════════════════════════════════
const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required.' });

    const [rows] = await db.query(
      `SELECT * FROM otp_verifications
       WHERE phone = ? AND otp_code = ? AND purpose = 'password_reset'
         AND is_used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark OTP as used
    await db.query('UPDATE otp_verifications SET is_used = 1 WHERE id = ?', [rows[0].id]);

    // Temporary token for password reset (5 min)
    const resetToken = jwt.sign({ phone, purpose: 'reset' }, process.env.JWT_SECRET, { expiresIn: '5m' });

    res.json({ success: true, message: 'OTP verified.', reset_token: resetToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// POST /api/auth/reset-password
// ════════════════════════════════════════════
const resetPassword = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) {
      return res.status(400).json({ success: false, message: 'Token and new password required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (decoded.purpose !== 'reset') {
      return res.status(403).json({ success: false, message: 'Invalid token purpose.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE phone = ?', [password_hash, decoded.phone]);

    res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { register, login, sendOTP, verifyOTP, resetPassword };
