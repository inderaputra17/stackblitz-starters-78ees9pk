import { db } from "./app.js";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("Dashboard loaded");

/* =========================
   SESSION + PERMISSIONS
========================= */
const user = JSON.parse(sessionStorage.getItem("faUser")) || {};
const perms = user.permissions || {};

/* =========================
   DOM HELPERS + ELEMENTS
========================= */
const $ = id => document.getElementById(id);

// FAB references
const fab = $("fab");
const fabMenu = $("fabMenu");

// KPI elements
const reportsTodayEl = $("newReportsToday");
const lowCriticalEl = $("lowCriticalItems");
const reportsMonthEl = $("reportsMonth");
const activeEventsEl = $("activeEvents");

// Alerts + charts
const alertsPanel = $("alertsPanel");
const chartCases = $("caseTrendChart");
const chartInventory = $("inventoryUsageChart");


/* =========================
   PERMISSION FILTERS
========================= */

/* Hide QUICK ACTION tiles */
function hideQuickAction(linkTarget) {
  const el = document.querySelector(`a[href="${linkTarget}"]`);
  if (el) el.style.display = "none";
}

/* Hide FAB links (but never remove logout) */
function hideFab(linkTarget) {
  if (!fabMenu) return;
  [...fabMenu.querySelectorAll("a")].forEach(a => {
    if (a.getAttribute("href") === linkTarget) a.remove();
  });
}

/* Apply permissions to dashboard UI */
function applyPermissionVisibility() {
  // QUICK ACTION tiles
  if (!perms.reports) hideQuickAction("report.html");
  if (!perms.addStock) hideQuickAction("addStock.html");
  if (!perms.transfer) hideQuickAction("transfer.html");
  if (!perms.inventory) hideQuickAction("inventory.html");

  // FAB links
  if (!perms.reports) hideFab("report.html");
  if (!perms.addStock) hideFab("addStock.html");
  if (!perms.transfer) hideFab("transfer.html");
  if (!perms.adminPage) hideFab("admin.html");

  // Do NOT remove logout from FAB.

  // Hide FAB if no options left
  if (fab && fabMenu && fabMenu.children.length === 0) {
    fab.style.display = "none";
  }
}


/* =========================
   FAB Toggle
========================= */
if (fab && fabMenu) {
  fab.addEventListener("click", () => {
    const open = fabMenu.classList.toggle("active");
    fabMenu.classList.toggle("hidden", !open);
  });
}


/* =========================
   LOGOUT (Always Active)
========================= */
document.addEventListener("click", e => {
  if (e.target.id === "logoutBtn") {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = "login.html";
  }
});


/* =========================
   KPI, Alerts, Charts
========================= */

/* Date helpers */
function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* Load KPIs */
async function loadKPIs() {
  const todayQ = query(
    collection(db, "injuryReports"),
    where("createdAt", ">=", Timestamp.fromDate(startOfDay()))
  );

  const monthQ = query(
    collection(db, "injuryReports"),
    where("createdAt", ">=", Timestamp.fromDate(startOfMonth()))
  );

  const eventQ = query(
    collection(db, "events"),
    where("active", "==", true)
  );

  const [todaySnap, monthSnap, eventSnap] = await Promise.all([
    getDocs(todayQ),
    getDocs(monthQ),
    getDocs(eventQ)
  ]);

  if (reportsTodayEl) reportsTodayEl.textContent = todaySnap.size;
  if (reportsMonthEl) reportsMonthEl.textContent = monthSnap.size;
  if (activeEventsEl) activeEventsEl.textContent = eventSnap.size;
}

/* Alerts helpers */
function getStatus(qty, par, min) {
  if (qty <= min) return "critical";
  if (qty < par) return "low";
  return "ok";
}

function makeAlert(type, text, id, loc) {
  const p = document.createElement("p");
  p.className = `alert ${type}`;
  p.textContent = text;
  p.onclick = () => {
    window.location.href = `inventory.html?id=${id}&loc=${loc}`;
  };
  return p;
}

/* Inventory alerts */
function loadInventoryAlerts() {
  if (!alertsPanel) return;

  onSnapshot(collection(db, "inventory"), snap => {
    alertsPanel.innerHTML = "";
    let low = 0;
    let critical = 0;
    const frag = document.createDocumentFragment();

    snap.forEach(docSnap => {
      const item = docSnap.data();
      const id = docSnap.id;

      Object.entries(item.locations || {}).forEach(([loc, data]) => {
        const status = getStatus(data.qty, data.par, data.min);

        if (status === "low") {
          low++;
          frag.appendChild(
            makeAlert(
              "low",
              `⚠️ LOW — ${item.displayName} @ ${loc} (${data.qty})`,
              id,
              loc
            )
          );
        }

        if (status === "critical") {
          critical++;
          frag.appendChild(
            makeAlert(
              "critical",
              `🔴 CRITICAL — ${item.displayName} @ ${loc} (${data.qty})`,
              id,
              loc
            )
          );
        }
      });
    });

    if (lowCriticalEl) lowCriticalEl.textContent = low + critical;

    if (low + critical === 0) {
      alertsPanel.innerHTML = `<p class="empty-alert">No alerts at this time.</p>`;
    } else {
      alertsPanel.appendChild(frag);
    }
  });
}

/* Charts */
function loadCharts() {
  if (!window.Chart) return;
  if (!chartCases || !chartInventory) return;

  new Chart(chartCases, {
    type: "line",
    data: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      datasets: [
        {
          label: "Reports",
          data: [12, 18, 21, 25],
          borderColor: "#E63946",
          backgroundColor: "rgba(230,57,70,0.25)",
          fill: true,
          tension: 0.35
        }
      ]
    }
  });

  new Chart(chartInventory, {
    type: "bar",
    data: {
      labels: ["Bandages", "Gloves", "Ice Packs"],
      datasets: [
        {
          label: "Usage",
          data: [34, 22, 51],
          backgroundColor: ["#C62828", "#8E0000", "#D2BBA0"]
        }
      ]
    }
  });
}


/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  applyPermissionVisibility();
  loadKPIs();
  loadInventoryAlerts();
  loadCharts();
});
