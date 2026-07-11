const db = require('./src/config/db');
const supabase = require('./src/config/supabase');

async function test() {
    try {
        const { useSupabase } = db;
        console.log('Database type:', useSupabase ? 'Supabase' : 'Local JSON');

        // 1. Get user
        const user = await db.getUserByEmail('mb7813614@gmail.com');
        console.log('User found:', user);

        if (!user) {
            console.log('User mb7813614@gmail.com not found in database.');
            return;
        }

        // 2. Query all coupons in database
        const { data: allCoupons, error: cErr } = await supabase
            .from('coupons')
            .select('*');
        if (cErr) throw cErr;
        console.log('All coupons in database:', allCoupons.map(c => ({ id: c.id, cafe_id: c.cafe_id, title: c.title })));

        // 3. Query claims
        const { data: claims, error: clErr } = await supabase
            .from('user_claimed_coupons')
            .select('*')
            .eq('user_id', user.id);
        if (clErr) throw clErr;
        console.log('Claims for user:', claims);

        // 4. Test lookups
        const lookup1 = await db.getCouponById('c-118577');
        const lookup2 = await db.getCouponById('C-118577');
        console.log('Lookup with lowercase c-118577:', lookup1);
        console.log('Lookup with uppercase C-118577:', lookup2);

    } catch (err) {
        console.error(err);
    }
}
test();
