// Casino Gaming Intel — Token-Based Authentication
// Redirects to login.html if not authenticated
(function() {
    var TOKEN_KEY = 'cgi_token';
    var USER_KEY = 'cgi_user';

    // Skip auth check on login page itself
    if (window.location.pathname === '/login.html') return;

    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Hide body until auth confirmed
    document.documentElement.style.visibility = 'hidden';

    function showPage(user) {
        document.documentElement.style.visibility = '';
        window.SITE_USER = user;

        // Add admin link to nav if admin
        if (user && user.role === 'admin') {
            document.addEventListener('DOMContentLoaded', function() {
                var nav = document.querySelector('.nav, nav, .navbar, [class*="nav"]');
                if (nav) {
                    var existing = nav.querySelector('a[href*="admin"]');
                    if (!existing) {
                        var link = document.createElement('a');
                        link.href = '/admin.html';
                        link.textContent = 'Admin';
                        link.style.cssText = 'color:#f5c518;font-weight:700;font-size:13px;margin-left:12px;text-decoration:none;';
                        nav.appendChild(link);
                    }
                }
            });
        }
    }

    // Validate token with server
    fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(resp) {
            if (!resp.ok) throw new Error('invalid');
            return resp.json();
        })
        .then(function(data) {
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            showPage(data.user);
        })
        .catch(function() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.location.href = '/login.html';
        });

    // Global logout function
    window.cgiLogout = function() {
        var t = localStorage.getItem(TOKEN_KEY);
        if (t) fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + t } });
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = '/login.html';
    };
})();
