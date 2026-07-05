const express = require('express');
const CafeController = require('../controllers/cafeController');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Private route to get cafe transactions
router.get('/transactions', AuthController.authorize, CafeController.getTransactions);

// Private route for cafe owner to update cafe settings
router.put('/update', AuthController.authorize, CafeController.updateDetails);

// Private route for cafe owner to create a coupon
router.post('/coupons', AuthController.authorize, CafeController.createCoupon);

// Public route to get cafe and remaining coupons by slug (wildcard at bottom!)
router.get('/:slug', CafeController.getBySlug);

module.exports = router;
