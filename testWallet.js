const db = require('./src/config/db');
require('dotenv').config();

(async () => {
    try {
        console.log('--- Testing Wallet Queries ---');
        // Get or insert a test user
        const email = 'mb7813614@gmail.com';
        let user = await db.getUserByEmail(email);
        if (!user) {
            console.log('Inserting new test user...');
            user = await db.insertUser({
                email,
                name: 'Test',
                created_at: new Date().toISOString()
            });
        }
        console.log('Test User:', user);

        console.log('Fetching Brew Cafe coupons...');
        const brewCafeCoupons = await db.getCouponsByCafeId('9d2abeff-0f6d-40a5-b75d-1fc8d4112da6', false);
        console.log('Coupons:', brewCafeCoupons);

        console.log('Fetching user claimed coupons (wallet)...');
        const claimed = await db.getUserClaimedCoupons(user.id, '6c7abab8-f627-44e4-bada-c8e192a01e15');
        console.log('Claimed Coupons returned:', JSON.stringify(claimed, null, 2));

        // Let's also query the raw table to see ALL claims (used & available)
        const useSupabase = process.env.SUPABASE_URL &&
            !process.env.SUPABASE_URL.includes('your-project') &&
            process.env.SUPABASE_KEY &&
            !process.env.SUPABASE_KEY.includes('placeholder');

        if (useSupabase) {
            const supabase = require('./src/config/supabase');
            const { data: claims } = await supabase
                .from('user_claimed_coupons')
                .select('*')
                .eq('user_id', user.id);
            console.log('Raw user_claimed_coupons from DB:', claims);

            const { data: couponDetail } = await supabase
                .from('coupons')
                .select('*')
                .eq('id', 'c-311799')
                .maybeSingle();
            console.log('Coupon Detail for c-311799:', couponDetail);

            const { data: cafes } = await supabase.from('cafes').select('id, name, slug');
            console.log('Cafes List:', cafes);
        } else {
            const dbInstance = db.readDb();
            const claims = (dbInstance.user_claimed_coupons || []).filter(r => r.user_id === user.id);
            console.log('Raw user_claimed_coupons from DB:', claims);
            const couponDetail = (dbInstance.coupons || []).find(c => c.id === 'c-311799');
            console.log('Coupon Detail for c-311799:', couponDetail);
        }

        console.log('--- Testing API calls ---');
        try {
            const url = `http://localhost:5000/api/wallet?userId=${user.id}&cafeId=6c7abab8-f627-44e4-bada-c8e192a01e15`;
            console.log('Fetching URL:', url);
            const response = await fetch(url);
            const apiResult = await response.json();
            console.log('API /api/wallet response:', JSON.stringify(apiResult, null, 2));
        } catch (fetchErr) {
            console.error('Failed to query local dev server API:', fetchErr.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('Test script failed:', err);
        process.exit(1);
    }
})();
