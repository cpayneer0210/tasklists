import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Loading, ErrorState } from './Status.jsx';

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function Calendar({ area }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.listTasks('task_list', area)
      .then((rows) => {
        setTasks(rows.filter((r) => r.deadline));
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [area]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const todayIso = today.toISOString().slice(0, 10);

  const byDate = {};
  for (const t of tasks) {
    const d = t.deadline.slice(0, 10);
    (byDate[d] = byDate[d] || []).push(t);
  }

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelected(null); };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelected(null); };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedTasks = selected ? (byDate[selected] || []) : [];

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <button className="cal-nav" onClick={prev}>‹</button>
        <h2>{monthLabel}</h2>
        <button className="cal-nav" onClick={next}>›</button>
        <button className="cal-today-btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(todayIso); }}>Today</button>
      </div>
      <div className="cal-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="cal-cell cal-empty" />;
          const iso = isoDate(year, month, d);
          const dayTasks = byDate[iso] || [];
          const isToday = iso === todayIso;
          const isSelected = iso === selected;
          const hasOverdue = dayTasks.some((t) => t.deadline && t.deadline.slice(0, 10) < todayIso && t.progress !== 'Done');
          return (
            <div
              key={d}
              className={['cal-cell', isToday ? 'cal-today' : '', isSelected ? 'cal-selected' : '', hasOverdue ? 'cal-overdue-day' : ''].filter(Boolean).join(' ')}
              onClick={() => setSelected(iso === selected ? null : iso)}
            >
              <span className="cal-day-num">{d}</span>
              {dayTasks.slice(0, 3).map((t) => (
                <div key={t.id} className={`cal-task-chip${t.progress === 'Done' ? ' cal-chip-done' : ''}`}>{t.task_name}</div>
              ))}
              {dayTasks.length > 3 && <div className="cal-more">+{dayTasks.length - 3} more</div>}
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="cal-detail">
          <h3>{selected}</h3>
          {selectedTasks.length === 0
            ? <p className="cal-no-tasks">No tasks due this day.</p>
            : selectedTasks.map((t) => (
              <div key={t.id} className={`cal-detail-task${t.progress === 'Done' ? ' cal-detail-done' : ''}`}>
                <span className="cal-detail-name">{t.task_name}</span>
                <span className="cal-detail-meta">[{t.area}] · {t.progress}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
