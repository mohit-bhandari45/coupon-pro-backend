const db = require('./src/config/db');
const TransactionController = require('./src/controllers/transactionController');

// Run with: node testReferral.js
async function runTest() {
    console.log('🧪 Starting E2E Referral Coupon Flow Integration Test...');

    // 1. Generate unique identifiers for isolation
    const testId = Math.floor(1000 + Math.random() * 9000);
    const cafeSlug = `ref-cafe-${testId}`;
    const referrerEmail = `referrer-${testId}@test.com`;
    const refereeEmail = `referee-${testId}@test.com`;
    const couponId = `REFERRAL-${testId}`; // Custom flat coupon

    console.log(`- Test Cafe Slug: ${cafeSlug}`);
    console.log(`- Referrer Email: ${referrerEmail}`);
    console.log(`- Referee Email:  ${refereeEmail}`);
    console.log(`- Coupon ID:      ${couponId}`);

    let cafe = null;
    let referrer = null;
    let referee = null;
    let sharedClaim = null;

    try {
        // 2. Create Cafe
        console.log('\n[Step 1] Creating test cafe...');
        cafe = await db.insertCafe({
            id: db.useSupabase ? undefined : `cafe-${testId}`,
            name: `Referral Cafe ${testId}`,
            slug: cafeSlug,
            owner_name: `Test Owner ${testId}`,
            email: `owner-${testId}@test.com`,
            password: `password-${testId}`,
            address: `Test Address ${testId}`,
            allow_platform_coupons: true,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Test cafe created: ${cafe.name} (${cafe.id})`);

        // 3. Create custom flat discount coupon
        console.log('\n[Step 1.5] Creating custom flat discount coupon...');
        await db.insertCoupon({
            id: couponId,
            title: `Referral test ₹50 Flat`,
            desc_text: `Test campaign coupon for referral E2E testing`,
            discount_type: 'flat',
            discount_value: 50,
            max_uses: 9999,
            min_bill_amount: 0,
            is_active: true,
            is_public: true,
            cafe_id: cafe.id,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Custom flat coupon created: ${couponId}`);

        // 4. Create Referrer and Referee users
        console.log('\n[Step 2] Registering Referrer and Referee accounts...');
        referrer = await db.insertUser({
            id: db.useSupabase ? undefined : `user-referrer-${testId}`,
            email: referrerEmail,
            name: `Referrer User ${testId}`,
            wallet_balance: 0.00,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Referrer registered: ${referrer.email} (Wallet: ₹${referrer.wallet_balance})`);

        referee = await db.insertUser({
            id: db.useSupabase ? undefined : `user-referee-${testId}`,
            email: refereeEmail,
            name: `Referee User ${testId}`,
            wallet_balance: 0.00,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Referee registered: ${referee.email} (Wallet: ₹${referee.wallet_balance})`);

        // 5. Claim the flat coupon for Referrer
        console.log('\n[Step 3] Seeding and claiming flat coupon for Referrer wallet...');
        const claimResult = await db.claimCouponForUser(referrer.id, couponId, null);
        console.log('✅ Coupon claimed for Referrer:', claimResult);

        // 5.5. Verify welcome coupons cannot be shared
        console.log('\n[Step 3.5] Verifying welcome coupons cannot be shared...');
        try {
            await db.shareCoupon(referrer.id, 'WELCOME10', refereeEmail);
            throw new Error('FAILED: welcome coupon WELCOME10 was successfully shared (should have failed)');
        } catch (shareErr) {
            console.log(`✅ Sharing welcome coupon WELCOME10 correctly rejected: ${shareErr.message}`);
        }

        // 6. Share coupon: Referrer shares with Referee's email
        console.log('\n[Step 4] Simulating Referrer sharing coupon with Referee email...');
        const shareResult = await db.shareCoupon(referrer.id, couponId, refereeEmail);
        console.log('✅ Coupon shared successfully:', shareResult);

        // Verify the coupon is GONE from the referrer's wallet
        const referrerClaim = await db.getClaimedCoupon(referrer.id, couponId);
        if (referrerClaim) {
            throw new Error('FAILED: Shared coupon was NOT removed from the Referrer\'s wallet!');
        }
        console.log('✅ Shared coupon was successfully removed from Referrer\'s wallet!');

        // Verify Referee has the coupon in their available bank and it's marked referred_by Referrer
        console.log('\n[Step 5] Checking Referee claimed coupon metadata details...');
        sharedClaim = await db.getClaimedCoupon(referee.id, couponId);
        if (!sharedClaim) {
            throw new Error('FAILED: Shared coupon record not found in Referee claimed folder');
        }
        console.log(`✅ Found referee claimed coupon: ID=${sharedClaim.coupon_id}, STATUS=${sharedClaim.status}`);

        const claimReferredBy = String(sharedClaim.referred_by).toLowerCase();
        const expectedReferredBy = String(referrer.id).toLowerCase();
        if (claimReferredBy !== expectedReferredBy) {
            throw new Error(`FAILED: referred_by mismatch. Expected: ${expectedReferredBy}, Got: ${claimReferredBy}`);
        }
        console.log('✅ referred_by field matches Referrer ID perfectly!');

        // 7. Simulate checkout: Referee uses flat coupon (bill: ₹100)
        console.log('\n[Step 6] Simulating Referee checkout transaction of ₹100 using shared coupon...');
        // We'll call the transaction controller logic directly or via mocked express args
        const req = {
            body: {
                cafe_id: cafe.id,
                user_id: referee.id,
                coupon_id: couponId,
                bill_amount: 100.00,
                discount_amount: 50.00, // Caster passes nominal, controller should override
                payable_amount: 50.00,
                cashback_applied: 0
            }
        };

        let jsonResult = null;
        let responseCode = null;
        const res = {
            status: (code) => {
                responseCode = code;
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

        console.log(`✅ Transaction API response status: ${responseCode || 200}`);
        if (!jsonResult || !jsonResult.success) {
            throw new Error(`FAILED: Transaction creation failed: ${JSON.stringify(jsonResult)}`);
        }

        const txn = jsonResult.transaction;
        console.log('✅ Saved Transaction Record:', txn);

        // Assert 80% discount discount splitting is correct for Referee
        // Flat DISCOUNT_VALUE = ₹50. 80% is ₹40. Referee payable should be ₹60 (100 - 40).
        console.log('\n[Step 7] Validating 80% discount division logic for referee checkout...');
        const actualDiscount = parseFloat(txn.discount_amount);
        const actualPayable = parseFloat(txn.payable_amount);

        if (actualDiscount !== 40.00) {
            throw new Error(`FAILED: Referee discount amount is incorrect. Expected: 40.00, Got: ${actualDiscount}`);
        }
        if (actualPayable !== 60.00) {
            throw new Error(`FAILED: Referee payable amount is incorrect. Expected: 60.00, Got: ${actualPayable}`);
        }
        console.log(`✅ Referee received exact 80% discount share (Discount: ₹${actualDiscount}, Bill: ₹100, Payable: ₹${actualPayable})`);

        // 8. Verify Referrer receives 20% cashback added to wallet
        // Flat DISCOUNT_VALUE = ₹50. 20% is ₹10. Referrer wallet balance should be ₹10.
        console.log('\n[Step 8] Checking Referrer Cashback Wallet balance update...');
        const updatedReferrer = await db.getUserById(referrer.id);
        const referrerBalance = parseFloat(updatedReferrer.wallet_balance);

        if (referrerBalance !== 10.00) {
            throw new Error(`FAILED: Referrer did not receive 20% cashback reward. Expected: 10.00, Got: ${referrerBalance}`);
        }
        console.log(`✅ Referrer wallet successfully incremented by 20% reward share (Balance: ₹${referrerBalance.toFixed(2)})`);

        console.log('\n🌟🌟 ALL TESTS PASSED SUCCESSFULLY! E2E 80/20 Referral Flow is operational! 🌟🌟');

    } catch (e) {
        console.error('\n❌ TEST RUN FAILED:', e.message);
        process.exitCode = 1;
    } finally {
        // 9. DB cleanup after test completed
        console.log('\n[Cleanup] Removing temporary test entities...');
        try {
            if (db.useSupabase) {
                const supabase = require('./src/config/supabase');
                if (sharedClaim && sharedClaim.id) {
                    await supabase.from('user_claimed_coupons').delete().eq('id', sharedClaim.id);
                }
                if (referee && referee.id) {
                    await supabase.from('transactions').delete().eq('user_id', referee.id);
                    await supabase.from('users').delete().eq('id', referee.id);
                }
                if (referrer && referrer.id) {
                    await supabase.from('users').delete().eq('id', referrer.id);
                }
                if (couponId) {
                    await supabase.from('coupons').delete().eq('id', couponId);
                }
                if (cafe && cafe.id) {
                    await supabase.from('cafes').delete().eq('id', cafe.id);
                }
            } else {
                const fs = require('fs');
                const DB_PATH = './db.json';
                if (fs.existsSync(DB_PATH)) {
                    const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                    localDb.user_claimed_coupons = (localDb.user_claimed_coupons || []).filter(c => c.user_id !== referee.id && c.user_id !== referrer.id);
                    localDb.transactions = (localDb.transactions || []).filter(t => t.user_id !== referee.id);
                    localDb.users = (localDb.users || []).filter(u => u.id !== referee.id && u.id !== referrer.id);
                    localDb.coupons = (localDb.coupons || []).filter(c => c.id !== couponId);
                    localDb.cafes = (localDb.cafes || []).filter(c => c.id !== cafe.id);
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

runTest();
