const express    = require('express');
const router     = express.Router();
const { authUser } = require('../middleware/auth');
const { getProfile, getMyCards, changePassword, applyCard, updateProfile, deleteAccount } = require('../controllers/userController');

router.get('/profile',          authUser, getProfile);
router.get('/cards',            authUser, getMyCards);
router.put('/change-password',  authUser, changePassword);
router.post('/apply-card',      authUser, applyCard);
router.put('/update-profile',   authUser, updateProfile);
router.delete('/delete-account', authUser, deleteAccount);

module.exports = router;

