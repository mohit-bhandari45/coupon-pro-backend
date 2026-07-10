const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function initDatabase() {
    const connectionString = process.env.DATABASE_URL;

    // Check if the connection string is valid
    if (!connectionString || connectionString.includes('YOUR_') || connectionString.includes('[password]')) {
        console.log('\n⚠️ [Database] DATABASE_URL is not set or set to placeholders in backend/.env. Automatic table checks skipped.');
        return;
    }

    console.log('\n[Database] Connecting to PostgreSQL to verify table schemas...');

    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false // Required for Supabase direct connections
        }
    });

    try {
        await client.connect();

        // Check if the 'cafes' table exists
        const checkRes = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'cafes'
            );
        `);

        const tablesExist = checkRes.rows[0].exists;

        if (!tablesExist) {
            console.log('[Database] Tables "cafes" not found. Executing schema.sql to construct tables...');
            const sqlPath = path.join(__dirname, '../../schema.sql');
            const sqlContent = fs.readFileSync(sqlPath, 'utf8');

            // Execute the schema script
            await client.query(sqlContent);
            console.log('✅ [Database] Tables and indexes created successfully!');
        } else {
            console.log('✅ [Database] Tables and schemas verified (already exist).');
        }

        // Run self-healing schema updates for the wallet system
        console.log('[Database] Validating Coupon Bank user_claimed_coupons constraints...');
        await client.query(`
            ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_claims INTEGER DEFAULT NULL;
            CREATE TABLE IF NOT EXISTS user_claimed_coupons (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                coupon_id TEXT REFERENCES coupons(id) ON DELETE CASCADE,
                status TEXT DEFAULT 'available',
                claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
                UNIQUE(user_id, coupon_id)
            );
        `);
        try {
            await client.query(`ALTER TABLE user_claimed_coupons DISABLE ROW LEVEL SECURITY;`);
        } catch (e) {
            // Silence if already disabled
        }

        // Seed 3 welcome coupons on server launch
        const welcomeCoupons = [
            {
                id: 'WELCOME10',
                title: 'Welcome 10% Off',
                desc_text: 'Instant 10% discount on any order. Welcome to RedPerks!',
                discount_type: 'percent',
                discount_value: 10,
                max_uses: 99999,
                min_bill_amount: 0,
                is_active: true,
                is_public: false
            },
            {
                id: 'FREEBUI',
                title: 'Welcome ₹50 Off Combo',
                desc_text: 'Flat ₹50 saving on minimum bill of ₹150.',
                discount_type: 'flat',
                discount_value: 50,
                max_uses: 99999,
                min_bill_amount: 150,
                is_active: true,
                is_public: false
            },
            {
                id: 'FEST25',
                title: 'Welcome Fest ₹25 Off',
                desc_text: 'Flat ₹25 discount with no minimum spend.',
                discount_type: 'flat',
                discount_value: 25,
                max_uses: 99999,
                min_bill_amount: 0,
                is_active: true,
                is_public: false
            }
        ];

        for (const c of welcomeCoupons) {
            await client.query(`
                INSERT INTO coupons (id, cafe_id, title, desc_text, badge_label, discount_type, discount_value, max_uses, min_bill_amount, is_active, is_public, max_claims)
                VALUES ($1, NULL, $2, $3, 'Welcome', $4, $5, $6, $7, $8, $9, NULL)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    desc_text = EXCLUDED.desc_text,
                    discount_type = EXCLUDED.discount_type,
                    discount_value = EXCLUDED.discount_value,
                    max_uses = EXCLUDED.max_uses,
                    min_bill_amount = EXCLUDED.min_bill_amount,
                    is_active = EXCLUDED.is_active,
                    is_public = EXCLUDED.is_public;
            `, [c.id, c.title, c.desc_text, c.discount_type, c.discount_value, c.max_uses, c.min_bill_amount, c.is_active, c.is_public]);
        }
        console.log('✅ [Database] Platform welcome coupons verified and seeded!');
    } catch (err) {
        console.error('❌ [Database] Failed to execute database self-creation checks:', err.message);
    } finally {
        try {
            await client.end();
        } catch (e) {
            // Ignore closing connection errors
        }
    }
}

module.exports = initDatabase;
