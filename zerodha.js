import KiteConnect from 'kiteconnect';
import fetch from 'node-fetch';
import { ZERODHA_CONFIG, FAVORITE_STOCKS, TECHNICAL_PARAMS, TRADING_PARAMS } from './config.js';

// Log API initialization info
console.log('Initializing Zerodha API client with:');
console.log('API Key:', ZERODHA_CONFIG.apiKey || 'not set');
console.log('API Secret length:', ZERODHA_CONFIG.apiSecret ? ZERODHA_CONFIG.apiSecret.length : 0);
console.log('Access Token:', ZERODHA_CONFIG.accessToken ? '✓ (set)' : '✗ (not set)');

// Initialize the Kite Connect API client
let kite = new KiteConnect.KiteConnect({
  api_key: ZERODHA_CONFIG.apiKey
});

// Store the session token once authenticated
let isAuthenticated = false;

// Initialize with access token if available
if (ZERODHA_CONFIG.accessToken) {
  kite.setAccessToken(ZERODHA_CONFIG.accessToken);
  isAuthenticated = true;
  console.log('Pre-initialized with access token');
}

/**
 * Generate login URL for Zerodha authentication
 * @returns {string} Login URL
 */
export function getLoginURL() {
  // Construct the login URL manually using our actual API key
  const loginURL = `https://kite.zerodha.com/connect/login?api_key=${ZERODHA_CONFIG.apiKey}&v=3`;
  console.log('Getting login URL: ' + loginURL);
  return loginURL;
}

/**
 * Generate session using request token
 * @param {string} requestToken - Request token obtained after login
 * @returns {Promise<object>} Session details
 */
export async function generateSession(requestToken) {
  try {
    const sessionResponse = await kite.generateSession(requestToken, ZERODHA_CONFIG.apiSecret);
    kite.setAccessToken(sessionResponse.access_token);
    isAuthenticated = true;
    return sessionResponse;
  } catch (error) {
    console.error('Error generating session:', error);
    throw error;
  }
}

/**
 * Check if client is authenticated
 * @returns {boolean} Authentication status
 */
export function isClientAuthenticated() {
  return isAuthenticated;
}

/**
 * Get user profile information
 * @returns {Promise<object>} User profile
 */
