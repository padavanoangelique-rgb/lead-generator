import { createClient } from '@supabase/supabase-js';
import { isEmbedded } from './unlock';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DESK_SESSION = { user: { email: 'desk@majesticpermits.com' } };

if (typeof window !== 'undefined' && isEmbedded()) {
  const auth = supabase.auth;
  auth.getSession = async () => ({ data: { session: DESK_SESSION }, error: null });
  auth.getUser = async () => ({ data: { user: DESK_SESSION.user }, error: null });
  const origChange = auth.onAuthStateChange.bind(auth);
  auth.onAuthStateChange = (cb) => {
    try { cb('SIGNED_IN', DESK_SESSION); } catch {}
    return { data: { subscription: { unsubscribe() {} } } };
  };
}
