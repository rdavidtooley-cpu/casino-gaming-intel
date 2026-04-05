// GET /api/email/unsubscribe?email=user@example.com&token=xxx
// Token = first 24 hex chars of SHA-256("email|cgi-alert-unsub-2026")
// Marks the user's USERS KV record with email_alerts_unsubscribed: true
const UNSUB_SALT = 'cgi-alert-unsub-2026';

async function sha256hex(message) {
    const data = new TextEncoder().encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function htmlPage(title, heading, message, linkText, linkUrl) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} — Casino Gaming Intel</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e8eaed;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#1a1d29;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:40px;text-align:center;max-width:420px;}
h2{color:#ffd700;margin:0 0 12px;}
p{color:#9aa0a6;font-size:14px;line-height:1.6;margin:0 0 20px;}
a{display:inline-block;padding:10px 20px;background:rgba(255,215,0,0.12);color:#ffd700;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;border:1px solid rgba(255,215,0,0.3);}
a:hover{background:rgba(255,215,0,0.2);}
</style></head><body>
<div class="card"><h2>${heading}</h2><p>${message}</p><a href="${linkUrl}">${linkText}</a></div>
</body></html>`;
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const token = url.searchParams.get('token');

    if (!email || !token) {
        return new Response(
            htmlPage('Invalid Link', 'Invalid Link', 'This unsubscribe link is missing required parameters.', 'Go to Dashboard', 'https://casino.sector-intel.com'),
            { status: 400, headers: { 'Content-Type': 'text/html' } }
        );
    }

    const norm = decodeURIComponent(email).toLowerCase().trim();
    const expectedHash = await sha256hex(`${norm}|${UNSUB_SALT}`);
    const expectedToken = expectedHash.slice(0, 24);

    if (token !== expectedToken) {
        return new Response(
            htmlPage('Invalid Token', 'Invalid Token', 'This unsubscribe link is not valid or has expired. Please use the link from your most recent alert email.', 'Go to Dashboard', 'https://casino.sector-intel.com'),
            { status: 403, headers: { 'Content-Type': 'text/html' } }
        );
    }

    try {
        // Mark in USERS KV if user exists
        if (env.USERS) {
            const userData = await env.USERS.get(`user:${norm}`);
            if (userData) {
                const user = JSON.parse(userData);
                user.email_alerts_unsubscribed = true;
                user.email_alerts_unsubscribed_at = new Date().toISOString();
                await env.USERS.put(`user:${norm}`, JSON.stringify(user));
            }
        }

        return new Response(
            htmlPage('Unsubscribed', "You're unsubscribed", "You won't receive big movers alert emails from Casino Gaming Intel anymore. You can re-enable alerts from your account settings.", 'Back to Dashboard', 'https://casino.sector-intel.com'),
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
    } catch (err) {
        return new Response(
            htmlPage('Error', 'Something went wrong', 'Please try again or contact support.', 'Back to Dashboard', 'https://casino.sector-intel.com'),
            { status: 500, headers: { 'Content-Type': 'text/html' } }
        );
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
