const db = require('../config/db');

class CouponController {

    static async applyPromoCode(req, res) {
        try {
            const { code, email, billAmount, cafeSlug } = req.body;

            if (!code || !email || !billAmount || !cafeSlug) {
                return res.status(400).json({
                    success: false,
                    message: 'Required: code, email, billAmount, and cafeSlug'
                });
            }

            const coupon = await db.getCouponById(code);
            if (!coupon) {
                return res.status(404).json({
                    success: false,
                    message: 'Invalid promo code'
                });
            }

            if (!coupon.is_active) {
                return res.status(400).json({
                    success: false,
                    message: 'This promo code is currently inactive'
                });
            }

            // Verify global remaining uses of this promo code
            if (coupon.remaining_uses !== undefined && coupon.remaining_uses <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This coupon has been fully redeemed'
                });
            }

            // Verify min bill constraint
            if (parseFloat(billAmount) < parseFloat(coupon.min_bill_amount || 0)) {
                return res.status(400).json({
                    success: false,
                    message: `Minimum bill of ₹${parseFloat(coupon.min_bill_amount).toFixed(2)} is required for this coupon`
                });
            }

            // Verify cafe restriction if coupon is not global
            if (coupon.cafe_id !== null) {
                const cafe = await db.getCafeBySlug(cafeSlug);
                if (!cafe || coupon.cafe_id !== cafe.id) {
                    return res.status(400).json({
                        success: false,
                        message: 'This promo code is not valid at this cafe'
                    });
                }
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

                // Check if user has already redeemed this specific promo code previously
                let isAlreadyUsed = false;
                if (db.useSupabase) {
                    const { data: usedClaim } = await db.supabase
                        .from('user_claimed_coupons')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('coupon_id', coupon.id)
                        .eq('status', 'used')
                        .maybeSingle();
                    if (usedClaim) isAlreadyUsed = true;
                } else {
                    const dbInstance = db.readDb();
                    isAlreadyUsed = (dbInstance.user_claimed_coupons || []).some(
                        r => r.user_id === user.id && r.coupon_id === coupon.id && r.status === 'used'
                    );
                }

                if (isAlreadyUsed) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have already redeemed this promo code'
                    });
                }

                // Auto-claim the coupon so it is registered in their bank
                try {
                    await db.claimCouponForUser(user.id, coupon.id);
                } catch (claimErr) {
                    return res.status(400).json({
                        success: false,
                        message: claimErr.message || 'Failed to claim promo code'
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Promo code applied successfully!',
                coupon
            });
        } catch (error) {
            console.error('Error applying promo code:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = CouponController;
