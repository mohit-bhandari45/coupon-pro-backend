const express = require('express');
const CouponController = require('../controllers/couponController');

const router = express.Router();

router.post('/send-otp', CouponController.sendCouponOtp);
router.post('/verify-otp', CouponController.verifyCouponOtp);
router.post('/apply-code', CouponController.applyPromoCode);

module.exports = router;
