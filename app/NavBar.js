'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (pathname === '/login' || !session) return null;

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const tabs = [
    { href: '/', label: 'Lead Generator' },
    { href: '/sales', label: 'Sales' },
    { href: '/finances', label: 'Finances' },
  ];

  return (
    <header>
      <h1>The Permit <span>Closer</span></h1>
      <nav className="top-nav no-print">
        {tabs.map(t => (
          <a key={t.href} href={t.href} className={pathname === t.href ? 'active' : ''}>{t.label}</a>
        ))}
        <button className="btn-outline btn-sm" onClick={signOut}>Sign Out</button>
      </nav>
    </header>
  );
}
