import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { AREA_OPTIONS } from './constants.js';
import { Loading, ErrorState } from './Status.jsx';

const COLORS = ['#4c6ef5', '#f03e3e', '#2f9e44', '#e67700', '#ae3ec9', '#0c8599', '#e64980'];

export default function Projects({ area }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', color: COLORS[0], area: area || 'Personal' });
  const [taskCounts, setTaskCounts] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.listProjects(area)
      .then(async (projs) => {
        setProjects(projs);
        setError(null);
        // Load task counts per project
        const all = await api.listTasks('task_list', area).catch(() => []);
        const counts = {};
        for (const t of all) {
          if (t.project_id) counts[t.project_id] = (counts[t.project_id] || 0) + 1;
        }
        setTaskCounts(counts);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [area]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!draft.name.trim()) return;
    const p = await api.createProject(draft);
    setProjects((prev) => [...prev, p]);
    setAdding(false);
    setDraft({ name: '', color: COLORS[0], area: area || 'Personal' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete project? Tasks will be unassigned.')) return;
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleColorChange = async (id, color) => {
    await api.updateProject(id, { color });
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
  };

  const handleRename = async (id, name) => {
    await api.updateProject(id, { name });
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="projects-wrap">
      <div className="projects-toolbar">
        <h2>Projects</h2>
        <button className="projects-add-btn" onClick={() => setAdding(true)}>+ New Project</button>
      </div>

      {adding && (
        <div className="project-form">
          <input
            autoFocus
            type="text"
            placeholder="Project name…"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
          />
          <div className="project-color-picker">
            {COLORS.map((c) => (
              <button key={c} className={`project-color-swatch${draft.color === c ? ' active' : ''}`}
                style={{ background: c }} onClick={() => setDraft((d) => ({ ...d, color: c }))} />
            ))}
          </div>
          <select value={draft.area} onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))}>
            {AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="project-form-actions">
            <button className="project-save-btn" onClick={handleCreate}>Create</button>
            <button className="project-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="projects-grid">
        {projects.length === 0 && !adding && (
          <div className="projects-empty">No projects yet. Create one to group your tasks.</div>
        )}
        {projects.map((p) => (
          <div key={p.id} className="project-card" style={{ '--project-color': p.color }}>
            <div className="project-card-bar" />
            <div className="project-card-body">
              <input
                className="project-name-input"
                type="text"
                defaultValue={p.name}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.name) handleRename(p.id, e.target.value.trim()); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              />
              <div className="project-meta">
                <span className="project-area">{p.area}</span>
                <span className="project-count">{taskCounts[p.id] || 0} tasks</span>
              </div>
              <div className="project-color-picker">
                {COLORS.map((c) => (
                  <button key={c} className={`project-color-swatch${p.color === c ? ' active' : ''}`}
                    style={{ background: c }} onClick={() => handleColorChange(p.id, c)} />
                ))}
              </div>
            </div>
            <button className="project-delete-btn" onClick={() => handleDelete(p.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
