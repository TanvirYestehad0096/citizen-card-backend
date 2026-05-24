const express    = require('express');
const router     = express.Router();
const { authUser } = require('../middleware/auth');
const { getProfile, getMyCards, changePassword } = require('../controllers/userController');

router.get('/profile',         authUser, getProfile);
router.get('/cards',           authUser, getMyCards);
router.put('/change-password', authUser, changePassword);

module.exports = router;
