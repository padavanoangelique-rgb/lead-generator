'use client';
import { useEffect } from 'react';

const KEY = 'majestic-theme';

function apply(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
    localStorage.setItem('admin-theme', theme);
  } catch {}
}

export default function ThemeSync() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) || localStorage.getItem('admin-theme');
      if (saved === 'light' || saved === 'dark') apply(saved);
      else apply('dark');
    } catch {
      apply('dark');
    }

    function onMessage(e) {
      const data = e.data;
      if (!data || data.type !== 'majestic-theme') return;
      apply(data.theme);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return null;
}
