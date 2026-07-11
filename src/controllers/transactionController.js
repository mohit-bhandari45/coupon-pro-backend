const db = require('../config/db');
const MailService = require('../services/mailService');

class TransactionController {
    static async createTransaction(req, res) {
        try {
            const { cafe_id, user_id, coupon_id, bill_amount, discount_amount, payable_amount, cashback_applied } = req.body;

            if (!cafe_id || !bill_amount) {
                return res.status(400).json({
                    success: false,
                    message: 'cafe_id and bill_amount are required'
                });
            }

            // Fetch user and cafe details for invoice simulation
            const [cafe, user, coupon] = await Promise.all([
                db.getCafeById(cafe_id),
                user_id ? db.getUserById(user_id) : Promise.resolve(null),
                coupon_id ? db.getCouponById(coupon_id) : Promise.resolve(null)
            ]);

            if (!cafe) {
                return res.status(404).json({
                    success: false,
                    message: 'Cafe not found in system'
                });
            }

            if (user_id && !user) {
                return res.status(401).json({
                    success: false,
                    session_expired: true,
                    message: 'User session not found in system. Please sign in again.'
                });
            }

            // Safety check: verify user has remaining credit balance for any coupon redemption
            if (user_id && coupon_id) {
                const totalRedemptions = await db.getUserCouponRedemptionCount(user_id);
                if (totalRedemptions >= 3) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have exhausted your coupon redemption credits balance (3 max)'
                    });
                }

                // Verify coupon is available in user's bank (wallet)
                const claimedCoupons = await db.getUserClaimedCoupons(user_id, cafe_id);
                const isClaimedAndAvailable = claimedCoupons.some(c => c.id === coupon_id);
                if (!isClaimedAndAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: 'Coupon is not available in your Coupon Bank or has already been redeemed'
                    });
                }
            }

            // Check applied cashback balance
            const cashbackAmount = parseFloat(cashback_applied || 0);
            if (user_id && cashbackAmount > 0) {
                const balance = parseFloat(user.wallet_balance || 0);
                if (cashbackAmount > balance + 0.01) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient cashback wallet balance. Available: ₹${balance.toFixed(2)}`
                    });
                }
            }

            // Check if coupon is platform-funded and store allows it
            if (coupon && coupon.funded_by === 'platform') {
                if (cafe.allow_platform_coupons === false || cafe.allow_platform_coupons === 'false') {
                    return res.status(400).json({
                        success: false,
                        message: 'This café does not accept platform promotional codes.'
                    });
                }
            }

            // Check minimum bill amount cap
            if (coupon && coupon.min_bill_amount) {
                const minBill = parseFloat(coupon.min_bill_amount);
                if (parseFloat(bill_amount) < minBill) {
                    return res.status(400).json({
                        success: false,
                        message: `Minimum bill of ₹${minBill.toFixed(2)} is required for this coupon`
                    });
                }
            }

            const uuid = 't-' + Math.floor(100000 + Math.random() * 900000);
            const newTxn = {
                id: db.useSupabase ? undefined : uuid,
                cafe_id,
                user_id: user_id || null,
                coupon_id: coupon_id || null,
                bill_amount: parseFloat(bill_amount),
                discount_amount: parseFloat(discount_amount || 0),
                payable_amount: parseFloat(payable_amount),
                cashback_applied: cashbackAmount,
                status: 'completed', // auto-complete for coupon flow
                created_at: new Date().toISOString()
            };

            const savedTxn = await db.insertTransaction(newTxn);

            // Mark the coupon as used in the user's claimed coupons wallet
            if (user_id && coupon_id) {
                await db.useClaimedCoupon(user_id, coupon_id);
            }

            // Deduct applied cashback from user account
            if (user_id && cashbackAmount > 0) {
                await db.deductUserWalletBalance(user_id, cashbackAmount);
            }

            // Log customer invoice receipt simulation
            console.log(`
┌────────────────────────────────────────────────────────┐
│ 🧾  [INVOICE SIMULATOR] Transaction Receipt Issued       │
├────────────────────────────────────────────────────────┤
│ Cafe:       ${cafe.name.substring(0, 38).padEnd(38)} │
│ Customer:   ${(user ? user.name : 'Guest Customer').padEnd(38)} │
│ Email:      ${(user ? user.email : 'N/A').padEnd(38)} │
│ Coupon:     ${(coupon ? coupon.title : 'None').substring(0, 38).padEnd(38)} │
│ Bill:       ₹${parseFloat(bill_amount).toFixed(2).padEnd(37)} │
│ Discount:   -₹${parseFloat(discount_amount || 0).toFixed(2).padEnd(36)} │
│ Cashback:   -₹${cashbackAmount.toFixed(2).padEnd(36)} │
│ Paid:       ₹${parseFloat(payable_amount).toFixed(2).padEnd(37)} │
│ Status:     COMPLETED                                  │
└────────────────────────────────────────────────────────┘
`);

            // Send invoice email to cafe owner asynchronously (so we don't delay client response)
            MailService.sendCafeOwnerInvoice({
                cafe,
                customerEmail: user ? user.email : 'Guest Customer',
                couponTitle: coupon ? coupon.title : 'None',
                transaction: {
                    ...savedTxn,
                    cashback_applied: cashbackAmount
                }
            }).catch(err => {
                console.error('❌ [Mailer] Async cafe owner invoice sending failed:', err);
            });

            return res.status(201).json({
                success: true,
                message: 'Transaction saved and invoice email sent to owner',
                transaction: savedTxn
            });
        } catch (error) {
            console.error('Error creating transaction:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = TransactionController;
