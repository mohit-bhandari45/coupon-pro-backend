const db = require('../config/db');
const MailService = require('../services/mailService');

class AdminController {
    static async getCustomers(req, res) {
        try {
            const customers = await db.getRegisteredUsers();
            return res.json({ success: true, customers });
        } catch (error) {
            console.error('Error fetching customers:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch customer list' });
        }
    }

    static async checkCouponByCode(req, res) {
        try {
            const { code } = req.params;
            const cleanCode = code.trim().toUpperCase();

            const coupon = await db.getCouponById(cleanCode);
            if (!coupon) {
                return res.json({ success: true, exists: false });
            }

            const useCount = await db.getCouponUseCount(cleanCode);
            const remainingUses = Math.max(0, (coupon.max_uses ?? 1) - useCount);

            return res.json({
                success: true,
                exists: true,
                coupon,
                usage: {
                    totalUses: coupon.max_uses ?? 1,
                    usedCount: useCount,
                    remainingUses
                }
            });
        } catch (error) {
            console.error('Error checking coupon by code:', error);
            return res.status(500).json({ success: false, message: 'Failed to check coupon code' });
        }
    }

    static async createOrReactivateCoupon(req, res) {
        try {
            const {
                code,
                title,
                desc_text,
                badge_label,
                discount_type,
                discount_value,
                min_bill_amount,
                max_uses,
                target_email,
                overwrite
            } = req.body;

            if (!code || !target_email) {
                return res.status(400).json({
                    success: false,
                    message: 'Required fields: code, target_email'
                });
            }

            const cleanCode = code.trim().toUpperCase();

            const existing = await db.getCouponById(cleanCode);
            if (existing) {
                const useCount = await db.getCouponUseCount(cleanCode);
                const remainingUses = Math.max(0, (existing.max_uses ?? 1) - useCount);

                if (remainingUses > 0) {
                    // Send existing active coupon directly to target email without modifying the database configuration
                    await MailService.sendCouponCodeEmail({
                        to: target_email,
                        code: cleanCode,
                        title: existing.title,
                        desc_text: existing.desc_text,
                        discount_type: existing.discount_type,
                        discount_value: existing.discount_value,
                        min_bill_amount: existing.min_bill_amount
                    });

                    return res.status(200).json({
                        success: true,
                        message: `Active promo code "${cleanCode}" successfully sent to ${target_email}!`
                    });
                } else {
                    // Depleted code
                    if (overwrite === true) {
                        if (!title || !desc_text || !discount_type || !discount_value) {
                            return res.status(400).json({
                                success: false,
                                message: 'Required fields for reactivation: title, desc_text, discount_type, discount_value'
                            });
                        }
                        // Reactivate existing coupon (reset timestamp, activate, and update config parameters!)
                        await db.updateCoupon(cleanCode, {
                            title,
                            desc_text,
                            badge_label: badge_label || 'Special',
                            discount_type,
                            discount_value: parseFloat(discount_value),
                            min_bill_amount: min_bill_amount ? parseFloat(min_bill_amount) : 0,
                            max_uses: max_uses ? parseInt(max_uses) : 1,
                            max_claims: max_uses ? parseInt(max_uses) : 1,
                            created_at: new Date().toISOString(),
                            is_active: true
                        });

                        // Fetch updated config to send in email
                        const updated = await db.getCouponById(cleanCode);
                        await MailService.sendCouponCodeEmail({
                            to: target_email,
                            code: cleanCode,
                            title: updated.title,
                            desc_text: updated.desc_text,
                            discount_type: updated.discount_type,
                            discount_value: updated.discount_value,
                            min_bill_amount: updated.min_bill_amount
                        });

                        return res.json({
                            success: true,
                            message: `Coupon "${cleanCode}" reactivated with new parameters and sent to ${target_email}!`
                        });
                    } else {
                        // Warn client that the code exists but is depleted
                        return res.status(200).json({
                            success: false,
                            depleted: true,
                            message: `The code "${cleanCode}" was fully used. Overwrite and reactivate it?`
                        });
                    }
                }
            }

            // For new coupon creation, require configuration fields
            if (!title || !desc_text || !discount_type || !discount_value) {
                return res.status(400).json({
                    success: false,
                    message: 'Required fields for new coupon: title, desc_text, discount_type, discount_value'
                });
            }

            // Create new campaign coupon
            const newCoupon = {
                id: cleanCode,
                cafe_id: null,
                title,
                desc_text,
                badge_label: badge_label || 'Special',
                discount_type,
                discount_value: parseFloat(discount_value),
                max_uses: max_uses ? parseInt(max_uses) : 1,
                max_claims: max_uses ? parseInt(max_uses) : 1,
                min_bill_amount: min_bill_amount ? parseFloat(min_bill_amount) : 0,
                is_active: true,
                is_public: false, // Promo code-only: do not show in public selectable loyalty lists
                created_at: new Date().toISOString()
            };

            await db.insertCoupon(newCoupon);

            await MailService.sendCouponCodeEmail({
                to: target_email,
                code: newCoupon.id,
                title: newCoupon.title,
                desc_text: newCoupon.desc_text,
                discount_type: newCoupon.discount_type,
                discount_value: newCoupon.discount_value,
                min_bill_amount: newCoupon.min_bill_amount
            });

            return res.status(201).json({
                success: true,
                message: `Promo code "${newCoupon.id}" created and sent to ${target_email}!`
            });
        } catch (error) {
            console.error('Error creating/reactivating coupon:', error);
            return res.status(500).json({ success: false, message: 'Failed to process coupon action' });
        }
    }
}

module.exports = AdminController;
