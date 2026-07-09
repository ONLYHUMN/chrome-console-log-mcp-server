function parseArgs(argv) {
  const opts = {
    port: Number(process.env.CDP_PORT) || 9222,
    mcpPort: Number(process.env.MCP_PORT) || 8766,
    match: null,
    scanIntervalMs: 2000,
    logDir: process.env.LOG_DIR || '/tmp/chrome-console-logs',
    logMaxBytes: Number(process.env.LOG_MAX_BYTES) || 10 * 1024 * 1024,
    logKeep: Number(process.env.LOG_KEEP) || 5,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') opts.port = Number(argv[++i]);
    else if (arg === '--mcp-port') opts.mcpPort = Number(argv[++i]);
    else if (arg === '--match') opts.match = argv[++i];
    else if (arg === '--scan-interval') opts.scanIntervalMs = Number(argv[++i]);
    else if (arg === '--log-dir') opts.logDir = argv[++i];
    else if (arg === '--log-max-bytes') opts.logMaxBytes = Number(argv[++i]);
    else if (arg === '--log-keep') opts.logKeep = Number(argv[++i]);
  }
  return opts;
}

module.exports = { parseArgs };
