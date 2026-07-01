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

const PRIORITY_COLOURS = {
  '1 - Recurring': 'var(--accent)',
  '2 - High': '#e03131',
  '3 - Medium': '#f08c00',
  '4 - Low': '#2f9e44',
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
        const isCompleted = col.key === 'completed';
        return (
          <div
            className={`kanban-column${dragOverCol === col.key ? ' drag-over' : ''}${col.key === 'overdue' ? ' kanban-overdue' : ''}`}
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
                style={t.priority ? { borderLeft: `3px solid ${PRIORITY_COLOURS[t.priority] || 'var(--glass-border)'}` } : undefined}
              >
                <strong>{t.task_name || '(untitled)'}</strong>
                <div className="kanban-meta">
                  {t.area}{t.priority && ` · ${t.priority}`}{t.type && ` · ${t.type}`}
                </div>
                {isCompleted && t.task_complete && (
                  <div className="kanban-meta">✓ {String(t.task_complete).slice(0, 10)}{t.met_deadline ? ` · ${t.met_deadline} deadline` : ''}</div>
                )}
                {!isCompleted && t.deadline && (
                  <div className="kanban-meta">Due: {String(t.deadline).slice(0, 10)}</div>
                )}
                {t.task_focus && <div className="kanban-meta kanban-focus">↳ {t.task_focus}</div>}
                {t.notes && <div className="kanban-note">{t.notes}</div>}
              </div>
            ))}
            {data[col.key].length === 0 && (
              <div className="kanban-empty">{droppable ? 'Drop here' : 'None'}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
