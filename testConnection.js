const { Client } = require('pg');
require('dotenv').config();

async function testPort(port, useSsl = true) {
    const connectionString = `postgresql://postgres:J1hmmdiWPtfkZoiA@db.juovadmyvyyiwjqpvprk.supabase.co:${port}/postgres`;
    console.log(`\nTesting connection to port ${port} (SSL: ${useSsl})...`);

    const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000,
        ssl: useSsl ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log(`✅ SUCCESS: Connected to port ${port}`);
        const res = await client.query('SELECT NOW()');
        console.log('Server time check:', res.rows[0].now);
        await client.end();
        return true;
    } catch (err) {
        console.error(`❌ FAILED: Port ${port} - ${err.message}`);
        try { await client.end(); } catch (e) { }
        return false;
    }
}

async function run() {
    await testPort(5432, true);
    await testPort(5432, false);
    await testPort(6543, true);
    await testPort(6543, false);
}

run();
