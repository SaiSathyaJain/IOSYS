import express from 'express';
import { chatWithAi } from '../services/ai-service.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                message: "Invalid format. 'messages' array is required."
            });
        }

        const reply = await chatWithAi(messages);

        res.json({ success: true, reply });
    } catch (error) {
        console.error('Chat Route Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
