import { db } from "./app.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("inventoryLogs.js loaded");

// DOM refs – KPIs
const kpiTotalItemsEl = document.getElementById("kpiTotalItems");
const kpiCriticalEl = document.getElementById("kpiCritical");
const kpiLowEl = document.getElementById("kpiLow");
const kpiOverEl = document.getElementById("kpiOver");

// DOM refs – critical/low list
const criticalListEl = document.getElementById("criticalList");

// DOM refs – activity summary
const activitySummaryEl = document.getElementById("activitySummary");

// DOM refs – location summary
const locationSummaryBody = document.getElementById("locationSummaryBody");

// DOM refs – logs + filters
const auditBody = document.getElementById("auditBody");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const locationFilter = document.getElementById("locationFilter");
const itemFilter = document.getElementById("itemFilter");

// State
let allItems = [];
let allLogs = [];

/* ---------------------- Status helper ---------------------- */
function getStatus(qty, par, min, max) {
  qty = Number(qty);
  par = Number(par ?? 0);
  min = Number(min ?? 0);
  max = Number(max ?? 9999);

  if (qty <= min) return { label: "Critical", cls: "critical" };
  if (qty < par) return { label: "Low", cls: "low" };
  if (qty > max) return { label: "Overstock", cls: "overstock" };
  return { label: "OK", cls: "ok" };
}

/* ---------------------- Build summary KPIs ---------------------- */
function buildKPIs() {
  if (!allItems.length) {
    kpiTotalItemsEl.textContent = "0";
    kpiCriticalEl.textContent = "0";
    kpiLowEl.textContent = "0";
    kpiOverEl.textContent = "0";
    return;
  }

  let totalItems = allItems.length;
  let criticalCount = 0;
  let lowCount = 0;
  let overCount = 0;

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(locKey => {
      const data = locs[locKey];
      const st = getStatus(
        data.qty || 0,
        data.par ?? item.defaultPar,
        data.min ?? item.defaultMin,
        data.max ?? item.defaultMax
      );
      if (st.cls === "critical") criticalCount++;
      else if (st.cls === "low") lowCount++;
      else if (st.cls === "overstock") overCount++;
    });
  });

  kpiTotalItemsEl.textContent = String(totalItems);
  kpiCriticalEl.textContent = String(criticalCount);
  kpiLowEl.textContent = String(lowCount);
  kpiOverEl.textContent = String(overCount);
}

/* ---------------------- Critical / Low list ---------------------- */
function buildCriticalList() {
  const rows = [];

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(locKey => {
      const data = locs[locKey];
      const st = getStatus(
        data.qty || 0,
        data.par ?? item.defaultPar,
        data.min ?? item.defaultMin,
        data.max ?? item.defaultMax
      );

      if (st.cls === "critical" || st.cls === "low") {
        rows.push({
          item: item.displayName,
          location: locKey,
          qty: data.qty || 0,
          status: st
        });
      }
    });
  });

  if (!rows.length) {
    criticalListEl.innerHTML = `<div>✅ No critical or low stock items.</div>`;
    return;
  }

  // Sort by severity then qty ascending
  rows.sort((a, b) => {
    const severities = { critical: 0, low: 1 };
    const da = severities[a.status.cls];
    const db = severities[b.status.cls];
    if (da !== db) return da - db;
    return a.qty - b.qty;
  });

  // Limit to top 8
  const topRows = rows.slice(0, 8);

  criticalListEl.innerHTML = topRows.map(r => `
    <div class="critical-item">
      <span class="name">${r.item}</span>
      <span class="loc"> @ ${r.location}</span>
      <span class="status-chip ${r.status.cls}">${r.status.label}</span>
      <span style="margin-left:4px;">(${r.qty})</span>
    </div>
  `).join("");
}

