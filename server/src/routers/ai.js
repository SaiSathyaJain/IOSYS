import { Hono } from 'hono';
import { chatWithAi } from '../services/ai-service.js';

export const aiRouter = new Hono();

aiRouter.post('/chat', async (c) => {
    try {
        const { messages } = await c.req.json();

        // Pass D1 database instance and API Key to the service
        const response = await chatWithAi(messages, c.env.DB, c.env.OPENROUTER_API_KEY);


        return c.json({
            success: true,
            message: response
        });
    } catch (error) {
        console.error('AI Chat Error:', error);
        return c.json({ success: false, message: 'AI processing failed' }, 500);
    }
});
