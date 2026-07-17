const db = require('./src/config/db');
const WalletController = require('./src/controllers/walletController');
const TransactionController = require('./src/controllers/transactionController');

async function testCreditsSystem() {
    console.log('🧪 Starting E2E Credits Earning and Deduction Verification Test...');
    const testId = Math.floor(1000 + Math.random() * 9000);
    const cafeASlug = `credits-cafe-a-${testId}`;
    const userEmail = `credits-user-${testId}@test.com`;
    const couponId = `WELCOME-${testId}`;

    let cafeA = null;
    let user = null;

    try {
        // 1. Create Cafe A
        cafeA = await db.insertCafe({
            id: db.useSupabase ? undefined : `cafe-a-${testId}`,
            name: `Cafe A ${testId}`,
            slug: cafeASlug,
            owner_name: `Owner A ${testId}`,
            email: `owner-a-${testId}@test.com`,
            password: `password-a-${testId}`,
            address: `Address A ${testId}`,
            allow_platform_coupons: true,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Cafe A created: ${cafeA.name} (${cafeA.id})`);

        // 2. Create User
        user = await db.insertUser({
            id: db.useSupabase ? undefined : `user-${testId}`,
            email: userEmail,
            name: `User ${testId}`,
            wallet_balance: 0.00,
            created_at: new Date().toISOString()
        });
        console.log(`✅ User created: ${user.email} (${user.id})`);

        // Assert user has 3 default platform credits
        console.log('\n[Step 1] Verifying user starts with 3 default platform credits...');
        let balances = await db.getUserBalances(user.id, cafeA.id);
        console.log(`Current Balances:`, balances);
        if (balances.platform !== 3 || balances.merchant !== 0) {
            throw new Error(`FAILED: Expected platform credits 3 and merchant 0, got ${JSON.stringify(balances)}`);
        }
        console.log('✅ Success: default balances verified.');

        // 3. Earn Platform Credit via ad
        console.log('\n[Step 2] Earning 1 platform credit via ad...');
        let earnResult = null;
        const resEarn = {
            json: (data) => {
                earnResult = data;
                return data;
            }
        };
        await WalletController.earnCredit({
            body: {
                userId: user.id,
                actionType: 'watch-ad',
                cafeId: cafeA.id
            }
        }, resEarn);
        console.log(`Earn result (watch-ad):`, earnResult);
        if (!earnResult || !earnResult.success || earnResult.platform !== 4) {
            throw new Error(`FAILED: Earning ad credit failed: ${JSON.stringify(earnResult)}`);
        }
        console.log('✅ Success: earned platform credit.');

        // 4. Earn Cafe Credit via feedback survey
        console.log('\n[Step 3] Earning 2 cafe-specific credits via survey...');
        await WalletController.earnCredit({
            body: {
                userId: user.id,
                actionType: 'cafe-survey',
                cafeId: cafeA.id
            }
        }, resEarn);
        console.log(`Earn result (cafe-survey):`, earnResult);
        if (!earnResult || !earnResult.success || earnResult.merchant !== 2) {
            throw new Error(`FAILED: Earning survey credit failed: ${JSON.stringify(earnResult)}`);
        }
        console.log('✅ Success: earned cafe specific credit.');

        // 5. Build a few welcome/loyalty coupons (since coupons are single-use per customer)
        const couponId1 = `${couponId}-1`;
        const couponId2 = `${couponId}-2`;
        const couponId3 = `${couponId}-3`;
        const couponId4 = `${couponId}-4`;

        for (const cid of [couponId1, couponId2, couponId3, couponId4]) {
            await db.insertCoupon({
                id: cid,
                cafe_id: cafeA.id,
                title: `Cafe A Reward`,
                desc_text: `Get ₹10 off!`,
                badge_label: 'Loyalty',
                discount_type: 'flat',
                discount_value: 10,
                max_uses: 100,
                min_bill_amount: 0,
                is_active: true,
                is_public: true,
                is_advertised: false,
                created_at: new Date().toISOString()
            });
        }
        console.log(`✅ Welcome Coupons created: ${couponId1}, ${couponId2}, ${couponId3}, ${couponId4}`);

        // 6. Redeem coupon and test priority deduction (should deduct from merchant first)
        console.log('\n[Step 4] Redeeming coupon (should consume merchant credit first)...');
        let txnResult = null;
        const resTxn = {
            json: (data) => {
                txnResult = data;
                return data;
            },
            status: function (code) { return this; }
        };
        await TransactionController.createTransaction({
            body: {
                user_id: user.id,
                cafe_id: cafeA.id,
                bill_amount: 100,
                coupon_id: couponId1,
                discount_amount: 10,
                payable_amount: 90,
                cashback_applied: 0
            }
        }, resTxn);
        console.log(`Checkout transaction response:`, txnResult);
        if (!txnResult || !txnResult.success) {
            throw new Error(`FAILED: Checkout transaction failed: ${JSON.stringify(txnResult)}`);
        }

        balances = await db.getUserBalances(user.id, cafeA.id);
        console.log(`Balances post 1st transaction:`, balances);
        if (balances.merchant !== 1 || balances.platform !== 4) {
            throw new Error(`FAILED: Priority deduction issue. Expected merchant 1, platform 4. Got: ${JSON.stringify(balances)}`);
        }
        console.log('✅ Success: Priority deduction of merchant credit verified.');

        // 7. Deduct again (merchant drops to 0, platform remains 4)
        console.log('\n[Step 5] Redeeming coupon again (should consume remaining merchant credit)...');
        await TransactionController.createTransaction({
            body: {
                user_id: user.id,
                cafe_id: cafeA.id,
                bill_amount: 100,
                coupon_id: couponId2,
                discount_amount: 10,
                payable_amount: 90,
                cashback_applied: 0
            }
        }, resTxn);
        balances = await db.getUserBalances(user.id, cafeA.id);
        console.log(`Balances post 2nd transaction:`, balances);
        if (balances.merchant !== 0 || balances.platform !== 4) {
            throw new Error(`FAILED: Expected merchant 0, platform 4. Got: ${JSON.stringify(balances)}`);
        }
        console.log('✅ Success: Second merchant credit consumed.');

        // 8. Deduct again (merchant is 0, should fallback to platform and drop platform to 3)
        console.log('\n[Step 6] Redeeming coupon 3rd time (should fall back to platform credit)...');
        await TransactionController.createTransaction({
            body: {
                user_id: user.id,
                cafe_id: cafeA.id,
                bill_amount: 100,
                coupon_id: couponId3,
                discount_amount: 10,
                payable_amount: 90,
                cashback_applied: 0
            }
        }, resTxn);
        balances = await db.getUserBalances(user.id, cafeA.id);
        console.log(`Balances post 3rd transaction:`, balances);
        if (balances.merchant !== 0 || balances.platform !== 3) {
            throw new Error(`FAILED: Expected merchant 0, platform 3. Got: ${JSON.stringify(balances)}`);
        }
        console.log('✅ Success: Priority fallback to platform credit verified.');

        // 9. Force credits to 0 and verify checkout blocks
        console.log('\n[Step 7] Testing block when total credits is 0...');
        // Reset balances to 0
        if (db.useSupabase) {
            const supabase = require('./src/config/supabase');
            await supabase.from('users').update({ platform_credits: 0 }).eq('id', user.id);
            await supabase.from('user_merchant_credits').update({ credits: 0 }).eq('user_id', user.id).eq('cafe_id', cafeA.id);
        } else {
            const fs = require('fs');
            const DB_PATH = './db.json';
            const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            const u = localDb.users.find(x => x.id === user.id);
            if (u) u.platform_credits = 0;
            const mc = localDb.user_merchant_credits.find(x => x.user_id === user.id && x.cafe_id === cafeA.id);
            if (mc) mc.credits = 0;
            fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 2), 'utf8');
        }

        balances = await db.getUserBalances(user.id, cafeA.id);
        console.log(`Verified credits are zeroed out:`, balances);
        if (balances.platform !== 0 || balances.merchant !== 0) {
            throw new Error(`FAILED: Could not mock zero credits.`);
        }

        console.log('Redeeming coupon 4th time (with 0 credits)...');
        // Reset local status to check block
        txnResult = null;
        await TransactionController.createTransaction({
            body: {
                user_id: user.id,
                cafe_id: cafeA.id,
                bill_amount: 100,
                coupon_id: couponId4,
                discount_amount: 10,
                payable_amount: 90,
                cashback_applied: 0
            }
        }, resTxn);
        console.log(`Zero credits checkout response:`, txnResult);
        if (txnResult && txnResult.success) {
            throw new Error(`FAILED: Allowed checkout to succeed with 0 credits!`);
        }
        console.log('✅ Success: Checkout was blocked due to insufficient credits.');
        console.log('\n🌟🌟 ALL CREDIT SYSTEM LIFECYCLE CHECKS PASSED SUCCESSFULLY! 🌟🌟');

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
                    await supabase.from('user_merchant_credits').delete().eq('user_id', user.id);
                    await supabase.from('users').delete().eq('id', user.id);
                }
                if (cafeA && cafeA.id) {
                    await supabase.from('coupons').delete().eq('cafe_id', cafeA.id);
                    await supabase.from('cafes').delete().eq('id', cafeA.id);
                }
            } else {
                const fs = require('fs');
                const DB_PATH = './db.json';
                if (fs.existsSync(DB_PATH)) {
                    const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                    localDb.transactions = (localDb.transactions || []).filter(t => t.user_id !== user.id);
                    localDb.user_merchant_credits = (localDb.user_merchant_credits || []).filter(mc => mc.user_id !== user.id);
                    localDb.users = (localDb.users || []).filter(u => u.id !== user.id);
                    if (cafeA && cafeA.id) {
                        localDb.coupons = (localDb.coupons || []).filter(c => c.cafe_id !== cafeA.id);
                        localDb.cafes = (localDb.cafes || []).filter(c => c.id !== cafeA.id);
                    }
                    fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 2), 'utf8');
                }
            }
            console.log('✅ Cleanup completed.');
        } catch (cleanupErr) {
            console.error('⚠️ Cleanup failed:', cleanupErr.message);
        }
        process.exit();
    }
}

testCreditsSystem();
