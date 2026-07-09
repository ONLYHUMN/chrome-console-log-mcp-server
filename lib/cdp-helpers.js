function serializeRemoteObject(obj) {
  if (!obj || typeof obj !== 'object') return String(obj);
  if (Object.prototype.hasOwnProperty.call(obj, 'value')) {
    const v = obj.value;
    if (v !== null && typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }
  if (obj.description) return String(obj.description);
  if (obj.unserializableValue) return String(obj.unserializableValue);
  return obj.type ? `[${obj.type}]` : '[unknown]';
}

function mapConsoleType(cdpType) {
  const map = {
    log: 'log',
    warning: 'warn',
    warn: 'warn',
    error: 'error',
    info: 'info',
    debug: 'debug',
  };
  return map[cdpType] || 'log';
}

function matchesTarget(target, match) {
  if (!match) return false;
  if (!target || !target.url) return false;
  if (target.type !== 'page' && target.type !== 'other') return false;
  return target.url.includes(match);
}

function buildLogEntry({ sessionId, url, type, content, timestamp }) {
  return { sessionId, url, type, content, timestamp };
}

module.exports = {
  serializeRemoteObject,
  mapConsoleType,
  matchesTarget,
  buildLogEntry,
};
