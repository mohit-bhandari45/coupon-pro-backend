const initDatabase = require('./src/config/initDb');
const db = require('./src/config/db');

async function test() {
    try {
        console.log('Running initDb...');
        await initDatabase();
        console.log('Checking users table details...');
        const user = await db.getUserByEmail('mb7813614@gmail.com');
        console.log('User profile:', user);
    } catch (err) {
        console.error('ERROR OCCURRED:', err);
    }
}
test();
