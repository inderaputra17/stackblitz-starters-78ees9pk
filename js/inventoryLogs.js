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

let allItems = [];
let logs = [];

/*--------------------------------------------------------
  FORMAT DATE/TIME
--------------------------------------------------------*/
function fmt(ts) {
  if (!ts) return "-";
  return ts.toDate().toLocaleString("en-SG", { hour12: false });
}

/*--------------------------------------------------------
  BUILD SUMMARY TABLE (Item × Location)
--------------------------------------------------------*/
function buildSummary() {
  if (!allItems.length) {
    summaryHead.innerHTML = "";
    summaryBody.innerHTML = "<tr><td>No inventory found</td></tr>";
    return;
  }

  const locations = new Set();

  allItems.forEach(item => {
    Object.keys(item.locations || {}).forEach(loc => locations.add(loc));
  });

  const locList = Array.from(locations);

  // Header
  let head = "<tr><th>Item</th>";
  locList.forEach(loc => head += `<th>${loc}</th>`);
  head += "<th>Total</th></tr>";
  summaryHead.innerHTML = head;

  // Body
  let bodyHTML = "";

  const sortedItems = [...allItems].sort((a,b) =>
    a.displayName.localeCompare(b.displayName)
  );

  sortedItems.forEach(item => {
    let total = 0;
    let row = `<tr><td><strong>${item.displayName}</strong></td>`;

    locList.forEach(loc => {
      const qty = item.locations?.[loc]?.qty ?? 0;
      total += qty;
      row += `<td>${qty}</td>`;
    });

    row += `<td><strong>${total}</strong></td></tr>`;

    bodyHTML += row;
  });

  summaryBody.innerHTML = bodyHTML;
}

/*--------------------------------------------------------
  BUILD AUDIT LOG TABLE
--------------------------------------------------------*/
function renderLogs() {
  if (!logs.length) {
    auditBody.innerHTML = `<tr><td colspan="6">No logs available.</td></tr>`;
    return;
  }

  let html = "";

  logs.forEach(log => {
    const locationText =
      log.type === "transfer"
        ? `${log.from} → ${log.to}`
        : (log.location || "-");

    html += `
      <tr>
        <td class="timestamp">${fmt(log.timestamp)}</td>
        <td>${log.type}</td>
        <td>${log.item ?? "-"}</td>
        <td>${locationText}</td>
        <td>${log.qty > 0 ? "+" + log.qty : log.qty}</td>
        <td>${log.reason ?? "-"}</td>
      </tr>
    `;
  });

  auditBody.innerHTML = html;
}

/*--------------------------------------------------------
  LISTEN TO INVENTORY SNAPSHOT (summary)
--------------------------------------------------------*/
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  buildSummary();
});

/*--------------------------------------------------------
  LISTEN TO AUDIT LOGS
--------------------------------------------------------*/
onSnapshot(
  query(collection(db, "inventoryLogs"), orderBy("timestamp", "desc")),
  snap => {
    logs = snap.docs.map(d => d.data());
    renderLogs();
  }
);
