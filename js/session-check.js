// ========================================================
// FIRST AID APP — SESSION CHECK + SW AUTH HANDLER
// ========================================================

/* --------------------------------------------------------
   SESSION VALIDATION
-------------------------------------------------------- */
function hasSession() {
  return !!sessionStorage.getItem("faUser");
}

// If user is NOT logged in and NOT on the login page → block access
if (!hasSession() && !window.location.pathname.includes("login.html")) {
  window.location.replace("login.html");
}


/* --------------------------------------------------------
   SERVICE WORKER LOGIN VERIFICATION (Offline Security)
   SW sends:    { cmd: "CHECK_LOGIN" }
   App replies: { loggedIn: true/false }
-------------------------------------------------------- */
function setupSWListener() {
  if (!navigator.serviceWorker) return;

  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.cmd === "CHECK_LOGIN") {
      const loggedIn = hasSession();
      event.ports[0].postMessage({ loggedIn });
    }
  });
}


/* --------------------------------------------------------
   ENSURE LISTENER IS ALWAYS ACTIVE
   (Before SW messages start arriving)
-------------------------------------------------------- */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSWListener);
} else {
  setupSWListener();
}
