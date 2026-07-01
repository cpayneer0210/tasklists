import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { db, rowsToObjects } from './db.js';
import { applyTaskTimestamps, applyMoveDone, daysSinceLast, nextDue } from './taskLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const TASK_COLUMNS = [
  'list', 'type', 'task_name', 'progress', 'priority', 'deadline', 'link',
  'task_focus', 'notes', 'value_add', 'tags', 'subtasks', 'sort_order',
  'task_added', 'task_started', 'task_complete', 'met_deadline', 'week_start', 'area',
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
  const { list, area, archived } = req.query;
  const conditions = [];
  const args = [];
  if (list) { conditions.push('list = ?'); args.push(list); }
  if (area) { conditions.push('area = ?'); args.push(area); }
  // Feature 10: archive filter — done tasks older than 30 days
  if (list === 'done') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (archived === 'true') {
      conditions.push("(task_complete < ? OR (task_complete IS NULL AND task_added < ?))");
      args.push(cutoff, cutoff);
    } else {
      conditions.push("(task_complete >= ? OR task_complete IS NULL)");
      args.push(cutoff);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await getAll(`SELECT * FROM tasks ${where} ORDER BY COALESCE(sort_order, id) DESC`, args);
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
  const withComputed = rows.map((r) => ({ ...r, days_since_last: daysSinceLast(r.last_added), next_due: nextDue(r.day, r.last_added) }));
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
  res.status(201).json({ ...row, days_since_last: daysSinceLast(row.last_added), next_due: nextDue(row.day, row.last_added) });
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
  res.json({ ...row, days_since_last: daysSinceLast(row.last_added), next_due: nextDue(row.day, row.last_added) });
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

// Feature 16: stats bar
app.get('/api/stats', async (req, res) => {
  const { area } = req.query;
  const areaClause = area ? ' AND area = ?' : '';
  const areaArgs = area ? [area] : [];
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [doneThisWeek] = await getAll(
    `SELECT COUNT(*) as count FROM tasks WHERE list = 'done' AND task_complete >= ?${areaClause}`,
    [weekStart, ...areaArgs]
  );
  const [overdue] = await getAll(
    `SELECT COUNT(*) as count FROM tasks WHERE list = 'task_list' AND deadline IS NOT NULL AND deadline < ? AND progress != 'Done'${areaClause}`,
    [today, ...areaArgs]
  );
  const [dueSoon] = await getAll(
    `SELECT COUNT(*) as count FROM tasks WHERE list = 'task_list' AND deadline IS NOT NULL AND deadline >= ? AND deadline <= ?${areaClause}`,
    [today, nextWeek, ...areaArgs]
  );
  res.json({ doneThisWeek: doneThisWeek.count, overdue: overdue.count, dueSoon: dueSoon.count });
});

// Feature 17: weekly review
app.get('/api/weekly-review', async (req, res) => {
  const { area } = req.query;
  const areaClause = area ? ' AND area = ?' : '';
  const areaArgs = area ? [area] : [];
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const completedThisWeek = await getAll(
    `SELECT * FROM tasks WHERE list = 'done' AND task_complete >= ?${areaClause} ORDER BY task_complete DESC`,
    [weekStart, ...areaArgs]
  );
  const overdue = await getAll(
    `SELECT * FROM tasks WHERE list = 'task_list' AND deadline IS NOT NULL AND deadline < ? AND progress != 'Done'${areaClause} ORDER BY deadline ASC`,
    [today, ...areaArgs]
  );
  const dueNextWeek = await getAll(
    `SELECT * FROM tasks WHERE list = 'task_list' AND deadline IS NOT NULL AND deadline >= ? AND deadline <= ?${areaClause} ORDER BY deadline ASC`,
    [today, nextWeek, ...areaArgs]
  );
  const recurringDue = await getAll(
    `SELECT * FROM recurring WHERE to_add = 'Yes'${areaClause}`,
    areaArgs
  );
  res.json({ completedThisWeek, overdue, dueNextWeek, recurringDue });
});

// Feature 13: comments
app.get('/api/tasks/:id/comments', async (req, res) => {
  const rows = await getAll('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC', [req.params.id]);
  res.json(rows);
});

app.post('/api/tasks/:id/comments', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const now = new Date().toISOString();
  const rs = await db.execute({
    sql: 'INSERT INTO task_comments (task_id, text, created_at) VALUES (?, ?, ?)',
    args: [req.params.id, text.trim(), now],
  });
  res.status(201).json({ id: Number(rs.lastInsertRowid), task_id: Number(req.params.id), text: text.trim(), created_at: now });
});


// --- Trello sync ---
// Pulls all cards from a board (via TRELLO_BOARD_ID) and imports any not yet
// seen (matched by trello_card_id). List name is mapped to progress status.
function trelloListToProgress(listName) {
  const n = listName.toLowerCase();
  if (/done|complet|finish|closed|archive/.test(n)) return 'Done';
  if (/doing|in.progress|progress|pending|active|current|started|wip/.test(n)) return 'Pending';
  return 'Not Started';
}

