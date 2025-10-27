const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(process.cwd(), 'sessions.sqlite');

function readSql(relPath) {
  return fs.readFileSync(path.resolve(__dirname, relPath), { encoding: 'utf8' });
}

function initDb(dbPath = DB_PATH) {
  const db = new Database(dbPath);

  db.exec(readSql('./sql/schema.sql'));
  db.exec(readSql('./sql/indexes.sql'));

  const stmts = {
    createSession: db.prepare(readSql('./queries/sessions.create.sql')),
    getSession: db.prepare(readSql('./queries/sessions.get.sql')),
    updateSessionFields: db.prepare(readSql('./queries/sessions.updateFields.sql')),
    deleteSession: db.prepare(readSql('./queries/sessions.delete.sql')),
    insertMessage: db.prepare(readSql('./queries/messages.insert.sql')),
    recentMessages: db.prepare(readSql('./queries/messages.recent.sql')),
  };

  return { db, stmts };
}

module.exports = { initDb };

