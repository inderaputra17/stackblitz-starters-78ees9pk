/* =========================================================
   SESSION UTILS — Consistent With Lock-In Security Model
   (No behavior changes)
========================================================= */

/**
 * Save user session
 * Stores only the fields your app actually uses.
 */
 export function startSession(user) {
  sessionStorage.setItem("faUser", JSON.stringify({
    id: user.id,
    name: user.name,
    role: user.role || "Staff",
    permissions: user.permissions || {}   // required by dashboard + perms-check
  }));
}

/**
 * Retrieve the logged-in user object
 */
export function getSessionUser() {
  const raw = sessionStorage.getItem("faUser");
  return raw ? JSON.parse(raw) : null;
}

/**
 * Hard-block pages that require login
 */
export function requireLogin() {
  if (!getSessionUser()) {
    window.location.href = "login.html";
  }
}
