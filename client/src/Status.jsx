import React from 'react';

export function Loading() {
  return <p className="status status-loading">Loading…</p>;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="status status-error">
      <p>Something went wrong{message ? `: ${message}` : '.'}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}
