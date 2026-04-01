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
        return new Response(JSON.stringify({ message: `User ${action}d successfully.`, user: { email: user.email, name: user.name, role: user.role } }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Action failed.' }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS' } });
}
