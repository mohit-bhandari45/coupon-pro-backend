const db = require('../config/db');

class TransactionController {
    static async createTransaction(req, res) {
        try {
            const { cafe_id, user_id, coupon_id, bill_amount, discount_amount, payable_amount } = req.body;

            if (!cafe_id || !bill_amount || !payable_amount) {
                return res.status(400).json({
                    success: false,
                    message: 'cafe_id, bill_amount, and payable_amount are required'
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

            const uuid = 't-' + Math.floor(100000 + Math.random() * 900000);
            const newTxn = {
                id: db.useSupabase ? undefined : uuid,
                cafe_id,
                user_id: user_id || null,
                coupon_id: coupon_id || null,
                bill_amount: parseFloat(bill_amount),
                discount_amount: parseFloat(discount_amount || 0),
                payable_amount: parseFloat(payable_amount),
                status: 'completed', // auto-complete for coupon flow
                created_at: new Date().toISOString()
            };

            const savedTxn = await db.insertTransaction(newTxn);

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
│ Paid:       ₹${parseFloat(payable_amount).toFixed(2).padEnd(37)} │
│ Status:     COMPLETED                                  │
└────────────────────────────────────────────────────────┘
`);

            return res.status(201).json({
                success: true,
                message: 'Transaction saved and simulated invoice receipt printed',
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
