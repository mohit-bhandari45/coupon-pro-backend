const db = require('../config/db');

class CouponController {
    static async sendCouponOtp(req, res) {
        try {
            const { email, coupon_id } = req.body;

            if (!email || !coupon_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and coupon_id are required'
                });
            }

            // Check if coupon exists
            const coupon = await db.getCouponById(coupon_id);
            if (!coupon) {
                return res.status(404).json({
                    success: false,
                    message: 'Coupon not found'
                });
            }

            // Verify if coupon has remaining count
            if (coupon.remaining_uses !== undefined && coupon.remaining_uses <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This coupon has been fully redeemed'
                });
            }

            // Check if user has exceeded their lifetime coupon limit (3 max)
            const user = await db.getUserByEmail(email);
            if (user) {
                const totalRedemptions = await db.getUserCouponRedemptionCount(user.id);
                if (totalRedemptions >= 3) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have exhausted your coupon redemption credits limit (3 max)'
                    });
                }
            }

            // Generate a 6-digit OTP code string
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins expiration

            const newOtp = {
                email,
                code,
                purpose: 'coupon',
                expires_at: expiresAt,
                created_at: new Date().toISOString()
            };

            await db.insertOtpCode(newOtp);

            // Log OTP code simulation in console/terminal for developer use
            console.log(`
┌────────────────────────────────────────────────────────┐
│ ✉️  [SIMULATOR] Coupon Redemption OTP dispatched       │
├────────────────────────────────────────────────────────┤
│ To:      ${email.padEnd(38)} │
│ Coupon:  ${coupon.title.substring(0, 38).padEnd(38)} │
│ OTP:     ${code.padEnd(38)} │
│ Purpose: Coupon Redemption (coupon)                    │
│ Expiry:  10 mins                                       │
└────────────────────────────────────────────────────────┘
`);

            // Send real email OTP asynchronously
            const MailService = require('../services/mailService');
            MailService.sendCouponOtp({ to: email, couponTitle: coupon.title, code }).catch(err => {
                console.error('❌ [Mailer] Email OTP sending error:', err);
            });

            return res.status(200).json({
                success: true,
                message: 'Redemption verification code sent to your email'
            });
        } catch (error) {
            console.error('Error sending coupon validation OTP:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async verifyCouponOtp(req, res) {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and OTP code are required'
                });
            }

            // Verify and consume the coupon OTP code from DB
            const verified = await db.verifyAndUseOtpCode(email, code, 'coupon');

            if (!verified) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired coupon verification code'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Coupon OTP verified successfully. Discount applied.'
            });
        } catch (error) {
            console.error('Error verifying coupon OTP:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = CouponController;
