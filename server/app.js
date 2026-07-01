import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, rowsToObjects } from './db.js';
import { applyTaskTimestamps, applyMoveDone, daysSinceLast } from './taskLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const TASK_COLUMNS = [
  'list', 'type', 'task_name', 'progress', 'priority', 'deadline', 'link',
  'task_focus', 'notes', 'value_add', 'task_added', 'task_started',
  'task_complete', 'met_deadline', 'week_start', 'area',
];

const RECURRING_COLUMNS = [
  'day', 'type', 'task_name', 'progress', 'priority', 'deadline', 'link',
  'task_focus', 'last_added', 'to_add', 'area',
];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

async function getOne(sql, args) {
  const rs = await db.execute({ sql, args });
  const rows = rowsToObjects(rs);
  return rows[0] || null;
}

async function getAll(sql, args) {
  const rs = await db.execute({ sql, args });
  return rowsToObjects(rs);
}

// --- Tasks ---

app.get('/api/tasks', async (req, res) => {
  const { list, area } = req.query;
  const conditions = [];
  const args = [];
  if (list) { conditions.push('list = ?'); args.push(list); }
  if (area) { conditions.push('area = ?'); args.push(area); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await getAll(`SELECT * FROM tasks ${where} ORDER BY id DESC`, args);
  res.json(rows);
});

app.post('/api/tasks', async (req, res) => {
  const body = pick(req.body, TASK_COLUMNS);
  body.list = body.list || 'task_list';
  body.area = body.area || 'Personal';
  const patched = applyTaskTimestamps(null, body);
  const cols = Object.keys(patched);
  const placeholders = cols.map(() => '?').join(',');
  const rs = await db.execute({
    sql: `INSERT INTO tasks (${cols.join(',')}) VALUES (${placeholders})`,
    args: cols.map((c) => patched[c]),
  });
  const row = await getOne('SELECT * FROM tasks WHERE id = ?', [Number(rs.lastInsertRowid)]);
  res.status(201).json(row);
});

app.put('/api/tasks/:id', async (req, res) => {
  const existing = await getOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  let patch = pick(req.body, TASK_COLUMNS);
  patch = applyTaskTimestamps(existing, patch);
  patch = applyMoveDone(existing, patch);

  const cols = Object.keys(patch);
  if (cols.length === 0) return res.json(existing);
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  await db.execute({
    sql: `UPDATE tasks SET ${setClause} WHERE id = ?`,
    args: [...cols.map((c) => patch[c]), req.params.id],
  });
  const row = await getOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(row);
});

app.delete('/api/tasks/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// --- Recurring ---

app.get('/api/recurring', async (req, res) => {
  const { area } = req.query;
  const rows = area
    ? await getAll('SELECT * FROM recurring WHERE area = ? ORDER BY id DESC', [area])
    : await getAll('SELECT * FROM recurring ORDER BY id DESC', []);
  const withComputed = rows.map((r) => ({ ...r, days_since_last: daysSinceLast(r.last_added) }));
  res.json(withComputed);
});

app.post('/api/recurring', async (req, res) => {
  const body = pick(req.body, RECURRING_COLUMNS);
  body.area = body.area || 'Personal';
  const cols = Object.keys(body);
  const placeholders = cols.map(() => '?').join(',');
  const rs = await db.execute({
    sql: `INSERT INTO recurring (${cols.join(',')}) VALUES (${placeholders})`,
    args: cols.map((c) => body[c]),
  });
  const row = await getOne('SELECT * FROM recurring WHERE id = ?', [Number(rs.lastInsertRowid)]);
  res.status(201).json({ ...row, days_since_last: daysSinceLast(row.last_added) });
});

app.put('/api/recurring/:id', async (req, res) => {
  const existing = await getOne('SELECT * FROM recurring WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const patch = pick(req.body, RECURRING_COLUMNS);
  const cols = Object.keys(patch);
  if (cols.length === 0) return res.json(existing);
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  await db.execute({
    sql: `UPDATE recurring SET ${setClause} WHERE id = ?`,
    args: [...cols.map((c) => patch[c]), req.params.id],
  });
  const row = await getOne('SELECT * FROM recurring WHERE id = ?', [req.params.id]);
  res.json({ ...row, days_since_last: daysSinceLast(row.last_added) });
});

app.delete('/api/recurring/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM recurring WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// copyRecurringTasks: for every recurring row with to_add = 'Yes',
// create a new task_list row and stamp last_added on the recurring row.
app.post('/api/recurring/run-copy', async (req, res) => {
  const due = await getAll("SELECT * FROM recurring WHERE to_add = 'Yes'", []);
  const now = new Date().toISOString();
  const created = [];

  for (const r of due) {
    const rs = await db.execute({
      sql: `INSERT INTO tasks (list, type, task_name, progress, priority, deadline, link, task_focus, task_added, area)
            VALUES ('task_list', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [r.type, r.task_name, r.progress, r.priority, r.deadline, r.link, r.task_focus, now, r.area || 'Personal'],
    });
    await db.execute({ sql: 'UPDATE recurring SET last_added = ? WHERE id = ?', args: [now, r.id] });
    created.push(await getOne('SELECT * FROM tasks WHERE id = ?', [Number(rs.lastInsertRowid)]));
  }

  res.json({ created, count: created.length });
});

// --- Kanban ---

app.get('/api/kanban', async (req, res) => {
  const { area } = req.query;
  const rows = area
    ? await getAll("SELECT * FROM tasks WHERE list IN ('task_list', 'parked', 'done') AND area = ?", [area])
    : await getAll("SELECT * FROM tasks WHERE list IN ('task_list', 'parked', 'done')", []);
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

app.get('/api/dashboard', async (req, res) => {
  const { area } = req.query;
  const areaClause = area ? ' AND area = ?' : '';
  const areaArgs = area ? [area] : [];
  const today = new Date().toISOString().slice(0, 10);
const pending = await getAll(
`SELECT * FROM tasks WHERE list = 'task_list' AND (progress = 'Pending' OR (deadline IS NOT NULL AND deadline != '' AND deadline < ?))${areaClause} ORDER BY deadline ASC`,
[today, ...areaArgs],
  );
  const calendarRows = await getAll(
    `SELECT * FROM tasks WHERE deadline IS NOT NULL AND deadline != '' AND list != 'done'${areaClause}`,
    areaArgs,
  );
  res.json({ pending, calendar: calendarRows });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

export default app;
