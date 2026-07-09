const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function stamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    d.getUTCFullYear() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    '-' +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    p(d.getUTCMilliseconds(), 3)
  );
}

function createLogStore({ dir, maxBytes, keep }) {
  fs.mkdirSync(dir, { recursive: true });
  const currentPath = path.join(dir, 'current.jsonl');
  let chain = Promise.resolve();
  let rotateSeq = 0;

  function currentSize() {
    try {
      return fs.statSync(currentPath).size;
    } catch {
      return 0;
    }
  }

  function prune() {
    const gz = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl.gz'))
      .sort()
      .reverse();
    for (const f of gz.slice(keep)) {
      fs.unlinkSync(path.join(dir, f));
    }
  }

  function rotateIfNeeded() {
    if (currentSize() < maxBytes) return;
    rotateSeq += 1;
    const base = `current-${stamp()}-${rotateSeq}.jsonl`;
    const renamed = path.join(dir, base);
    const gzPath = renamed + '.gz';
    fs.renameSync(currentPath, renamed);
    fs.writeFileSync(gzPath, zlib.gzipSync(fs.readFileSync(renamed)));
    fs.unlinkSync(renamed);
    fs.writeFileSync(currentPath, '');
    prune();
  }

  function append(entry) {
    chain = chain.then(() => {
      try {
        fs.appendFileSync(currentPath, JSON.stringify(entry) + '\n');
        rotateIfNeeded();
      } catch (err) {
        console.error(`log-store append failed: ${err.message}`);
      }
    });
    return chain;
  }

  async function readRecent({ maxLines = 500, maxBytes = 512 * 1024 } = {}) {
    const files = [];
    if (fs.existsSync(currentPath)) files.push(currentPath);
    const gz = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl.gz'))
      .sort()
      .reverse()
      .map((f) => path.join(dir, f));
    files.push(...gz);

    const collected = [];
    let bytes = 0;
    for (const file of files) {
      let text;
      if (file.endsWith('.gz')) {
        text = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
      } else {
        text = fs.readFileSync(file, 'utf8');
      }
      const lines = text.split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        bytes += Buffer.byteLength(line);
        try {
          collected.push(JSON.parse(line));
        } catch {
          continue;
        }
        if (collected.length >= maxLines || bytes >= maxBytes) {
          return collected;
        }
      }
    }
    return collected;
  }

  async function close() {
    await chain;
  }

  return { append, readRecent, close };
}

module.exports = { createLogStore };
