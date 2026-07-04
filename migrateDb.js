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

        console.log('Dropping outdated customer tables...');
        // Drop tables cascade
        await client.query('DROP TABLE IF EXISTS otp_codes CASCADE;');
        await client.query('DROP TABLE IF EXISTS transactions CASCADE;');
        await client.query('DROP TABLE IF EXISTS users CASCADE;');

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
