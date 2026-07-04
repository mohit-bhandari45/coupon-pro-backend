const dns = require('dns');
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};
    options.family = 4;
    return originalLookup(hostname, options, callback);
};

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log('Dropping outdated tables...');
        // Drop tables cascade
        await client.query('DROP TABLE IF EXISTS otp_codes CASCADE;');
        await client.query('DROP TABLE IF EXISTS transactions CASCADE;');
        await client.query('DROP TABLE IF EXISTS coupons CASCADE;');
        await client.query('DROP TABLE IF EXISTS users CASCADE;');
        await client.query('DROP TABLE IF EXISTS cafes CASCADE;');

        console.log('Re-running schema.sql queries...');
        const sqlPath = path.join(__dirname, 'schema.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sqlContent);

        console.log('Migration successfully completed!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

run();
