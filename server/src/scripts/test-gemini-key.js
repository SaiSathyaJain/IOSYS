import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    const key = process.env.GEMINI_API_KEY;
    console.log('Testing Gemini...');
    console.log('Key length:', key?.length);
    console.log('Key starts with:', key?.substring(0, 7));

    if (!key) {
        console.error('❌ GEMINI_API_KEY is missing');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(key);

        console.log('Listing available models...');
        const models_res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await models_res.json();
        console.log('Models found:', data.models?.length);
        if (data.models) {
            data.models.forEach(m => console.log(' -', m.name.replace('models/', '')));
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            console.log('Sending message to gemini-2.0-flash...');
            const result = await model.generateContent("Say hello");
            const response = await result.response;
            console.log('✅ Success! Response:', response.text());
        }
    } catch (error) {
        console.error('❌ Error testing Gemini:');
        console.error('Message:', error.message);
        console.error('Full Error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
}

test();
