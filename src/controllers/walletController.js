const db = require('../config/db');

class WalletController {
    static async getUserWallet(req, res) {
        try {
            const { userId, cafeId } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }

            const coupons = await db.getUserClaimedCoupons(userId, cafeId);
            return res.json({ success: true, coupons });
        } catch (error) {
            console.error('Error fetching user wallet:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch user coupon bank' });
        }
    }

    static async getAdvertisedCoupons(req, res) {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }

            const coupons = await db.getAdvertisedCoupons(userId);
            return res.json({ success: true, coupons });
        } catch (error) {
            console.error('Error fetching advertised coupons:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch advertised coupons' });
        }
    }

    static async claimCoupon(req, res) {
        try {
            const { userId, couponId } = req.body;
            if (!userId || !couponId) {
                return res.status(400).json({ success: false, message: 'userId and couponId are required' });
            }

            const result = await db.claimCouponForUser(userId, couponId);
            return res.json(result);
        } catch (error) {
            console.error('Error claiming coupon:', error);
            return res.status(400).json({ success: false, message: error.message || 'Failed to claim coupon' });
        }
    }
}

module.exports = WalletController;
