// ======================================================
// login.js — Clean, Structured, No New Features
// ======================================================

import { db } from "./app.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


/* ======================================================
   DOM REFERENCES
====================================================== */
const pinInput   = document.getElementById("loginPin");
const loginBtn   = document.getElementById("loginBtn");
const showPinBtn = document.getElementById("showPin");
const errorMsg   = document.getElementById("errorMsg");


/* ======================================================
   PIN VISIBILITY TOGGLE
====================================================== */
showPinBtn.addEventListener("click", () => {
  const isHidden = pinInput.type === "password";
  pinInput.type = isHidden ? "text" : "password";
  showPinBtn.textContent = isHidden ? "Hide" : "Show";
});


/* ======================================================
   LOCAL STAFF CACHE (Offline Login Support)
====================================================== */
function getLocalStaff() {
  try {
    return JSON.parse(localStorage.getItem("staffCache") || "[]");
  } catch {
    return [];
  }
}


/* ======================================================
   SYNC STAFF LIST (Online → Store Offline)
====================================================== */
async function syncStaffList() {
  try {
    const snap = await getDocs(collection(db, "staff"));
    const staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Required by Lock-In Guide (offline login)
    localStorage.setItem("staffCache", JSON.stringify(staff));
    return staff;

  } catch (err) {
    console.warn("Sync failed, reverting to offline staff cache:", err);
    return getLocalStaff();
  }
}


/* ======================================================
   LOGIN HANDLER
====================================================== */
loginBtn.addEventListener("click", async () => {
  const enteredPin = pinInput.value.trim();

  // Strict PIN format (cannot remove)
  if (!/^\d{6}$/.test(enteredPin)) {
    errorMsg.textContent = "PIN must be 6 digits.";
    errorMsg.classList.remove("hidden");
    return;
  }

  let staffList = [];

  if (navigator.onLine) {
    staffList = await syncStaffList();
  } else {
    // Offline mode
    staffList = getLocalStaff();

    if (staffList.length === 0) {
      errorMsg.textContent =
        "Offline login not available. Log in at least once online first.";
      errorMsg.classList.remove("hidden");
      return;
    }
  }

  // Validate user
  const user = staffList.find(
    s => s.pin === enteredPin && s.active !== false
  );

  if (!user) {
    errorMsg.textContent = "Invalid PIN.";
    errorMsg.classList.remove("hidden");
    return;
  }

  // Save session (required for Lock-In Guide)
  sessionStorage.setItem(
    "faUser",
    JSON.stringify({
      id: user.id,
      name: user.name,
      role: user.role || "Staff",
      permissions: user.permissions || {}
    })
  );

  // Redirect to dashboard
  window.location.href = "index.html";
});
