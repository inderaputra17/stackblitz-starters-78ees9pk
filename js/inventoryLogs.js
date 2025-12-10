/* ============================================================
   INVENTORY LOGS — JS (Clean, Structured, No Breaking Changes)
============================================================ */

import { db } from "./app.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("inventoryLogs.js loaded");


/* ============================================================
   DOM REFERENCES
============================================================ */
const kpiTotalItemsEl     = document.getElementById("kpiTotalItems");
const kpiCriticalEl       = document.getElementById("kpiCritical");
const kpiLowEl            = document.getElementById("kpiLow");
const kpiOverEl           = document.getElementById("kpiOver");

const criticalListEl      = document.getElementById("criticalList");
const activitySummaryEl   = document.getElementById("activitySummary");
const locationSummaryBody = document.getElementById("locationSummaryBody");

const auditBody           = document.getElementById("auditBody");

const searchInput         = document.getElementById("searchInput");
const typeFilter          = document.getElementById("typeFilter");
const locationFilter      = document.getElementById("locationFilter");
const itemFilter          = document.getElementById("itemFilter");


/* ============================================================
   STATE
============================================================ */
let allItems = [];
let allLogs  = [];


/* ============================================================
   LOG NORMALIZATION
============================================================ */
function normalizeLog(raw) {
  return {
    type: raw.type || "",
    item: raw.itemName || raw.item || "-",
    qty: Number(raw.qtyChange ?? raw.qty ?? 0),
    newQty: Number(raw.newQty ?? 0),
    from: raw.fromLocation || raw.from || "",
    to: raw.toLocation || raw.to || "",
    location: raw.location || raw.fromLocation || "",
    reason: raw.meta?.message || raw.reason || "",
    timestamp: raw.timestamp
  };
}


/* ============================================================
   STOCK STATUS CLASSIFIER
============================================================ */
function getStatus(qty, par, min, max) {
  qty = Number(qty);
  par = Number(par ?? 999999);
  min = Number(min ?? 0);
  max = Number(max ?? 999999);

  if (qty <= min) return { label: "Critical", cls: "critical" };
  if (qty < par)  return { label: "Low", cls: "low" };
  if (qty > max)  return { label: "Overstock", cls: "overstock" };
  return { label: "OK", cls: "ok" };
}


/* ============================================================
   KPI SUMMARY BUILDER
============================================================ */
function buildKPIs() {
  if (!allItems.length) {
    kpiTotalItemsEl.textContent = "0";
    kpiCriticalEl.textContent   = "0";
    kpiLowEl.textContent        = "0";
    kpiOverEl.textContent       = "0";
    return;
  }

  let total = allItems.length;
  let critical = 0, low = 0, over = 0;

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(loc => {
      const d = locs[loc];
      const st = getStatus(
        d.qty,
        d.par ?? item.defaultPar,
        d.min ?? item.defaultMin,
        d.max ?? item.defaultMax
      );

      if (st.cls === "critical") critical++;
      else if (st.cls === "low") low++;
      else if (st.cls === "overstock") over++;
    });
  });

  kpiTotalItemsEl.textContent = total;
  kpiCriticalEl.textContent   = critical;
  kpiLowEl.textContent        = low;
  kpiOverEl.textContent       = over;
}


/* ============================================================
   CRITICAL / LOW ITEM LIST
============================================================ */
function buildCriticalList() {
  const rows = [];

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(loc => {
      const d = locs[loc];
      const st = getStatus(
        d.qty,
        d.par ?? item.defaultPar,
        d.min ?? item.defaultMin,
        d.max ?? item.defaultMax
      );

      if (st.cls === "critical" || st.cls === "low") {
        rows.push({
          name: item.displayName,
          location: loc,
          qty: Number(d.qty ?? 0),
          status: st
        });
      }
    });
  });

  if (!rows.length) {
    criticalListEl.innerHTML = `<div>✅ No critical or low stock items.</div>`;
    return;
  }

  rows.sort((a, b) => {
    const sev = { critical: 0, low: 1 };
    return sev[a.status.cls] !== sev[b.status.cls]
      ? sev[a.status.cls] - sev[b.status.cls]
      : a.qty - b.qty;
  });

  criticalListEl.innerHTML = rows
    .slice(0, 10)
    .map(r => `
      <div class="critical-item">
        <span class="name">${r.name}</span>
        <span class="loc">@ ${r.location}</span>
        <span class="status-chip ${r.status.cls}">${r.status.label}</span>
        <span>(${r.qty})</span>
      </div>
    `)
    .join("");
}


