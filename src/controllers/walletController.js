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

    static async shareCoupon(req, res) {
        try {
            const { referrerId, couponId, refereeEmail } = req.body;
            if (!referrerId || !couponId || !refereeEmail) {
                return res.status(400).json({ success: false, message: 'referrerId, couponId, and refereeEmail are required' });
            }

            const result = await db.shareCoupon(referrerId, couponId, refereeEmail.trim());
            return res.json(result);
        } catch (error) {
            console.error('Error sharing coupon:', error);
            return res.status(400).json({ success: false, message: error.message || 'Failed to share coupon' });
        }
    }

    static async getUserCredits(req, res) {
        try {
            const { userId, cafeId } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }
            const balances = await db.getUserBalances(userId, cafeId);
            return res.json({ success: true, ...balances });
        } catch (error) {
            console.error('Error fetching user credits:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch user credits balance' });
        }
    }

    static async earnCredit(req, res) {
        try {
            const { userId, actionType, cafeId } = req.body;
            if (!userId || !actionType) {
                return res.status(400).json({ success: false, message: 'userId and actionType are required' });
            }

            if (actionType === 'watch-ad' || actionType === 'follow-ig') {
                await db.incrementPlatformCredits(userId, 1);
            } else if (actionType === 'cafe-survey') {
                if (!cafeId) return res.status(400).json({ success: false, message: 'cafeId is required for merchant survey credit' });
                await db.incrementMerchantCredits(userId, cafeId, 2);
            } else if (actionType === 'cafe-video' || actionType === 'cafe-social-follow') {
                if (!cafeId) return res.status(400).json({ success: false, message: 'cafeId is required for merchant credit' });
                await db.incrementMerchantCredits(userId, cafeId, 1);
            } else {
                return res.status(400).json({ success: false, message: 'Invalid actionType' });
            }

            const balances = await db.getUserBalances(userId, cafeId);
            return res.json({ success: true, message: 'Credits awarded successfully!', ...balances });
        } catch (error) {
            console.error('Error earning credit:', error);
            return res.status(500).json({ success: false, message: 'Failed to earn credit' });
        }
    }
}

module.exports = WalletController;
