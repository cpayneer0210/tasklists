import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  url = `file:${path.join(dataDir, 'tasks.sqlite')}`;
}

export const db = createClient(authToken ? { url, authToken } : { url });

export function rowsToObjects(rs) {
  return rs.rows.map((r) => {
    const obj = {};
    rs.columns.forEach((c, i) => {
      obj[c] = r[i];
    });
    return obj;
  });
}

await db.execute(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list TEXT NOT NULL DEFAULT 'task_list',
  type TEXT,
  task_name TEXT,
  progress TEXT,
  priority TEXT,
  deadline TEXT,
  link TEXT,
  task_focus TEXT,
  notes TEXT,
  value_add TEXT,
  task_added TEXT,
  task_started TEXT,
  task_complete TEXT,
  met_deadline TEXT,
  week_start TEXT
)
`);

await db.execute(`
CREATE TABLE IF NOT EXISTS recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,
  type TEXT,
  task_name TEXT,
  progress TEXT,
  priority TEXT,
  deadline TEXT,
  link TEXT,
  task_focus TEXT,
  last_added TEXT,
  to_add TEXT
)
`);

export default db;
