import {createClient} from '@supabase/supabase-js';
export async function staffClient(req) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url||!anon) {const e=new Error('Supabase is not configured.');e.status=503;throw e;}
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  const verifier=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await verifier.auth.getUser(token);
  if(error||!data?.user){const e=new Error('Sign in to the Permit Closer.');e.status=401;throw e;}
  const emails=(process.env.ADMIN_EMAILS||'angelique@majesticpermits.com').split(',').map(v=>v.trim().toLowerCase());
  if(!emails.includes((data.user.email||'').toLowerCase())){const e=new Error('Owner/staff access required.');e.status=403;throw e;}
  return createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
}
