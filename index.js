// Import env-loader first to ensure environment variables are loaded
// before any other imports that might need them
import './env-loader.js';

import { FastMCP } from "fastmcp";
import { z } from "zod";
import * as zerodha from './zerodha.js';
import { FAVORITE_STOCKS } from './config.js';

// Create a new FastMCP server
const server = new FastMCP({
  name: "Zerodha Trading MCP",
  version: "1.0.0",
  instructions: "This MCP server provides tools to interact with Zerodha broker API for stock trading. You can fetch stock prices, analyze price changes, view user portfolio, and get buy/sell recommendations."
});

// Add authentication status tool
server.addTool({
  name: "checkAuthStatus",
  description: "Check if the Zerodha API client is authenticated",
  execute: async () => {
    const isAuthenticated = zerodha.isClientAuthenticated();
    return `Authentication status: ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}`;
  }
});

// Add login URL tool
server.addTool({
  name: "getLoginURL",
  description: "Get the Zerodha login URL for authentication",
  execute: async () => {
    const loginURL = zerodha.getLoginURL();
    return `Please visit this URL to authenticate: ${loginURL}`;
  }
});

// Add generate session tool
server.addTool({
  name: "generateSession",
  description: "Generate a session using the request token obtained after login",
  parameters: z.object({
    requestToken: z.string().describe("Request token obtained after login")
  }),
  execute: async (args) => {
    try {
      const session = await zerodha.generateSession(args.requestToken);
      return `Session generated successfully. Access token: ${session.access_token}`;
    } catch (error) {
      return `Error generating session: ${error.message}`;
    }
  }
});

// Add profile tool
server.addTool({
  name: "getProfile",
  description: "Get user profile information from Zerodha",
  execute: async () => {
    try {
      const profile = await zerodha.getProfile();
      return JSON.stringify(profile, null, 2);
    } catch (error) {
      return `Error fetching profile: ${error.message}`;
    }
  }
});

// Add holdings (portfolio) tool
server.addTool({
  name: "getPortfolio",
  description: "Get user's stock portfolio (holdings) from Zerodha",
  execute: async () => {
    try {
      const holdings = await zerodha.getHoldings();
      return JSON.stringify(holdings, null, 2);
    } catch (error) {
      return `Error fetching portfolio: ${error.message}`;
    }
  }
});

// Add positions tool
server.addTool({
  name: "getPositions",
  description: "Get user's current day trading positions from Zerodha",
  execute: async () => {
    try {
      const positions = await zerodha.getPositions();
      return JSON.stringify(positions, null, 2);
    } catch (error) {
      return `Error fetching positions: ${error.message}`;
    }
  }
});

// Add stock quote tool
server.addTool({
  name: "getStockPrice",
  description: "Get current market price for given stocks",
  parameters: z.object({
    symbols: z.string().describe("Comma-separated list of stock symbols (e.g., RELIANCE,TCS,INFY)")
  }),
  execute: async (args) => {
    try {
      const symbols = args.symbols.split(',').map(s => s.trim());
      const quotes = await zerodha.getQuote(symbols);
      return JSON.stringify(quotes, null, 2);
    } catch (error) {
      return `Error fetching stock prices: ${error.message}`;
    }
  }
});

// Add favorite stocks price tool
server.addTool({
  name: "getFavoriteStockPrices",
  description: "Get current market price for favorite/common stocks",
  execute: async () => {
    try {
      const quotes = await zerodha.getQuote(FAVORITE_STOCKS);
      return JSON.stringify(quotes, null, 2);
    } catch (error) {
      return `Error fetching favorite stock prices: ${error.message}`;
    }
  }
});

// Add price analysis tool
server.addTool({
  name: "analyzePriceChanges",
  description: "Analyze price changes for given stocks",
  parameters: z.object({
    symbols: z.string().optional().describe("Comma-separated list of stock symbols (e.g., RELIANCE,TCS,INFY). If not provided, favorite stocks will be analyzed.")
  }),
  execute: async (args) => {
    try {
      const symbols = args.symbols ? args.symbols.split(',').map(s => s.trim()) : [];
      const analysis = await zerodha.analyzePriceChanges(symbols);
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      return `Error analyzing price changes: ${error.message}`;
    }
  }
});

// Add portfolio analysis tool
server.addTool({
  name: "analyzePortfolio",
  description: "Analyze portfolio for buy/sell recommendations",
  execute: async () => {
    try {
      const analysis = await zerodha.analyzePortfolio();
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      return `Error analyzing portfolio: ${error.message}`;
    }
  }
});

// Add potential buys tool
server.addTool({
  name: "findPotentialBuys",
  description: "Find potential stocks to buy based on price analysis",
  execute: async () => {
    try {
      const potentialBuys = await zerodha.findPotentialBuys();
      return JSON.stringify(potentialBuys, null, 2);
    } catch (error) {
      return `Error finding potential buys: ${error.message}`;
    }
  }
});

// Add historical data tool
server.addTool({
  name: "getHistoricalData",
  description: "Get historical price data for a given instrument",
  parameters: z.object({
    instrument: z.string().describe("Instrument token or symbol"),
    interval: z.string().optional().describe("Candle interval (minute, day, etc.)"),
    from: z.string().describe("From date (YYYY-MM-DD)"),
    to: z.string().describe("To date (YYYY-MM-DD)")
  }),
  execute: async (args) => {
    try {
      const historicalData = await zerodha.getHistoricalData(
        args.instrument,
        args.interval || 'day',
        args.from,
        args.to
      );
      return JSON.stringify(historicalData, null, 2);
    } catch (error) {
      return `Error fetching historical data: ${error.message}`;
    }
  }
});

server.on("connect", (event) => {
  console.log("Client connected:", event.session);
});

server.on("disconnect", (event) => {
  console.log("Client disconnected:", event.session);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

// Start the server with stdio transport
server.start({
  transportType: "stdio"
});

console.log("Zerodha Trading MCP server started!");