/* ---------------------- Location summary ---------------------- */
function buildLocationSummary() {
  const locMap = {}; // locName -> { items, low, critical }

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(locKey => {
      const data = locs[locKey];
      const qty = Number(data.qty || 0);
      if (!locMap[locKey]) {
        locMap[locKey] = { items: 0, low: 0, critical: 0 };
      }

      if (qty > 0) {
        locMap[locKey].items += 1;
      }

      const st = getStatus(
        qty,
        data.par ?? item.defaultPar,
        data.min ?? item.defaultMin,
        data.max ?? item.defaultMax
      );
      if (st.cls === "low") locMap[locKey].low += 1;
      else if (st.cls === "critical") locMap[locKey].critical += 1;
    });
  });

  const locNames = Object.keys(locMap);
  if (!locNames.length) {
    locationSummaryBody.innerHTML = `<tr><td colspan="4">No locations found.</td></tr>`;
    return;
  }

  locNames.sort();

  locationSummaryBody.innerHTML = locNames.map(loc => {
    const row = locMap[loc];
    return `
      <tr>
        <td>${loc}</td>
        <td>${row.items}</td>
        <td>${row.low}</td>
        <td>${row.critical}</td>
      </tr>
    `;
  }).join("");
}

/* ---------------------- Activity snapshot (last 7 days) ---------------------- */
function buildActivitySummary() {
  if (!allLogs.length) {
    activitySummaryEl.innerHTML = `<div>No recent activity.</div>`;
    return;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let addCount = 0;
  let decCount = 0;
  let transferCount = 0;
  let deleteCount = 0;

  allLogs.forEach(log => {
    const ts = log.timestamp;
    if (!ts || !ts.toDate) return;
    const dt = ts.toDate();
    if (dt < sevenDaysAgo) return;

    const type = (log.type || "").toLowerCase();

    if (type.includes("transfer")) {
      transferCount++;
    } else if (
      type.includes("delete")
    ) {
      deleteCount++;
    } else if (
      type.includes("decrease") ||
      type.includes("minus") ||
      (type === "dec")
    ) {
      decCount++;
    } else if (
      type.includes("add") ||
      type.includes("increase") ||
      type.includes("topup") ||
      type.includes("add-new-item")
    ) {
      addCount++;
    }
  });

  activitySummaryEl.innerHTML = `
    <div class="activity-row">
      <span class="activity-label">Add / Top-up:</span>
      <span class="activity-count">${addCount}</span>
    </div>
    <div class="activity-row">
      <span class="activity-label">Decrease / Usage:</span>
      <span class="activity-count">${decCount}</span>
    </div>
    <div class="activity-row">
      <span class="activity-label">Transfers:</span>
      <span class="activity-count">${transferCount}</span>
    </div>
    <div class="activity-row">
      <span class="activity-label">Deletes / Removals:</span>
      <span class="activity-count">${deleteCount}</span>
    </div>
  `;
}

/* ---------------------- Helpers for logs rendering ---------------------- */
function fmtTimestamp(ts) {
  if (!ts || !ts.toDate) return "-";
  return ts.toDate().toLocaleString("en-SG", { hour12: false });
}

function classifyType(t) {
  const type = (t || "").toLowerCase();
  if (type.includes("transfer")) return "transfer";
  if (type.includes("delete")) return "delete";
  if (type.includes("decrease") || type.includes("minus") || type === "dec") return "dec";
  if (type.includes("add") || type.includes("increase") || type.includes("topup") || type.includes("add-new-item")) return "add";
  return "other";
}

function typeLabelAndClass(typeRaw) {
  const group = classifyType(typeRaw);
  switch (group) {
    case "add":
      return { label: "Add / Top-up", cls: "pill-add" };
    case "dec":
      return { label: "Decrease", cls: "pill-dec" };
    case "transfer":
      return { label: "Transfer", cls: "pill-trans" };
    case "delete":
      return { label: "Delete", cls: "pill-del" };
    default:
      return { label: typeRaw || "Other", cls: "pill-other" };
  }
}

/* ---------------------- Build filters (item & location) ---------------------- */
function buildLogFilters() {
  const locSet = new Set();
  const itemSet = new Set();

  allLogs.forEach(log => {
    if (log.location) locSet.add(log.location);
    if (log.from) locSet.add(log.from);
    if (log.to) locSet.add(log.to);
    if (log.item) itemSet.add(log.item);
  });

  // Location filter
  locationFilter.innerHTML = `<option value="">All locations</option>`;
  [...locSet].sort().forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationFilter.appendChild(opt);
  });

  // Item filter
  itemFilter.innerHTML = `<option value="">All items</option>`;
  [...itemSet].sort().forEach(it => {
    const opt = document.createElement("option");
    opt.value = it;
    opt.textContent = it;
    itemFilter.appendChild(opt);
  });
}

