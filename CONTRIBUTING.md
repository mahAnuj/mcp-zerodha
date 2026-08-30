# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Getting set up

Requires Node 18+ and a Zerodha Kite Connect developer app for anything that
touches live data.

```bash
git clone https://github.com/mahAnuj/mcp-zerodha.git
cd mcp-zerodha
npm install
cp .env.example .env    # add your API_KEY and API_SECRET
npm run inspect         # browse the tools interactively
```

`npm start` will look like it hangs — that is correct. An MCP server over stdio
blocks waiting for JSON-RPC on stdin. Use `npm run inspect` to explore.

You can also point an MCP client at it. Credentials go in the client's config
rather than a file:

```json
{
  "mcpServers": {
    "zerodha": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-zerodha/index.js"],
      "env": { "API_KEY": "...", "API_SECRET": "..." }
    }
  }
}
```

## Two rules to read before changing anything

**Never write to stdout on the server path.** `index.js`, `zerodha.js`,
`config.js` and `env-loader.js` speak JSON-RPC over stdout. A `console.log`
there corrupts the protocol stream. Use `console.error`.

`portfolio-analysis.js` and `zerodha-portfolio.js` are standalone scripts run
directly by a human — their `console.log` output is intentional. Don't
"consistency-fix" them.

**Never make `.env` mandatory.** MCP clients supply credentials through their
own config. `env-loader.js` treats a missing `.env` as fine; `config.js` is
where missing credentials are reported. Making the loader fail on a missing
file makes the server unusable from Claude Desktop and Cursor.

## Never commit credentials

An earlier version of this project committed a Zerodha token file. Deleting it
was not enough — the blob stayed reachable in git history and the repository had
to be rebuilt from a clean root commit to remove it.

So: no keys, no secrets, no token dumps, not even briefly. `.env` is gitignored.
If you commit a credential by accident, say so immediately rather than pushing a
follow-up "remove secret" commit — that does not remove it.

## Keep it read-only

Every tool here reads. Nothing places, modifies or cancels an order, and the
"buy signals" are text suggestions, not actions. A pull request that adds
order placement changes what this project *is* and what a mistake in it costs.
Open an issue to discuss before writing that code.

## What makes a change easy to merge

- **One concern per pull request.**
- **Say what you ran and what happened.** There is no test suite, so your
  description is the evidence.
- **Smoke-test both startup paths** before submitting:

```bash
env -u API_KEY -u API_SECRET node index.js < /dev/null   # clear error, exit 1
API_KEY=x API_SECRET=y node index.js < /dev/null         # exits 0, stdout empty
```

Stdout being empty in the second case is the check that matters.

## Adding a tool

Register it in `index.js` with a Zod input schema, keep the handler thin, and
put the actual Kite API work in `zerodha.js`. Tunable thresholds belong in
`config.js`.

## Reporting bugs

Include the tool name, the arguments, and the stderr output. Redact anything
resembling a key, token or account number before pasting.
