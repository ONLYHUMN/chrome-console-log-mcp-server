const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createLogStore } = require('../lib/log-store');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'log-store-test-'));
}

describe('createLogStore', () => {
  let dir;
  let store;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(async () => {
    if (store) await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('appends JSONL lines to current.jsonl', async () => {
    store = createLogStore({ dir, maxBytes: 1024 * 1024, keep: 5 });
    await store.append({
      timestamp: '2026-07-08T12:00:00.000Z',
      type: 'log',
      content: ['a'],
      url: 'http://x/',
      sessionId: 's1',
    });
    const text = fs.readFileSync(path.join(dir, 'current.jsonl'), 'utf8');
    assert.match(text, /"content":\["a"\]/);
  });

  it('rotates and gzips when over maxBytes', async () => {
    store = createLogStore({ dir, maxBytes: 80, keep: 5 });
    for (let i = 0; i < 20; i++) {
      await store.append({
        timestamp: `2026-07-08T12:00:00.${String(i).padStart(3, '0')}Z`,
        type: 'log',
        content: [`line-${i}-xxxxxxxxxxxxxxxxxxxx`],
        url: 'http://x/',
        sessionId: 's1',
      });
    }
    const files = fs.readdirSync(dir).sort();
    assert.ok(files.includes('current.jsonl'));
    const gz = files.filter((f) => f.endsWith('.jsonl.gz'));
    assert.ok(gz.length >= 1);
    const gunzipped = zlib.gunzipSync(
      fs.readFileSync(path.join(dir, gz[0]))
    );
    assert.match(gunzipped.toString('utf8'), /line-/);
  });

  it('prunes old gz files beyond keep', async () => {
    store = createLogStore({ dir, maxBytes: 60, keep: 2 });
    for (let i = 0; i < 80; i++) {
      await store.append({
        timestamp: `2026-07-08T12:00:00.${String(i).padStart(3, '0')}Z`,
        type: 'log',
        content: [`pad-${i}-yyyyyyyyyyyyyyyyyyyy`],
        url: 'http://x/',
        sessionId: 's1',
      });
    }
    const gz = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl.gz'));
    assert.ok(gz.length <= 2);
  });

  it('reads newest-first with maxLines', async () => {
    store = createLogStore({ dir, maxBytes: 1024 * 1024, keep: 5 });
    for (let i = 0; i < 5; i++) {
      await store.append({
        timestamp: `2026-07-08T12:00:0${i}.000Z`,
        type: 'log',
        content: [`n${i}`],
        url: 'http://x/',
        sessionId: 's1',
      });
    }
    const entries = await store.readRecent({ maxLines: 3 });
    assert.equal(entries.length, 3);
    assert.deepEqual(entries[0].content, ['n4']);
    assert.deepEqual(entries[2].content, ['n2']);
  });
});
