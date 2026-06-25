import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { PROGRESS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS, DAY_OPTIONS } from './constants.js';

const FIELDS = [
  { key: 'day', label: 'Day', type: 'select', options: DAY_OPTIONS },
  { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
  { key: 'task_name', label: 'Task List', type: 'text' },
  { key: 'progress', label: 'Progress', type: 'select', options: PROGRESS_OPTIONS },
  { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
  { key: 'deadline', label: 'Deadline', type: 'date' },
  { key: 'link', label: 'Link', type: 'text' },
  { key: 'task_focus', label: 'Task Focus', type: 'text' },
  { key: 'to_add', label: 'To Add', type: 'select', options: ['Yes', 'No'] },
];

export default function RecurringTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.listRecurring().then(setRows).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const created = await api.createRecurring({ day: 'Weekly', task_name: '', to_add: 'No' });
    setRows((r) => [created, ...r]);
  };

  const handleChange = async (id, key, value) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    const updated = await api.updateRecurring(id, { [key]: value });
    setRows((r) => r.map((row) => (row.id === id ? updated : row)));
  };

  const handleDelete = async (id) => {
    await api.deleteRecurring(id);
    setRows((r) => r.filter((row) => row.id !== id));
  };

  const handleRunCopy = async () => {
    setRunning(true);
    setMessage('');
    try {
      const result = await api.runRecurringCopy();
      setMessage(`Created ${result.count} task(s).`);
      load();
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="table-wrap">
      <button onClick={handleAdd}>+ Add Recurring</button>
      <button onClick={handleRunCopy} disabled={running}>{running ? 'Running...' : 'Run Recurring Copy'}</button>
      {message && <span className="message">{message}</span>}
      <table>
        <thead>
          <tr>
            {FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
            <th>Last Added</th>
            <th>Days Since Last</th>
            <th></th>
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
              <td className="readonly">{row.last_added ? String(row.last_added).slice(0, 10) : ''}</td>
              <td className="readonly">{row.days_since_last ?? ''}</td>
              <td><button onClick={() => handleDelete(row.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
