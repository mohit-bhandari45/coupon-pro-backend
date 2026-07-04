const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cafe-loyalty-fallback-secret-key';

class UserAuthController {
    static async sendOtp(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email address is required'
                });
            }

            // Generate a 6-digit OTP code string
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

            const newOtp = {
                email,
                code,
                purpose: 'auth',
                expires_at: expiresAt,
                created_at: new Date().toISOString()
            };

            await db.insertOtpCode(newOtp);

            // Log OTP code simulation in console/terminal for developer use
            console.log(`
┌────────────────────────────────────────────────────────┐
│ ✉️  [SIMULATOR] Email verification OTP dispatched      │
├────────────────────────────────────────────────────────┤
│ To:      ${email.padEnd(38)} │
│ OTP:     ${code.padEnd(38)} │
│ Purpose: Customer Sign-In (auth)                       │
│ Expiry:  10 mins                                       │
└────────────────────────────────────────────────────────┘
`);

            return res.status(200).json({
                success: true,
                message: 'OTP sent successfully (Simulated in terminal)'
            });
        } catch (error) {
            console.error('Error sending user OTP:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async verifyOtp(req, res) {
        try {
            const { email, code, name } = req.body;

            if (!email || !code) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and verification OTP code are required'
                });
            }

            // Verify and consume the OTP code from DB
            const verified = await db.verifyAndUseOtpCode(email, code, 'auth');

            if (!verified) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired verification code'
                });
            }

            // Query user in the system
            let user = await db.getUserByEmail(email);

            if (!user) {
                // If user doesn't exist, create profile
                const uuid = 'u-' + Math.floor(100000 + Math.random() * 900000);
                const newUser = {
                    id: db.useSupabase ? undefined : uuid, // If using Supabase Postgres, let gen_random_uuid handle the ID
                    email,
                    name: name || 'Loyal Customer',
                    created_at: new Date().toISOString()
                };

                user = await db.insertUser(newUser);
            }

            // Return customer auth JWT token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: 'customer' },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            return res.status(200).json({
                success: true,
                message: 'OTP verified successfully',
                token,
                user
            });
        } catch (error) {
            console.error('Error verifying user OTP:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = UserAuthController;
