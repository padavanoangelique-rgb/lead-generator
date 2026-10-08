// Embedding is never proof of authentication. The owner must sign in
// with a verified, authorized Supabase account or the supported SSO flow.
export function isEmbedded() { return false; }
