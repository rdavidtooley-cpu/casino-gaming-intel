// POST /api/auth/logout — Invalidate session token
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            await env.USERS.delete(`session:${token}`);
        }
        return new Response(JSON.stringify({ message: 'Logged out.' }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ message: 'Logged out.' }), { status: 200, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
