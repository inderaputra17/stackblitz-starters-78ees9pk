import { db } from "./app.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("inventoryLogs.js loaded");

const summaryHead = document.getElementById("summaryHead");
const summaryBody = document.getElementById("summaryBody");
const auditBody = document.getElementById("auditBody");
const auditSummaryBody = document.getElementById("auditSummaryBody");

let allItems = [];
let logs = [];

/* -------------------------------------------------------
   FORMAT DATE/TIME
-------------------------------------------------------- */
function fmt(ts) {
  if (!ts) return "-";
  try {
    return ts.toDate().toLocaleString("en-SG", { hour12: false });
  } catch {
    return "-";
  }
}

/* -------------------------------------------------------
   CURRENT INVENTORY SNAPSHOT (from inventory collection)
-------------------------------------------------------- */
function buildInventorySummary() {
  if (!allItems.length) {
    summaryHead.innerHTML = "<tr><th>Item</th></tr>";
    summaryBody.innerHTML =
      `<tr><td>No inventory found in <span class="pill">inventory</span> collection.</td></tr>`;
    return;
  }

  const locations = new Set();

  allItems.forEach(item => {
    Object.keys(item.locations || {}).forEach(loc => locations.add(loc));
  });

  const locList = Array.from(locations).sort();

  // Header
  let headHTML = "<tr><th>Item</th>";
  locList.forEach(loc => headHTML += `<th class="number-cell">${loc}</th>`);
  headHTML += `<th class="number-cell">Total</th></tr>`;
  summaryHead.innerHTML = headHTML;

  // Body
  const sortedItems = [...allItems].sort((a, b) =>
    (a.displayName || "").localeCompare(b.displayName || "")
  );

  let bodyHTML = "";

  sortedItems.forEach(item => {
    let total = 0;
    let row = `<tr><td><strong>${item.displayName || "-"}</strong></td>`;

    locList.forEach(loc => {
      const qty = item.locations?.[loc]?.qty ?? 0;
      total += qty;
      row += `<td class="number-cell">${qty}</td>`;
    });

    row += `<td class="number-cell"><strong>${total}</strong></td></tr>`;
    bodyHTML += row;
  });

  summaryBody.innerHTML = bodyHTML;
}

/* -------------------------------------------------------
   AUDIT SUMMARY (aggregated from inventoryLogs)
   Per item + location: totalIn, totalOut, net
-------------------------------------------------------- */
function buildAuditSummary() {
  if (!logs.length) {
    auditSummaryBody.innerHTML =
      `<tr><td colspan="5">No audit data – inventoryLogs is empty.</td></tr>`;
    return;
  }

  // Map key: `${item}||${location}`
  const summaryMap = new Map();

  function addMovement(itemName, location, delta) {
    if (!itemName || !location) return;
    const key = `${itemName}||${location}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        item: itemName,
        location,
        in: 0,
        out: 0,
        net: 0
      });
    }
    const entry = summaryMap.get(key);
    if (delta > 0) entry.in += delta;
    if (delta < 0) entry.out += Math.abs(delta);
    entry.net += delta;
  }

  logs.forEach(log => {
    const type = log.type;
    const qty = Number(log.qty || 0);
    const itemName = log.item || "-";

    if (!qty && type !== "delete" && type?.startsWith("update-")) {
      // Level updates or actions without quantity → ignore for movement
      return;
    }

    if (type === "transfer") {
      // Apply negative at from, positive at to
      if (log.from) addMovement(itemName, log.from, -qty);
      if (log.to)   addMovement(itemName, log.to, qty);
    } else {
      // For increase/decrease we logged signed qty already
      const location = log.location || "-";
      addMovement(itemName, location, qty);
    }
  });

  if (!summaryMap.size) {
    auditSummaryBody.innerHTML =
      `<tr><td colspan="5">No quantity movements recorded yet.</td></tr>`;
    return;
  }

  const rows = Array.from(summaryMap.values())
    .sort((a, b) => {
      const itemCmp = a.item.localeCompare(b.item);
      if (itemCmp !== 0) return itemCmp;
      return a.location.localeCompare(b.location);
    });

  let html = "";
  rows.forEach(row => {
    let netClass = "net-zero";
    if (row.net > 0) netClass = "net-positive";
    else if (row.net < 0) netClass = "net-negative";

    html += `
      <tr>
        <td>${row.item}</td>
        <td>${row.location}</td>
        <td class="number-cell">${row.in}</td>
        <td class="number-cell">${row.out}</td>
        <td class="number-cell ${netClass}">${row.net}</td>
      </tr>
    `;
  });

  auditSummaryBody.innerHTML = html;
}

/* -------------------------------------------------------
   AUDIT TRAIL TABLE (detailed logs)
-------------------------------------------------------- */
function renderLogs() {
  if (!logs.length) {
    auditBody.innerHTML = `<tr><td colspan="6">No logs available.</td></tr>`;
    return;
  }

  let html = "";

  logs.forEach(log => {
    const locationText =
      log.type === "transfer"
        ? `${log.from || "-"} → ${log.to || "-"}`
        : (log.location || "-");

    let badgeClass = "";
    if (log.type === "increase") badgeClass = "badge-increase";
    else if (log.type === "decrease") badgeClass = "badge-decrease";
    else if (log.type === "transfer") badgeClass = "badge-transfer";
    else if (log.type?.startsWith("update-")) badgeClass = "badge-level";
    else if (log.type === "delete") badgeClass = "badge-delete";

    const typeLabel = log.type || "–";

    const qty = Number(log.qty || 0);
    const qtyDisplay = qty > 0 ? `+${qty}` : qty;

    html += `
      <tr>
        <td class="timestamp">${fmt(log.timestamp)}</td>
        <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
        <td>${log.item ?? "-"}</td>
        <td>${locationText}</td>
        <td class="number-cell">${qtyDisplay}</td>
        <td>${log.reason ?? "-"}</td>
      </tr>
    `;
  });

  auditBody.innerHTML = html;
}

/* -------------------------------------------------------
   SNAPSHOT LISTENERS
-------------------------------------------------------- */

// Live inventory snapshot (current quantities)
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildInventorySummary();
});

// Audit logs (for both trail + audit summary)
onSnapshot(
  query(collection(db, "inventoryLogs"), orderBy("timestamp", "desc")),
  snap => {
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLogs();
    buildAuditSummary();
  }
);
