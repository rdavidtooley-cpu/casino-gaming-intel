// Casino Gaming Intel — Authentication Gate
// Password is SHA-256 hashed, never stored in plain text
(function() {
    const HASHES = [
        'e9f38ebfb639bc196f5f7ea5ae422f3dcdbd58bf708717c4d3ae06becea5addd'
    ];
    const SESSION_KEY = 'cgi_auth';
    const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    function isAuthenticated() {
        const session = localStorage.getItem(SESSION_KEY);
        if (!session) return false;
        try {
            const data = JSON.parse(session);
            if (Date.now() - data.ts > SESSION_DURATION) {
                localStorage.removeItem(SESSION_KEY);
                return false;
            }
            return HASHES.includes(data.h);
        } catch(e) {
            return false;
        }
    }

    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function showLoginScreen() {
        document.documentElement.style.background = '#0f1117';
        document.body.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML = `
            <style>
                #auth-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999;
                    background: #0f1117;
                    display: flex; align-items: center; justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .auth-box {
                    background: #1a1d29; border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px; padding: 40px; width: 380px; text-align: center;
                }
                .auth-box h1 {
                    color: #e8eaed; font-size: 22px; font-weight: 700; margin-bottom: 6px;
                }
                .auth-box p {
                    color: #9aa0a6; font-size: 13px; margin-bottom: 28px;
                }
                .auth-input {
                    width: 100%; padding: 12px 16px; border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 8px; background: #0f1117; color: #e8eaed; font-size: 14px;
                    outline: none; margin-bottom: 16px; box-sizing: border-box;
                }
                .auth-input:focus { border-color: #ffd700; }
                .auth-btn {
                    width: 100%; padding: 12px; border: none; border-radius: 8px;
                    background: linear-gradient(135deg, #b8860b, #daa520); color: #fff;
                    font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
                }
                .auth-btn:hover { opacity: 0.9; }
                .auth-error {
                    color: #f44336; font-size: 12px; margin-top: 12px; display: none;
                }
                .auth-logo {
                    width: 48px; height: 48px; margin: 0 auto 20px;
                    background: rgba(255,215,0,0.15); border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                }
            </style>
            <div class="auth-box">
                <div class="auth-logo">
                    <svg width="24" height="24" fill="none" stroke="#ffd700" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>
                <h1>Casino Gaming Intel</h1>
                <p>Enter password to access dashboards</p>
                <input type="password" class="auth-input" id="auth-pw" placeholder="Password" autocomplete="off">
                <button class="auth-btn" id="auth-submit">Sign In</button>
                <div class="auth-error" id="auth-error">Incorrect password. Please try again.</div>
            </div>
        `;
        document.documentElement.appendChild(overlay);

        const input = document.getElementById('auth-pw');
        const btn = document.getElementById('auth-submit');
        const error = document.getElementById('auth-error');

        async function tryLogin() {
            const hash = await sha256(input.value);
            if (HASHES.includes(hash)) {
                localStorage.setItem(SESSION_KEY, JSON.stringify({ h: hash, ts: Date.now() }));
                overlay.remove();
                document.body.style.display = '';
            } else {
                error.style.display = 'block';
                input.value = '';
                input.focus();
            }
        }

        btn.addEventListener('click', tryLogin);
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') tryLogin(); });
        setTimeout(() => input.focus(), 100);
    }

    if (!isAuthenticated()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showLoginScreen);
        } else {
            showLoginScreen();
        }
    }
})();
