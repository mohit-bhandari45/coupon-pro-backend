const jwt = require('jsonwebtoken');
const CafeModel = require('../models/cafeModel');

const JWT_SECRET = process.env.JWT_SECRET || 'cafe-loyalty-fallback-secret-key';

// Helper to generate JWT
function generateToken(cafeId) {
    return jwt.sign({ id: cafeId }, JWT_SECRET, { expiresIn: '7d' });
}

class AuthController {
    static async register(req, res) {
        try {
            const { name, owner_name, email, password, address } = req.body;

            // Validation
            if (!name || !owner_name || !email || !password || !address) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields (name, owner_name, email, password, address) are required'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters long'
                });
            }

            const cafe = await CafeModel.create({
                name,
                owner_name,
                email,
                password,
                address
            });

            const token = generateToken(cafe.id);

            return res.status(201).json({
                success: true,
                message: 'Cafe registered successfully',
                token,
                cafe
            });
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(400).json({
                success: false,
                message: error.message || 'Error occurred during registration'
            });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const cafe = await CafeModel.authenticate(email, password);
            const token = generateToken(cafe.id);

            return res.status(200).json({
                success: true,
                message: 'Logged in successfully',
                token,
                cafe
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(400).json({
                success: false,
                message: error.message || 'Invalid credentials'
            });
        }
    }

    // Middleware to authorize cafe owner requests
    static async authorize(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, message: 'No token provided' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);

            const db = require('../config/db');
            const cafe = await db.getCafeById(decoded.id);

            if (!cafe) {
                return res.status(401).json({ success: false, message: 'Invalid token or cafe doesn\'t exist' });
            }

            const { password: _, ...cafeWithoutPassword } = cafe;
            req.cafe = cafeWithoutPassword;
            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Failed to authenticate token' });
        }
    }
}

module.exports = AuthController;
