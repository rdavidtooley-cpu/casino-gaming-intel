// GET /api/subscribers?frequency=daily&key=SECRET — List active subscribers (protected)
export async function onRequestGet(context) {
    const { request, env } = context;
    const headers = { 'Content-Type': 'application/json' };
    const url = new URL(request.url);

    // Authenticate via Bearer token or query param
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || url.searchParams.get('key');
    if (!env.API_SECRET || token !== env.API_SECRET)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const freqFilter = url.searchParams.get('frequency');

    try {
        const indexData = await env.SUBSCRIBERS.get('_index');
        if (!indexData)
            return new Response(JSON.stringify({ subscribers: [], count: 0 }), { status: 200, headers });

        const emails = JSON.parse(indexData);
        const subs = [];
        for (const e of emails) {
            const d = await env.SUBSCRIBERS.get(`sub:${e}`);
            if (d) {
                const s = JSON.parse(d);
                if (s.active !== false && (!freqFilter || s.frequency === freqFilter))
                    subs.push(s);
            }
        }

        return new Response(JSON.stringify({ subscribers: subs, count: subs.length }), { status: 200, headers });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to fetch subscribers.' }), { status: 500, headers });
    }
}
