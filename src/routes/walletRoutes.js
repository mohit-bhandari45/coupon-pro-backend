const express = require('express');
const WalletController = require('../controllers/walletController');

const router = express.Router();

router.get('/', WalletController.getUserWallet);
router.get('/advertised', WalletController.getAdvertisedCoupons);
router.post('/claim', WalletController.claimCoupon);

module.exports = router;
