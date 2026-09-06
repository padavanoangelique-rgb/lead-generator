'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { isEmbedded } from '../../lib/unlock';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isEmbedded()) {
      router.replace('/?embed=1');
      return;
    }
    setShow(true);
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); return; }
    router.push('/');
  }

  if (!show) return null;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Majestic Permits</h1>
        <p className="tag" style={{ marginTop: -8, marginBottom: 18 }}>Majestic Construction Permits LLC</p>
        <form onSubmit={handleLogin}>
          <div className="form-row">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
          <button className="btn-gold" type="submit" style={{ width: '100%', marginTop: 8 }}>Log In</button>
        </form>
      </div>
    </div>
  );
}