app.post('/api/integrations/trello/sync', async (req, res) => {
  const { TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;
  if (!TRELLO_API_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    return res.status(500).json({ error: 'Trello integration not configured. Set TRELLO_API_KEY, TRELLO_TOKEN and TRELLO_BOARD_ID in environment variables.' });
  }

  const base = `https://api.trello.com/1`;
  const auth = `key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

  // Fetch all lists on the board to build id→progress map
  const listsRes = await fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?${auth}`);
  if (!listsRes.ok) return res.status(502).json({ error: `Trello lists error: ${listsRes.status}` });
  const lists = await listsRes.json();
  const listProgress = Object.fromEntries(lists.map((l) => [l.id, trelloListToProgress(l.name)]));
  const listName = Object.fromEntries(lists.map((l) => [l.id, l.name]));

  // Fetch all open cards on the board
  const cardsRes = await fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?filter=open&${auth}`);
  if (!cardsRes.ok) return res.status(502).json({ error: `Trello cards error: ${cardsRes.status}` });
  const cards = await cardsRes.json();

  const existing = await getAll('SELECT trello_card_id FROM tasks WHERE trello_card_id IS NOT NULL', []);
  const known = new Set(existing.map((r) => r.trello_card_id));

  const now = new Date().toISOString();
  const created = [];
  for (const card of cards) {
    if (known.has(card.id)) continue;
    const progress = listProgress[card.idList] || 'Not Started';
    const list = progress === 'Done' ? 'done' : 'task_list';
    const rs = await db.execute({
      sql: `INSERT INTO tasks (list, task_name, progress, deadline, link, notes, task_added, area, trello_card_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Work', ?)`,
      args: [list, card.name, progress, card.due ? card.due.slice(0, 10) : null, card.shortUrl, card.desc || null, now, card.id],
    });
    created.push(await getOne('SELECT * FROM tasks WHERE id = ?', [Number(rs.lastInsertRowid)]));
  }

  res.json({ created, count: created.length, lists: lists.map((l) => ({ name: l.name, progress: listProgress[l.id] })) });
});

// --- Projects ---

app.get('/api/projects', async (req, res) => {
  const { area } = req.query;
  const rows = area
    ? await getAll('SELECT * FROM projects WHERE area = ? ORDER BY name ASC', [area])
    : await getAll('SELECT * FROM projects ORDER BY name ASC', []);
  res.json(rows);
});

app.post('/api/projects', async (req, res) => {
  const { name, color, area } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  const now = new Date().toISOString();
  const rs = await db.execute({
    sql: 'INSERT INTO projects (name, color, area, created_at) VALUES (?, ?, ?, ?)',
    args: [name.trim(), color || '#4c6ef5', area || 'Personal', now],
  });
  res.status(201).json(await getOne('SELECT * FROM projects WHERE id = ?', [Number(rs.lastInsertRowid)]));
});

app.put('/api/projects/:id', async (req, res) => {
  const { name, color, area } = req.body;
  const existing = await getOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const patch = { name: name ?? existing.name, color: color ?? existing.color, area: area ?? existing.area };
  await db.execute({
    sql: 'UPDATE projects SET name = ?, color = ?, area = ? WHERE id = ?',
    args: [patch.name, patch.color, patch.area, req.params.id],
  });
  res.json(await getOne('SELECT * FROM projects WHERE id = ?', [req.params.id]));
});

app.delete('/api/projects/:id', async (req, res) => {
  await db.execute({ sql: 'UPDATE tasks SET project_id = NULL WHERE project_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [req.params.id] });
  res.status(204).end();
});

// --- Dependencies ---

app.get('/api/tasks/:id/dependencies', async (req, res) => {
  const deps = await getAll(
    'SELECT t.* FROM tasks t JOIN task_dependencies d ON t.id = d.depends_on_id WHERE d.task_id = ?',
    [req.params.id]
  );
  res.json(deps);
});

app.post('/api/tasks/:id/dependencies', async (req, res) => {
  const { depends_on_id } = req.body;
  if (!depends_on_id) return res.status(400).json({ error: 'depends_on_id required' });
  try {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)',
      args: [req.params.id, depends_on_id],
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.status(201).json({ task_id: Number(req.params.id), depends_on_id: Number(depends_on_id) });
});

app.delete('/api/tasks/:id/dependencies/:depId', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?',
    args: [req.params.id, req.params.depId],
  });
  res.status(204).end();
});

// --- Google Sheets sync ---
// Reads a "publish to web" CSV export of a sheet with columns
// source, text, link, date. Each row becomes a task (deduped by a hash
// of its own contents) unless already imported.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

app.get('/api/integrations/sheets/sync', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { SHEETS_CSV_URL } = process.env;
  if (!SHEETS_CSV_URL) {
    return res.status(500).json({ error: 'Sheets integration not configured' });
  }

  const sheetRes = await fetch(SHEETS_CSV_URL);
  if (!sheetRes.ok) {
    return res.status(502).json({ error: `Sheets fetch error: ${sheetRes.status}` });
  }
  const csvText = await sheetRes.text();
  const allRows = parseCsv(csvText);
  const dataRows = allRows.slice(1); // skip header row

  const existing = await getAll('SELECT sheet_row_hash FROM tasks WHERE sheet_row_hash IS NOT NULL', []);
  const known = new Set(existing.map((r) => r.sheet_row_hash));

  const now = new Date().toISOString();
  const created = [];
  for (const [source, text, link, date] of dataRows) {
    if (!text) continue;
    const hash = crypto.createHash('sha256').update(`${source}|${text}|${link}|${date}`).digest('hex');
    if (known.has(hash)) continue;
    const rs = await db.execute({
      sql: `INSERT INTO tasks (list, task_name, progress, deadline, link, task_focus, task_added, area, sheet_row_hash)
            VALUES ('task_list', ?, 'Not Started', ?, ?, ?, ?, 'Work', ?)`,
      args: [text, date || null, link || null, source || null, now, hash],
    });
    created.push(await getOne('SELECT * FROM tasks WHERE id = ?', [Number(rs.lastInsertRowid)]));
  }

  res.json({ created, count: created.length });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

export default app;
