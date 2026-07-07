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

// Private route for cafe owner to get all coupons (active and archived)
router.get('/coupons', AuthController.authorize, CafeController.getOwnerCoupons);

// Private route for cafe owner to toggle a coupon's active status
router.put('/coupons/:id/toggle-active', AuthController.authorize, CafeController.toggleCouponActive);

// Public route to get cafe and remaining coupons by slug (wildcard at bottom!)
router.get('/:slug', CafeController.getBySlug);

module.exports = router;
