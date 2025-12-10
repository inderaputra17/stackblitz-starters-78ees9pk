/**
 * PERMISSIONS CHECK (Offline-safe + PWA compatible)
 * Ensures:
 * - Correct permission blocking
 * - Works with cached pages (PWA)
 * - Does NOT run before session-check.js
 */

 setTimeout(() => {
  const permUser = JSON.parse(sessionStorage.getItem("faUser"));

  // No session → force login
  if (!permUser) {
    window.location.replace("login.html");
    return;
  }

  const perms = permUser.permissions || {};

  // ============================================================
  //  PAGE → PERMISSION KEY MAP  (UPDATED + LOCK-IN ALIGNED)
  // ============================================================
  const pagePermissionMap = {
    "index.html":          "dashboard",
    "inventory.html":      "inventory",
    "addStock.html":       "addStock",
    "transfer.html":       "transfer",
    "report.html":         "reports",
    "admin.html":          "adminPage",

    // 🔒 NEW SECURE PAGES (you told system to lock-in)
    "reportLogs.html":     "reports",
    "inventoryLogs.html":  "inventory"
  };

  // Determine which file is being accessed
  const file = window.location.pathname.split("/").pop();
  const required = pagePermissionMap[file];

  // ============================================================
  //  BLOCK ONLY IF THE PAGE DEFINES A PERMISSION REQUIREMENT
  // ============================================================
  if (required && perms[required] !== true) {
    window.location.replace("denied.html");
  }

}, 80);  // Prevent offline breakage & SW race condition
