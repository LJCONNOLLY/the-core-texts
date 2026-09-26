import { useCallback, useEffect, useMemo, useState } from 'react';

// Your checks of Claude's judgments. They save in this browser as you click,
// and "Export" writes them to a file you commit as data/reviews/<tab>.json,
// which the site then loads for everyone. The browser copy wins where both
// have an entry, so recent clicks are never lost.
//
// An entry: { status: 'checked' | 'flagged', at: '2026-09-26' }

const BASE = import.meta.env.BASE_URL + 'data/reviews/';
const localKey = tab => `coretexts-reviews-${tab}`;

function readLocal(tab) {
  try {
    return JSON.parse(localStorage.getItem(localKey(tab)) || '{}');
  } catch {
    return {};
  }
}

function writeLocal(tab, entries) {
  try {
    localStorage.setItem(localKey(tab), JSON.stringify(entries));
  } catch {
    // Private windows can refuse storage; the click still shows this visit.
  }
}

export function useReviews(tab) {
  const [committed, setCommitted] = useState({});
  const [local, setLocal] = useState(() => readLocal(tab));

  useEffect(() => {
    fetch(`${BASE}${tab}.json`)
      .then(r => (r.ok ? r.json() : { items: {} }))
      .then(d => setCommitted(d.items || {}))
      .catch(() => setCommitted({}));
  }, [tab]);

  const all = useMemo(() => ({ ...committed, ...local }), [committed, local]);

  const statusOf = useCallback(id => all[id]?.status || null, [all]);

  const setStatus = useCallback((id, status) => {
    setLocal(prev => {
      const next = { ...prev, [id]: status ? { status, at: new Date().toISOString().slice(0, 10) } : null };
      writeLocal(tab, next);
      return next;
    });
  }, [tab]);

  const exportFile = useCallback(() => {
    const items = Object.fromEntries(Object.entries(all).filter(([, v]) => v && v.status));
    const blob = new Blob([JSON.stringify({ tab, items }, null, 1) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${tab}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [all, tab]);

  const counts = Object.values(all).reduce((c, v) => {
    if (v?.status) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, {});

  return { statusOf, setStatus, exportFile, counts };
}

// A value kept in this browser between visits ("where I left off").
export function useRemembered(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(`coretexts-${key}`);
      return v === null ? initial : JSON.parse(v);
    } catch {
      return initial;
    }
  });
  const set = useCallback(v => {
    setValue(v);
    try {
      localStorage.setItem(`coretexts-${key}`, JSON.stringify(v));
    } catch {
      // ignore: remembering is a convenience
    }
  }, [key]);
  return [value, set];
}
