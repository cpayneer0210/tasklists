import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { PROGRESS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS, AREA_OPTIONS } from './constants.js';
import { Loading, ErrorState } from './Status.jsx';

const FIELDS = [
  { key: 'area', label: 'Area', type: 'select', options: AREA_OPTIONS },
  { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
  { key: 'task_name', label: 'Task List', type: 'text' },
  { key: 'progress', label: 'Progress', type: 'select', options: PROGRESS_OPTIONS },
  { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
  { key: 'deadline', label: 'Deadline', type: 'date' },
  { key: 'link', label: 'Link', type: 'text' },
  { key: 'task_focus', label: 'Task Focus', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'text' },
  { key: 'value_add', label: 'Value Add', type: 'text' },
];

const TIMESTAMP_FIELDS = [
  { key: 'task_added', label: 'Task Added' },
  { key: 'task_started', label: 'Task Started' },
  { key: 'task_complete', label: 'Task Complete' },
  { key: 'met_deadline', label: 'Met Deadline' },
];

export default function TaskTable({ list, area, allowAdd = true, allowDelete = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.listTasks(list, area).then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [list, area]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const name = window.prompt('Task name:');
    if (!name || !name.trim()) return;
    const created = await api.createTask({
      list, task_name: name.trim(), progress: 'Not Started', area: area || 'Personal',
    });
    setRows((r) => [created, ...r]);
  };

  const handleLocalChange = (id, key, value) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const handleCommit = async (id, key, value) => {
    const updated = await api.updateTask(id, { [key]: value });
    const stillVisible = updated.list === list && (!area || updated.area === area);
    setRows((r) => (stillVisible ? r.map((row) => (row.id === id ? updated : row)) : r.filter((row) => row.id !== id)));
  };

  const handleDelete = async (id) => {
    await api.deleteTask(id);
    setRows((r) => r.filter((row) => row.id !== id));
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="table-wrap">
      {allowAdd && <button onClick={handleAdd}>+ Add Task</button>}
      <table>
        <thead>
          <tr>
            {FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
            {TIMESTAMP_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
            {allowDelete && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {FIELDS.map((f) => (
                <td key={f.key}>
                  {f.type === 'select' ? (
                    <select
                      value={row[f.key] || ''}
                      onChange={(e) => { handleLocalChange(row.id, f.key, e.target.value); handleCommit(row.id, f.key, e.target.value); }}
                    >
                      <option value=""></option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      value={row[f.key] ? (f.type === 'date' ? row[f.key].slice(0, 10) : row[f.key]) : ''}
                      onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                      onBlur={(e) => handleCommit(row.id, f.key, e.target.value)}
                    />
                  )}
                </td>
              ))}
              {TIMESTAMP_FIELDS.map((f) => (
                <td key={f.key} className="readonly">{row[f.key] ? String(row[f.key]).slice(0, 10) : ''}</td>
              ))}
              {allowDelete && <td><button onClick={() => handleDelete(row.id)}>Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
