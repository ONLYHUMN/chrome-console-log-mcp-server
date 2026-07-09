# Chrome Console Log MCP Server

Capture browser console logs via the Chrome DevTools Protocol and expose them to an MCP client over SSE.

Useful for getting console log for extensions that run outside of the main browser window!

## Install

```bash
npm install -g @onlyhumn/chrome-console-log-mcp-server
```

Or run without installing:

```bash
npx @onlyhumn/chrome-console-log-mcp-server --match "YOUR_URL_SUBSTRING"
```

From a clone:

```bash
npm install
node server.js --match "YOUR_URL_SUBSTRING"
```

## Usage

1. Start the browser with remote debugging:

   ```bash
   /Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
   ```

2. Start the server (requires `--match`):

   ```bash
   npx @onlyhumn/chrome-console-log-mcp-server --match "YOUR_URL_SUBSTRING"
   ```

   Examples:

   ```bash
   npx @onlyhumn/chrome-console-log-mcp-server --match "localhost:3000"
   npx @onlyhumn/chrome-console-log-mcp-server --match "vlt-panel.html"
   ```

3. Configure your MCP client:
   - Type: `sse`
   - URL: `http://localhost:8766/sse`

4. Open or focus a page whose URL contains the match string. The server prints `Attached to ...` when it finds a match. Use the `getConsoleLogs` tool to read captured output.

## Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--match` | required | URL substring for CDP targets |
| `--port` | `9222` | CDP remote debugging port |
| `--mcp-port` | `8766` | HTTP port for MCP SSE |
| `--log-dir` | `/tmp/chrome-console-logs` | log directory |
| `--log-max-bytes` | `10485760` (10 MB) | rotate threshold |
| `--log-keep` | `5` | rotated `.gz` files to keep |
| `--scan-interval` | `2000` | CDP target rescan interval (ms) |

## Logs

Console events are appended to `/tmp/chrome-console-logs/current.jsonl`. When the file exceeds the rotate threshold it is gzipped and pruned so only the newest `--log-keep` archives remain.

## Releasing

Publishes run from GitHub Actions on `v*` tags. The tag must match `package.json` `"version"`.

1. Ensure the npm org/user owns the `@onlyhumn` scope.
2. First publish only: from a machine logged into npm (`npm login`), run `npm publish --access public` once so the package exists, **or** create the package on npmjs.com if your account allows it.
3. On the package page → **Trusted Publisher** (values are case-sensitive; must match GitHub OIDC claims):
   - Repository: `ONLYHUMN/chrome-console-log-mcp-server` (not lowercase `onlyhumn/...`)
   - Workflow filename: `publish.yml`
   - Leave Environment blank (workflow does not set one)
4. Bump `"version"` in `package.json`, commit, push to `master`.
5. Tag and push:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

A Trusted Publishing failure often shows up as a misleading `E404` from `npm publish`.

## Troubleshooting

- Browser must be started with `--remote-debugging-port=9222` (or the port you pass to `--port`)
- `--match` is required; without it the process exits immediately
- Confirm the server printed `Attached to ...` for your page
- MCP client URL should be `http://localhost:8766/sse` (or your `--mcp-port`)

## License

[MIT License](LICENSE)
