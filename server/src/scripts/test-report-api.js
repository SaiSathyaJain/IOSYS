

async function testApi() {
    try {
        console.log('Testing GET /api/outward...');
        // Test without params first
        // const res = await fetch('http://localhost:5000/api/outward');

        // Test with date params (simulating report generation)
        const startDate = '2023-01-01';
        const endDate = new Date().toISOString().split('T')[0];
        const url = `http://localhost:5000/api/outward?startDate=${startDate}&endDate=${endDate}`;

        console.log(`Fetching ${url}`);
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            console.log('✅ Success! Found', data.entries.length, 'entries.');
            if (data.entries.length > 0) {
                console.log('First entry sample:', JSON.stringify(data.entries[0], null, 2));
            }
        } else {
            console.log('❌ API Error:', data.message);
        }

    } catch (error) {
        console.error('❌ Network/Script Error:', error.message);
    }
}

testApi();
