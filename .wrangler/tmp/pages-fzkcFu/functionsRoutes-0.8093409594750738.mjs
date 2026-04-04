import { onRequestGet as __api_admin_users_js_onRequestGet } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/admin/users.js"
import { onRequestOptions as __api_admin_users_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/admin/users.js"
import { onRequestPatch as __api_admin_users_js_onRequestPatch } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/admin/users.js"
import { onRequestOptions as __api_auth_login_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/login.js"
import { onRequestPost as __api_auth_login_js_onRequestPost } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/login.js"
import { onRequestOptions as __api_auth_logout_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/logout.js"
import { onRequestPost as __api_auth_logout_js_onRequestPost } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/logout.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/me.js"
import { onRequestOptions as __api_auth_me_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/me.js"
import { onRequestOptions as __api_auth_register_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/register.js"
import { onRequestPost as __api_auth_register_js_onRequestPost } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/auth/register.js"
import { onRequestOptions as __api_subscribe_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/subscribe.js"
import { onRequestPost as __api_subscribe_js_onRequestPost } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/subscribe.js"
import { onRequestGet as __api_subscribers_js_onRequestGet } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/subscribers.js"
import { onRequestGet as __api_unsubscribe_js_onRequestGet } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/unsubscribe.js"
import { onRequestGet as __api_watchlist_js_onRequestGet } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/watchlist.js"
import { onRequestOptions as __api_watchlist_js_onRequestOptions } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/watchlist.js"
import { onRequestPost as __api_watchlist_js_onRequestPost } from "/Users/roberttooley/Master Intelligence/Casino_Gaming_Intel/Dashboard/functions/api/watchlist.js"

export const routes = [
    {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_users_js_onRequestGet],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_admin_users_js_onRequestOptions],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "PATCH",
      middlewares: [],
      modules: [__api_admin_users_js_onRequestPatch],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestOptions],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_auth_logout_js_onRequestOptions],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_js_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestGet],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestOptions],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_auth_register_js_onRequestOptions],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_register_js_onRequestPost],
    },
  {
      routePath: "/api/subscribe",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_subscribe_js_onRequestOptions],
    },
  {
      routePath: "/api/subscribe",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_subscribe_js_onRequestPost],
    },
  {
      routePath: "/api/subscribers",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_subscribers_js_onRequestGet],
    },
  {
      routePath: "/api/unsubscribe",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_unsubscribe_js_onRequestGet],
    },
  {
      routePath: "/api/watchlist",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_watchlist_js_onRequestGet],
    },
  {
      routePath: "/api/watchlist",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_watchlist_js_onRequestOptions],
    },
  {
      routePath: "/api/watchlist",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_watchlist_js_onRequestPost],
    },
  ]