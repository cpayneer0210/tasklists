import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Loading, ErrorState } from './Status.jsx';

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const TODAY = new Date();
const TODAY_Y = TODAY.getFullYear();
const TODAY_M = TODAY.getMonth();
const TODAY_D = TODAY.getDate();
const TODAY_STR = TODAY.toISOString().slice(0, 10);

export default function Dashboard({ area }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const load = useCallback(() => {
    setError(null);
    api.dashboard(area).then(setData).catch((e) => setError(e.message));
  }, [area]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = buildCalendar(year, month);

  const tasksByDay = {};
  for (const t of data.calendar) {
    if (!t.deadline) continue;
    const d = new Date(t.deadline);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      (tasksByDay[day] = tasksByDay[day] || []).push(t);
    }
  }

  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });
  const isCurrentMonth = year === TODAY_Y && month === TODAY_M;

  return (
    <div className="dashboard">
      <div className="dashboard-pending">
        <h3>Action Required</h3>
        <ul>
          {data.pending.map((t) => {
            const overdue = t.deadline && t.deadline.slice(0, 10) < TODAY_STR && t.progress !== 'Done';
            return (
              <li key={t.id} className={overdue ? 'pending-overdue' : ''}>
                {overdue && <span className="overdue-tag">OVERDUE</span>}
                <strong>[{t.area}]</strong> {t.task_name || '(untitled)'}
                {t.deadline && <span className="pending-due"> — due {String(t.deadline).slice(0, 10)}</span>}
              </li>
            );
          })}
          {data.pending.length === 0 && <li>Nothing pending — all clear!</li>}
        </ul>
      </div>
      <div className="dashboard-calendar">
        <div className="calendar-header">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))}>&lt;</button>
          <h3>{monthLabel}</h3>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))}>&gt;</button>
        </div>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div className="calendar-dow" key={d}>{d}</div>
          ))}
          {cells.map((day, idx) => {
            const isToday = isCurrentMonth && day === TODAY_D;
            return (
              <div className={`calendar-cell${isToday ? ' calendar-today' : ''}`} key={idx}>
                {day && <div className="calendar-day-num">{day}</div>}
                {day && (tasksByDay[day] || []).map((t) => (
                  <div className="calendar-task" key={t.id} title={t.task_name}>{t.task_name}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
