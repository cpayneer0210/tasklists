import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Loading, ErrorState } from './Status.jsx';

const COLUMNS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

export default function Kanban() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.kanban().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  return (
    <div className="kanban">
      {COLUMNS.map((col) => (
        <div className="kanban-column" key={col.key}>
          <h3>{col.label} ({data[col.key].length})</h3>
          {data[col.key].map((t) => (
            <div className="kanban-card" key={t.id}>
              <strong>{t.task_name || '(untitled)'}</strong>
              <div className="kanban-meta">{t.priority}</div>
              {t.deadline && <div className="kanban-meta">Due: {String(t.deadline).slice(0, 10)}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
