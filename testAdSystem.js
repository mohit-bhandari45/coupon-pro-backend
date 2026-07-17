const db = require('./src/config/db');
const WalletController = require('./src/controllers/walletController');

async function testAdSystem() {
    console.log('🧪 Starting E2E Ad Coupons Verification Test...');
    const testId = Math.floor(1000 + Math.random() * 9000);
    const cafeASlug = `ads-cafe-a-${testId}`;
    const cafeBSlug = `ads-cafe-b-${testId}`;
    const userEmail = `ads-user-${testId}@test.com`;
    const couponId = `AD-COUP-${testId}`;

    let cafeA = null;
    let cafeB = null;
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

        // 2. Create Cafe B
        cafeB = await db.insertCafe({
            id: db.useSupabase ? undefined : `cafe-b-${testId}`,
            name: `Cafe B ${testId}`,
            slug: cafeBSlug,
            owner_name: `Owner B ${testId}`,
            email: `owner-b-${testId}@test.com`,
            password: `password-b-${testId}`,
            address: `Address B ${testId}`,
            allow_platform_coupons: true,
            created_at: new Date().toISOString()
        });
        console.log(`✅ Cafe B created: ${cafeB.name} (${cafeB.id})`);

        // 3. Create User
        user = await db.insertUser({
            id: db.useSupabase ? undefined : `user-${testId}`,
            email: userEmail,
            name: `User ${testId}`,
            wallet_balance: 0.00,
            created_at: new Date().toISOString()
        });
        console.log(`✅ User created: ${user.email} (${user.id})`);

        // 4. Cafe B creates an AD coupon (is_advertised = true)
        await db.insertCoupon({
            id: couponId,
            cafe_id: cafeB.id,
            title: `Cafe B Cross-Promo ₹20`,
            desc_text: `Get ₹20 off at Cafe B!`,
            badge_label: 'Ad Campaign',
            discount_type: 'flat',
            discount_value: 20,
            max_uses: 100,
            min_bill_amount: 0,
            is_active: true,
            is_public: true,
            is_advertised: true,
            ad_budget: 1000,
            ad_audience: 'All Customers',
            ad_duration: '7 Days',
            ad_impressions: 0,
            ad_clicks: 0,
            funded_by: 'merchant',
            created_at: new Date().toISOString()
        });
        console.log(`✅ Ad Coupon created for Cafe B: ${couponId}`);

        // 5. Query public loyalty coupons for Cafe B: should NOT display the ad coupon!
        console.log('\n[Step 1] Verifying ad coupon is EXCLUDED from standard Cafe B loyalty rewards list...');
        const cafeBCoupons = await db.getCouponsByCafeId(cafeB.id, true, true, true);
        const visibleInLoyalty = cafeBCoupons.some(c => c.id === couponId);
        if (visibleInLoyalty) {
            throw new Error('FAILED: Ad coupon is visible in loyalty rewards list!');
        }
        console.log('✅ Success: Ad coupon correctly excluded from loyalty rewards.');

        // 6. Query advertised coupons for the user: since user hasn't claimed it, it should display Cafe B's coupon!
        console.log('\n[Step 2] Querying advertised coupons for the user...');
        const advertisedCoupons = await db.getAdvertisedCoupons(user.id);
        const presentInAds = advertisedCoupons.some(c => c.id === couponId);
        if (!presentInAds) {
            throw new Error('FAILED: Ad coupon did not appear in advertised list!');
        }
        console.log('✅ Success: Cafe B ad coupon delivered to customer.');

        // 7. Claim the advertised coupon
        console.log('\n[Step 3] Claiming the advertised coupon...');
        const reqClaim = {
            body: {
                userId: user.id,
                couponId: couponId
            }
        };

        let claimResult = null;
        const resClaim = {
            json: (data) => {
                claimResult = data;
                return data;
            }
        };
        await WalletController.claimCoupon(reqClaim, resClaim);
        console.log(`claim result:`, claimResult);
        if (!claimResult || !claimResult.success) {
            throw new Error(`FAILED: Claim coupon api response: ${JSON.stringify(claimResult)}`);
        }
        console.log('✅ Success: Ad coupon claimed.');

        // 8. Assert it is now in the customer's wallet under Cafe B
        console.log('\n[Step 4] Verifying coupon now exists in customer wallet for Cafe B...');
        const walletCoupons = await db.getUserClaimedCoupons(user.id, cafeB.id);
        const inWallet = walletCoupons.some(c => c.id === couponId);
        if (!inWallet) {
            throw new Error('FAILED: Claimed ad coupon not found in user wallet for Cafe B!');
        }
        console.log('✅ Success: Claimed coupon is in User Wallet.');

        // 9. Assert it logistically disappears from the advertised list (cannot be claimed again)
        console.log('\n[Step 5] Checking that ad coupon has disappeared from advertised coupons feed...');
        const advertisedCouponsAfterClaim = await db.getAdvertisedCoupons(user.id);
        const presentInAdsAfter = advertisedCouponsAfterClaim.some(c => c.id === couponId);
        if (presentInAdsAfter) {
            throw new Error('FAILED: Ad coupon still visible in advertised list after claiming!');
        }
        console.log('✅ Success: Coupon disappeared from Ads feed.');
        console.log('\n🌟🌟 ALL AD SYSTEM LIFECYCLE CHECKS PASSED SUCCESSFULLY! 🌟🌟');

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
                    await supabase.from('user_claimed_coupons').delete().eq('user_id', user.id);
                    await supabase.from('users').delete().eq('id', user.id);
                }
                if (couponId) {
                    await supabase.from('coupons').delete().eq('id', couponId);
                }
                if (cafeA && cafeA.id) {
                    await supabase.from('cafes').delete().eq('id', cafeA.id);
                }
                if (cafeB && cafeB.id) {
                    await supabase.from('cafes').delete().eq('id', cafeB.id);
                }
            } else {
                const fs = require('fs');
                const DB_PATH = './db.json';
                if (fs.existsSync(DB_PATH)) {
                    const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                    localDb.transactions = (localDb.transactions || []).filter(t => t.user_id !== user.id);
                    localDb.user_claimed_coupons = (localDb.user_claimed_coupons || []).filter(c => c.user_id !== user.id);
                    localDb.users = (localDb.users || []).filter(u => u.id !== user.id);
                    localDb.coupons = (localDb.coupons || []).filter(c => c.id !== couponId);
                    localDb.cafes = (localDb.cafes || []).filter(c => c.id !== cafeA.id && c.id !== cafeB.id);
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

testAdSystem();
