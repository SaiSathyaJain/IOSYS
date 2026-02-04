import api from './index.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Route API requests to the Hono app
        if (url.pathname.startsWith('/api')) {
            return api.fetch(request, env, ctx);
        }

        // Attempt to fetch the asset from the static site build
        let response = await env.ASSETS.fetch(request);

        // If not found (404) and is a GET request, serve index.html (SPA Fallback)
        if (response.status === 404 && request.method === "GET") {
            const indexUrl = new URL("/index.html", request.url);
            response = await env.ASSETS.fetch(indexUrl);
        }

        // Clone the response so we can modify headers (headers are immutable in standard fetch response)
        response = new Response(response.body, response);

        // Add Cross-Origin-Opener-Policy to allow popup interaction (Google Login)
        response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

        return response;
    }
};
