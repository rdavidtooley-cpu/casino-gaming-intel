// POST /api/auth/register — Create a new user account (pending approval)
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
    const data = new TextEncoder().encode(saltHex + password);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
    return saltHex + ':' + hashHex;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password)
            return new Response(JSON.stringify({ error: 'Name, email, and password are required.' }), { status: 400, headers: CORS });
        if (password.length < 6)
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), { status: 400, headers: CORS });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return new Response(JSON.stringify({ error: 'Invalid email address.' }), { status: 400, headers: CORS });

        const norm = email.toLowerCase().trim();
        const key = `user:${norm}`;

        // Check if user already exists
        const existing = await env.USERS.get(key);
        if (existing)
            return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), { status: 409, headers: CORS });

        // Check if this is the first user (auto-admin)
        const idx = await env.USERS.get('_user_index');
        const isFirst = !idx || JSON.parse(idx).length === 0;

        const passwordHash = await hashPassword(password);
        const user = {
            email: norm,
            name: name.trim(),
            password_hash: passwordHash,
            role: isFirst ? 'admin' : 'pending',
            created_at: new Date().toISOString(),
            last_login: null
        };
        await env.USERS.put(key, JSON.stringify(user));

        // Update index
        let userIndex = [];
        if (idx) userIndex = JSON.parse(idx);
        if (!userIndex.includes(norm)) {
            userIndex.push(norm);
            await env.USERS.put('_user_index', JSON.stringify(userIndex));
        }

        // Send notification email to admin (skip if this IS the first/admin user)
        if (!isFirst && env.RESEND_API_KEY) {
            const siteUrl = env.SITE_URL || 'https://casino-gaming-intel.pages.dev';
            const fromEmail = env.FROM_EMAIL || 'Casino Gaming Intel <casino@sector-intel.com>';
            try {
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: fromEmail,
                        to: 'rdavidtooley@gmail.com',
                        subject: `New Access Request: ${name.trim()}`,
                        html: `<h2>New Registration Request</h2>
                            <p><strong>Name:</strong> ${name.trim()}</p>
                            <p><strong>Email:</strong> ${norm}</p>
                            <p><strong>Requested:</strong> ${new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})}</p>
                            <p><a href="${siteUrl}/admin.html" style="display:inline-block;padding:10px 20px;background:#f5c518;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Review in Admin Panel</a></p>`
                    })
                });
            } catch (e) { /* email failure is non-fatal */ }
        }

        if (isFirst) {
            return new Response(JSON.stringify({ status: 'approved', message: 'Account created! You are the first user and have been granted admin access. You can now sign in.' }), { status: 200, headers: CORS });
        }
        return new Response(JSON.stringify({ status: 'pending', message: 'Your access request has been submitted. An admin will review it shortly.' }), { status: 200, headers: CORS });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
