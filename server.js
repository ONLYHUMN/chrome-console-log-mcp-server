#!/usr/bin/env node
const http = require('node:http');
const CDP = require('chrome-remote-interface');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { parseArgs } = require('./lib/args');
const {
  serializeRemoteObject,
  mapConsoleType,
  matchesTarget,
  buildLogEntry,
} = require('./lib/cdp-helpers');
const { createLogStore } = require('./lib/log-store');

const opts = parseArgs(process.argv.slice(2));

if (!opts.match) {
  console.error(
    '\x1b[31mMissing required --match <substring>.\x1b[0m\n' +
      'Example:\n' +
      '  node server.js --match "localhost:3000"\n' +
      '  node server.js --match "vlt-panel.html"'
  );
  process.exit(1);
}

const logStore = createLogStore({
  dir: opts.logDir,
  maxBytes: opts.logMaxBytes,
  keep: opts.logKeep,
});

const attached = new Map();
const transports = Object.create(null);
let lastCdpDown = false;

async function recordConsoleLog(targetId, url, type, content, timestamp) {
  await logStore.append(
    buildLogEntry({
      sessionId: targetId,
      url,
      type,
      content,
      timestamp: timestamp || new Date().toISOString(),
    })
  );
}

async function attachTarget(target) {
  if (attached.has(target.targetId)) return;
  try {
    const client = await CDP({ port: opts.port, target: target.targetId });
    const { Runtime } = client;
    await Runtime.enable();

    Runtime.consoleAPICalled(({ type, args, timestamp }) => {
      const content = (args || []).map(serializeRemoteObject);
      const iso =
        typeof timestamp === 'number'
          ? new Date(timestamp).toISOString()
          : new Date().toISOString();
      recordConsoleLog(
        target.targetId,
        target.url,
        mapConsoleType(type),
        content,
        iso
      ).catch(() => {});
    });

    Runtime.exceptionThrown(({ exceptionDetails }) => {
      const text =
        exceptionDetails?.exception?.description ||
        exceptionDetails?.text ||
        'Uncaught exception';
      recordConsoleLog(target.targetId, target.url, 'error', [text]).catch(
        () => {}
      );
    });

    client.on('disconnect', () => {
      attached.delete(target.targetId);
      console.log(`\x1b[33mDetached from ${target.url}\x1b[0m`);
    });

    attached.set(target.targetId, { client, url: target.url });
    console.log(`\x1b[32mAttached to ${target.url}\x1b[0m`);
  } catch (err) {
    console.error(
      `\x1b[31mFailed to attach ${target.url}: ${err.message}\x1b[0m`
    );
  }
}

async function detachMissing(liveIds) {
  for (const [id, entry] of attached) {
    if (!liveIds.has(id)) {
      try {
        await entry.client.close();
      } catch {
        /* ignore */
      }
      attached.delete(id);
      console.log(`\x1b[33mDetached missing target ${entry.url}\x1b[0m`);
    }
  }
}

async function scanOnce() {
  let client;
  try {
    client = await CDP({ port: opts.port });
    lastCdpDown = false;
    const { Target } = client;
    const { targetInfos } = await Target.getTargets();
    const matches = targetInfos.filter((t) => matchesTarget(t, opts.match));
    const liveIds = new Set(matches.map((t) => t.targetId));
    await detachMissing(liveIds);
    for (const t of matches) {
      await attachTarget(t);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      if (!lastCdpDown) {
        console.log(
          '\x1b[31mCannot connect to browser CDP. Start Chrome/Brave with:\x1b[0m'
        );
        console.log(`\x1b[36m  --remote-debugging-port=${opts.port}\x1b[0m`);
        lastCdpDown = true;
      }
    } else {
      console.error(`\x1b[31mScan failed: ${err.message}\x1b[0m`);
    }
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function createMcpServer() {
  const server = new Server(
    { name: 'chrome-console-log-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'getConsoleLogs',
        description: 'Get console logs from the browser',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'getConsoleLogs') {
      return {
        content: [
          { type: 'text', text: `Unknown tool: ${request.params.name}` },
        ],
        isError: true,
      };
    }
    const entries = await logStore.readRecent({});
    if (!entries.length) {
      return {
        content: [{ type: 'text', text: 'No console logs captured yet.' }],
      };
    }
    const lines = entries.map((e) => {
      const content =
        typeof e.content === 'string' ? e.content : JSON.stringify(e.content);
      const where = e.url ? ` ${e.url}` : '';
      return `[${e.timestamp}] ${String(e.type).toUpperCase()}${where}: ${content}`;
    });
    return {
      content: [
        {
          type: 'text',
          text: `Console logs (${entries.length} entries):\n\n${lines.join('\n')}`,
        },
      ],
    };
  });
  return server;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${opts.mcpPort}`);
  try {
    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;
      transport.onclose = () => {
        delete transports[transport.sessionId];
      };
      const mcp = createMcpServer();
      await mcp.connect(transport);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId');
      const transport = sessionId ? transports[sessionId] : null;
      if (!transport) {
        res.writeHead(404).end('Session not found');
        return;
      }
      const body = await readJsonBody(req);
      await transport.handlePostMessage(req, res, body);
      return;
    }
    res.writeHead(404).end('Not found');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end('Error');
  }
});

httpServer.listen(opts.mcpPort, () => {
  console.log(`\x1b[35mMCP SSE: http://localhost:${opts.mcpPort}/sse\x1b[0m`);
  console.log(`CDP port: ${opts.port}`);
  console.log(`Match: ${opts.match}`);
  console.log(`Logs: ${opts.logDir}`);
  scanOnce().catch((err) => console.error(err));
  setInterval(() => {
    scanOnce().catch((err) => console.error(err));
  }, opts.scanIntervalMs);
});
