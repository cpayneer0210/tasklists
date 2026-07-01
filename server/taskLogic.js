function nowIso() {
  return new Date().toISOString();
}

// Applies addatimestamp + movedone logic to a task row given the incoming patch.
// `existing` is the current DB row (or null for a new row), `patch` is the
// set of fields the client wants to change.
export function applyTaskTimestamps(existing, patch) {
  const merged = { ...existing, ...patch };
  const result = { ...patch };

  const hadName = existing && existing.task_name && existing.task_name.trim() !== '';
  const hasName = merged.task_name && merged.task_name.trim() !== '';
  if (!hadName && hasName && !merged.task_added) {
    result.task_added = nowIso();
  }

  const progressChanged = patch.progress !== undefined && patch.progress !== (existing && existing.progress);
  if (progressChanged) {
    if (patch.progress === 'Pending' && !merged.task_started) {
      result.task_started = nowIso();
    }
    if (patch.progress === 'Done' && !merged.task_complete) {
      result.task_complete = nowIso();
    }
  }

  return result;
}

// Determines target list based on progress, and computes Met Deadline when moving to done.
export function applyMoveDone(existing, patch) {
  const merged = { ...existing, ...patch };
  const result = { ...patch };

  if (patch.progress === undefined) return result;

  if (patch.progress === 'Done') {
    result.list = 'done';
    const completeAt = merged.task_complete || nowIso();
    result.task_complete = result.task_complete || completeAt;
    if (merged.deadline) {
      const deadline = new Date(merged.deadline);
      const complete = new Date(completeAt);
      result.met_deadline = complete <= deadline ? 'Yes' : 'No';
    } else {
      result.met_deadline = result.met_deadline ?? null;
    }
  } else if (patch.progress === 'Parked') {
    result.list = 'parked';
  } else if (patch.progress === 'Ready') {
    result.list = 'task_list';
  }

  return result;
}

export function daysSinceLast(lastAdded) {
  if (!lastAdded) return null;
  const diffMs = Date.now() - new Date(lastAdded).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function nextDue(day, lastAdded, repeatFrom, lastCompleted) {
  const intervals = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 91, 'Semi-Annual': 182, Annual: 365 };
  const days = intervals[day] || 7;
  // repeat_from='completion': count from when last completed rather than when last added
  const base = (repeatFrom === 'completion' && lastCompleted)
    ? new Date(lastCompleted)
    : (lastAdded ? new Date(lastAdded) : new Date());
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}
