const CafeModel = require('../models/cafeModel');
const db = require('../config/db');

class CafeController {
    static async getBySlug(req, res) {
        try {
            const { slug } = req.params;
            const cafe = await CafeModel.findBySlug(slug);

            if (!cafe) {
                return res.status(404).json({
                    success: false,
                    message: 'Cafe not found'
                });
            }

            // Fetch coupons for this cafe (will be empty for now but matches schema)
            const coupons = await db.getCouponsByCafeId(cafe.id, true);

            return res.status(200).json({
                success: true,
                cafe,
                coupons
            });
        } catch (error) {
            console.error('Error fetching cafe by slug:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Update Cafe details (optional, but extremely useful for Cafe Owner Dashboard settings check!)
    static async updateDetails(req, res) {
        try {
            const { name, owner_name, email, address, upi_id } = req.body;
            const cafeId = req.cafe.id;

            const updates = {};
            if (name) updates.name = name;
            if (owner_name) updates.owner_name = owner_name;
            if (email) updates.email = email;
            if (address) updates.address = address;
            if (upi_id !== undefined) updates.upi_id = upi_id;

            const updatedCafe = await db.updateCafe(cafeId, updates);

            // Clean returned details
            const { password: _, ...cafeWithoutPassword } = updatedCafe;

            return res.status(200).json({
                success: true,
                message: 'Cafe details updated successfully',
                cafe: cafeWithoutPassword
            });
        } catch (error) {
            console.error('Error updating cafe details:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    // Create a new coupon for Cafe Owner
    static async createCoupon(req, res) {
        try {
            const { title, desc_text, badge_label, discount_type, discount_value, max_uses, frequency_per_day, min_bill_amount } = req.body;
            const cafeId = req.cafe.id;

            if (!title || !desc_text || !discount_type || discount_value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required coupon details (title, desc_text, discount_type, discount_value)'
                });
            }

            const limitValue = max_uses !== undefined && max_uses !== null ? max_uses : frequency_per_day;

            const newCoupon = {
                id: 'c-' + Math.floor(100000 + Math.random() * 900000),
                cafe_id: cafeId,
                title,
                desc_text,
                badge_label: badge_label || 'Save',
                discount_type,
                discount_value: parseFloat(discount_value),
                max_uses: limitValue ? parseInt(limitValue) : 1,
                min_bill_amount: min_bill_amount ? parseFloat(min_bill_amount) : 0,
                is_active: true,
                created_at: new Date().toISOString()
            };

            await db.insertCoupon(newCoupon);

            return res.status(201).json({
                success: true,
                message: 'Coupon created successfully',
                coupon: newCoupon
            });
        } catch (err) {
            console.error('Error creating coupon:', err);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getOwnerCoupons(req, res) {
        try {
            const cafeId = req.cafe.id;
            const coupons = await db.getCouponsByCafeId(cafeId, false);
            return res.status(200).json({
                success: true,
                coupons
            });
        } catch (error) {
            console.error('Error fetching owner coupons:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async toggleCouponActive(req, res) {
        try {
            const cafeId = req.cafe.id;
            const { id } = req.params;
            const { is_active } = req.body;

            const coupon = await db.getCouponById(id);
            if (!coupon) {
                return res.status(404).json({
                    success: false,
                    message: 'Coupon not found'
                });
            }

            if (coupon.cafe_id !== cafeId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to modify this coupon'
                });
            }

            const updatedCoupon = await db.updateCoupon(id, {
                is_active: is_active !== undefined ? is_active : !coupon.is_active
            });

            return res.status(200).json({
                success: true,
                message: 'Coupon status updated successfully',
                coupon: updatedCoupon
            });
        } catch (error) {
            console.error('Error toggling coupon status:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async getTransactions(req, res) {
        try {
            const cafeId = req.cafe.id;
            console.log('[DEBUG] getTransactions for cafeId:', cafeId);
            const transactions = await db.getTransactionsByCafeId(cafeId);
            console.log('[DEBUG] Returned transactions count:', transactions.length, transactions);
            return res.status(200).json({
                success: true,
                transactions
            });
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = CafeController;
