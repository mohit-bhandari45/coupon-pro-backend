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
            const coupons = await db.getCouponsByCafeId(cafe.id);

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
            const { title, desc_text, badge_label, discount_type, discount_value, frequency_per_day } = req.body;
            const cafeId = req.cafe.id;

            if (!title || !desc_text || !discount_type || discount_value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required coupon details (title, desc_text, discount_type, discount_value)'
                });
            }

            const newCoupon = {
                id: 'c-' + Math.floor(100000 + Math.random() * 900000),
                cafe_id: cafeId,
                title,
                desc_text,
                badge_label: badge_label || 'Save',
                discount_type,
                discount_value: parseFloat(discount_value),
                frequency_per_day: frequency_per_day ? parseInt(frequency_per_day) : 1,
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
}

module.exports = CafeController;
