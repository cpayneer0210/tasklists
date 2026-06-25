import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { PROGRESS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from './constants.js';

const FIELDS = [
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

export default function TaskTable({ list, allowAdd = true, allowDelete = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.listTasks(list).then(setRows).finally(() => setLoading(false));
  }, [list]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const created = await api.createTask({ list, task_name: '', progress: 'Not Started' });
    setRows((r) => [created, ...r]);
  };

  const handleChange = async (id, key, value) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    const updated = await api.updateTask(id, { [key]: value });
    setRows((r) => (updated.list === list ? r.map((row) => (row.id === id ? updated : row)) : r.filter((row) => row.id !== id)));
  };

  const handleDelete = async (id) => {
    await api.deleteTask(id);
    setRows((r) => r.filter((row) => row.id !== id));
  };

  if (loading) return <p>Loading...</p>;

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
                    <select value={row[f.key] || ''} onChange={(e) => handleChange(row.id, f.key, e.target.value)}>
                      <option value=""></option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      value={row[f.key] ? (f.type === 'date' ? row[f.key].slice(0, 10) : row[f.key]) : ''}
                      onChange={(e) => handleChange(row.id, f.key, e.target.value)}
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
