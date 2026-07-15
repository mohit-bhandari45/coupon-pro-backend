const db = require('./src/config/db');

async function verify() {
    try {
        const email = 'sankalpreddy111@gmail.com';
        const user = await db.getUserByEmail(email);
        console.log('User database record retrieved:', user);
        if (!user) {
            console.error('❌ User not found!');
            process.exit(1);
        }
        const count = await db.getUserCouponRedemptionCount(user.id);
        const maxCredits = user.max_credits !== undefined && user.max_credits !== null ? user.max_credits : 3;
        const remaining = Math.max(0, maxCredits - count);
        console.log(`Verification metrics: limit=${maxCredits}, used=${count}, remaining=${remaining}`);
        if (maxCredits === 100) {
            console.log('✅ VERIFICATION SUCCESS: Custom credits dynamically resolved to 100!');
        } else {
            console.error('❌ VERIFICATION FAILURE: credits limit is not 100.');
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Error during verification:', err);
        process.exit(1);
    }
}

verify();
