import React, { useState } from 'react';
import TaskTable from './TaskTable.jsx';
import RecurringTable from './RecurringTable.jsx';
import Kanban from './Kanban.jsx';
import Dashboard from './Dashboard.jsx';
import WeeklyReview from './WeeklyReview.jsx';
import StatsBar from './StatsBar.jsx';
import { api } from './api.js';
import { AREA_OPTIONS } from './constants.js';

const PAGES = [
  { key: 'task_list', label: 'Task List' },
  { key: 'parked', label: 'Parked Tasks' },
  { key: 'done', label: 'Done' },
  { key: 'archive', label: 'Archive' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'weekly', label: 'Weekly Review' },
];

export default function App() {
  const [page, setPage] = useState('task_list');
  const [area, setArea] = useState('');
  const [search, setSearch] = useState('');
  const [trelloSyncing, setTrelloSyncing] = useState(false);
  const [trelloMsg, setTrelloMsg] = useState('');

  const handleTrelloSync = async () => {
    setTrelloSyncing(true);
    setTrelloMsg('');
    try {
      const result = await api.syncTrello();
      setTrelloMsg(`Imported ${result.count} card${result.count !== 1 ? 's' : ''}`);
      setTimeout(() => setTrelloMsg(''), 4000);
    } catch (e) {
      setTrelloMsg(`Error: ${e.message}`);
      setTimeout(() => setTrelloMsg(''), 6000);
    } finally {
      setTrelloSyncing(false);
    }
  };

  const showStats = page === 'task_list' || page === 'parked';

  return (
    <div className="app">
      <nav>
        {PAGES.map((p) => (
          <button key={p.key} className={page === p.key ? 'active' : ''} onClick={() => setPage(p.key)}>
            {p.label}
          </button>
        ))}
        <input className="nav-search" type="search" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="trello-sync-btn" onClick={handleTrelloSync} disabled={trelloSyncing} title="Import cards from Trello board">
          {trelloSyncing ? 'Syncing…' : '⟳ Trello'}
        </button>
        {trelloMsg && <span className="trello-msg">{trelloMsg}</span>}
        <select className="area-select" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All Areas</option>
          {AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </nav>
      {showStats && <StatsBar area={area} />}
      <main>
        {page === 'task_list' && <TaskTable list="task_list" area={area} search={search} />}
        {page === 'parked' && <TaskTable list="parked" area={area} search={search} />}
        {page === 'done' && <TaskTable list="done" area={area} search={search} allowAdd={false} />}
        {page === 'archive' && <TaskTable list="done" area={area} search={search} allowAdd={false} allowDelete={false} archived />}
        {page === 'recurring' && <RecurringTable area={area} />}
        {page === 'kanban' && <Kanban area={area} />}
        {page === 'dashboard' && <Dashboard area={area} />}
        {page === 'weekly' && <WeeklyReview area={area} />}
      </main>
    </div>
  );
}
