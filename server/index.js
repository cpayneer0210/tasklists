import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { applyTaskTimestamps, applyMoveDone, daysSinceLast } from './taskLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const TASK_COLUMNS = [
  'list', 'type', 'task_name', 'progress', 'priority', 'deadline', 'link',
  'task_focus', 'notes', 'value_add', 'task_added', 'task_started',
  'task_complete', 'met_deadline', 'week_start',
];

const RECURRING_COLUMNS = [
  'day', 'type', 'task_name', 'progress', 'priority', 'deadline', 'link',
  'task_focus', 'last_added', 'to_add',
];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

// --- Tasks ---

app.get('/api/tasks', (req, res) => {
  const { list } = req.query;
  let rows;
  if (list) {
    rows = db.prepare('SELECT * FROM tasks WHERE list = ? ORDER BY id DESC').all(list);
  } else {
    rows = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
  }
  res.json(rows);
});

app.post('/api/tasks', (req, res) => {
  const body = pick(req.body, TASK_COLUMNS);
  body.list = body.list || 'task_list';
  const patched = applyTaskTimestamps(null, body);
  const cols = Object.keys(patched);
  const placeholders = cols.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT INTO tasks (${cols.join(',')}) VALUES (${placeholders})`);
  const info = stmt.run(...cols.map((c) => patched[c]));
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.put('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  let patch = pick(req.body, TASK_COLUMNS);
  patch = applyTaskTimestamps(existing, patch);
  patch = applyMoveDone(existing, patch);

  const cols = Object.keys(patch);
  if (cols.length === 0) return res.json(existing);
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...cols.map((c) => patch[c]), req.params.id);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Recurring ---

app.get('/api/recurring', (req, res) => {
  const rows = db.prepare('SELECT * FROM recurring ORDER BY id DESC').all();
  const withComputed = rows.map((r) => ({ ...r, days_since_last: daysSinceLast(r.last_added) }));
  res.json(withComputed);
});

app.post('/api/recurring', (req, res) => {
  const body = pick(req.body, RECURRING_COLUMNS);
  const cols = Object.keys(body);
  const placeholders = cols.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT INTO recurring (${cols.join(',')}) VALUES (${placeholders})`);
  const info = stmt.run(...cols.map((c) => body[c]));
  const row = db.prepare('SELECT * FROM recurring WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...row, days_since_last: daysSinceLast(row.last_added) });
});

app.put('/api/recurring/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM recurring WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const patch = pick(req.body, RECURRING_COLUMNS);
  const cols = Object.keys(patch);
  if (cols.length === 0) return res.json(existing);
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  db.prepare(`UPDATE recurring SET ${setClause} WHERE id = ?`).run(...cols.map((c) => patch[c]), req.params.id);
  const row = db.prepare('SELECT * FROM recurring WHERE id = ?').get(req.params.id);
  res.json({ ...row, days_since_last: daysSinceLast(row.last_added) });
});

app.delete('/api/recurring/:id', (req, res) => {
  db.prepare('DELETE FROM recurring WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// copyRecurringTasks: for every recurring row with to_add = 'Yes',
// create a new task_list row and stamp last_added on the recurring row.
app.post('/api/recurring/run-copy', (req, res) => {
  const due = db.prepare("SELECT * FROM recurring WHERE to_add = 'Yes'").all();
  const now = new Date().toISOString();
  const created = [];

  const insertTask = db.prepare(`
    INSERT INTO tasks (list, type, task_name, progress, priority, deadline, link, task_focus, task_added)
    VALUES ('task_list', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateRecurring = db.prepare('UPDATE recurring SET last_added = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const r of due) {
      const info = insertTask.run(r.type, r.task_name, r.progress, r.priority, r.deadline, r.link, r.task_focus, now);
      updateRecurring.run(now, r.id);
      created.push(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
    }
  });
  tx();

  res.json({ created, count: created.length });
});

// --- Kanban ---

app.get('/api/kanban', (req, res) => {
  const rows = db.prepare("SELECT * FROM tasks WHERE list IN ('task_list', 'parked', 'done')").all();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  const columns = { overdue: [], not_started: [], pending: [], completed: [] };

  for (const t of rows) {
    if (t.progress === 'Done') {
      if (t.task_complete) {
        const completedAt = new Date(t.task_complete);
        if (completedAt >= fourteenDaysAgo) columns.completed.push(t);
      }
      continue;
    }
    if (t.deadline) {
      const deadline = new Date(t.deadline);
      if (deadline < today) {
        columns.overdue.push(t);
        continue;
      }
    }
    if (t.progress === 'Pending') {
      columns.pending.push(t);
    } else {
      columns.not_started.push(t);
    }
  }

  res.json(columns);
});

// --- Dashboard ---

app.get('/api/dashboard', (req, res) => {
  const pending = db.prepare("SELECT * FROM tasks WHERE progress = 'Pending' ORDER BY deadline ASC").all();
  const calendarRows = db.prepare("SELECT * FROM tasks WHERE deadline IS NOT NULL AND deadline != '' AND list != 'done'").all();
  res.json({ pending, calendar: calendarRows });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
