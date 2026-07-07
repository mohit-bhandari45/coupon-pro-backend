const express = require('express');
const AdminController = require('../controllers/adminController');
const AuthController = require('../controllers/authController');

const router = express.Router();

router.use(AuthController.adminAuthorize); // Secure all admin routes

router.get('/customers', AdminController.getCustomers);
router.get('/coupons/check/:code', AdminController.checkCouponByCode);
router.post('/coupons', AdminController.createOrReactivateCoupon);

module.exports = router;
