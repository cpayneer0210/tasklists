import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export default function StatsBar({ area }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats(area).then(setStats).catch(() => {});
  }, [area]);

  if (!stats) return null;

  return (
    <div className="stats-bar">
      <div className="stat-item stat-done">
        <span className="stat-num">{stats.doneThisWeek}</span>
        <span className="stat-label">done this week</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item stat-overdue">
        <span className="stat-num">{stats.overdue}</span>
        <span className="stat-label">overdue</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item stat-soon">
        <span className="stat-num">{stats.dueSoon}</span>
        <span className="stat-label">due next 7 days</span>
      </div>
    </div>
  );
}
