// Casino Gaming Intel — Gateway-Aware Authentication
// Validates against sector-intel.com gateway, falls back to local auth
(function() {
    var TOKEN_KEY = 'cgi_token';
    var USER_KEY = 'cgi_user';
    var SITE_ID = 'casino';
    var GATEWAY = 'https://sector-intel.com';

    // Skip auth on login page
    if (window.location.pathname === '/login.html') return;
    if (window.location.pathname === '/admin.html') return;

    // Check for gateway_token in URL (arriving from hub)
    var params = new URLSearchParams(window.location.search);
    var gatewayToken = params.get('gateway_token');
    if (gatewayToken) {
        localStorage.setItem(TOKEN_KEY, gatewayToken);
        // Strip token from URL
        params.delete('gateway_token');
        var cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        history.replaceState(null, '', cleanUrl);
    }

    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        // Redirect to gateway login with return URL
        window.location.href = GATEWAY + '/login.html?redirect=' + encodeURIComponent(window.location.origin);
        return;
    }

    // Hide body until auth confirmed
    document.documentElement.style.visibility = 'hidden';

    function showPage(user) {
        document.documentElement.style.visibility = '';
        window.SITE_USER = user;

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

    function clearAndRedirect() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = GATEWAY + '/login.html?redirect=' + encodeURIComponent(window.location.origin);
    }

    // Try gateway validation first
    fetch(GATEWAY + '/api/auth/validate?token=' + encodeURIComponent(token) + '&site=' + SITE_ID)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            if (data.valid) {
                localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                showPage(data.user);
            } else {
                // Gateway says invalid or no access
                clearAndRedirect();
            }
        })
        .catch(function() {
            // Gateway unreachable — try local auth as fallback
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
                    clearAndRedirect();
                });
        });

    // Global logout — clears both gateway and local sessions
    window.cgiLogout = function() {
        var t = localStorage.getItem(TOKEN_KEY);
        if (t) {
            fetch(GATEWAY + '/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + t } }).catch(function(){});
            fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + t } }).catch(function(){});
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = GATEWAY + '/login.html';
    };
})();
