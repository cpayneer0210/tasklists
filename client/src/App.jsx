import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import TaskTable from './TaskTable.jsx';
import RecurringTable from './RecurringTable.jsx';
import Kanban from './Kanban.jsx';
import Dashboard from './Dashboard.jsx';
import WeeklyReview from './WeeklyReview.jsx';
import StatsBar from './StatsBar.jsx';
import Calendar from './Calendar.jsx';
import Projects from './Projects.jsx';
import { api } from './api.js';
import { AREA_OPTIONS, PRIORITY_OPTIONS } from './constants.js';

const PAGES = [
  { key: 'task_list', label: 'Task List' },
  { key: 'parked', label: 'Parked Tasks' },
  { key: 'done', label: 'Done' },
  { key: 'archive', label: 'Archive' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'projects', label: 'Projects' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'weekly', label: 'Weekly Review' },
];

// NLP parser: extracts deadline, priority, area from a task name string
function parseNLP(raw) {
  let text = raw;
  let deadline = '';
  let priority = '';
  let taskArea = '';

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);

  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  const nextWeekday = (dow) => {
    const d = new Date(today);
    const diff = (dow - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return iso(d);
  };

  const datePatterns = [
    [/\btoday\b/i, () => iso(today)],
    [/\btomorrow\b/i, () => addDays(1)],
    [/\byesterday\b/i, () => addDays(-1)],
    [/\bnext week\b/i, () => addDays(7)],
    [/\bin (\d+) days?\b/i, (m) => addDays(Number(m[1]))],
    [/\bin (\d+) weeks?\b/i, (m) => addDays(Number(m[1]) * 7)],
    [/\bnext (mon|monday)\b/i, () => nextWeekday(1)],
    [/\bnext (tue|tuesday)\b/i, () => nextWeekday(2)],
    [/\bnext (wed|wednesday)\b/i, () => nextWeekday(3)],
    [/\bnext (thu|thursday)\b/i, () => nextWeekday(4)],
    [/\bnext (fri|friday)\b/i, () => nextWeekday(5)],
    [/\bnext (sat|saturday)\b/i, () => nextWeekday(6)],
    [/\bnext (sun|sunday)\b/i, () => nextWeekday(0)],
    [/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
      const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear();
      return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
    }],
  ];

  for (const [pat, fn] of datePatterns) {
    const m = text.match(pat);
    if (m) { deadline = fn(m); text = text.replace(m[0], '').trim(); break; }
  }

  const priorityMap = [
    [/\b(urgent|asap|critical|p1|high priority)\b/i, '2 - High'],
    [/\b(high|important)\b/i, '2 - High'],
    [/\b(medium|normal|p3)\b/i, '3 - Medium'],
    [/\b(low|minor|p4|someday)\b/i, '4 - Low'],
    [/\b(recurring|p1)\b/i, '1 - Recurring'],
  ];
  for (const [pat, pri] of priorityMap) {
    if (pat.test(text)) { priority = pri; text = text.replace(pat, '').trim(); break; }
  }

  const areaMap = [
    [/\b(work|job|office|professional)\b/i, 'Work'],
    [/\b(personal|home|private)\b/i, 'Personal'],
    [/\b(freelance|client|contract)\b/i, 'Freelance Work'],
  ];
  for (const [pat, a] of areaMap) {
    if (pat.test(text)) { taskArea = a; text = text.replace(pat, '').trim(); break; }
  }

  // Clean up extra whitespace/punctuation
  text = text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  return { task_name: text || raw.trim(), deadline, priority, area: taskArea };
}

