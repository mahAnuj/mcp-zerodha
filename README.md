# Zerodha Trading MCP Server

A MCP (Model Context Protocol) server built with FastMCP that interfaces with Zerodha broker APIs to provide stock trading tools and analysis.

## Features

- Authentication with Zerodha
- Fetch stock prices from Zerodha
- Analyze price changes
- Get user portfolio
- Get buy/sell recommendations
- Find potential stocks to buy
- Fetch historical data

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Configure Zerodha API credentials:
   - Create a `.env` file in the root directory
   - Add your Zerodha API credentials:

```
# Zerodha API Credentials
API_KEY=your_api_key
API_SECRET=your_api_secret
USER_ID=your_user_id
PASSWORD=your_password
PIN=your_pin

# Optional - if you already have an access token
ACCESS_TOKEN=your_access_token
```

## Running the Server

You can run the server in different ways:

### Using npm start

```bash
npm start
```

### Using FastMCP CLI for testing

```bash
npm run dev
```

This launches the FastMCP CLI for interactively testing the server in the terminal.

### Using MCP Inspector for visual testing

```bash
npm run inspect
```

This launches the MCP Inspector web UI for testing the server.

## Integrating with Cursor IDE

To integrate this MCP server with Cursor IDE:

1. Install Cursor IDE from https://cursor.sh/
2. Open Cursor settings 
3. Navigate to "AI" > "MCP Servers"
4. Add a new MCP server configuration:

```json
{
  "mcpServers": {
    "zerodha-trading-mcp": {
      "command": "node",
      "args": ["path/to/your/project/index.js"],
      "env": {
        "API_KEY": "your_zerodha_api_key",
        "API_SECRET": "your_zerodha_api_secret"
      }
    }
  }
}
```

Replace `path/to/your/project` with the actual path to your project directory and add your Zerodha API credentials.

5. Restart Cursor
6. When using Claude or another AI assistant in Cursor, you should now see your Zerodha trading tools available for the AI to use.

## Authentication Flow

Before using the tools that require authentication, you need to:

1. Call the `getLoginURL` tool to get the Zerodha login URL
2. Visit the URL and complete the login process
3. Copy the request token from the redirect URL
4. Call the `generateSession` tool with the request token
5. Now you can use all the other tools that require authentication

## Available Tools

- `checkAuthStatus`: Check if the Zerodha API client is authenticated
- `getLoginURL`: Get the Zerodha login URL for authentication
- `generateSession`: Generate a session using the request token obtained after login
- `getProfile`: Get user profile information from Zerodha
- `getPortfolio`: Get user's stock portfolio (holdings) from Zerodha
- `getPositions`: Get user's current day trading positions from Zerodha
- `getStockPrice`: Get current market price for given stocks
- `getFavoriteStockPrices`: Get current market price for favorite/common stocks
- `analyzePriceChanges`: Analyze price changes for given stocks
- `analyzePortfolio`: Analyze portfolio for buy/sell recommendations
- `findPotentialBuys`: Find potential stocks to buy based on price analysis
- `getHistoricalData`: Get historical price data for a given instrument

## Customizing the Server

You can modify the following files to customize the server:

- `config.js`: Configure favorite stocks, trading parameters, and technical analysis parameters
- `zerodha.js`: Implement additional Zerodha API functions
- `index.js`: Add or modify tools

## Disclaimer

This server is provided for educational and informational purposes only. It is not intended to provide investment advice. Always conduct your own research before making investment decisions. 