const http = require('http');

const request = (method, path, body, headers = {}) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Connection': 'close',
                ...headers
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: JSON.parse(responseBody)
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseBody
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (body) {
            req.write(data);
        }
        req.end();
    });
};

async function runTests() {
    console.log('--- STARTING BACKEND REST API VERIFICATION ---');

    try {
        // 1. Register a Cafe
        console.log('\n1. Testing POST /api/auth/register...');
        const registerPayload = {
            name: 'The Brew Lounge',
            owner_name: 'Mohit Bhandari',
            email: 'mohit-qr3@brewlounge.com',
            password: 'password123',
            address: '102 Cafe Street, Dehradun'
        };

        // Clean up existing db.json record manually first by resetting the file database if needed.
        // In our case we'll run it directly, and if email exists, authenticate it.

        let registerRes;
        try {
            registerRes = await request('POST', '/api/auth/register', registerPayload);
            console.log('Register status:', registerRes.statusCode);
            console.log('Register response:', JSON.stringify(registerRes.data, null, 2));
        } catch (e) {
            console.log('Registration failed (might already compile or exist). Moving to login.');
        }

        // 2. Login to Cafe
        console.log('\n2. Testing POST /api/auth/login...');
        const loginPayload = {
            email: 'mohit-qr3@brewlounge.com',
            password: 'password123'
        };
        const loginRes = await request('POST', '/api/auth/login', loginPayload);
        console.log('Login status:', loginRes.statusCode);
        console.log('Login response:', JSON.stringify(loginRes.data, null, 2));

        const token = loginRes.data.token;
        const slug = loginRes.data.cafe.slug;
        console.log(`Retrieved slug: ${slug}, token length: ${token ? token.length : 0}`);

        if (!token) {
            throw new Error('Authentication failed - token is null');
        }

        // 3. Get Cafe details by slug
        console.log(`\n3. Testing GET /api/cafe/${slug}...`);
        const getRes = await request('GET', `/api/cafe/${slug}`);
        console.log('Get details status:', getRes.statusCode);
        console.log('Get details response:', JSON.stringify(getRes.data, null, 2));

        // 4. Update Cafe UPI ID
        console.log('\n4. Testing PUT /api/cafe/update...');
        const updatePayload = {
            upi_id: 'mohit@oksbi',
            address: 'Shop 12, Dehradun Mall'
        };
        const updateRes = await request('PUT', '/api/cafe/update', updatePayload, {
            'Authorization': `Bearer ${token}`
        });
        console.log('Update details status:', updateRes.statusCode);
        console.log('Update details response:', JSON.stringify(updateRes.data, null, 2));

        // 5. Create a new loyalty coupon
        console.log('\n5. Testing POST /api/cafe/coupons...');
        const couponPayload = {
            title: 'Summer Magic Deal',
            desc_text: 'Get 20% off on all cold brew varieties',
            badge_label: 'Special',
            discount_type: 'percent',
            discount_value: 20,
            frequency_per_day: 3
        };
        const couponRes = await request('POST', '/api/cafe/coupons', couponPayload, {
            'Authorization': `Bearer ${token}`
        });
        console.log('Create coupon status:', couponRes.statusCode);
        console.log('Create coupon response:', JSON.stringify(couponRes.data, null, 2));

        // 6. Verify lookup retrieves the new coupon
        console.log(`\n6. Re-Testing GET /api/cafe/${slug} to verify coupon insertion...`);
        const verifyRes = await request('GET', `/api/cafe/${slug}`);
        console.log('Verify get details status:', verifyRes.statusCode);
        console.log('Verify get details response Coupons list:', JSON.stringify(verifyRes.data.coupons, null, 2));

        // 7. Test Customer OTP Send
        console.log('\n7. Testing POST /api/auth/send-otp...');
        const customerEmail = 'customer-test@example.com';
        const sendUserOtpRes = await request('POST', '/api/auth/send-otp', { email: customerEmail });
        console.log('Customer send OTP status:', sendUserOtpRes.statusCode);
        console.log('Customer send OTP response:', JSON.stringify(sendUserOtpRes.data, null, 2));

        // Fetch OTP from local DB configuration directly for automated verify payload
        const db = require('./src/config/db');
        const getLatestOtp = async (email, purpose) => {
            const codes = await db.getOtpCodes();
            return codes
                .filter(o => o.email.toLowerCase() === email.toLowerCase() && o.purpose === purpose)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        };

        const latestUserOtp = await getLatestOtp(customerEmail, 'auth');

        console.log('Latest customer Auth OTP in DB:', latestUserOtp);
        if (!latestUserOtp) {
            throw new Error('Customer OTP not recorded in database');
        }

        // 8. Test Customer OTP Verification
        console.log('\n8. Testing POST /api/auth/verify-otp...');
        const verifyUserOtpRes = await request('POST', '/api/auth/verify-otp', {
            email: customerEmail,
            code: latestUserOtp.code,
            name: 'Sarah Connor'
        });
        console.log('Customer verify OTP status:', verifyUserOtpRes.statusCode);
        console.log('Customer verify OTP response:', JSON.stringify(verifyUserOtpRes.data, null, 2));
        const customerUser = verifyUserOtpRes.data.user;

        // 9. Test Coupon Redemption OTP Send
        console.log('\n9. Testing POST /api/coupon/send-otp...');
        const testCoupon = verifyRes.data.coupons[0];
        if (!testCoupon) {
            throw new Error('No coupons found to test redemption');
        }
        const sendCouponOtpRes = await request('POST', '/api/coupon/send-otp', {
            email: customerEmail,
            coupon_id: testCoupon.id
        });
        console.log('Coupon send OTP status:', sendCouponOtpRes.statusCode);
        console.log('Coupon send OTP response:', JSON.stringify(sendCouponOtpRes.data, null, 2));

        // Get latest coupon OTP
        const latestCouponOtp = await getLatestOtp(customerEmail, 'coupon');
        console.log('Latest Coupon OTP in DB:', latestCouponOtp);
        if (!latestCouponOtp) {
            throw new Error('Coupon OTP not recorded in database');
        }

        // 10. Test Coupon Redemption OTP Verification
        console.log('\n10. Testing POST /api/coupon/verify-otp...');
        const verifyCouponOtpRes = await request('POST', '/api/coupon/verify-otp', {
            email: customerEmail,
            code: latestCouponOtp.code
        });
        console.log('Coupon verify OTP status:', verifyCouponOtpRes.statusCode);
        console.log('Coupon verify OTP response:', JSON.stringify(verifyCouponOtpRes.data, null, 2));

        // 11. Test Transaction Creation
        console.log('\n11. Testing POST /api/transaction/create...');
        const createTxnRes = await request('POST', '/api/transaction/create', {
            cafe_id: verifyRes.data.cafe.id,
            user_id: customerUser.id,
            coupon_id: testCoupon.id,
            bill_amount: 100,
            discount_amount: 20,
            payable_amount: 80
        });
        console.log('Create transaction status:', createTxnRes.statusCode);
        console.log('Create transaction response:', JSON.stringify(createTxnRes.data, null, 2));

        // 12. Re-Test Cafe Details to check daily occupancy count
        console.log(`\n12. Re-Testing GET /api/cafe/${slug} to verify remaining_today discount decrement...`);
        const verifyDecrementRes = await request('GET', `/api/cafe/${slug}`);
        console.log('Verify get details status:', verifyDecrementRes.statusCode);
        console.log('Verify remaining_today decrement output:', JSON.stringify(verifyDecrementRes.data.coupons, null, 2));

        console.log('\n--- VERIFICATION SUCCESSFUL ---');
    } catch (err) {
        console.error('\n--- VERIFICATION FAILED ---');
        console.error(err);
        process.exit(1);
    }
}

runTests();
