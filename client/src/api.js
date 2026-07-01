const BASE = '/api';

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v);
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export const api = {
  listTasks: (list, area) => request(`/tasks${qs({ list, area })}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  listRecurring: (area) => request(`/recurring${qs({ area })}`),
  createRecurring: (data) => request('/recurring', { method: 'POST', body: JSON.stringify(data) }),
  updateRecurring: (id, data) => request(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecurring: (id) => request(`/recurring/${id}`, { method: 'DELETE' }),
  runRecurringCopy: () => request('/recurring/run-copy', { method: 'POST' }),

  kanban: (area) => request(`/kanban${qs({ area })}`),
  dashboard: (area) => request(`/dashboard${qs({ area })}`),
  stats: (area) => request(`/stats${qs({ area })}`),
  weeklyReview: (area) => request(`/weekly-review${qs({ area })}`),

  listComments: (taskId) => request(`/tasks/${taskId}/comments`),
  addComment: (taskId, text) => request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),

  listTasksArchived: (area) => request(`/tasks${qs({ list: 'done', area, archived: 'true' })}`),

  syncTrello: () => request('/integrations/trello/sync', { method: 'POST' }),

  listProjects: (area) => request(`/projects${qs({ area })}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  listDependencies: (taskId) => request(`/tasks/${taskId}/dependencies`),
  addDependency: (taskId, dependsOnId) => request(`/tasks/${taskId}/dependencies`, { method: 'POST', body: JSON.stringify({ depends_on_id: dependsOnId }) }),
  removeDependency: (taskId, depId) => request(`/tasks/${taskId}/dependencies/${depId}`, { method: 'DELETE' }),
};