function QuickAdd({ defaultArea, defaultList, onCreated, onClose }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (val) => {
    setInput(val);
    if (val.trim().length > 2) setPreview(parseNLP(val));
    else setPreview(null);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSaving(true);
    const parsed = parseNLP(input);
    const task = {
      list: defaultList || 'task_list',
      task_name: parsed.task_name,
      progress: 'Not Started',
      area: parsed.area || defaultArea || 'Personal',
      ...(parsed.deadline && { deadline: parsed.deadline }),
      ...(parsed.priority && { priority: parsed.priority }),
    };
    const created = await api.createTask(task).catch(() => null);
    setSaving(false);
    if (created) { onCreated(created); onClose(); }
  };

  return createPortal(
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qa-header">
          <span className="qa-title">Quick Add Task</span>
          <button className="qa-close" onClick={onClose}>✕</button>
        </div>
        <input
          autoFocus
          className="qa-input"
          type="text"
          placeholder="e.g. Call dentist tomorrow high priority work"
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
        />
        {preview && (
          <div className="qa-preview">
            <span className="qa-preview-name">{preview.task_name}</span>
            {preview.deadline && <span className="qa-chip">📅 {preview.deadline}</span>}
            {preview.priority && <span className="qa-chip">⚡ {preview.priority}</span>}
            {preview.area && <span className="qa-chip">📁 {preview.area}</span>}
          </div>
        )}
        <div className="qa-hint">
          Natural language: "tomorrow", "next friday", "urgent", "work", "in 3 days"
        </div>
        <button className="qa-submit" onClick={handleSubmit} disabled={saving || !input.trim()}>
          {saving ? 'Adding…' : 'Add Task ↵'}
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function App() {
  const [page, setPage] = useState('task_list');
  const [area, setArea] = useState('');
  const [search, setSearch] = useState('');
  const [trelloSyncing, setTrelloSyncing] = useState(false);
  const [trelloMsg, setTrelloMsg] = useState('');
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickAddKey, setQuickAddKey] = useState(0);

  const handleTrelloSync = async () => {
    setTrelloSyncing(true);
    setTrelloMsg('');
    try {
      const result = await api.syncTrello();
      setTrelloMsg(`Imported ${result.count} card${result.count !== 1 ? 's' : ''}`);
      setTimeout(() => setTrelloMsg(''), 4000);
    } catch (e) {
      setTrelloMsg(`Error: ${e.message}`);
      setTimeout(() => setTrelloMsg(''), 6000);
    } finally {
      setTrelloSyncing(false);
    }
  };

  const showStats = page === 'task_list' || page === 'parked';

  return (
    <div className="app">
      <nav>
        {PAGES.map((p) => (
          <button key={p.key} className={page === p.key ? 'active' : ''} onClick={() => setPage(p.key)}>
            {p.label}
          </button>
        ))}
        <input className="nav-search" type="search" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="trello-sync-btn" onClick={handleTrelloSync} disabled={trelloSyncing} title="Import cards from Trello board">
          {trelloSyncing ? 'Syncing…' : '⟳ Trello'}
        </button>
        {trelloMsg && <span className="trello-msg">{trelloMsg}</span>}
        <select className="area-select" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All Areas</option>
          {AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </nav>
      {showStats && <StatsBar area={area} />}
      <main>
        {page === 'task_list' && <TaskTable key={quickAddKey} list="task_list" area={area} search={search} />}
        {page === 'parked' && <TaskTable list="parked" area={area} search={search} />}
        {page === 'done' && <TaskTable list="done" area={area} search={search} allowAdd={false} />}
        {page === 'archive' && <TaskTable list="done" area={area} search={search} allowAdd={false} allowDelete={false} archived />}
        {page === 'recurring' && <RecurringTable area={area} />}
        {page === 'kanban' && <Kanban area={area} />}
        {page === 'calendar' && <Calendar area={area} />}
        {page === 'projects' && <Projects area={area} />}
        {page === 'dashboard' && <Dashboard area={area} />}
        {page === 'weekly' && <WeeklyReview area={area} />}
      </main>

      {/* Floating quick-add button */}
      <button className="fab" onClick={() => setQuickAdd(true)} title="Quick add task">+</button>

      {quickAdd && (
        <QuickAdd
          defaultArea={area}
          defaultList={page === 'parked' ? 'parked' : 'task_list'}
          onCreated={() => setQuickAddKey((k) => k + 1)}
          onClose={() => setQuickAdd(false)}
        />
      )}
    </div>
  );
}
