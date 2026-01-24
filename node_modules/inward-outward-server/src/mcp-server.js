import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initDatabase, getDb } from "./database/db.js";

// Initialize DB (loading from file using sql.js)
await initDatabase();
const db = getDb();

// Create server instance
const server = new Server(
    {
        name: "inward-outward-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query_database",
                description: "Execute a SELECT query on the SQLite database to retrieve inward/outward entries. Use this to find specific entries, check status, or generate reports.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sql: {
                            type: "string",
                            description: "The SQL SELECT query to execute (e.g., 'SELECT * FROM inward WHERE assigned_team = \"UG\"')",
                        },
                    },
                    required: ["sql"],
                },
            },
            {
                name: "get_pending_tasks",
                description: "Get all pending inward entries grouped by team.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "query_database") {
            const { sql } = args;
            // Basic security: only allow SELECT
            if (!sql.trim().toLowerCase().startsWith("select")) {
                throw new Error("Only SELECT queries are allowed via MCP for safety.");
            }

            const result = db.exec(sql);
            const rows = result.length > 0 ? rowsToObjects(result[0]) : [];

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(rows, null, 2),
                    },
                ],
            };
        }

        if (name === "get_pending_tasks") {
            const sql = `
        SELECT assigned_team, COUNT(*) as count 
        FROM inward 
        WHERE assignment_status = 'Pending' 
        GROUP BY assigned_team
      `;
            const result = db.exec(sql);
            const rows = result.length > 0 ? rowsToObjects(result[0]) : [];

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(rows, null, 2),
                    },
                ],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Helper for sql.js results
function rowsToObjects(result) {
    const { columns, values } = result;
    return values.map((row) => {
        const obj = {};
        columns.forEach((col, i) => (obj[col] = row[i]));
        return obj;
    });
}

// Start Server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Inward/Outward MCP Server running on stdio");
