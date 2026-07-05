const express = require('express');
const AuthController = require('../controllers/authController');
const UserAuthController = require('../controllers/userAuthController');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', AuthController.authorize, (req, res) => {
    return res.status(200).json({
        success: true,
        cafe: req.cafe
    });
});

// Customer Authentication
router.post('/send-otp', UserAuthController.sendOtp);
router.post('/verify-otp', UserAuthController.verifyOtp);
router.get('/credits/:email', UserAuthController.getCredits);

module.exports = router;