/* ============================================================
   LOCATION SUMMARY TABLE
============================================================ */
function buildLocationSummary() {
  const locMap = {};

  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(loc => {
      const d = locs[loc];
      if (!locMap[loc]) {
        locMap[loc] = { items: 0, low: 0, critical: 0 };
      }

      locMap[loc].items++;

      const st = getStatus(
        d.qty,
        d.par ?? item.defaultPar,
        d.min ?? item.defaultMin,
        d.max ?? item.defaultMax
      );

      if (st.cls === "low") locMap[loc].low++;
      if (st.cls === "critical") locMap[loc].critical++;
    });
  });

  const locNames = Object.keys(locMap);
  if (!locNames.length) {
    locationSummaryBody.innerHTML =
      `<tr><td colspan="4">No locations found.</td></tr>`;
    return;
  }

  locationSummaryBody.innerHTML = locNames
    .sort()
    .map(loc => `
      <tr>
        <td>${loc}</td>
        <td>${locMap[loc].items}</td>
        <td>${locMap[loc].low}</td>
        <td>${locMap[loc].critical}</td>
      </tr>
    `)
    .join("");
}


/* ============================================================
   ACTIVITY SUMMARY (Last 7 Days)
============================================================ */
function buildActivitySummary() {
  const now = Date.now();
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;

  let add = 0, dec = 0, trans = 0, del = 0;

  allLogs.forEach(l => {
    const log = normalizeLog(l);
    const ts = log.timestamp?.toDate?.();
    if (!ts || ts.getTime() < cutoff) return;

    const t = (log.type || "").toLowerCase();
    if (t.includes("transfer")) trans++;
    else if (t.includes("delete")) del++;
    else if (t.includes("minus") || t.includes("dec")) dec++;
    else if (t.includes("add") || t.includes("top")) add++;
  });

  activitySummaryEl.innerHTML = `
    <div class="activity-row"><span>Add / Top-up</span><span>${add}</span></div>
    <div class="activity-row"><span>Decrease</span><span>${dec}</span></div>
    <div class="activity-row"><span>Transfers</span><span>${trans}</span></div>
    <div class="activity-row"><span>Deletes</span><span>${del}</span></div>
  `;
}


/* ============================================================
   LOG TYPE CLASSIFIER
============================================================ */
function classifyType(t) {
  t = (t || "").toLowerCase();
  if (t.includes("transfer")) return "transfer";
  if (t.includes("delete")) return "delete";
  if (t.includes("minus") || t.includes("dec")) return "dec";
  if (t.includes("add") || t.includes("increase") || t.includes("top"))
    return "add";
  return "other";
}

function typeLabelClass(raw) {
  const type = classifyType(raw);
  switch (type) {
    case "add":      return { label: "Add / Top-up", cls: "pill-add" };
    case "dec":      return { label: "Decrease", cls: "pill-dec" };
    case "transfer": return { label: "Transfer", cls: "pill-trans" };
    case "delete":   return { label: "Delete", cls: "pill-del" };
    default:         return { label: raw || "Other", cls: "pill-other" };
  }
}


/* ============================================================
   FILTER SELECT POPULATION
============================================================ */
function buildLogFilters() {
  const locSet = new Set();
  const itemSet = new Set();

  allLogs.forEach(raw => {
    const log = normalizeLog(raw);

    if (log.location) locSet.add(log.location);
    if (log.from) locSet.add(log.from);
    if (log.to) locSet.add(log.to);

    if (log.item) itemSet.add(log.item);
  });

  locationFilter.innerHTML = `<option value="">All Locations</option>`;
  [...locSet].sort().forEach(loc => {
    locationFilter.innerHTML += `<option value="${loc}">${loc}</option>`;
  });

  itemFilter.innerHTML = `<option value="">All Items</option>`;
  [...itemSet].sort().forEach(item => {
    itemFilter.innerHTML += `<option value="${item}">${item}</option>`;
  });
}


