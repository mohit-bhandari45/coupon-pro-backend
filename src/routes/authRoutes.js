const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', AuthController.authorize, (req, res) => {
    return res.status(200).json({
        success: true,
        cafe: req.cafe
    });
});

module.exports = router;
