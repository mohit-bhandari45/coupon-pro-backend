const db = require('./src/config/db');
require('dotenv').config();

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
    console.log('🚀 Starting E2E Backend Integration Test...');
    const testEmail = `e2e_test_${Date.now()}@example.com`;
    const testName = 'E2E Test User';

    // 1. Send OTP for Registration
    console.log(`\n1. Requesting signup OTP for ${testEmail}...`);
    const sendRes = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, mode: 'register' })
    });
    const sendData = await sendRes.json();
    if (!sendData.success) {
        throw new Error(`Failed to send OTP: ${sendData.message}`);
    }
    console.log('✅ OTP dispatched successfully.');

    // 2. Fetch the generated OTP from mock DB or Supabase
    console.log('\n2. Retrieving OTP from database...');
    let otpCode = '';
    const useSupabase = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project');
    if (useSupabase) {
        const supabase = require('./src/config/supabase');
        const { data } = await supabase
            .from('otp_codes')
            .select('code')
            .eq('email', testEmail)
            .order('expires_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        otpCode = data?.code;
    } else {
        const dbJson = db.readDb();
        const testOtpObj = (dbJson.otps || [])
            .filter(o => o.email === testEmail)
            .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0];
        otpCode = testOtpObj?.code;
    }

    if (!otpCode) {
        throw new Error('Failed to find generated OTP code in database.');
    }
    console.log(`✅ Found OTP: ${otpCode}`);

    // 3. Verify OTP & Register User
    console.log('\n3. Verifying OTP...');
    const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, code: otpCode, name: testName })
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
        throw new Error(`OTP Verification failed: ${verifyData.message}`);
    }
    console.log('✅ User registered successfully.');
    console.log('User Details:', verifyData.user);
    if (parseFloat(verifyData.user.wallet_balance) !== 100.00) {
        throw new Error(`Expected welcome wallet balance of ₹100.00, got: ₹${verifyData.user.wallet_balance}`);
    }
    console.log('✅ Verified ₹100.00 welcome cashback credited!');

    const userToken = verifyData.token;
    const userId = verifyData.user.id;

    // 4. Fetch credits & wallet balance
    console.log('\n4. Syncing user credits...');
    const creditsRes = await fetch(`${API_BASE}/auth/credits/${testEmail}`);
    const creditsData = await creditsRes.json();
    console.log('Credits & Wallet Data:', creditsData);
    if (creditsData.remaining !== 3 || parseFloat(creditsData.walletBalance) !== 100.00) {
        throw new Error('Credits or Wallet Balance mismatch.');
    }
    console.log('✅ Verified 3 credits and ₹100.00 balance.');

    // Cafe setup: dynamically find or create a cafe and a merchant coupon
    const cafesList = await db.getAllCafes();
    if (cafesList.length === 0) {
        throw new Error('Database contains no Cafe records. Please start the server to seed/setup cafes first.');
    }
    const cafeId = cafesList[0].id;
    console.log(`Using Cafe: ${cafesList[0].name} (ID: ${cafeId})`);

    let couponsToUse = [];
    while (couponsToUse.length < 3) {
        const seededCoupon = await db.insertCoupon({
            id: 'c-test-' + Math.floor(100000 + Math.random() * 900000),
            cafe_id: cafeId,
            title: `E2E Test Cafe Coupon ${couponsToUse.length + 1}`,
            desc_text: 'Get 10% off your purchase.',
            discount_type: 'percent',
            discount_value: 10,
            max_uses: 9999,
            min_bill_amount: 0,
            is_active: true,
            is_public: true,
            funded_by: 'merchant'
        });
        couponsToUse.push(seededCoupon.id);
    }
    const [couponId, couponId2, couponId3] = couponsToUse;
    console.log(`Using Cafe Coupons: ${couponId}, ${couponId2}, ${couponId3}`);

    // 9. Two-Tier system test: Allow/Disallow platform coupons
    console.log('\n9. Testing Two-Tier Platform Coupons configuration...');
    // Fetch the cafe first to check initial settings
    const cafeObj = await db.getCafeById(cafeId);
    console.log(`Current Café allow_platform_coupons: ${cafeObj.allow_platform_coupons}`);

    // Disallow platform coupons first
    console.log('9a. Disallowing platform coupons...');
    await db.updateCafe(cafeId, { allow_platform_coupons: false });

    // Try a platform mock coupon (id: WELCOME10)
    console.log('9b. Redeeming platform coupon (should fail)...');
    const platTxFailureRes = await fetch(`${API_BASE}/transaction/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cafe_id: cafeId,
            user_id: userId,
            coupon_id: 'WELCOME10',
            bill_amount: 100.00,
            discount_amount: 10.00,
            payable_amount: 90.00
        })
    });
    const platTxFailData = await platTxFailureRes.json();
    console.log('Result:', platTxFailData);
    if (platTxFailData.success) {
        throw new Error('Redemption succeeded when cafe disallowed platform coupons!');
    }
    console.log('✅ Correctly blocked platform coupon with message:', platTxFailData.message);

    // Re-allow platform coupons
    console.log('9c. Allowing platform coupons back...');
    await db.updateCafe(cafeId, { allow_platform_coupons: true });

    // Seed the user claimed coupon for 'WELCOME10' so they can redeem it
    await db.claimCouponForUser(userId, 'WELCOME10');

    // Try platform coupon again
    console.log('9d. Redeeming platform coupon (should succeed now)...');
    const platTxSuccessRes = await fetch(`${API_BASE}/transaction/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cafe_id: cafeId,
            user_id: userId,
            coupon_id: 'WELCOME10',
            bill_amount: 100.00,
            discount_amount: 10.00,
            payable_amount: 90.00
        })
    });
    const platTxSuccessData = await platTxSuccessRes.json();
    if (!platTxSuccessData.success) {
        throw new Error(`Redemption failed when cafe allowed platform coupons: ${platTxSuccessData.message}`);
    }
    console.log('✅ Platform coupon redeemed successfully!');

    // Claim the cafe coupons for this test user first to pass Coupon Bank check
    console.log(`\nClaiming cafe coupon ${couponId} inside user Coupon Bank...`);
    await db.claimCouponForUser(userId, couponId);

    console.log(`Claiming cafe coupon ${couponId2} inside user Coupon Bank...`);
    await db.claimCouponForUser(userId, couponId2);

    // 5. Try placing 1st transaction applying ₹30.00 wallet cashback
    console.log('\n5. Creating Transaction 1 (Applying ₹30 cashback)...');
    const tx1Res = await fetch(`${API_BASE}/transaction/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cafe_id: cafeId,
            user_id: userId,
            coupon_id: couponId,
            bill_amount: 100.00,
            discount_amount: 10.00,
            payable_amount: 60.00,
            cashback_applied: 30.00
        })
    });
    const tx1Data = await tx1Res.json();
    if (!tx1Data.success) {
        throw new Error(`Transaction 1 failed: ${tx1Data.message}`);
    }
    console.log('✅ Transaction 1 processed successfully:', tx1Data.transaction);

    // Verify wallet balance is deducted
    const syncRes1 = await fetch(`${API_BASE}/auth/credits/${testEmail}`);
    const syncData1 = await syncRes1.json();
    console.log('Synced Balance:', syncData1);
    if (parseFloat(syncData1.walletBalance) !== 70.00) {
        throw new Error(`Expected wallet balance to be ₹70.00, got: ₹${syncData1.walletBalance}`);
    }
    console.log('✅ Verified wallet balance deducted to ₹70.00.');

    // 6. Complete remaining 1 claim (2 remaining before, WELCOME10 used 1, and tx1 used 1, so 1 remaining)
    console.log('\n6. Creating Transaction 2 (applying ₹20 cashback)...');
    const tx2Res = await fetch(`${API_BASE}/transaction/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cafe_id: cafeId,
            user_id: userId,
            coupon_id: couponId2,
            bill_amount: 100.00,
            discount_amount: 10.00,
            payable_amount: 70.00,
            cashback_applied: 20.00
        })
    });
    const tx2Data = await tx2Res.json();
    if (!tx2Data.success) {
        throw new Error(`Transaction 2 failed: ${tx2Data.message}`);
    }
    console.log('✅ Transaction 2 processed.');

    // Sync to verify credits are now 0 and cashback wallet is ₹50.00
    const syncRes3 = await fetch(`${API_BASE}/auth/credits/${testEmail}`);
    const syncData3 = await syncRes3.json();
    console.log('Synced Balance after 3 claims:', syncData3);
    if (syncData3.remaining !== 0) {
        throw new Error(`Expected remaining credits to be 0, got: ${syncData3.remaining}`);
    }
    if (parseFloat(syncData3.walletBalance) !== 50.00) {
        throw new Error(`Expected wallet balance to be ₹50.00, got: ₹${syncData3.walletBalance}`);
    }
    console.log('✅ Verified credits completely exhausted (0 remaining).');

    // 7. Try a 4th transaction using coupon - should fail with credit exhaustion!
    console.log('\n8. Attempting 4th Transaction (should fail due to credit exhaustion)...');
    const tx4Res = await fetch(`${API_BASE}/transaction/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cafe_id: cafeId,
            user_id: userId,
            coupon_id: couponId3,
            bill_amount: 100.00,
            discount_amount: 10.00,
            payable_amount: 90.00
        })
    });
    const tx4Data = await tx4Res.json();
    console.log('Result of 4th Transaction:', tx4Data);
    if (tx4Data.success) {
        throw new Error('Allowed 4th transaction despite credit limits!');
    }
    console.log('✅ Verified 4th transaction correctly blocked with message:', tx4Data.message);

    console.log('\n✨ ALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY! ✨');
}

runTests().catch(err => {
    console.error('\n❌ E2E TEST FAILED:', err.message);
    process.exit(1);
});
