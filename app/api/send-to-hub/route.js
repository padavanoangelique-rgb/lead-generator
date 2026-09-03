export const dynamic = 'force-dynamic';

export async function POST(req) {
  const secret = process.env.HUB_INGEST_SECRET || process.env.LEAD_INGEST_SECRET;
  const hubBase = (process.env.HUB_URL || 'https://hub.majesticpermits.com').replace(/\/$/, '');

  if (!secret) {
    return Response.json(
      { error: 'Set HUB_INGEST_SECRET on this Vercel project (same value as LEAD_INGEST_SECRET on the Hub).' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const res = await fetch(`${hubBase}/api/ingest/permit-closer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ error: err.message || 'Hub request failed' }, { status: 502 });
  }
}
