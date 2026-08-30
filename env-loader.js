import dotenv from 'dotenv';

// Load a .env file when one is present. A missing file is NOT an error: MCP
// clients (Claude Desktop, Cursor) pass credentials through the `env` block of
// their server config, and hosts inject real environment variables. Exiting
// here made the server impossible to launch from an MCP client.
const result = dotenv.config();

if (result.error && result.error.code !== 'ENOENT') {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Never write to stdout: this server speaks JSON-RPC over stdio, so anything
// on stdout corrupts the protocol stream. Diagnostics go to stderr.
console.error('[mcp-zerodha] environment loaded');
