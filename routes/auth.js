const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const {
  register, login, sendOTP, verifyOTP, resetPassword
} = require('../controllers/authController');

// Rate limiter — max 10 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

router.post('/register',       limiter, register);
router.post('/login',          limiter, login);
router.post('/send-otp',       limiter, sendOTP);
router.post('/verify-otp',     limiter, verifyOTP);
router.post('/reset-password', limiter, resetPassword);

module.exports = router;
