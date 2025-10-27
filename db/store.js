// db/store.js
const { initDb } = require('./init');
const TTL_MS = 24 * 60 * 60 * 1000;
function now(){ return Date.now(); }

const { db, stmts } = initDb(); // single DB instance for the app
const crypto = require("crypto");

function createSession(id, opts = {}) {
  id = crypto.randomUUID();
  const ts = now();
  const expiresAt = ts + (opts.ttlMs ?? TTL_MS);
  const active_symbol = opts.activeSymbol ?? null;
  const referenced_symbols = opts.referencedSymbols ? JSON.stringify(opts.referencedSymbols) : JSON.stringify([]);
  const last_op = opts.lastOp ?? null;
  const summary = opts.summary ?? null;

  stmts.createSession.run(id, ts, ts, expiresAt, active_symbol, referenced_symbols, last_op, summary);
  return getSession(id);
}

function getSession(id) {
  const s = stmts.getSession.get(id);
  if (!s) return null;
  return {
    id: s.id,
    createdAt: s.created_at,
    lastActiveAt: s.last_active_at,
    expiresAt: s.expires_at,
    activeSymbol: s.active_symbol,
    referencedSymbols: s.referenced_symbols ? JSON.parse(s.referenced_symbols) : [],
    lastOp: s.last_op,
    summary: s.summary
  };
}

function touchSession(id) {
  const ts = now();
  const expiresAt = ts + TTL_MS;
  db.prepare(`UPDATE sessions SET last_active_at = ?, expires_at = ? WHERE id = ?`).run(ts, expiresAt, id);
}

function updateSessionFields(id, fields = {}) {
  const current = getSession(id);
  if (!current) return null;

  const active_symbol = (fields.activeSymbol !== undefined) ? fields.activeSymbol : current.activeSymbol;
  const referenced_symbols = (fields.referencedSymbols !== undefined) ? JSON.stringify(fields.referencedSymbols) : JSON.stringify(current.referencedSymbols);
  const last_op = (fields.lastOp !== undefined) ? fields.lastOp : current.lastOp;
  const summary = (fields.summary !== undefined) ? fields.summary : current.summary;

  stmts.updateSessionFields.run(active_symbol, referenced_symbols, last_op, summary, id);
  touchSession(id);
  return getSession(id);
}

const deleteSessionTx = db.transaction((id) => {
  db.prepare(`DELETE FROM messages WHERE session_id = ?`).run(id);
  stmts.deleteSession.run(id);
});

function deleteSession(id) {
  deleteSessionTx(id);
}

function addMessage(sessionId, role, content, metadata = null) {
  const ts = now();
  stmts.insertMessage.run(sessionId, role, content, metadata ? JSON.stringify(metadata) : null, ts);
  touchSession(sessionId);
}

function getRecentMessages(sessionId, limit = 10) {
  const rows = stmts.recentMessages.all(sessionId, limit);
  return rows.reverse().map(r => ({ id: r.id, role: r.role, content: r.content, metadata: r.metadata ? JSON.parse(r.metadata) : null, ts: r.ts }));
}

function sessionExpired(session) {
  if (!session) return true;
  return now() > (session.expiresAt || 0);
}

module.exports = {
  createSession, getSession, updateSessionFields, deleteSession, addMessage, getRecentMessages, sessionExpired,touchSession,
  _db: db
};
