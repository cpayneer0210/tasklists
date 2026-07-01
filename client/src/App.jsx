import React, { useState } from 'react';
import TaskTable from './TaskTable.jsx';
import RecurringTable from './RecurringTable.jsx';
import Kanban from './Kanban.jsx';
import Dashboard from './Dashboard.jsx';
import { AREA_OPTIONS } from './constants.js';

const PAGES = [
  { key: 'task_list', label: 'Task List' },
  { key: 'parked', label: 'Parked Tasks' },
  { key: 'done', label: 'Done' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'dashboard', label: 'Dashboard' },
];

export default function App() {
  const [page, setPage] = useState('task_list');
  const [area, setArea] = useState('');
  const [search, setSearch] = useState('');

  return (
    <div className="app">
      <nav>
        {PAGES.map((p) => (
          <button
            key={p.key}
            className={page === p.key ? 'active' : ''}
            onClick={() => setPage(p.key)}
          >
            {p.label}
          </button>
        ))}
        <input
          className="nav-search"
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="area-select" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All Areas</option>
          {AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </nav>
      <main>
        {page === 'task_list' && <TaskTable list="task_list" area={area} search={search} />}
        {page === 'parked' && <TaskTable list="parked" area={area} search={search} />}
        {page === 'done' && <TaskTable list="done" area={area} search={search} allowAdd={false} />}
        {page === 'recurring' && <RecurringTable area={area} />}
        {page === 'kanban' && <Kanban area={area} />}
        {page === 'dashboard' && <Dashboard area={area} />}
      </main>
    </div>
  );
}
