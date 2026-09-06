'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    try {
      const saved = localStorage.getItem('majestic-theme') || localStorage.getItem('admin-theme');
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {}
    return () => sub.subscription.unsubscribe();
  }, []);

  if (pathname === '/login' || !session) return null;

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('majestic-theme', next);
      localStorage.setItem('admin-theme', next);
    } catch {}
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'majestic-theme', theme: next }, '*');
    }
  }

  const tabs = [
    { href: '/', label: 'Lead Generator' },
    { href: '/sales', label: 'Sales' },
    { href: '/finances', label: 'Finances' },
  ];

  return (
    <header>
      <h1>Majestic <span>Permits</span><small>Majestic Construction Permits LLC</small></h1>
      <nav className="top-nav no-print">
        {tabs.map(t => (
          <a key={t.href} href={t.href} className={pathname === t.href ? 'active' : ''}>{t.label}</a>
        ))}
        <button className="btn-outline btn-sm" onClick={toggleTheme}>
          {theme === 'dark' ? 'White + blue' : 'Black + lime'}
        </button>
        <button className="btn-outline btn-sm" onClick={signOut}>Sign Out</button>
      </nav>
    </header>
  );
}
