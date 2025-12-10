/* =========================================================
   IMPORTS
========================================================= */
import { db } from "./app.js";
import {
  collection, doc, deleteDoc,
  query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


/* =========================================================
   DOM REFERENCES
========================================================= */
const logsContainer = document.getElementById("logsContainer");
const searchInput   = document.getElementById("searchInput");
const caseFilter    = document.getElementById("caseFilter");

const countP1       = document.getElementById("countP1");
const countP2       = document.getElementById("countP2");
const countP3       = document.getElementById("countP3");

const heatmapBox    = document.getElementById("locationHeatmap");
const insightBox    = document.getElementById("insightSummary");
const trendCanvas   = document.getElementById("caseTrendChart");

let logs = [];
let trendChart = null;

const toDate = ts => ts?.toDate?.() || null;


/* =========================================================
   SUMMARY COUNTS
========================================================= */
function updateSummary() {
  countP1.textContent = logs.filter(x => x.caseType === "P1").length;
  countP2.textContent = logs.filter(x => x.caseType === "P2").length;
  countP3.textContent = logs.filter(x => x.caseType === "P3").length;
}


/* =========================================================
   LOCATION HEATMAP
========================================================= */
function updateHeatmap() {
  if (!logs.length) {
    heatmapBox.innerHTML = "No data.";
    return;
  }

  const map = {};
  logs.forEach(r => {
    const loc = r.location || "Unknown";
    map[loc] = (map[loc] || 0) + 1;
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const max = sorted[0][1];

  heatmapBox.innerHTML = sorted.map(([loc, count]) => `
    <div class="heatmap-row">
      <span>${loc}</span>
      <div class="heatmap-bar">
        <div class="heatmap-bar-fill" style="width:${(count / max) * 100}%"></div>
      </div>
      <span>${count}</span>
    </div>
  `).join("");
}


/* =========================================================
   INSIGHT SUMMARY (Hotspot + Peak)
========================================================= */
function updateInsights() {
  if (!logs.length) {
    insightBox.innerHTML = "No insights.";
    return;
  }

  const groups = { P1: [], P2: [], P3: [] };

  logs.forEach(r => groups[r.caseType]?.push(r));

  const summary = type => {
    const list = groups[type];
    if (!list.length) return `<strong>${type}</strong>: 0<br>`;

    const locs = {};
    const hrs  = {};

    list.forEach(r => {
      const loc = r.location || "Unknown";
      locs[loc] = (locs[loc] || 0) + 1;

      const d = toDate(r.createdAt);
      if (d) hrs[d.getHours()] = (hrs[d.getHours()] || 0) + 1;
    });

    const hot  = Object.entries(locs).sort((a,b)=>b[1]-a[1])[0];
    const peak = Object.entries(hrs).sort((a,b)=>b[1]-a[1])[0];

    return `
      <strong>${type}</strong><br>
      Total: ${list.length}<br>
      Hotspot: ${hot[0]} (${hot[1]})<br>
      Peak: ${peak ? peak[0] + ":00" : "—"}<br><br>
    `;
  };

  insightBox.innerHTML =
    summary("P1") + summary("P2") + summary("P3");
}


/* =========================================================
   TREND CHART (Last 4 weeks)
========================================================= */
function updateTrendChart() {
  if (!trendCanvas || !window.Chart) return;

  const weeks = [0, 0, 0, 0];

  logs.forEach(r => {
    const d = toDate(r.createdAt);
    if (!d) return;

    const diffDays = (Date.now() - d.getTime()) / 86400000;
    if (diffDays < 0 || diffDays > 28) return;

    const idx = 3 - Math.floor(diffDays / 7);
    if (idx >= 0 && idx < 4) weeks[idx]++;
  });

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels: ["W1", "W2", "W3", "W4"],
      datasets: [{
        data: weeks,
        borderColor: "#E63946",
        backgroundColor: "rgba(230,57,70,0.15)",
        tension: 0.35,
        borderWidth: 2,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } }
    }
  });
}


/* =========================================================
   FILTER HELPERS
========================================================= */
function filtered() {
  const key = searchInput.value.toLowerCase();
  const type = caseFilter.value;

  return logs.filter(r => {
    const hay = `${r.patientName} ${r.location} ${r.fullText}`.toLowerCase();
    return (type === "all" || r.caseType === type) && hay.includes(key);
  });
}


/* =========================================================
   RENDER LOG CARDS
========================================================= */
function renderLogs() {
  const list = filtered();
  logsContainer.innerHTML = "";

  if (!list.length) {
    logsContainer.innerHTML = "<p>No reports.</p>";
    return;
  }

  list.forEach(r => {
    const d = toDate(r.createdAt);
    const timestamp = d ? d.toLocaleString("en-SG", { hour12: false }) : "—";

    const badgeCls =
      r.caseType === "P1" ? "case-P1" :
      r.caseType === "P2" ? "case-P2" :
      "case-P3";

    logsContainer.innerHTML += `
      <div class="log-card">
        <div class="patient-name">${r.patientName || "Unnamed"}</div>
        <span class="case-badge ${badgeCls}">${r.caseType}</span>

        <div class="meta">${timestamp} • ${r.location || ""}</div>
        <div class="report-preview">${r.fullText || ""}</div>

        <div class="action-row">
          <button class="action-btn copy-btn">Copy</button>
          <button class="action-btn edit-btn">Edit</button>
          <button class="action-btn delete-btn">Delete</button>
        </div>
      </div>
    `;
  });

  const items = filtered();

  document.querySelectorAll(".copy-btn").forEach((b, i) =>
    b.onclick = () => navigator.clipboard.writeText(items[i].fullText)
  );

  document.querySelectorAll(".edit-btn").forEach((b, i) =>
    b.onclick = () => location.href = `report.html?id=${items[i].id}`
  );

  document.querySelectorAll(".delete-btn").forEach((b, i) =>
    b.onclick = async () => {
      if (!confirm("Delete?")) return;
      await deleteDoc(doc(db, "injuryReports", items[i].id));
    }
  );
}


/* =========================================================
   REALTIME FIRESTORE LISTENER
========================================================= */
onSnapshot(
  query(collection(db, "injuryReports"), orderBy("createdAt", "desc")),
  snap => {
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    updateSummary();
    updateHeatmap();
    updateInsights();
    updateTrendChart();
    renderLogs();
  }
);


/* =========================================================
   FILTER EVENTS
========================================================= */
searchInput.oninput = renderLogs;
caseFilter.onchange = renderLogs;
