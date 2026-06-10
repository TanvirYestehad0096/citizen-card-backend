const express    = require('express');
const router     = express.Router();
const { authAdmin } = require('../middleware/auth');
const {
  adminLogin, getAllUsers, getUserDetails,
  updateUserStatus, updateCardStatus, getDashboardStats, generateHash
} = require('../controllers/adminController');

router.post('/login',                    adminLogin);
router.get('/stats',                     authAdmin, getDashboardStats);
router.get('/users',                     authAdmin, getAllUsers);
router.get('/users/:id',                 authAdmin, getUserDetails);
router.patch('/users/:id/status',        authAdmin, updateUserStatus);
router.patch('/cards/:id/status',        authAdmin, updateCardStatus);

router.post('/generate-hash', generateHash);
module.exports = router;
