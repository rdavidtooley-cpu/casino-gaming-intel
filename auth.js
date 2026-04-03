// Casino Gaming Intel — Token-Based Authentication
// Redirects to login.html if not authenticated
(function() {
    var TOKEN_KEY = 'cgi_token';
    var USER_KEY = 'cgi_user';

    // Skip auth check on login page and admin page
    if (window.location.pathname === '/login.html') return;
    if (window.location.pathname === '/admin.html') return;

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

        // Show admin link (pre-embedded in nav HTML, hidden by default)
        if (user && user.role === 'admin') {
            function showAdminLink() {
                var el = document.getElementById('admin-nav-link');
                if (el) el.style.display = '';
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', showAdminLink);
            } else {
                showAdminLink();
            }
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
