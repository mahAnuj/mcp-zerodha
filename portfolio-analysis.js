// Import environment variables first
import './env-loader.js';
import * as zerodha from './zerodha.js';
import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

// Token storage file
const TOKEN_FILE = path.join(process.cwd(), '.zerodha_token.json');

// Technical analysis parameters (can be adjusted)
const ANALYSIS_PARAMS = {
  // Short and long term moving averages (in days)
  shortTermSMA: 20,
  longTermSMA: 50,
  
  // Relative Strength Index
  rsiPeriod: 14,
  rsiOverbought: 70,  // RSI above this suggests overbought (sell signal)
  rsiOversold: 30,    // RSI below this suggests oversold (buy signal)
  
  // Moving Average Convergence Divergence
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  
  // Historical data lookback period (in days)
  lookbackDays: 100,
  
  // Price thresholds
  supportThreshold: 0.05,  // 5% above recent low
  resistanceThreshold: 0.05  // 5% below recent high
};

// Function to check if token file exists and is valid
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      console.log('Token data found:', tokenData.access_token ? 'Token available' : 'No token');
      
      if (tokenData.access_token) {
        return tokenData;
      } else {
        console.log('Stored token data exists but access_token is missing.');
        return null;
      }
    } else {
      console.log(`Token file not found at: ${TOKEN_FILE}`);
    }
  } catch (error) {
    console.error('Error reading token file:', error.message);
  }
  return null;
}

// Calculate Simple Moving Average
function calculateSMA(prices, period) {
  const result = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j].close;
    }
    
    result.push(sum / period);
  }
  
  return result;
}

// Calculate Relative Strength Index (RSI)
function calculateRSI(prices, period) {
  const result = [];
  const gains = [];
  const losses = [];
  
  // Calculate gains and losses
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      result.push(null);
      continue;
    }
    
    const change = prices[i].close - prices[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
    
    if (i < period) {
      result.push(null);
      continue;
    }
    
    // Calculate average gains and losses over the period
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let j = 0; j < period; j++) {
      avgGain += gains[i - j];
      avgLoss += losses[i - j];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Calculate RSI
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  
  return result;
}

// Format date for API
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's date and date from N days ago
function getDateRange(days) {
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - days);
  
  return {
    from: pastDate,
    to: today
  };
}

// Convert Zerodha symbol to Yahoo Finance symbol
function convertToYahooSymbol(zerodhaSymbol) {
  // Yahoo Finance uses .NS suffix for NSE stocks
  return `${zerodhaSymbol}.NS`;
}

