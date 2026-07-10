const express = require('express');
const CouponController = require('../controllers/couponController');

const router = express.Router();

router.post('/apply-code', CouponController.applyPromoCode);

module.exports = router;
