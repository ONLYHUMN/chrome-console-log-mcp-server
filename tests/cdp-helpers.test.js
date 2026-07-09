const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  serializeRemoteObject,
  mapConsoleType,
  matchesTarget,
  buildLogEntry,
} = require('../lib/cdp-helpers');

describe('serializeRemoteObject', () => {
  it('prefers value', () => {
    assert.equal(serializeRemoteObject({ value: 'hi' }), 'hi');
  });

  it('uses description when no value', () => {
    assert.equal(
      serializeRemoteObject({ description: 'Error: boom' }),
      'Error: boom'
    );
  });

  it('stringifies objects with value', () => {
    assert.equal(serializeRemoteObject({ value: { a: 1 } }), '{"a":1}');
  });

  it('falls back for empty object', () => {
    assert.equal(serializeRemoteObject({ type: 'object' }), '[object]');
  });
});

describe('mapConsoleType', () => {
  it('maps known types', () => {
    assert.equal(mapConsoleType('warning'), 'warn');
    assert.equal(mapConsoleType('log'), 'log');
    assert.equal(mapConsoleType('error'), 'error');
    assert.equal(mapConsoleType('info'), 'info');
    assert.equal(mapConsoleType('debug'), 'debug');
  });

  it('defaults unknown to log', () => {
    assert.equal(mapConsoleType('dir'), 'log');
  });
});

describe('matchesTarget', () => {
  it('matches url substring', () => {
    assert.equal(
      matchesTarget(
        { url: 'http://localhost:3000/app', type: 'page' },
        'localhost:3000'
      ),
      true
    );
  });

  it('rejects non-matching urls', () => {
    assert.equal(
      matchesTarget(
        { url: 'https://example.com', type: 'page' },
        'localhost:3000'
      ),
      false
    );
  });

  it('rejects when match is missing', () => {
    assert.equal(
      matchesTarget({ url: 'http://localhost:3000', type: 'page' }, null),
      false
    );
  });

  it('rejects unsupported target types', () => {
    assert.equal(
      matchesTarget(
        { url: 'http://localhost:3000', type: 'service_worker' },
        'localhost:3000'
      ),
      false
    );
  });
});

describe('buildLogEntry', () => {
  it('builds a single JSONL record', () => {
    assert.deepEqual(
      buildLogEntry({
        sessionId: 'tid-1',
        url: 'http://localhost:3000/',
        type: 'log',
        content: ['hello'],
        timestamp: '2026-07-08T12:00:00.000Z',
      }),
      {
        sessionId: 'tid-1',
        url: 'http://localhost:3000/',
        type: 'log',
        content: ['hello'],
        timestamp: '2026-07-08T12:00:00.000Z',
      }
    );
  });
});
