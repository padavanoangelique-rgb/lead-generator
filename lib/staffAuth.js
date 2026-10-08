import { createClient } from "@supabase/supabase-js";

/** Require a real, verified, allowlisted Supabase session for every lead write/read. */
export async function staffClient(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    const error = new Error("Lead Generator is not configured.");
    error.status = 503;
    throw error;
  }

  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) {
    const error = new Error("Sign in to access Lead Generator.");
    error.status = 401;
    throw error;
  }

  const verifier = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(match[1]);
  if (error || !data?.user || !data.user.email_confirmed_at) {
    const denied = new Error("Your session is invalid or unverified. Sign in again.");
    denied.status = 401;
    throw denied;
  }

  const allowed = (process.env.ADMIN_EMAILS || "angelique@majesticpermits.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!data.user.email || !allowed.includes(data.user.email.toLowerCase())) {
    const denied = new Error("Owner or approved staff access required.");
    denied.status = 403;
    throw denied;
  }

  // Only user-scoped JWTs are passed to PostgREST. Never use the service
  // role key for client-originated Lead Generator CRUD.
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + match[1] } },
  });
}
