/**
 * Shared AI model lists.
 *
 * OpenRouter retires ":free" model slugs fairly often, and Groq decommissions
 * older models — when that happens every call site fails at once with an
 * unhelpful "model unavailable" error. Keeping the lists here means there is a
 * single place to update when a model goes away.
 *
 * Verified available on 2026-09-08.
 */

// Text generation, in preference order. Each of these was confirmed with a real
// streaming request — note that a model can be listed as free by the /models
// endpoint and still 404 with "unavailable for free", so listing is not proof.
// These are reasoning models: when streaming they emit their thinking in a
// separate `reasoning` delta (the UI ignores it), but on non-streaming calls the
// prose can precede the JSON, so parsers must extract the {...} block.
export const OPENROUTER_TEXT_MODELS = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
];

// Image-capable models. The previous qwen/llama vision slugs no longer exist on
// OpenRouter in any form. The gemma pair is currently rate-limited rather than
// retired, so they are kept as the vision path.
export const OPENROUTER_VISION_MODELS = [
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
];

export const OPENROUTER_DEFAULT_MODEL = OPENROUTER_TEXT_MODELS[0];

// Models a client may explicitly request for the chat assistant.
export const ALLOWED_CHAT_MODELS = new Set([
    ...OPENROUTER_TEXT_MODELS,
    ...OPENROUTER_VISION_MODELS,
]);

// Groq alternatives, used first where a GROQ_API_KEY is configured.
export const GROQ_MODELS = [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
];

export const GROQ_DEFAULT_MODEL = GROQ_MODELS[0];
