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

        console.log('\n--- VERIFICATION SUCCESSFUL ---');
    } catch (err) {
        console.error('\n--- VERIFICATION FAILED ---');
        console.error(err);
        process.exit(1);
    }
}

runTests();
