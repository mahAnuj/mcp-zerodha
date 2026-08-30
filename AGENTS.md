# AGENTS.md

Guidance for AI coding agents working in this repository. Also useful to humans.

## Commands

```bash
npm install
npm start            # node index.js - speaks MCP over stdio, waits on stdin
npm run dev          # npx fastmcp dev index.js
npm run inspect      # npx fastmcp inspect index.js - browse the tools
```

`npm start` looks like it hangs. It has not: an MCP server over stdio blocks
waiting for JSON-RPC on stdin. Use `npm run inspect` to poke at it interactively.

Credentials come from `API_KEY` and `API_SECRET` (see `.env.example`), either
via a `.env` file or real environment variables. A missing `.env` is fine.

There is no test suite, no linter and no build step. `node index.js` starting
without error is the smoke test.

## The two rules that matter most

**1. Never write to stdout.** This server speaks JSON-RPC over stdio, so stdout
*is* the protocol channel. A stray `console.log` corrupts the stream and can
break the client connection. All diagnostics use `console.error` (stderr).
This applies to `index.js`, `zerodha.js`, `config.js` and `env-loader.js`.

`portfolio-analysis.js` and `zerodha-portfolio.js` are the exception — they are
standalone CLI scripts, run directly by a human and never imported by the
server, so their `console.log` output is the point. Leave them alone.

**2. Never make `.env` mandatory.** MCP clients pass credentials through the
`env` block of their server config, not through a file. `env-loader.js` tolerates
a missing `.env` and only fails on a genuine read error; `config.js` is what
enforces that the credentials are actually present. Reverting that makes the
server impossible to launch from Claude Desktop or Cursor.

## Architecture

Four files on the server path:

- **`index.js`** — the FastMCP server. Registers 12 tools and starts a stdio
  transport. Each tool is a thin wrapper: validate with Zod, call `zerodha.js`,
  JSON-stringify the result.
- **`zerodha.js`** — all KiteConnect API access and the analysis helpers behind
  the tools.
- **`config.js`** — reads `API_KEY`/`API_SECRET`, exits with a clear message if
  either is missing, and defines `FAVORITE_STOCKS` (the default watchlist).
- **`env-loader.js`** — imported first by `index.js` so dotenv runs before
  anything reads `process.env`.

### The 12 tools

Auth: `checkAuthStatus`, `getLoginURL`, `generateSession`, `getProfile`.
Holdings: `getPortfolio`, `getPositions`.
Quotes: `getStockPrice`, `getFavoriteStockPrices`, `getHistoricalData`.
Analysis: `analyzePriceChanges`, `analyzePortfolio`, `findPotentialBuys`.

### Invariants

- **This server is read-only and must stay that way.** Nothing places, modifies
  or cancels an order. `analyzePortfolio` and `findPotentialBuys` return
  *suggestions* as text; they never act. Adding an order-placing tool would
  change the risk profile of the whole project — don't, without a deliberate
  decision and a much louder README.
- **Zerodha access tokens are session-scoped and expire daily.** `generateSession`
  exchanges a request token for one. Never write tokens, keys or secrets to disk
  in this repo — an earlier version committed a token file and the whole
  repository had to be rebuilt to purge it.
- Thresholds for the analysis tools (`buySignalThreshold`, `sellSignalThreshold`)
  live in `config.js`, not scattered through `zerodha.js`.

## Conventions

ES modules (`"type": "module"`), plain JavaScript, no build step. Tool input
schemas are Zod, defined inline in `index.js` next to each tool.
