var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/admin/users.js
var CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function requireAdmin(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const sessionData = await env.USERS.get(`session:${token}`);
  if (!sessionData) return null;
  const session = JSON.parse(sessionData);
  if (new Date(session.expires_at) < /* @__PURE__ */ new Date()) return null;
  const userData = await env.USERS.get(`user:${session.user_email}`);
  if (!userData) return null;
  const user = JSON.parse(userData);
  if (user.role !== "admin") return null;
  return user;
}
__name(requireAdmin, "requireAdmin");
async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin)
    return new Response(JSON.stringify({ error: "Admin access required." }), { status: 403, headers: CORS });
  try {
    const idxData = await env.USERS.get("_user_index");
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
    users.sort((a, b) => {
      if (a.role === "pending" && b.role !== "pending") return -1;
      if (b.role === "pending" && a.role !== "pending") return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return new Response(JSON.stringify({ users }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to load users." }), { status: 500, headers: CORS });
  }
}
__name(onRequestGet, "onRequestGet");
async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin)
    return new Response(JSON.stringify({ error: "Admin access required." }), { status: 403, headers: CORS });
  try {
    const { email, action } = await request.json();
    if (!email || !action)
      return new Response(JSON.stringify({ error: "Email and action are required." }), { status: 400, headers: CORS });
    const norm = email.toLowerCase().trim();
    const key = `user:${norm}`;
    const userData = await env.USERS.get(key);
    if (!userData)
      return new Response(JSON.stringify({ error: "User not found." }), { status: 404, headers: CORS });
    const user = JSON.parse(userData);
    switch (action) {
      case "approve":
        user.role = "user";
        user.approved_by = admin.email;
        user.approved_at = (/* @__PURE__ */ new Date()).toISOString();
        break;
      case "reject":
        user.role = "rejected";
        break;
      case "make-admin":
        user.role = "admin";
        break;
      case "remove":
        user.role = "rejected";
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid action." }), { status: 400, headers: CORS });
    }
    await env.USERS.put(key, JSON.stringify(user));
    if (action === "approve" && env.RESEND_API_KEY) {
      const siteUrl = env.SITE_URL || "https://casino.sector-intel.com";
      const siteName = "Casino Gaming Intel";
      const fromEmail = env.FROM_EMAIL || "Casino Gaming Intel <casino@sector-intel.com>";
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: user.email,
            subject: `You're approved \u2014 ${siteName}`,
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
      } catch (e) {
      }
    }
    return new Response(JSON.stringify({ message: `User ${action}d successfully.`, user: { email: user.email, name: user.name, role: user.role } }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Action failed." }), { status: 500, headers: CORS });
  }
}
__name(onRequestPatch, "onRequestPatch");
async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS" } });
}
__name(onRequestOptions, "onRequestOptions");

// api/auth/login.js
var CORS2 = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const data = new TextEncoder().encode(salt + password);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashHex = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === hash;
}
__name(verifyPassword, "verifyPassword");
function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");
async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();
    if (!email || !password)
      return new Response(JSON.stringify({ error: "Email and password are required." }), { status: 400, headers: CORS2 });
    const norm = email.toLowerCase().trim();
    const key = `user:${norm}`;
    const userData = await env.USERS.get(key);
    if (!userData)
      return new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401, headers: CORS2 });
    const user = JSON.parse(userData);
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid)
      return new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401, headers: CORS2 });
    if (user.role === "pending")
      return new Response(JSON.stringify({ error: "Your account is pending approval. You will be notified when an admin reviews your request." }), { status: 403, headers: CORS2 });
    if (user.role === "rejected")
      return new Response(JSON.stringify({ error: "Your access request was not approved." }), { status: 403, headers: CORS2 });
    const token = generateToken();
    const session = {
      user_email: norm,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.USERS.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 7 * 24 * 60 * 60 });
    user.last_login = (/* @__PURE__ */ new Date()).toISOString();
    await env.USERS.put(key, JSON.stringify(user));
    return new Response(JSON.stringify({
      token,
      user: { email: user.email, name: user.name, role: user.role }
    }), { status: 200, headers: CORS2 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Login failed. Please try again." }), { status: 500, headers: CORS2 });
  }
}
__name(onRequestPost, "onRequestPost");
async function onRequestOptions2() {
  return new Response(null, { status: 204, headers: { ...CORS2, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}
__name(onRequestOptions2, "onRequestOptions");

// api/auth/logout.js
var CORS3 = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function onRequestPost2(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await env.USERS.delete(`session:${token}`);
    }
    return new Response(JSON.stringify({ message: "Logged out." }), { status: 200, headers: CORS3 });
  } catch (err) {
    return new Response(JSON.stringify({ message: "Logged out." }), { status: 200, headers: CORS3 });
  }
}
__name(onRequestPost2, "onRequestPost");
async function onRequestOptions3() {
  return new Response(null, { status: 204, headers: { ...CORS3, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}
__name(onRequestOptions3, "onRequestOptions");

// api/auth/me.js
var CORS4 = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function onRequestGet2(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401, headers: CORS4 });
    const token = authHeader.slice(7);
    const sessionData = await env.USERS.get(`session:${token}`);
    if (!sessionData)
      return new Response(JSON.stringify({ error: "Session expired or invalid." }), { status: 401, headers: CORS4 });
    const session = JSON.parse(sessionData);
    if (new Date(session.expires_at) < /* @__PURE__ */ new Date())
      return new Response(JSON.stringify({ error: "Session expired." }), { status: 401, headers: CORS4 });
    const userData = await env.USERS.get(`user:${session.user_email}`);
    if (!userData)
      return new Response(JSON.stringify({ error: "User not found." }), { status: 401, headers: CORS4 });
    const user = JSON.parse(userData);
    if (user.role === "pending" || user.role === "rejected")
      return new Response(JSON.stringify({ error: "Account not active." }), { status: 403, headers: CORS4 });
    return new Response(JSON.stringify({
      user: { email: user.email, name: user.name, role: user.role }
    }), { status: 200, headers: CORS4 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Authentication check failed." }), { status: 500, headers: CORS4 });
  }
}
__name(onRequestGet2, "onRequestGet");
async function onRequestOptions4() {
  return new Response(null, { status: 204, headers: { ...CORS4, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
__name(onRequestOptions4, "onRequestOptions");

// api/auth/register.js
var CORS5 = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const data = new TextEncoder().encode(saltHex + password);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashHex = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return saltHex + ":" + hashHex;
}
__name(hashPassword, "hashPassword");
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password)
      return new Response(JSON.stringify({ error: "Name, email, and password are required." }), { status: 400, headers: CORS5 });
    if (password.length < 6)
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), { status: 400, headers: CORS5 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return new Response(JSON.stringify({ error: "Invalid email address." }), { status: 400, headers: CORS5 });
    const norm = email.toLowerCase().trim();
    const key = `user:${norm}`;
    const existing = await env.USERS.get(key);
    if (existing)
      return new Response(JSON.stringify({ error: "An account with this email already exists." }), { status: 409, headers: CORS5 });
    const idx = await env.USERS.get("_user_index");
    const isFirst = !idx || JSON.parse(idx).length === 0;
    const passwordHash = await hashPassword(password);
    const user = {
      email: norm,
      name: name.trim(),
      password_hash: passwordHash,
      role: isFirst ? "admin" : "pending",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      last_login: null
    };
    await env.USERS.put(key, JSON.stringify(user));
    let userIndex = [];
    if (idx) userIndex = JSON.parse(idx);
    if (!userIndex.includes(norm)) {
      userIndex.push(norm);
      await env.USERS.put("_user_index", JSON.stringify(userIndex));
    }
    if (!isFirst && env.RESEND_API_KEY) {
      const siteUrl = env.SITE_URL || "https://casino-gaming-intel.pages.dev";
      const fromEmail = env.FROM_EMAIL || "Casino Gaming Intel <casino@sector-intel.com>";
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: "rdavidtooley@gmail.com",
            subject: `New Access Request: ${name.trim()}`,
            html: `<h2>New Registration Request</h2>
                            <p><strong>Name:</strong> ${name.trim()}</p>
                            <p><strong>Email:</strong> ${norm}</p>
                            <p><strong>Requested:</strong> ${(/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
                            <p><a href="${siteUrl}/admin.html" style="display:inline-block;padding:10px 20px;background:#ffd700;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Review in Admin Panel</a></p>`
          })
        });
      } catch (e) {
      }
    }
    if (isFirst) {
      return new Response(JSON.stringify({ status: "approved", message: "Account created! You are the first user and have been granted admin access. You can now sign in." }), { status: 200, headers: CORS5 });
    }
    return new Response(JSON.stringify({ status: "pending", message: "Your access request has been submitted. An admin will review it shortly." }), { status: 200, headers: CORS5 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Registration failed. Please try again." }), { status: 500, headers: CORS5 });
  }
}
__name(onRequestPost3, "onRequestPost");
async function onRequestOptions5() {
  return new Response(null, { status: 204, headers: { ...CORS5, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}
__name(onRequestOptions5, "onRequestOptions");

// api/subscribe.js
async function onRequestPost4(context) {
  const { request, env } = context;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  try {
    const { email, frequency } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return new Response(JSON.stringify({ error: "Invalid email address." }), { status: 400, headers });
    if (!["daily", "weekly"].includes(frequency))
      return new Response(JSON.stringify({ error: "Frequency must be daily or weekly." }), { status: 400, headers });
    const norm = email.toLowerCase().trim();
    const key = `sub:${norm}`;
    const existing = await env.SUBSCRIBERS.get(key);
    if (existing) {
      const data = JSON.parse(existing);
      if (data.frequency === frequency)
        return new Response(JSON.stringify({ message: "Already subscribed." }), { status: 200, headers });
      data.frequency = frequency;
      data.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.SUBSCRIBERS.put(key, JSON.stringify(data));
      return new Response(JSON.stringify({ message: `Updated to ${frequency} digest.` }), { status: 200, headers });
    }
    const subscriber = {
      email: norm,
      frequency,
      subscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
      active: true
    };
    await env.SUBSCRIBERS.put(key, JSON.stringify(subscriber));
    let idx = [];
    const idxData = await env.SUBSCRIBERS.get("_index");
    if (idxData) idx = JSON.parse(idxData);
    if (!idx.includes(norm)) {
      idx.push(norm);
      await env.SUBSCRIBERS.put("_index", JSON.stringify(idx));
    }
    return new Response(JSON.stringify({ message: "Subscribed! You'll receive your first digest soon." }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Subscription failed. Please try again." }), { status: 500, headers });
  }
}
__name(onRequestPost4, "onRequestPost");
async function onRequestOptions6() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions6, "onRequestOptions");

// api/subscribers.js
async function onRequestGet3(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json" };
  const url = new URL(request.url);
  const token = request.headers.get("Authorization")?.replace("Bearer ", "") || url.searchParams.get("key");
  if (!env.API_SECRET || token !== env.API_SECRET)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const freqFilter = url.searchParams.get("frequency");
  try {
    const indexData = await env.SUBSCRIBERS.get("_index");
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
    return new Response(JSON.stringify({ error: "Failed to fetch subscribers." }), { status: 500, headers });
  }
}
__name(onRequestGet3, "onRequestGet");

// api/unsubscribe.js
async function onRequestGet4(context) {
  const { request, env } = context;
  const email = new URL(request.url).searchParams.get("email");
  if (!email)
    return new Response("<h2>Invalid unsubscribe link.</h2>", {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  const norm = decodeURIComponent(email).toLowerCase().trim();
  try {
    const existing = await env.SUBSCRIBERS.get(`sub:${norm}`);
    if (existing) {
      const data = JSON.parse(existing);
      data.active = false;
      data.unsubscribedAt = (/* @__PURE__ */ new Date()).toISOString();
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
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
  } catch (err) {
    return new Response("<h2>Something went wrong. Please try again.</h2>", {
      status: 500,
      headers: { "Content-Type": "text/html" }
    });
  }
}
__name(onRequestGet4, "onRequestGet");

// api/watchlist.js
var HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};
function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}
__name(normalizeEmail, "normalizeEmail");
function isValidEmail(email) {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail, "isValidEmail");
async function onRequestGet5(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const email = normalizeEmail(url.searchParams.get("email"));
  if (!isValidEmail(email))
    return new Response(JSON.stringify({ error: "Invalid or missing email." }), { status: 400, headers: HEADERS });
  const key = `watchlist:${email}`;
  const data = await env.SUBSCRIBERS.get(key);
  const tickers = data ? JSON.parse(data) : [];
  return new Response(JSON.stringify({ email, tickers }), { status: 200, headers: HEADERS });
}
__name(onRequestGet5, "onRequestGet");
async function onRequestPost5(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const ticker = (body.ticker || "").toUpperCase().trim();
    const action = (body.action || "").toLowerCase();
    if (!isValidEmail(email))
      return new Response(JSON.stringify({ error: "Invalid or missing email." }), { status: 400, headers: HEADERS });
    if (!ticker)
      return new Response(JSON.stringify({ error: "Missing ticker." }), { status: 400, headers: HEADERS });
    if (!["add", "remove"].includes(action))
      return new Response(JSON.stringify({ error: "Action must be 'add' or 'remove'." }), { status: 400, headers: HEADERS });
    const key = `watchlist:${email}`;
    const existing = await env.SUBSCRIBERS.get(key);
    let tickers = existing ? JSON.parse(existing) : [];
    if (action === "add") {
      if (!tickers.includes(ticker)) {
        tickers.push(ticker);
        tickers.sort();
      }
    } else {
      tickers = tickers.filter((t) => t !== ticker);
    }
    await env.SUBSCRIBERS.put(key, JSON.stringify(tickers));
    return new Response(JSON.stringify({ email, tickers, message: `${ticker} ${action === "add" ? "added to" : "removed from"} watchlist.` }), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400, headers: HEADERS });
  }
}
__name(onRequestPost5, "onRequestPost");
async function onRequestOptions7() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions7, "onRequestOptions");

// ../.wrangler/tmp/pages-fzkcFu/functionsRoutes-0.8093409594750738.mjs
var routes = [
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions5]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/subscribe",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions6]
  },
  {
    routePath: "/api/subscribe",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/subscribers",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/unsubscribe",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/watchlist",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/watchlist",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions7]
  },
  {
    routePath: "/api/watchlist",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  }
];

// ../../../../.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
