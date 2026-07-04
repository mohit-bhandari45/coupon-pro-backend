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
