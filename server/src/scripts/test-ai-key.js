import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "IO-SYS Test",
    }
});

async function test() {
    const key = process.env.OPENROUTER_API_KEY;
    console.log('Testing OpenRouter...');
    console.log('Key length:', key?.length);
    console.log('Key ends with:', key?.substring(key?.length - 4));

    try {
        console.log('Fetching models...');
        // const models = await openai.models.list(); // Some SDKs might vary, let's use raw fetch for ultimate proof
        const response_models = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        const models_data = await response_models.json();

        if (response_models.status !== 200) {
            console.error('❌ Model list failed:', response_models.status, models_data);
            return;
        }

        console.log('✅ Key is valid! Found', models_data.data?.length, 'models.');

        console.log('Testing completion with Mistral 7B...');
        const completion = await openai.chat.completions.create({
            model: "mistralai/mistral-7b-instruct:free",
            messages: [{ role: 'user', content: 'Say hello' }],
        });
        console.log('✅ Success! Response:', completion.choices[0].message.content);
    } catch (error) {
        console.error('❌ Error testing OpenRouter:');
        if (error.response) {
            console.error('Status:', error.status);
            console.log(JSON.stringify(error.response, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

test();
