// POST /api/auth/login — Authenticate user and return session token
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const data = new TextEncoder().encode(salt + password);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
}

function generateToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { email, password } = await request.json();

        if (!email || !password)
            return new Response(JSON.stringify({ error: 'Email and password are required.' }), { status: 400, headers: CORS });

        const norm = email.toLowerCase().trim();
        const key = `user:${norm}`;
        const userData = await env.USERS.get(key);

        if (!userData)
            return new Response(JSON.stringify({ error: 'Invalid email or password.' }), { status: 401, headers: CORS });

        const user = JSON.parse(userData);
        const valid = await verifyPassword(password, user.password_hash);

        if (!valid)
            return new Response(JSON.stringify({ error: 'Invalid email or password.' }), { status: 401, headers: CORS });

        if (user.role === 'pending')
            return new Response(JSON.stringify({ error: 'Your account is pending approval. You will be notified when an admin reviews your request.' }), { status: 403, headers: CORS });

        if (user.role === 'rejected')
            return new Response(JSON.stringify({ error: 'Your access request was not approved.' }), { status: 403, headers: CORS });

        // Create session token (7-day expiry)
        const token = generateToken();
        const session = {
            user_email: norm,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
        };
        await env.USERS.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 7 * 24 * 60 * 60 });

        // Update last_login
        user.last_login = new Date().toISOString();
        await env.USERS.put(key, JSON.stringify(user));

        return new Response(JSON.stringify({
            token,
            user: { email: user.email, name: user.name, role: user.role }
        }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Login failed. Please try again.' }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
