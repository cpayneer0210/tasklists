import React, { useEffect, useState, useCallback } from 'react';
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

// Detail-panel-only fields (hidden from table rows)
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

export default function TaskTable({ list, area, search = '', allowAdd = true, allowDelete = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.listTasks(list, area).then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await api.deleteTask(id);
    setRows((r) => r.filter((row) => row.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    if (expanded && expanded.id === id) setExpanded(null);
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

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const colSpanTotal = 1 + FIELDS.length + TIMESTAMP_FIELDS.length + (allowDelete ? 1 : 0) + 1;

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        {allowAdd && !adding && <button onClick={() => setAdding(true)}>+ Add Task</button>}
        {!allowAdd && <span className="table-hint">Tasks move here automatically when marked Done.</span>}
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
            <th><input type="checkbox" onChange={() => toggleAll(visible)} checked={selected.size === visible.length && visible.length > 0} /></th>
            {FIELDS.map((f) => (
              <th key={f.key} className="sortable" onClick={() => handleSort(f.key)}>
                {f.label}{sortKey === f.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
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
          {visible.map((row) => (
            <tr key={row.id} className={[priorityClass(row.priority), isOverdue(row) ? 'row-overdue' : ''].filter(Boolean).join(' ')}>
              <td><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
              {FIELDS.map((f) => {
                const val = row[f.key];
                return (
                  <td key={f.key} data-label={f.label} data-empty={!val ? 'true' : undefined}>
                    {f.type === 'select' ? (
                      <select value={val || ''}
                        onChange={(e) => { handleLocalChange(row.id, f.key, e.target.value); handleCommit(row.id, f.key, e.target.value); }}>
                        <option value=""></option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type}
                        value={val ? (f.type === 'date' ? val.slice(0, 10) : val) : ''}
                        onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                        onBlur={(e) => handleCommit(row.id, f.key, e.target.value)}
                      />
                    )}
                  </td>
                );
              })}
              {TIMESTAMP_FIELDS.map((f) => (
                <td key={f.key} className="readonly" data-label={f.label} data-empty={!row[f.key] ? 'true' : undefined}>
                  {row[f.key] ? String(row[f.key]).slice(0, 10) : ''}
                </td>
              ))}
              {allowDelete && <td><button onClick={() => handleDelete(row.id)}>Delete</button></td>}
              <td><button className="expand-btn" onClick={() => setExpanded(row)}>⋯</button></td>
            </tr>
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
                  {f.type === 'select' ? (
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
                    <input type={f.type}
                      value={expanded[f.key] ? (f.type === 'date' ? expanded[f.key].slice(0, 10) : expanded[f.key]) : ''}
                      onChange={(e) => handleLocalChange(expanded.id, f.key, e.target.value)}
                      onBlur={(e) => handleCommit(expanded.id, f.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="detail-timestamps">
              {TIMESTAMP_FIELDS.filter((f) => expanded[f.key]).map((f) => (
                <div key={f.key}><strong>{f.label}:</strong> {String(expanded[f.key]).slice(0, 10)}</div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
