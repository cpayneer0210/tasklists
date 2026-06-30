import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Loading, ErrorState } from './Status.jsx';

const COLUMNS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

const COLUMN_PROGRESS = {
  not_started: 'Not Started',
  pending: 'Pending',
  completed: 'Done',
};

export default function Kanban({ area }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.kanban(area).then(setData).catch((e) => setError(e.message));
  }, [area]);

  useEffect(() => { load(); }, [load]);

  const handleDrop = async (colKey, e) => {
    e.preventDefault();
    setDragOverCol(null);
    const progress = COLUMN_PROGRESS[colKey];
    if (!progress) return;
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    await api.updateTask(id, { progress });
    load();
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  return (
    <div className="kanban">
      {COLUMNS.map((col) => {
        const droppable = Boolean(COLUMN_PROGRESS[col.key]);
        return (
          <div
            className={`kanban-column${dragOverCol === col.key ? ' drag-over' : ''}`}
            key={col.key}
            onDragOver={droppable ? (e) => { e.preventDefault(); setDragOverCol(col.key); } : undefined}
            onDragLeave={droppable ? () => setDragOverCol((c) => (c === col.key ? null : c)) : undefined}
            onDrop={droppable ? (e) => handleDrop(col.key, e) : undefined}
          >
            <h3>{col.label} ({data[col.key].length})</h3>
            {data[col.key].map((t) => (
              <div
                className="kanban-card"
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
              >
                <strong>{t.task_name || '(untitled)'}</strong>
                <div className="kanban-meta">{t.area} {t.priority && `· ${t.priority}`}</div>
                {t.deadline && <div className="kanban-meta">Due: {String(t.deadline).slice(0, 10)}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
