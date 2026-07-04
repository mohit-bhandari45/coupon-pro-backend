const express = require('express');
const CafeController = require('../controllers/cafeController');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Public route to get cafe and remaining coupons by slug
router.get('/:slug', CafeController.getBySlug);

// Private route for cafe owner to update cafe settings
router.put('/update', AuthController.authorize, CafeController.updateDetails);

// Private route for cafe owner to create a coupon
router.post('/coupons', AuthController.authorize, CafeController.createCoupon);

module.exports = router;
