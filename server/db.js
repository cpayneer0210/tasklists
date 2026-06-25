import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'tasks.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
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
);

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
);
`);

export default db;
