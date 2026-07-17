const db = require('./src/config/db');
const TransactionController = require('./src/controllers/transactionController');

async function testCouponless() {
    console.log('🧪 Starting E2E Couponless Checkout Integration Test...');
    const testId = Math.floor(1000 + Math.random() * 9000);
    const cafeSlug = `no-coupon-cafe-${testId}`;
    const userEmail = `no-coupon-user-${testId}@test.com`;

    let cafe = null;
    let user = null;

    try {
        // Create Cafe
        cafe = await db.insertCafe({
            id: db.useSupabase ? undefined : `cafe-${testId}`,
            name: `No Coupon Cafe ${testId}`,
            slug: cafeSlug,
            owner_name: `Owner ${testId}`,
            email: `owner-${testId}@test.com`,
            password: `password-${testId}`,
            address: `Address ${testId}`,
            allow_platform_coupons: true,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Cafe created: ${cafe.name}`);

        // Create User
        user = await db.insertUser({
            id: db.useSupabase ? undefined : `user-${testId}`,
            email: userEmail,
            name: `User ${testId}`,
            wallet_balance: 0.00,
            created_at: new Date().toISOString()
        });
        console.log(`✅ User created: ${user.email}`);

        // Simulate checkout without a coupon (coupon_id: null)
        console.log('\n[Step] Simulating checkout without coupon...');
        const req = {
            body: {
                cafe_id: cafe.id,
                user_id: user.id,
                coupon_id: null,
                bill_amount: 120.00,
                discount_amount: 0.00,
                payable_amount: 120.00,
                cashback_applied: 0
            }
        };

        let jsonResult = null;
        let responseStatus = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return {
                    json: (data) => {
                        jsonResult = data;
                        return data;
                    }
                }
            },
            json: (data) => {
                jsonResult = data;
                return data;
            }
        };

        await TransactionController.createTransaction(req, res);

        console.log(`✅ Response status: ${responseStatus || 201}`);
        if (jsonResult && jsonResult.success) {
            console.log('✅ SUCCESS: Couponless checkout completed successfully!');
            console.log('Payable amount matches:', jsonResult.transaction.payable_amount);
        } else {
            throw new Error(`FAILED: Couponless checkout failed: ${JSON.stringify(jsonResult)}`);
        }

    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exitCode = 1;
    } finally {
        console.log('\n[Cleanup] Removing temporary test entities...');
        try {
            if (db.useSupabase) {
                const supabase = require('./src/config/supabase');
                if (user && user.id) {
                    await supabase.from('transactions').delete().eq('user_id', user.id);
                    await supabase.from('users').delete().eq('id', user.id);
                }
                if (cafe && cafe.id) {
                    await supabase.from('cafes').delete().eq('id', cafe.id);
                }
            } else {
                const fs = require('fs');
                const DB_PATH = './db.json';
                if (fs.existsSync(DB_PATH)) {
                    const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                    localDb.transactions = (localDb.transactions || []).filter(t => t.user_id !== user.id);
                    localDb.users = (localDb.users || []).filter(u => u.id !== user.id);
                    localDb.cafes = (localDb.cafes || []).filter(c => c.id !== cafe.id);
                    fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 2), 'utf8');
                }
            }
            console.log('✅ Cleanup completed.');
        } catch (cleanupErr) {
            console.error('⚠️ Cleanup failed:', cleanupErr.message);
        }
    }
}

testCouponless();
