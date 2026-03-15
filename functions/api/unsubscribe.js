// GET /api/unsubscribe?email=user@example.com — One-click unsubscribe
export async function onRequestGet(context) {
    const { request, env } = context;
    const email = new URL(request.url).searchParams.get('email');

    if (!email)
        return new Response('<h2>Invalid unsubscribe link.</h2>', {
            status: 400, headers: { 'Content-Type': 'text/html' }
        });

    const norm = decodeURIComponent(email).toLowerCase().trim();

    try {
        const existing = await env.SUBSCRIBERS.get(`sub:${norm}`);
        if (existing) {
            const data = JSON.parse(existing);
            data.active = false;
            data.unsubscribedAt = new Date().toISOString();
            await env.SUBSCRIBERS.put(`sub:${norm}`, JSON.stringify(data));
        }

        const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Unsubscribed &mdash; Casino Gaming Intel</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e8eaed;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#1a1d29;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:40px;text-align:center;max-width:400px;}
h2{color:#ffd700;margin-bottom:12px;}
p{color:#9aa0a6;font-size:14px;line-height:1.6;}
a{color:#ffd700;text-decoration:none;}
a:hover{text-decoration:underline;}
</style></head><body>
<div class="card">
<h2>Unsubscribed</h2>
<p>You've been removed from Casino Gaming Intel email digests.</p>
<p>Changed your mind? Visit <a href="https://casino-gaming-intel.pages.dev/">casino-gaming-intel.pages.dev</a> to resubscribe.</p>
</div></body></html>`;

        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    } catch (err) {
        return new Response('<h2>Something went wrong. Please try again.</h2>', {
            status: 500, headers: { 'Content-Type': 'text/html' }
        });
    }
}
