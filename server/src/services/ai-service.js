import OpenAI from "openai";
import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database Path - Reusing the logic from mcp-server.js
const dbPath = join(__dirname, '..', '..', 'database.sqlite');
let db = null;

// Initialize Database connection for read-only access
async function initDb() {
    if (db) return db;
    if (!existsSync(dbPath)) {
        console.error('❌ Database file not found at:', dbPath);
        return null;
    }
    const SQL = await initSqlJs();
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
    return db;
}

// Convert SQL.js result to array of objects
function rowsToObjects(result) {
    if (!result || result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

// Initialize OpenAI Client for OpenRouter
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Define Tools
const tools = [
    {
        type: "function",
        function: {
            name: "query_database",
            description: "Execute a SELECT SQL query to retrieve inward/outward entries. Use this to find letters, check status, or generate reports.",
            parameters: {
                type: "object",
                properties: {
                    sql: {
                        type: "string",
                        description: "The SELECT SQL query (e.g., 'SELECT * FROM inward WHERE assignment_status = \"Pending\"')",
                    },
                },
                required: ["sql"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_table_schema",
            description: "Get the schema of the inward and outward tables to understand available columns.",
            parameters: { type: "object", properties: {} },
        },
    }
];

export async function chatWithAi(messages) {
    try {
        await initDb();
        if (!db) throw new Error("Database not initialized");

        const response = await openai.chat.completions.create({
            model: "google/gemini-2.0-flash-lite-preview-02-05:free", // Using free model
            messages: messages,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;

        // Check if the model wants to call a tool
        if (responseMessage.tool_calls) {
            messages.push(responseMessage); // Add assistant's tool call request to history

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                let toolResult = "";

                try {
                    if (functionName === "query_database") {
                        const { sql } = functionArgs;
                        console.log(`🤖 AI Querying DB: ${sql}`);

                        // Security Check: Only Allow SELECT
                        if (!sql.trim().toLowerCase().startsWith("select")) {
                            toolResult = "Error: Only SELECT queries are allowed for safety.";
                        } else {
                            const result = db.exec(sql);
                            const rows = rowsToObjects(result);
                            toolResult = JSON.stringify(rows);
                        }
                    } else if (functionName === "get_table_schema") {
                        // Hardcoded schema helper for better answers
                        toolResult = JSON.stringify({
                            inward: "id, inward_no, subject, particulars_from_whom, means, received_date, assigned_team, assignment_status, due_date",
                            outward: "id, outward_no, subject, to_whom, sent_by, created_by_team, linked_inward_id"
                        });
                    }
                } catch (e) {
                    toolResult = `Error executing tool: ${e.message}`;
                }

                // Add tool response to history
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolResult,
                });
            }

            // Get final response from AI
            const secondResponse = await openai.chat.completions.create({
                model: "google/gemini-2.0-flash-lite-preview-02-05:free",
                messages: messages,
            });

            return secondResponse.choices[0].message.content;
        }

        return responseMessage.content;

    } catch (error) {
        console.error("AI Service Error:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
}