/* ============================================================
   TIMESTAMP FORMATTER
============================================================ */
function fmtTimestamp(ts) {
  try {
    return ts?.toDate?.().toLocaleString("en-SG", { hour12: false }) || "-";
  } catch {
    return "-";
  }
}


/* ============================================================
   LOG TABLE RENDERER
============================================================ */
function renderLogs() {
  if (!allLogs.length) {
    auditBody.innerHTML = `<tr><td colspan="6">No logs yet.</td></tr>`;
    return;
  }

  const search = searchInput.value.toLowerCase();
  const typeF  = typeFilter.value;
  const locF   = locationFilter.value;
  const itemF  = itemFilter.value;

  const filtered = allLogs
    .map(normalizeLog)
    .filter(log => {
      const t = classifyType(log.type);

      if (typeF && t !== typeF) return false;
      if (itemF && log.item !== itemF) return false;
      if (locF && ![log.location, log.from, log.to].includes(locF))
        return false;

      if (search) {
        const hay = [
          log.item,
          log.location,
          log.from,
          log.to,
          log.reason,
          log.type
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }

      return true;
    });

  if (!filtered.length) {
    auditBody.innerHTML = `<tr><td colspan="6">No logs match your filters.</td></tr>`;
    return;
  }

  auditBody.innerHTML = filtered
    .map((log, i) => {
      const info = typeLabelClass(log.type);
      const ts = fmtTimestamp(log.timestamp);
      const route =
        classifyType(log.type) === "transfer"
          ? `${log.from || "-"} → ${log.to || "-"}`
          : log.location || "-";

      const qtyDisplay = log.qty > 0 ? `+${log.qty}` : `${log.qty}`;
      const key = `row-${i}`;

      return `
        <tr>
          <td>${ts}</td>
          <td><span class="type-pill ${info.cls}">${info.label}</span></td>
          <td>${log.item}</td>
          <td>${route}</td>
          <td>${qtyDisplay}</td>
          <td>
            <button class="details-toggle" data-key="${key}" aria-expanded="false">
              Details
            </button>
          </td>
        </tr>

        <tr class="details-row" data-details="${key}" style="display:none;">
          <td colspan="6">
            <div><strong>Raw Type:</strong> ${log.type}</div>
            <div><strong>Reason:</strong> ${log.reason || "-"}</div>
            <div><strong>From:</strong> ${log.from || "-"}</div>
            <div><strong>To:</strong> ${log.to || "-"}</div>
            <div><strong>Location:</strong> ${log.location || "-"}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Toggle expand/collapse
  document.querySelectorAll(".details-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.querySelector(
        `.details-row[data-details="${btn.dataset.key}"]`
      );

      const show = target.style.display === "none";
      target.style.display = show ? "table-row" : "none";
      btn.setAttribute("aria-expanded", show);
    });
  });
}


/* ============================================================
   FILTER CHANGE LISTENERS
============================================================ */
[searchInput, typeFilter, locationFilter, itemFilter].forEach(el => {
  el.addEventListener("input", renderLogs);
  el.addEventListener("change", renderLogs);
});


/* ============================================================
   FIRESTORE LIVE LISTENERS
============================================================ */

// Inventory changes → rebuild KPIs + summaries
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildKPIs();
  buildCriticalList();
  buildLocationSummary();
});

// Log stream → rebuild log table + filters + activity overview
onSnapshot(
  query(collection(db, "inventoryLogs"), orderBy("timestamp", "desc")),
  snap => {
    allLogs = snap.docs.map(d => d.data());
    buildActivitySummary();
    buildLogFilters();
    renderLogs();
  }
);


/* ============================================================
   END OF FILE
============================================================ */
