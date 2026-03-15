// POST /api/subscribe — Add or update a subscriber
export async function onRequestPost(context) {
    const { request, env } = context;
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    try {
        const { email, frequency } = await request.json();

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return new Response(JSON.stringify({ error: 'Invalid email address.' }), { status: 400, headers });

        // Validate frequency
        if (!['daily', 'weekly'].includes(frequency))
            return new Response(JSON.stringify({ error: 'Frequency must be daily or weekly.' }), { status: 400, headers });

        const norm = email.toLowerCase().trim();
        const key = `sub:${norm}`;

        // Check for existing subscriber
        const existing = await env.SUBSCRIBERS.get(key);
        if (existing) {
            const data = JSON.parse(existing);
            if (data.frequency === frequency)
                return new Response(JSON.stringify({ message: 'Already subscribed.' }), { status: 200, headers });
            // Update frequency
            data.frequency = frequency;
            data.updatedAt = new Date().toISOString();
            await env.SUBSCRIBERS.put(key, JSON.stringify(data));
            return new Response(JSON.stringify({ message: `Updated to ${frequency} digest.` }), { status: 200, headers });
        }

        // Create new subscriber
        const subscriber = {
            email: norm,
            frequency,
            subscribedAt: new Date().toISOString(),
            active: true
        };
        await env.SUBSCRIBERS.put(key, JSON.stringify(subscriber));

        // Maintain index for listing
        let idx = [];
        const idxData = await env.SUBSCRIBERS.get('_index');
        if (idxData) idx = JSON.parse(idxData);
        if (!idx.includes(norm)) {
            idx.push(norm);
            await env.SUBSCRIBERS.put('_index', JSON.stringify(idx));
        }

        return new Response(JSON.stringify({ message: 'Subscribed! You\'ll receive your first digest soon.' }), { status: 200, headers });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Subscription failed. Please try again.' }), { status: 500, headers });
    }
}

// Handle CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
