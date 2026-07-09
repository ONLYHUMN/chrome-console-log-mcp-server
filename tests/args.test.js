const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../lib/args');

describe('parseArgs', () => {
  it('uses defaults without match', () => {
    assert.deepEqual(parseArgs([]), {
      port: 9222,
      mcpPort: 8766,
      match: null,
      scanIntervalMs: 2000,
      logDir: '/tmp/chrome-console-logs',
      logMaxBytes: 10 * 1024 * 1024,
      logKeep: 5,
    });
  });

  it('parses all flags', () => {
    assert.deepEqual(
      parseArgs([
        '--port',
        '9333',
        '--mcp-port',
        '9000',
        '--match',
        'vlt-panel.html',
        '--scan-interval',
        '1500',
        '--log-dir',
        '/tmp/custom-logs',
        '--log-max-bytes',
        '1024',
        '--log-keep',
        '3',
      ]),
      {
        port: 9333,
        mcpPort: 9000,
        match: 'vlt-panel.html',
        scanIntervalMs: 1500,
        logDir: '/tmp/custom-logs',
        logMaxBytes: 1024,
        logKeep: 3,
      }
    );
  });
});
