import { type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const backendUrl = process.env.PYTHON_BACKEND_URL;

    const body = await req.json();

    const upstreamRes = await fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ error: 'Backend unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to connect to backend', raw: error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