export async function getProfile() {
  try {
    return await kite.getProfile();
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

/**
 * Get user holdings (portfolio)
 * @returns {Promise<Array>} User holdings
 */
export async function getHoldings() {
  try {
    return await kite.getHoldings();
  } catch (error) {
    console.error('Error fetching holdings:', error);
    throw error;
  }
}

/**
 * Get positions (day trading positions)
 * @returns {Promise<object>} User positions
 */
export async function getPositions() {
  try {
    return await kite.getPositions();
  } catch (error) {
    console.error('Error fetching positions:', error);
    throw error;
  }
}

/**
 * Get current market price for given instruments
 * @param {Array<string>} instruments - Array of instrument tokens or symbols
 * @returns {Promise<object>} Quote data
 */
export async function getQuote(instruments) {
  try {
    // If no instruments provided, use favorite stocks
    const symbolsToFetch = instruments?.length ? instruments : FAVORITE_STOCKS;
    
    // Convert to proper format if needed (NSE:SYMBOL)
    const formattedSymbols = symbolsToFetch.map(symbol => 
      symbol.includes(':') ? symbol : `NSE:${symbol}`
    );
    
    return await kite.getQuote(formattedSymbols);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    throw error;
  }
}

/**
 * Get historical data for a given instrument
 * @param {string} instrument - Instrument token
 * @param {string} interval - Candle interval (minute, day, etc.)
 * @param {string} from - From date (YYYY-MM-DD)
 * @param {string} to - To date (YYYY-MM-DD)
 * @returns {Promise<Array>} Historical data
 */
export async function getHistoricalData(instrument, interval = 'day', from, to) {
  try {
    return await kite.getHistoricalData(instrument, interval, from, to);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
}

/**
 * Analyze price changes for given instruments
 * @param {Array<string>} instruments - Array of instrument tokens or symbols
 * @returns {Promise<object>} Analysis result
 */
export async function analyzePriceChanges(instruments) {
  try {
    const quotes = await getQuote(instruments);
    const analysis = {};
    
    for (const symbol in quotes) {
      const quote = quotes[symbol];
      const changePercent = ((quote.last_price - quote.ohlc.open) / quote.ohlc.open) * 100;
      
      analysis[symbol] = {
        currentPrice: quote.last_price,
        openPrice: quote.ohlc.open,
        highPrice: quote.ohlc.high,
        lowPrice: quote.ohlc.low,
        changePercent: changePercent.toFixed(2),
        volume: quote.volume,
        lastTradeTime: quote.last_trade_time,
        buySignal: changePercent <= -TRADING_PARAMS.buySignalThreshold,
        sellSignal: changePercent >= TRADING_PARAMS.sellSignalThreshold
      };
    }
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing price changes:', error);
    throw error;
  }
}

/**
 * Analyze portfolio for buy/sell recommendations
 * @returns {Promise<object>} Portfolio analysis
 */
export async function analyzePortfolio() {
  try {
    // Get holdings and current market prices
    const holdings = await getHoldings();
    const holdingSymbols = holdings.map(holding => holding.tradingsymbol);
    const quotes = await getQuote(holdingSymbols);
    
    // Calculate portfolio total value
    let portfolioValue = 0;
    holdings.forEach(holding => {
      const symbol = `NSE:${holding.tradingsymbol}`;
      const currentPrice = quotes[symbol]?.last_price || holding.last_price;
      portfolioValue += currentPrice * holding.quantity;
    });
    
    // Analyze each holding
    const analysis = {
      totalValue: portfolioValue,
      holdings: []
    };
    
    for (const holding of holdings) {
      const symbol = `NSE:${holding.tradingsymbol}`;
      const quote = quotes[symbol];
      
      if (!quote) continue;
      
      const currentPrice = quote.last_price;
      const investmentValue = holding.average_price * holding.quantity;
      const currentValue = currentPrice * holding.quantity;
      const profitLoss = currentValue - investmentValue;
      const profitLossPercent = (profitLoss / investmentValue) * 100;
      const allocationPercent = (currentValue / portfolioValue) * 100;
      
      // Determine recommendation
      let recommendation = 'HOLD';
      let reason = '';
      
      // Sell signals
      if (profitLossPercent >= TRADING_PARAMS.targetProfitPercentage * 100) {
        recommendation = 'SELL';
        reason = 'Target profit reached';
      } else if (profitLossPercent <= -TRADING_PARAMS.stopLossPercentage * 100) {
        recommendation = 'SELL';
        reason = 'Stop loss triggered';
      } else if (allocationPercent > TRADING_PARAMS.maxPortfolioAllocation * 100) {
        recommendation = 'REDUCE';
        reason = 'Overallocated in portfolio';
      }
      
      analysis.holdings.push({
        symbol: holding.tradingsymbol,
        quantity: holding.quantity,
        averagePrice: holding.average_price,
        currentPrice: currentPrice,
        investmentValue: investmentValue,
        currentValue: currentValue,
        profitLoss: profitLoss,
        profitLossPercent: profitLossPercent.toFixed(2),
        allocationPercent: allocationPercent.toFixed(2),
        recommendation: recommendation,
        reason: reason
      });
    }
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing portfolio:', error);
    throw error;
  }
}

/**
 * Find potential stocks to buy based on price analysis and technical indicators
 * @returns {Promise<Array>} Potential buy opportunities
 */
export async function findPotentialBuys() {
  try {
    // Analyze favorite stocks
    const priceAnalysis = await analyzePriceChanges(FAVORITE_STOCKS);
    const potentialBuys = [];
    
    for (const symbol in priceAnalysis) {
      const analysis = priceAnalysis[symbol];
      
      // Basic price drop filter
      if (analysis.buySignal) {
        potentialBuys.push({
          symbol: symbol.replace('NSE:', ''),
          currentPrice: analysis.currentPrice,
          changePercent: analysis.changePercent,
          reason: `Price dropped by ${Math.abs(analysis.changePercent)}%`
        });
      }
    }
    
    return potentialBuys;
  } catch (error) {
    console.error('Error finding potential buys:', error);
    throw error;
  }
}

/**
 * Set access token directly
 * @param {string} accessToken - Access token
 */
export function setAccessToken(accessToken) {
  try {
    kite.setAccessToken(accessToken);
    isAuthenticated = true;
    console.log('Access token set successfully');
  } catch (error) {
    console.error('Error setting access token:', error);
    throw error;
  }
} 