import OpenAI from "openai";

// Initialize OpenAI Client for OpenRouter inside the function to use env vars
// const openai = new OpenAI({ ... }); // Removed top-level init


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

export async function chatWithAi(messages, db, apiKey) {
    try {
        if (!db) throw new Error("Database not initialized");
        if (!apiKey) throw new Error("OpenRouter API Key not provided");

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: apiKey,
        });

        const response = await openai.chat.completions.create({
            model: "google/gemini-2.0-flash-lite-preview-02-05:free",
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
                            // D1 query execution
                            const { results } = await db.prepare(sql).all();
                            toolResult = JSON.stringify(results);
                        }
                    } else if (functionName === "get_table_schema") {
                        toolResult = JSON.stringify({
                            inward: "id, inward_no, subject, particulars_from_whom, means, sign_receipt_datetime, file_reference, assigned_team, assigned_to_email, assignment_instructions, assignment_date, assignment_status, due_date, completion_date",
                            outward: "id, outward_no, subject, to_whom, sent_by, sign_receipt_datetime, case_closed, created_by_team, team_member_email, linked_inward_id"
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
