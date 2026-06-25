import React, { useState } from 'react';
import TaskTable from './TaskTable.jsx';
import RecurringTable from './RecurringTable.jsx';
import Kanban from './Kanban.jsx';
import Dashboard from './Dashboard.jsx';

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
      </nav>
      <main>
        {page === 'task_list' && <TaskTable list="task_list" />}
        {page === 'parked' && <TaskTable list="parked" />}
        {page === 'done' && <TaskTable list="done" allowAdd={false} />}
        {page === 'recurring' && <RecurringTable />}
        {page === 'kanban' && <Kanban />}
        {page === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
}
