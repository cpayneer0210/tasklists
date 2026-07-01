import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Loading, ErrorState } from './Status.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

function Section({ title, items, emptyMsg, renderItem }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="wr-section">
      <div className="wr-section-header" onClick={() => setCollapsed((c) => !c)}>
        <h3>{title} <span className="wr-count">{items.length}</span></h3>
        <span className="wr-toggle">{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <ul className="wr-list">
          {items.length === 0
            ? <li className="wr-empty">{emptyMsg}</li>
            : items.map(renderItem)}
        </ul>
      )}
    </div>
  );
}

export default function WeeklyReview({ area }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.weeklyReview(area).then(setData).catch((e) => setError(e.message));
  }, [area]);

  if (error) return <ErrorState message={error} onRetry={() => api.weeklyReview(area).then(setData)} />;
  if (!data) return <Loading />;

  return (
    <div className="weekly-review">
      <div className="wr-header">
        <h2>Weekly Review</h2>
        <span className="wr-date">{TODAY}</span>
      </div>

      <Section
        title="Completed this week"
        items={data.completedThisWeek}
        emptyMsg="Nothing completed yet — keep going!"
        renderItem={(t) => (
          <li key={t.id} className="wr-item wr-done">
            <span className="wr-check">✓</span>
            <span className="wr-name">{t.task_name}</span>
            <span className="wr-meta">[{t.area}]{t.met_deadline ? ` · ${t.met_deadline} deadline` : ''}</span>
          </li>
        )}
      />

      <Section
        title="Overdue"
        items={data.overdue}
        emptyMsg="No overdue tasks — great work!"
        renderItem={(t) => (
          <li key={t.id} className="wr-item wr-overdue">
            <span className="wr-check">⚠</span>
            <span className="wr-name">{t.task_name}</span>
            <span className="wr-meta">[{t.area}] · due {t.deadline}</span>
          </li>
        )}
      />

      <Section
        title="Due next 7 days"
        items={data.dueNextWeek}
        emptyMsg="Nothing due this week."
        renderItem={(t) => (
          <li key={t.id} className="wr-item">
            <span className="wr-check">📅</span>
            <span className="wr-name">{t.task_name}</span>
            <span className="wr-meta">[{t.area}] · due {t.deadline}</span>
          </li>
        )}
      />

      <Section
        title="Recurring tasks due"
        items={data.recurringDue}
        emptyMsg="No recurring tasks marked for adding."
        renderItem={(t) => (
          <li key={t.id} className="wr-item">
            <span className="wr-check">🔁</span>
            <span className="wr-name">{t.task_name}</span>
            <span className="wr-meta">[{t.area}] · {t.day}</span>
          </li>
        )}
      />
    </div>
  );
}
