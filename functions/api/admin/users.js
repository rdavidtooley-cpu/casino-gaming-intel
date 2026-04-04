// GET /api/admin/users — List all users (admin only)
// PATCH /api/admin/users — Update user role (admin only)
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function requireAdmin(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const sessionData = await env.USERS.get(`session:${token}`);
    if (!sessionData) return null;
    const session = JSON.parse(sessionData);
    if (new Date(session.expires_at) < new Date()) return null;
    const userData = await env.USERS.get(`user:${session.user_email}`);
    if (!userData) return null;
    const user = JSON.parse(userData);
    if (user.role !== 'admin') return null;
    return user;
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (!admin)
        return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 403, headers: CORS });

    try {
        const idxData = await env.USERS.get('_user_index');
        if (!idxData)
            return new Response(JSON.stringify({ users: [] }), { status: 200, headers: CORS });

        const emails = JSON.parse(idxData);
        const users = [];
        for (const email of emails) {
            const data = await env.USERS.get(`user:${email}`);
            if (data) {
                const u = JSON.parse(data);
                users.push({
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    created_at: u.created_at,
                    last_login: u.last_login
                });
            }
        }
        // Sort: pending first, then by created_at desc
        users.sort((a, b) => {
            if (a.role === 'pending' && b.role !== 'pending') return -1;
            if (b.role === 'pending' && a.role !== 'pending') return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return new Response(JSON.stringify({ users }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to load users.' }), { status: 500, headers: CORS });
    }
}

export async function onRequestPatch(context) {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (!admin)
        return new Response(JSON.stringify({ error: 'Admin access required.' }), { status: 403, headers: CORS });

    try {
        const { email, action } = await request.json();
        if (!email || !action)
            return new Response(JSON.stringify({ error: 'Email and action are required.' }), { status: 400, headers: CORS });

        const norm = email.toLowerCase().trim();
        const key = `user:${norm}`;
        const userData = await env.USERS.get(key);
        if (!userData)
            return new Response(JSON.stringify({ error: 'User not found.' }), { status: 404, headers: CORS });

        const user = JSON.parse(userData);

        switch (action) {
            case 'approve':
                user.role = 'user';
                user.approved_by = admin.email;
                user.approved_at = new Date().toISOString();
                break;
            case 'reject':
                user.role = 'rejected';
                break;
            case 'make-admin':
                user.role = 'admin';
                break;
            case 'remove':
                user.role = 'rejected';
                break;
            default:
                return new Response(JSON.stringify({ error: 'Invalid action.' }), { status: 400, headers: CORS });
        }

        await env.USERS.put(key, JSON.stringify(user));

        // Send welcome email on approval
        if (action === 'approve' && env.RESEND_API_KEY) {
            const siteUrl = env.SITE_URL || 'https://casino.sector-intel.com';
            const siteName = 'Casino Gaming Intel';
            const fromEmail = env.FROM_EMAIL || 'Casino Gaming Intel <casino@sector-intel.com>';
            try {
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: fromEmail,
                        to: user.email,
                        subject: `You're approved — ${siteName}`,
                        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0f1117;color:#e8eaed;border-radius:8px;">
                            <h2 style="color:#ffd700;margin-top:0;">You're in, ${user.name}.</h2>
                            <p style="color:#9aa0a6;line-height:1.6;">Your access request for <strong style="color:#e8eaed;">${siteName}</strong> has been approved. You can sign in now.</p>
                            <p style="margin:28px 0;">
                                <a href="${siteUrl}/login.html" style="display:inline-block;padding:12px 24px;background:#ffd700;color:#000;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;">Sign In Now</a>
                            </p>
                            <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">If you didn't request access to ${siteName}, you can ignore this email.</p>
                        </div>`
                    })
                });
            } catch (e) { /* email failure is non-fatal */ }
        }

        return new Response(JSON.stringify({ message: `User ${action}d successfully.`, user: { email: user.email, name: user.name, role: user.role } }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Action failed.' }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS' } });
}
