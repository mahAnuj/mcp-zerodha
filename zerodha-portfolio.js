// Import environment variables first
import './env-loader.js';
import * as zerodha from './zerodha.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Token storage file
const TOKEN_FILE = path.join(process.cwd(), '.zerodha_token.json');

// Function to check if token file exists and is valid
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      
      // Check if token is expired (expiry is in Unix timestamp)
      const now = Math.floor(Date.now() / 1000);
      if (tokenData.expires_at && tokenData.expires_at > now) {
        return tokenData;
      } else {
        console.log('Stored token has expired. Need to authenticate again.');
        return null;
      }
    }
  } catch (error) {
    console.error('Error reading token file:', error.message);
  }
  return null;
}

// Function to save token data
function saveTokenData(tokenData) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
    console.log('Access token saved successfully for future use.');
  } catch (error) {
    console.error('Error saving token data:', error.message);
  }
}

// Function to handle the authentication process
async function authenticateZerodha() {
  // Check for stored token first
  const storedToken = getStoredToken();
  if (storedToken && storedToken.access_token) {
    console.log('Found valid stored access token.');
    try {
      // We need to manually call generateSession to set up the API client
      // But we'll use a workaround by directly checking the authentication status
      // after setting the token in memory to avoid an API call
      
      // This won't make an API call, it just updates the local state
      zerodha.setAccessToken(storedToken.access_token);
      
      console.log('Using stored token that expires:', new Date(storedToken.expires_at * 1000).toLocaleString());
      return true;
    } catch (error) {
      console.error('Error using stored token:', error.message);
      return false;
    }
  }
  
  console.log('=== Zerodha Authentication ===');
  
  // Get login URL
  const loginURL = zerodha.getLoginURL();
  console.log(`\n1. Visit this URL in your browser to login: ${loginURL}`);
  console.log('\n2. After login, you will be redirected to a page with a request token in the URL.');
  console.log('   Example: https://your-redirect-url?request_token=abcd1234&action=login');
  
  // Prompt for request token
  return new Promise((resolve) => {
    rl.question('\nEnter the request token from the URL: ', async (requestToken) => {
      try {
        console.log(`\nAttempting to generate session with token: ${requestToken}`);
        
        const sessionResponse = await zerodha.generateSession(requestToken);
        console.log('\nSession generated successfully!');
        console.log('Access Token:', sessionResponse.access_token);
        console.log('Token expiry:', new Date(sessionResponse.expires_at * 1000).toLocaleString());
        
        // Save token data for future use
        saveTokenData(sessionResponse);
        
        resolve(true);
      } catch (error) {
        console.error('\nError generating session:', error.message);
        if (error.message.includes('invalid')) {
          console.log('\nPossible reasons:');
          console.log('1. The request token has expired (valid only for a few minutes)');
          console.log('2. The request token has already been used');
          console.log('3. The request token is invalid');
        }
        resolve(false);
      }
    });
  });
}

// Function to fetch and display portfolio data
async function fetchPortfolio() {
  try {
    console.log('\n=== Fetching Portfolio Data ===');
    
    // Get holdings (portfolio)
    const holdings = await zerodha.getHoldings();
    
    if (holdings.length === 0) {
      console.log('\nNo holdings found in your portfolio.');
      return;
    }
    
    console.log(`\nFound ${holdings.length} holdings in your portfolio.`);
    
    // Calculate total portfolio value
    let totalValue = 0;
    let totalInvestment = 0;
    
    console.log('\n=== Portfolio Summary ===');
    console.log('Symbol\t\tQty\tAvg Price\tCurrent\t\tP&L\t\tP&L %');
    console.log('-'.repeat(80));
    
    for (const holding of holdings) {
      const currentValue = holding.quantity * holding.last_price;
      const investmentValue = holding.quantity * holding.average_price;
      const pnl = currentValue - investmentValue;
      const pnlPercent = (pnl / investmentValue) * 100;
      
      totalValue += currentValue;
      totalInvestment += investmentValue;
      
      // Format the output for better readability
      const symbol = holding.tradingsymbol.padEnd(12);
      const qty = holding.quantity.toString().padEnd(8);
      const avgPrice = holding.average_price.toFixed(2).padEnd(12);
      const current = holding.last_price.toFixed(2).padEnd(12);
      const pnlFormatted = pnl.toFixed(2).padEnd(12);
      const pnlPercentFormatted = pnlPercent.toFixed(2) + '%';
      
      console.log(`${symbol}${qty}${avgPrice}${current}${pnlFormatted}${pnlPercentFormatted}`);
    }
    
    console.log('-'.repeat(80));
    const totalPnL = totalValue - totalInvestment;
    const totalPnLPercent = (totalPnL / totalInvestment) * 100;
    console.log(`TOTAL\t\t\t\t\t\t${totalPnL.toFixed(2)}\t\t${totalPnLPercent.toFixed(2)}%`);
    console.log(`\nTotal Portfolio Value: ₹${totalValue.toFixed(2)}`);
    console.log(`Total Investment: ₹${totalInvestment.toFixed(2)}`);
    
    // Get current market prices for favorite stocks
    console.log('\n=== Market Watch ===');
    
    const quotes = await zerodha.getQuote();
    console.log('Symbol\t\tLTP\t\tChange\t\tChange %');
    console.log('-'.repeat(80));
    
    for (const symbol in quotes) {
      const quote = quotes[symbol];
      const stockSymbol = symbol.replace('NSE:', '').padEnd(12);
      const ltp = quote.last_price.toFixed(2).padEnd(12);
      const change = (quote.last_price - quote.ohlc.open).toFixed(2);
      const changePercent = ((quote.last_price - quote.ohlc.open) / quote.ohlc.open * 100).toFixed(2) + '%';
      const changeStr = change.padEnd(12);
      
      console.log(`${stockSymbol}${ltp}${changeStr}${changePercent}`);
    }
    
  } catch (error) {
    console.error('\nError fetching portfolio data:', error.message);
  }
}

// Main function
async function main() {
  try {
    // Step 1: Authenticate
    const isAuthenticated = await authenticateZerodha();
    
    if (!isAuthenticated) {
      console.log('\nAuthentication failed. Please try again.');
      rl.close();
      return;
    }
    
    // Step 2: Fetch portfolio
    await fetchPortfolio();
    
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    rl.close();
  }
}

// Run the main function
main(); 