import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const COLUMNS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

export default function Kanban() {
  const [data, setData] = useState(null);

  useEffect(() => { api.kanban().then(setData); }, []);

  if (!data) return <p>Loading...</p>;

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
