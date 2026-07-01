import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { PROGRESS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS, AREA_OPTIONS } from './constants.js';
import { Loading, ErrorState } from './Status.jsx';

const FIELDS = [
  { key: 'area', label: 'Area', type: 'select', options: AREA_OPTIONS },
  { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
  { key: 'task_name', label: 'Task Name', type: 'text' },
  { key: 'progress', label: 'Progress', type: 'select', options: PROGRESS_OPTIONS },
  { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
  { key: 'deadline', label: 'Deadline', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'text' },
];

const DETAIL_ONLY_FIELDS = [
  { key: 'link', label: 'Link', type: 'text' },
  { key: 'task_focus', label: 'Task Focus', type: 'text' },
  { key: 'value_add', label: 'Value Add', type: 'text' },
];

const ALL_DETAIL_FIELDS = [...FIELDS, ...DETAIL_ONLY_FIELDS];

const TIMESTAMP_FIELDS = [
  { key: 'task_added', label: 'Added' },
  { key: 'task_started', label: 'Started' },
  { key: 'task_complete', label: 'Complete' },
  { key: 'met_deadline', label: 'Met Deadline' },
];

const TODAY = new Date().toISOString().slice(0, 10);

function priorityClass(p) {
  if (!p) return '';
  if (p.startsWith('1')) return 'pri-recurring';
  if (p.startsWith('2')) return 'pri-high';
  if (p.startsWith('3')) return 'pri-medium';
  if (p.startsWith('4')) return 'pri-low';
  return '';
}

function isOverdue(row) {
  return row.deadline && row.deadline.slice(0, 10) < TODAY && row.progress !== 'Done';
}

// Feature 12: relative date display
function relativeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const today = new Date(TODAY + 'T00:00:00');
  const diff = Math.round((date - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: 'Today', cls: 'rel-today' };
  if (diff === 1) return { label: 'Tomorrow', cls: 'rel-soon' };
  if (diff === -1) return { label: 'Yesterday', cls: 'rel-overdue' };
  if (diff > 0 && diff <= 7) return { label: `In ${diff}d`, cls: 'rel-soon' };
  if (diff < 0) return { label: `${Math.abs(diff)}d ago`, cls: 'rel-overdue' };
  return null;
}

// Feature 5: mini inline date picker
function DateCell({ value, onChange, onBlur }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const val = value ? value.slice(0, 10) : '';

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cursor = val ? new Date(val + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(cursor.getFullYear());
  const [viewMonth, setViewMonth] = useState(cursor.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'short', year: 'numeric' });

  const selectDay = (d) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onChange(iso);
    onBlur(iso);
    setOpen(false);
  };

  const rel = relativeDate(val);

  return (
    <div className="date-cell" ref={ref}>
      <div className="date-display" onClick={() => { setViewYear(cursor.getFullYear()); setViewMonth(cursor.getMonth()); setOpen((o) => !o); }}>
        {val ? (
          <>
            <span className="date-val">{val}</span>
            {rel && <span className={`rel-badge ${rel.cls}`}>{rel.label}</span>}
          </>
        ) : <span className="date-placeholder">Set date</span>}
      </div>
      {open && createPortal(
        <div className="dp-backdrop" onClick={() => setOpen(false)}>
          <div className="dp-popup" style={{ position: 'fixed', top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 100, left: ref.current ? ref.current.getBoundingClientRect().left : 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="dp-header">
              <button onClick={() => { const d = new Date(viewYear, viewMonth - 1, 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }}>‹</button>
              <span>{monthLabel}</span>
              <button onClick={() => { const d = new Date(viewYear, viewMonth + 1, 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }}>›</button>
            </div>
            <div className="dp-grid">
              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="dp-dow">{d}</div>)}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                return (
                  <div key={d} className={`dp-day${iso === val ? ' dp-selected' : ''}${iso === TODAY ? ' dp-today' : ''}`} onClick={() => selectDay(d)}>{d}</div>
                );
              })}
            </div>
            {val && <button className="dp-clear" onClick={() => { onChange(''); onBlur(''); setOpen(false); }}>Clear</button>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Feature 11: subtask checklist in detail panel
function SubtaskList({ taskId, subtasks, onChange }) {
  const items = (() => { try { return JSON.parse(subtasks || '[]'); } catch { return []; } })();
  const [draft, setDraft] = useState('');

  const save = (next) => onChange(JSON.stringify(next));
  const toggle = (i) => { const n = [...items]; n[i] = { ...n[i], done: !n[i].done }; save(n); };
  const remove = (i) => { const n = items.filter((_, idx) => idx !== i); save(n); };
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    save([...items, { text, done: false }]);
    setDraft('');
  };

  const done = items.filter((t) => t.done).length;

  return (
    <div className="subtask-list">
      {items.length > 0 && <div className="subtask-progress-bar"><div style={{ width: `${(done / items.length) * 100}%` }} /></div>}
      {items.map((t, i) => (
        <div key={i} className={`subtask-item${t.done ? ' subtask-done' : ''}`}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(i)} />
          <span>{t.text}</span>
          <button className="subtask-remove" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <div className="subtask-add">
        <input
          type="text"
          placeholder="Add subtask…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <button onClick={add}>+</button>
      </div>
    </div>
  );
}

// Feature 13: comments/activity in detail panel
function CommentThread({ taskId }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listComments(taskId).then(setComments).catch(() => {}).finally(() => setLoading(false));
  }, [taskId]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const c = await api.addComment(taskId, text);
    setComments((prev) => [...prev, c]);
  };

  return (
    <div className="comment-thread">
      <label className="detail-field-label">Activity</label>
      {loading ? <div className="comment-loading">Loading…</div> : (
        <>
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <span className="comment-text">{c.text}</span>
              <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
            </div>
          ))}
          {comments.length === 0 && <div className="comment-empty">No activity yet.</div>}
        </>
      )}
      <div className="comment-input-row">
        <input
          type="text"
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button onClick={submit}>Post</button>
      </div>
    </div>
  );
}

// Feature 3: undo toast
function UndoToast({ action, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return createPortal(
    <div className="undo-toast">
      <span>{action}</span>
      <button onClick={onUndo}>Undo</button>
      <button className="undo-dismiss" onClick={onDismiss}>✕</button>
    </div>,
    document.body
  );
}

export default function TaskTable({ list, area, search = '', allowAdd = true, allowDelete = true, archived = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const [groupBy, setGroupBy] = useState(null); // Feature 6
  const [undoAction, setUndoAction] = useState(null); // Feature 3
  const dragRow = useRef(null); // Feature 4: drag to reorder

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    (archived ? api.listTasksArchived(area) : api.listTasks(list, area))
      .then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [list, area]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [list, area]);

  const commitAdd = async () => {
    const name = draftName.trim();
    setAdding(false);
    setDraftName('');
    if (!name) return;
    const created = await api.createTask({ list, task_name: name, progress: 'Not Started', area: area || 'Personal' });
    setRows((r) => [created, ...r]);
  };

  const handleLocalChange = (id, key, value) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    if (expanded && expanded.id === id) setExpanded((e) => ({ ...e, [key]: value }));
  };

  const handleCommit = async (id, key, value) => {
    const updated = await api.updateTask(id, { [key]: value });
    const stillVisible = updated.list === list && (!area || updated.area === area);
    setRows((r) => (stillVisible ? r.map((row) => (row.id === id ? updated : row)) : r.filter((row) => row.id !== id)));
    if (expanded && expanded.id === id) setExpanded(stillVisible ? updated : null);
  };

  // Feature 1: quick-complete
  const handleQuickDone = async (row) => {
    const prevProgress = row.progress;
    handleLocalChange(row.id, 'progress', 'Done');
    const updated = await api.updateTask(row.id, { progress: 'Done' });
    const stillVisible = updated.list === list && (!area || updated.area === area);
    setRows((r) => (stillVisible ? r.map((rx) => (rx.id === row.id ? updated : rx)) : r.filter((rx) => rx.id !== row.id)));
    // Feature 3: undo
    setUndoAction({
      label: `Marked "${row.task_name || 'task'}" as Done`,
      undo: async () => {
        await api.updateTask(row.id, { progress: prevProgress });
        load();
      },
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    const row = rows.find((r) => r.id === id);
    await api.deleteTask(id);
    setRows((r) => r.filter((rx) => rx.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    if (expanded && expanded.id === id) setExpanded(null);
    setUndoAction({
      label: `Deleted "${row?.task_name || 'task'}"`,
      undo: async () => {
        const { id: _id, ...rest } = row;
        await api.createTask(rest);
        load();
      },
    });
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} task(s)?`)) return;
    await Promise.all([...selected].map((id) => api.deleteTask(id)));
    setRows((r) => r.filter((row) => !selected.has(row.id)));
    setSelected(new Set());
  };

  const handleBulkProgress = async (progress) => {
    const updates = await Promise.all([...selected].map((id) => api.updateTask(id, { progress })));
    setRows((r) => {
      const map = Object.fromEntries(updates.map((u) => [u.id, u]));
      return r.map((row) => map[row.id] || row).filter((row) => row.list === list && (!area || row.area === area));
    });
    setSelected(new Set());
  };

  const toggleSelect = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (visibleRows) => {
    if (selected.size === visibleRows.length && visibleRows.length > 0) setSelected(new Set());
    else setSelected(new Set(visibleRows.map((r) => r.id)));
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const q = search.trim().toLowerCase();
  let visible = q
    ? rows.filter((r) => Object.values(r).some((v) => v && String(v).toLowerCase().includes(q)))
    : rows;
  if (sortKey) {
    visible = [...visible].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  // Feature 6: grouping
  const groupedRows = (() => {
    if (!groupBy) return [{ key: null, rows: visible }];
    const groups = {};
    for (const row of visible) {
      const key = row[groupBy] || '(none)';
      (groups[key] = groups[key] || []).push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => ({ key, rows }));
  })();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const colSpanTotal = 2 + FIELDS.length + 1 + TIMESTAMP_FIELDS.length + (allowDelete ? 1 : 0) + 1;

  // Feature 4: drag to reorder
  const handleDragStart = (e, id) => { dragRow.current = id; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, id) => { e.preventDefault(); if (dragRow.current === id) return; };
  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    const srcId = dragRow.current;
    if (!srcId || srcId === targetId) return;
    dragRow.current = null;
    setRows((prev) => {
      const next = [...prev];
      const from = next.findIndex((r) => r.id === srcId);
      const to = next.findIndex((r) => r.id === targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Persist sort_order for reordered rows
      next.forEach((r, i) => { api.updateTask(r.id, { sort_order: next.length - i }).catch(() => {}); });
      return next;
    });
  };

  const renderRow = (row) => {
    const subtasks = (() => { try { return JSON.parse(row.subtasks || '[]'); } catch { return []; } })();
    const subtaskDone = subtasks.filter((t) => t.done).length;
    const rel = relativeDate(row.deadline);

    return (
      <tr key={row.id}
        className={[priorityClass(row.priority), isOverdue(row) ? 'row-overdue' : ''].filter(Boolean).join(' ')}
        draggable={!sortKey && !groupBy}
        onDragStart={(e) => handleDragStart(e, row.id)}
        onDragOver={(e) => handleDragOver(e, row.id)}
        onDrop={(e) => handleDrop(e, row.id)}
      >
        {/* Feature 1: quick-complete */}
        <td className="quick-done-cell">
          <button className="quick-done-btn" title="Mark done" onClick={() => handleQuickDone(row)}>✓</button>
        </td>
        <td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
        {FIELDS.map((f) => {
          const val = row[f.key];
          return (
            <td key={f.key} data-label={f.label} data-empty={!val ? 'true' : undefined}>
              {f.key === 'deadline' ? (
                <DateCell
                  value={val}
                  onChange={(v) => handleLocalChange(row.id, 'deadline', v)}
                  onBlur={(v) => handleCommit(row.id, 'deadline', v)}
                />
              ) : f.type === 'select' ? (
                <select value={val || ''}
                  onChange={(e) => { handleLocalChange(row.id, f.key, e.target.value); handleCommit(row.id, f.key, e.target.value); }}>
                  <option value=""></option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type}
                  value={val || ''}
                  onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                  onBlur={(e) => handleCommit(row.id, f.key, e.target.value)}
                />
              )}
            </td>
          );
        })}
        <td className="tags-cell" data-label="Tags">
          <input className="tags-input" type="text" placeholder="tag1, tag2"
            value={row.tags || ''}
            onChange={(e) => handleLocalChange(row.id, 'tags', e.target.value)}
            onBlur={(e) => handleCommit(row.id, 'tags', e.target.value)}
          />
          {row.tags && (
            <div className="tag-chips-row">
              {row.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="tag-chip">{t}</span>
              ))}
            </div>
          )}
        </td>
        {TIMESTAMP_FIELDS.map((f) => (
          <td key={f.key} className="readonly" data-label={f.label} data-empty={!row[f.key] ? 'true' : undefined}>
            {row[f.key] ? String(row[f.key]).slice(0, 10) : ''}
          </td>
        ))}
        {allowDelete && <td><button onClick={() => handleDelete(row.id)}>Delete</button></td>}
        <td>
          {subtasks.length > 0 && <span className="subtask-badge">{subtaskDone}/{subtasks.length}</span>}
          <button className="expand-btn" onClick={() => setExpanded(row)}>⋯</button>
        </td>
      </tr>
    );
  };

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        {allowAdd && !adding && <button onClick={() => setAdding(true)}>+ Add Task</button>}
        {!allowAdd && <span className="table-hint">Tasks move here automatically when marked Done.</span>}
        {/* Feature 6: group-by toggle */}
        <div className="group-by">
          <span className="group-by-label">Group:</span>
          {['area', 'priority', 'type'].map((g) => (
            <button key={g} className={`group-by-btn${groupBy === g ? ' active' : ''}`}
              onClick={() => setGroupBy(groupBy === g ? null : g)}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} selected</span>
            <button onClick={() => handleBulkProgress('Done')}>Mark Done</button>
            <button onClick={() => handleBulkProgress('Parked')}>Park</button>
            <button className="bulk-delete" onClick={handleBulkDelete}>Delete</button>
            <button className="bulk-clear" onClick={() => setSelected(new Set())}>✕</button>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th className="quick-done-th"></th>
            <th><input type="checkbox" onChange={() => toggleAll(visible)} checked={selected.size === visible.length && visible.length > 0} /></th>
            {FIELDS.map((f) => (
              <th key={f.key} className="sortable" onClick={() => handleSort(f.key)}>
                {f.label}{sortKey === f.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
            <th>Tags</th>
            {TIMESTAMP_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
            {allowDelete && <th></th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr>
              <td colSpan={colSpanTotal}>
                <input autoFocus type="text" placeholder="Task name…" value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAdding(false); setDraftName(''); } }}
                  onBlur={commitAdd}
                />
              </td>
            </tr>
          )}
          {groupedRows.map(({ key, rows: groupRows }) => (
            <React.Fragment key={key ?? '__all'}>
              {key && (
                <tr className="group-header-row">
                  <td colSpan={colSpanTotal} className="group-header-cell">
                    {groupBy && `${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}: `}<strong>{key}</strong>
                    <span className="group-count">{groupRows.length}</span>
                  </td>
                </tr>
              )}
              {groupRows.map(renderRow)}
            </React.Fragment>
          ))}
          {visible.length === 0 && !adding && (
            <tr>
              <td colSpan={colSpanTotal} className="readonly" style={{ textAlign: 'center', padding: '24px' }}>
                {q ? 'No tasks match your search.' : 'No tasks here yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Feature 3: undo toast */}
      {undoAction && (
        <UndoToast
          action={undoAction.label}
          onUndo={async () => { await undoAction.undo(); setUndoAction(null); }}
          onDismiss={() => setUndoAction(null)}
        />
      )}

      {expanded && createPortal(
        <div className="detail-overlay" onClick={() => setExpanded(null)}>
          <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{expanded.task_name || '(untitled)'}</h2>
              <button className="detail-close" onClick={() => setExpanded(null)}>✕</button>
            </div>
            {isOverdue(expanded) && <div className="overdue-badge">⚠ Overdue — deadline {expanded.deadline.slice(0, 10)}</div>}
            <div className="detail-fields">
              {ALL_DETAIL_FIELDS.map((f) => (
                <div key={f.key} className="detail-field">
                  <label>{f.label}</label>
                  {f.key === 'deadline' ? (
                    <DateCell
                      value={expanded[f.key]}
                      onChange={(v) => handleLocalChange(expanded.id, f.key, v)}
                      onBlur={(v) => handleCommit(expanded.id, f.key, v)}
                    />
                  ) : f.type === 'select' ? (
                    <select value={expanded[f.key] || ''}
                      onChange={(e) => { handleLocalChange(expanded.id, f.key, e.target.value); handleCommit(expanded.id, f.key, e.target.value); }}>
                      <option value=""></option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.key === 'notes' || f.key === 'value_add' ? (
                    <textarea value={expanded[f.key] || ''}
                      onChange={(e) => handleLocalChange(expanded.id, f.key, e.target.value)}
                      onBlur={(e) => handleCommit(expanded.id, f.key, e.target.value)}
                      rows={4}
                    />
                  ) : (
                    <input type="text"
                      value={expanded[f.key] || ''}
                      onChange={(e) => handleLocalChange(expanded.id, f.key, e.target.value)}
                      onBlur={(e) => handleCommit(expanded.id, f.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
              <div className="detail-field">
                <label>Tags <span className="detail-hint">comma-separated</span></label>
                <input type="text" placeholder="e.g. maintenance, buying guide"
                  value={expanded.tags || ''}
                  onChange={(e) => handleLocalChange(expanded.id, 'tags', e.target.value)}
                  onBlur={(e) => handleCommit(expanded.id, 'tags', e.target.value)}
                />
                {expanded.tags && (
                  <div className="tag-chip-preview">
                    {expanded.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="tag-chip">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* Feature 11: subtasks */}
              <div className="detail-field">
                <label>Subtasks</label>
                <SubtaskList
                  taskId={expanded.id}
                  subtasks={expanded.subtasks}
                  onChange={(val) => { handleLocalChange(expanded.id, 'subtasks', val); handleCommit(expanded.id, 'subtasks', val); }}
                />
              </div>
            </div>
            <div className="detail-timestamps">
              {TIMESTAMP_FIELDS.filter((f) => expanded[f.key]).map((f) => (
                <div key={f.key}><strong>{f.label}:</strong> {String(expanded[f.key]).slice(0, 10)}</div>
              ))}
            </div>
            {/* Feature 13: comments */}
            <CommentThread taskId={expanded.id} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
