const dotenv = require('dotenv');
const { Client } = require('pg');
const db = require('./src/config/db');

dotenv.config();

async function run() {
    const email = 'sankalpreddy111@gmail.com';
    console.log(`Setting max_credits to 100 for ${email}...`);

    try {
        if (db.useSupabase) {
            console.log('Using PostgreSQL Database...');
            const client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false
                }
            });
            await client.connect();

            console.log('Ensuring max_credits column exists in users table...');
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS max_credits INTEGER DEFAULT 3;');

            console.log(`Executing UPDATE query for ${email}...`);
            const res = await client.query('UPDATE users SET max_credits = 100 WHERE email = $1 RETURNING *;', [email]);

            console.log('Postgres Update Result:', res.rows);
            await client.end();
        } else {
            console.log('Using local JSON engine...');
            const dbInstance = db.readDb();
            if (!dbInstance.users) dbInstance.users = [];
            const user = dbInstance.users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (user) {
                user.max_credits = 100;
                db.writeDb(dbInstance);
                console.log('Updated user in db.json:', user);
            } else {
                console.log(`User ${email} not found in db.json fallback! Creating a mock user for testing.`);
                const newUser = { id: 'test-user-uuid', email, name: 'Sankalp Reddy', max_credits: 100, wallet_balance: 0 };
                dbInstance.users.push(newUser);
                db.writeDb(dbInstance);
                console.log('Created user in db.json:', newUser);
            }
        }
        console.log('✅ Update completed successfully!');
    } catch (err) {
        console.error('❌ Update failed:', err);
        process.exit(1);
    }
}

run();
