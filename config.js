// Load environment variables are loaded by env-loader.js before this file is imported
export const ZERODHA_CONFIG = {
  apiKey: process.env.API_KEY,  // Required
  apiSecret: process.env.API_SECRET,  // Required
};

// Validate required environment variables
if (!ZERODHA_CONFIG.apiKey) {
  console.error('Error: Environment variable API_KEY is required but not set.');
  process.exit(1);
}

if (!ZERODHA_CONFIG.apiSecret) {
  console.error('Error: Environment variable API_SECRET is required but not set.');
  process.exit(1);
}

// Define list of favorite or common stocks to track
export const FAVORITE_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'HDFC', 'KOTAKBANK', 'SBIN', 'BHARTIARTL'
];

// Trading parameters and thresholds
export const TRADING_PARAMS = {
  buySignalThreshold: 0.05,   // 5% price drop could be a buy signal
  sellSignalThreshold: 0.08,  // 8% price increase could be a sell signal
  maxPortfolioAllocation: 0.2, // No stock should be more than 20% of portfolio
  stopLossPercentage: 0.1,    // 10% stop loss
  targetProfitPercentage: 0.15 // 15% target profit
};

// Technical analysis parameters
export const TECHNICAL_PARAMS = {
  shortTermSMA: 20,   // Short-term Simple Moving Average period
  longTermSMA: 50,    // Long-term Simple Moving Average period
  rsiPeriod: 14,      // Relative Strength Index period
  rsiOverbought: 70,  // RSI overbought threshold
  rsiOversold: 30     // RSI oversold threshold
}; 