const express = require('express');
const WalletController = require('../controllers/walletController');

const router = express.Router();

router.get('/', WalletController.getUserWallet);
router.get('/advertised', WalletController.getAdvertisedCoupons);
router.get('/credits', WalletController.getUserCredits);
router.post('/claim', WalletController.claimCoupon);
router.post('/share', WalletController.shareCoupon);
router.post('/earn-credit', WalletController.earnCredit);

module.exports = router;