// Fetch historical data from Yahoo Finance
async function fetchYahooHistoricalData(symbol, fromDate, toDate) {
  try {
    console.log(`Fetching historical data for ${symbol} from Yahoo Finance...`);
    
    const yahooSymbol = convertToYahooSymbol(symbol);
    
    const queryOptions = {
      period1: fromDate,
      period2: toDate,
      interval: '1d',  // daily data
    };
    
    const result = await yahooFinance.historical(yahooSymbol, queryOptions);
    
    // Convert Yahoo Finance format to a format similar to Zerodha's
    return result.map(item => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }));
    
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol} from Yahoo Finance:`, error.message);
    return null;
  }
}

// Analyze stock with historical data
async function analyzeStock(symbol, quantity, avgPrice) {
  try {
    console.log(`\nAnalyzing ${symbol}...`);
    
    // Get date range for historical data
    const dateRange = getDateRange(ANALYSIS_PARAMS.lookbackDays);
    
    // Fetch historical data from Yahoo Finance instead of Zerodha
    const historicalData = await fetchYahooHistoricalData(
      symbol,
      dateRange.from,
      dateRange.to
    );
    
    if (!historicalData || historicalData.length === 0) {
      return {
        symbol,
        recommendation: 'HOLD',
        reason: 'Insufficient historical data'
      };
    }
    
    // Calculate technical indicators
    const prices = historicalData;
    const shortTermSMA = calculateSMA(prices, ANALYSIS_PARAMS.shortTermSMA);
    const longTermSMA = calculateSMA(prices, ANALYSIS_PARAMS.longTermSMA);
    const rsi = calculateRSI(prices, ANALYSIS_PARAMS.rsiPeriod);
    
    // Get latest values
    const currentPrice = prices[prices.length - 1].close;
    const currentShortSMA = shortTermSMA[shortTermSMA.length - 1];
    const currentLongSMA = longTermSMA[longTermSMA.length - 1];
    const currentRSI = rsi[rsi.length - 1];
    
    // Find recent highs and lows
    let recentHigh = -Infinity;
    let recentLow = Infinity;
    
    for (let i = Math.max(0, prices.length - 30); i < prices.length; i++) {
      recentHigh = Math.max(recentHigh, prices[i].high);
      recentLow = Math.min(recentLow, prices[i].low);
    }
    
    // Calculate potential support and resistance levels
    const supportLevel = recentLow * (1 + ANALYSIS_PARAMS.supportThreshold);
    const resistanceLevel = recentHigh * (1 - ANALYSIS_PARAMS.resistanceThreshold);
    
    // Calculate price performance
    const priceChange1Month = (currentPrice / prices[Math.max(0, prices.length - 20)].close - 1) * 100;
    const priceChange3Month = (currentPrice / prices[Math.max(0, prices.length - 60)].close - 1) * 100;
    
    // Calculate unrealized P&L
    const investmentValue = quantity * avgPrice;
    const currentValue = quantity * currentPrice;
    const pnl = currentValue - investmentValue;
    const pnlPercent = (pnl / investmentValue) * 100;
    
    // Generate recommendation and reason
    let recommendation = 'HOLD';
    let reasons = [];
    let strength = 0; // -ve for sell, +ve for buy
    
    // MA Cross signals
    if (currentShortSMA > currentLongSMA) {
      // Golden cross (bullish)
      strength += 1;
      reasons.push('Short-term MA above long-term MA (bullish)');
    } else if (currentShortSMA < currentLongSMA) {
      // Death cross (bearish)
      strength -= 1;
      reasons.push('Short-term MA below long-term MA (bearish)');
    }
    
    // RSI signals
    if (currentRSI > ANALYSIS_PARAMS.rsiOverbought) {
      strength -= 2;
      reasons.push(`RSI at ${currentRSI.toFixed(2)} indicates overbought condition`);
    } else if (currentRSI < ANALYSIS_PARAMS.rsiOversold) {
      strength += 2;
      reasons.push(`RSI at ${currentRSI.toFixed(2)} indicates oversold condition`);
    }
    
    // Support and resistance
    if (currentPrice < supportLevel) {
      strength += 1;
      reasons.push('Price near support level');
    } else if (currentPrice > resistanceLevel) {
      strength -= 1;
      reasons.push('Price near resistance level');
    }
    
    // P&L based signals
    if (pnlPercent > 20) {
      strength -= 1;
      reasons.push(`Large unrealized profit (${pnlPercent.toFixed(2)}%)`);
    } else if (pnlPercent < -10) {
      // Don't add buy strength for losses, but note it
      reasons.push(`Current unrealized loss (${pnlPercent.toFixed(2)}%)`);
    }
    
    // Price momentum
    if (priceChange1Month > 10 && priceChange3Month > 15) {
      strength += 1;
      reasons.push('Strong positive price momentum');
    } else if (priceChange1Month < -10 && priceChange3Month < -15) {
      strength -= 1;
      reasons.push('Strong negative price momentum');
    }
    
    // Determine final recommendation
    if (strength >= 2) {
      recommendation = 'BUY';
    } else if (strength <= -2) {
      recommendation = 'SELL';
    } else if (strength === 1) {
      recommendation = 'ACCUMULATE';
    } else if (strength === -1) {
      recommendation = 'REDUCE';
    }
    
    // Return analysis result
    return {
      symbol,
      currentPrice,
      avgPrice,
      pnlPercent: pnlPercent.toFixed(2),
      shortTermSMA: currentShortSMA?.toFixed(2) || 'N/A',
      longTermSMA: currentLongSMA?.toFixed(2) || 'N/A',
      rsi: currentRSI?.toFixed(2) || 'N/A',
      supportLevel: supportLevel.toFixed(2),
      resistanceLevel: resistanceLevel.toFixed(2),
      priceChange1Month: priceChange1Month.toFixed(2),
      priceChange3Month: priceChange3Month.toFixed(2),
      recommendation,
      reasons
    };
    
  } catch (error) {
    console.error(`Error analyzing ${symbol}:`, error.message);
    return {
      symbol,
      recommendation: 'HOLD',
      reason: `Error in analysis: ${error.message}`
    };
  }
}

// Main function to analyze portfolio
async function analyzePortfolio() {
  try {
    // Check for stored token and set it
    const storedToken = getStoredToken();
    if (!storedToken || !storedToken.access_token) {
      console.log('No valid access token found.');
      console.log('Please run zerodha-portfolio.js first to authenticate.');
      return;
    }
    
    // Set the access token
    try {
      zerodha.setAccessToken(storedToken.access_token);
      console.log('Successfully set access token');
      
      // Verify authentication
      const isAuthenticated = zerodha.isClientAuthenticated();
      console.log('Authentication status:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
      
      if (!isAuthenticated) {
        console.log('Failed to authenticate with the token. Please run zerodha-portfolio.js again.');
        return;
      }
    } catch (error) {
      console.error('Error setting access token:', error.message);
      console.log('Please run zerodha-portfolio.js again to get a fresh token.');
      return;
    }
    
    console.log('=== Portfolio Analysis and Recommendations ===');
    console.log(`Using technical parameters: SMA(${ANALYSIS_PARAMS.shortTermSMA},${ANALYSIS_PARAMS.longTermSMA}), RSI(${ANALYSIS_PARAMS.rsiPeriod})`);
    console.log(`Looking back ${ANALYSIS_PARAMS.lookbackDays} days for historical data\n`);
    
    // Get holdings (portfolio)
    const holdings = await zerodha.getHoldings();
    
    if (holdings.length === 0) {
      console.log('No holdings found in your portfolio.');
      return;
    }
    
    console.log(`Found ${holdings.length} holdings in your portfolio.`);
    console.log('Analyzing each stock (this may take a while)...\n');
    
    // Analyze each stock
    const analyses = [];
    for (const holding of holdings) {
      const analysis = await analyzeStock(
        holding.tradingsymbol,
        holding.quantity,
        holding.average_price
      );
      analyses.push(analysis);
    }
    
    // Display results
    console.log('\n=== Portfolio Recommendations ===');
    console.log('Symbol\t\tCurrent\tAvg Price\tP&L %\tRSI\tRecommendation');
    console.log('-'.repeat(90));
    
    for (const analysis of analyses) {
      // Format output
      const symbol = analysis.symbol.padEnd(12);
      const currentPrice = (analysis.currentPrice || '?').toString().padEnd(8);
      const avgPrice = (analysis.avgPrice || '?').toString().padEnd(12);
      const pnl = (analysis.pnlPercent + '%').padEnd(8);
      const rsi = (analysis.rsi || 'N/A').padEnd(6);
      const recommendation = analysis.recommendation;
      
      console.log(`${symbol}${currentPrice}${avgPrice}${pnl}${rsi}${recommendation}`);
    }
    
    // Display detailed analysis for each stock
    console.log('\n=== Detailed Analysis ===');
    
    for (const analysis of analyses) {
      console.log(`\n${analysis.symbol} (${analysis.recommendation}):`);
      console.log(`Current Price: ${analysis.currentPrice}, Avg Buy Price: ${analysis.avgPrice}, P&L: ${analysis.pnlPercent}%`);
      console.log(`Technical Indicators: RSI=${analysis.rsi}, Short-term SMA=${analysis.shortTermSMA}, Long-term SMA=${analysis.longTermSMA}`);
      console.log(`Support Level: ${analysis.supportLevel}, Resistance Level: ${analysis.resistanceLevel}`);
      console.log(`1-Month Price Change: ${analysis.priceChange1Month}%, 3-Month Price Change: ${analysis.priceChange3Month}%`);
      console.log('Reasons:');
      
      for (const reason of analysis.reasons || []) {
        console.log(`  - ${reason}`);
      }
    }
    
  } catch (error) {
    console.error('Error in portfolio analysis:', error);
  }
}

// Run the analysis
analyzePortfolio(); 