// GET /api/auth/me — Validate session token and return user info
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequestGet(context) {
    const { request, env } = context;
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer '))
            return new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401, headers: CORS });

        const token = authHeader.slice(7);
        const sessionData = await env.USERS.get(`session:${token}`);
        if (!sessionData)
            return new Response(JSON.stringify({ error: 'Session expired or invalid.' }), { status: 401, headers: CORS });

        const session = JSON.parse(sessionData);
        if (new Date(session.expires_at) < new Date())
            return new Response(JSON.stringify({ error: 'Session expired.' }), { status: 401, headers: CORS });

        const userData = await env.USERS.get(`user:${session.user_email}`);
        if (!userData)
            return new Response(JSON.stringify({ error: 'User not found.' }), { status: 401, headers: CORS });

        const user = JSON.parse(userData);
        if (user.role === 'pending' || user.role === 'rejected')
            return new Response(JSON.stringify({ error: 'Account not active.' }), { status: 403, headers: CORS });

        return new Response(JSON.stringify({
            user: { email: user.email, name: user.name, role: user.role }
        }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Authentication check failed.' }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
