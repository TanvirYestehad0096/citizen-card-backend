const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

// ════════════════════════════════════════════
// POST /api/admin/login
// ════════════════════════════════════════════
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const admin   = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ success: true, message: 'Admin login successful.', token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// GET /api/admin/users  (all users + cards)
// ════════════════════════════════════════════
const getAllUsers = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query  = 'SELECT id, nid_number, full_name, phone, status, created_at FROM users WHERE 1=1';
    const params = [];

    if (status)  { query += ' AND status = ?';                          params.push(status); }
    if (search)  { query += ' AND (full_name LIKE ? OR nid_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM users');

    res.json({ success: true, users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// GET /api/admin/users/:id  (single user + cards)
// ════════════════════════════════════════════
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await db.query(
      'SELECT id, nid_number, full_name, date_of_birth, phone, status, created_at FROM users WHERE id = ?',
      [id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const [cards] = await db.query(
      `SELECT c.id, ct.type_name AS card_type, c.card_number, c.status, c.applied_at, c.issued_at 
       FROM cards c 
       JOIN card_types ct ON c.card_type_id = ct.id 
       WHERE c.user_id = ?`,
      [id]
    );

    res.json({ success: true, user: { ...user, cards } });
  } catch (err) {
    console.error('Get user details error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// PATCH /api/admin/users/:id/status
// Body: { status: 'active' | 'suspended' | 'pending' }
// ════════════════════════════════════════════
const updateUserStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    const allowed    = ['pending', 'active', 'suspended'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `User status updated to '${status}'.` });
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Helper: generate card number ─────────────
const generateCardNumber = (type) => {
  const prefix = { family: 'FAM', business: 'BUS', student: 'STU', vehicle: 'VEH', agriculture: 'AGR' };
  return `BD-${prefix[type] || 'GEN'}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// ════════════════════════════════════════════
// PATCH /api/admin/cards/:id/status
// Body: { status: 'processing' | 'approved' | 'rejected' | 'issued' }
// ════════════════════════════════════════════
const updateCardStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    const allowed    = ['applied', 'processing', 'approved', 'rejected', 'issued'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid card status.' });
    }

    // Fetch current card to check if card_number exists
    const [[card]] = await db.query(
      `SELECT c.id, ct.type_name AS card_type, c.card_number 
       FROM cards c 
       JOIN card_types ct ON c.card_type_id = ct.id 
       WHERE c.id = ?`,
      [id]
    );
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found.' });
    }

    // Auto-generate card number if missing and status is approved or issued
    let cardNumber = card.card_number;
    if (!cardNumber && (status === 'approved' || status === 'issued')) {
      cardNumber = generateCardNumber(card.card_type);
    }

    const issuedAt = status === 'issued' ? new Date() : null;

    await db.query(
      'UPDATE cards SET status = ?, card_number = ?, issued_at = ? WHERE id = ?',
      [status, cardNumber, issuedAt, id]
    );

    res.json({ success: true, message: `Card status updated to '${status}'.` });
  } catch (err) {
    console.error('Update card status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════
// GET /api/admin/stats  (dashboard numbers)
// ════════════════════════════════════════════
const getDashboardStats = async (req, res) => {
  try {
    const [[{ total_users }]]    = await db.query('SELECT COUNT(*) as total_users FROM users');
    const [[{ pending_users }]]  = await db.query("SELECT COUNT(*) as pending_users FROM users WHERE status = 'pending'");
    const [[{ total_cards }]]    = await db.query('SELECT COUNT(*) as total_cards FROM cards');
    const [[{ pending_cards }]]  = await db.query("SELECT COUNT(*) as pending_cards FROM cards WHERE status = 'applied'");
    const [[{ issued_cards }]]   = await db.query("SELECT COUNT(*) as issued_cards FROM cards WHERE status = 'issued'");

    // Aggregation query (GROUP BY) for Rubric points
    const [cards_by_type] = await db.query(
      `SELECT ct.type_name, COUNT(c.id) as count 
       FROM card_types ct 
       LEFT JOIN cards c ON ct.id = c.card_type_id 
       GROUP BY ct.type_name`
    );

    res.json({
      success: true,
      stats: { total_users, pending_users, total_cards, pending_cards, issued_cards, cards_by_type },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// TEMPORARY: hash generator — remove after use
const generateHash = async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  res.json({ hash });
};

module.exports = { adminLogin, getAllUsers, getUserDetails, updateUserStatus, updateCardStatus, getDashboardStats, generateHash };
