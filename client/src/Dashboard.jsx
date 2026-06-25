import React, { useEffect, useState } from 'react';
import { api } from './api.js';

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  useEffect(() => { api.dashboard().then(setData); }, []);

  if (!data) return <p>Loading...</p>;

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

  return (
    <div className="dashboard">
      <div className="dashboard-pending">
        <h3>Pending Tasks</h3>
        <ul>
          {data.pending.map((t) => (
            <li key={t.id}>
              {t.task_name || '(untitled)'} {t.deadline && `— due ${String(t.deadline).slice(0, 10)}`}
            </li>
          ))}
          {data.pending.length === 0 && <li>No pending tasks.</li>}
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
          {cells.map((day, idx) => (
            <div className="calendar-cell" key={idx}>
              {day && <div className="calendar-day-num">{day}</div>}
              {day && (tasksByDay[day] || []).map((t) => (
                <div className="calendar-task" key={t.id} title={t.task_name}>{t.task_name}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