/* ---------------------- Render logs table with filters ---------------------- */
function renderLogs() {
  if (!allLogs.length) {
    auditBody.innerHTML = `<tr><td colspan="6">No logs available.</td></tr>`;
    return;
  }

  const search = (searchInput.value || "").toLowerCase();
  const typeF = typeFilter.value; // add / dec / transfer / delete / other / ""
  const locF = locationFilter.value;
  const itemF = itemFilter.value;

  let filtered = allLogs.slice();

  filtered = filtered.filter(log => {
    const group = classifyType(log.type);
    if (typeF && group !== typeF) return false;

    if (locF) {
      const locs = [
        log.location || "",
        log.from || "",
        log.to || ""
      ];
      if (!locs.some(l => l === locF)) return false;
    }

    if (itemF && log.item !== itemF) return false;

    if (search) {
      const s = search;
      const combined = [
        log.item || "",
        log.location || "",
        log.from || "",
        log.to || "",
        log.reason || "",
        log.type || ""
      ].join(" ").toLowerCase();
      if (!combined.includes(s)) return false;
    }

    return true;
  });

  if (!filtered.length) {
    auditBody.innerHTML = `<tr><td colspan="6">No logs match your filters.</td></tr>`;
    return;
  }

  let html = "";
  filtered.forEach((log, idx) => {
    const tInfo = typeLabelAndClass(log.type);
    const tsStr = fmtTimestamp(log.timestamp);

    let routeText = "-";
    if (classifyType(log.type) === "transfer") {
      routeText = `${log.from || "-"} → ${log.to || "-"}`;
    } else {
      routeText = log.location || "-";
    }

    const qtyVal = Number(log.qty || 0);
    const qtyDisplay = qtyVal > 0 ? `+${qtyVal}` : `${qtyVal}`;

    const rowKey = `log-${idx}`;

    html += `
      <tr>
        <td class="timestamp">${tsStr}</td>
        <td class="action-cell">
          <span class="type-pill ${tInfo.cls}">${tInfo.label}</span>
        </td>
        <td>${log.item || "-"}</td>
        <td>${routeText}</td>
        <td>${qtyDisplay}</td>
        <td>
          <span class="details-toggle" data-row="${rowKey}">Details</span>
        </td>
      </tr>
      <tr class="details-row" data-details="${rowKey}" style="display:none;">
        <td colspan="6">
          <div><strong>Raw type:</strong> ${log.type || "-"}</div>
          <div><strong>Reason:</strong> ${log.reason || "-"}</div>
          <div><strong>From:</strong> ${log.from || "-"}</div>
          <div><strong>To:</strong> ${log.to || "-"}</div>
          <div><strong>Location:</strong> ${log.location || "-"}</div>
        </td>
      </tr>
    `;
  });

  auditBody.innerHTML = html;

  // Attach detail toggles
  auditBody.querySelectorAll(".details-toggle").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.row;
      const row = auditBody.querySelector(`.details-row[data-details="${key}"]`);
      if (!row) return;
      row.style.display = (row.style.display === "none" || row.style.display === "") ? "table-row" : "none";
    });
  });
}

/* ---------------------- Listeners for filters ---------------------- */
[searchInput, typeFilter, locationFilter, itemFilter].forEach(el => {
  el.addEventListener("input", renderLogs);
  el.addEventListener("change", renderLogs);
});

/* ---------------------- FIRESTORE LISTENERS ---------------------- */

// Inventory snapshot (for summary & location overview)
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildKPIs();
  buildCriticalList();
  buildLocationSummary();
});

// Logs snapshot (for activity + audit trail)
onSnapshot(
  query(collection(db, "inventoryLogs"), orderBy("timestamp", "desc")),
  snap => {
    allLogs = snap.docs.map(d => d.data());
    buildActivitySummary();
    buildLogFilters();
    renderLogs();
  }
);
