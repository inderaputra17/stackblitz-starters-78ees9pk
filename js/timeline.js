/* =========================================================
   IMPORTS
========================================================= */
import { db } from "./app.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


/* =========================================================
   DOM REFERENCES
========================================================= */
const container    = document.getElementById("timelineContainer");
const caseFilter   = document.getElementById("timelineCaseFilter");
const sortSelect   = document.getElementById("timelineSort");

let logs = [];
const toDate = ts => ts?.toDate?.() || null;


/* =========================================================
   FILTER + SORT APPLY
========================================================= */
function applyFilters() {
  let list = logs;

  // Filter by case type
  if (caseFilter.value !== "all") {
    list = list.filter(r => r.caseType === caseFilter.value);
  }

  // Sort timeline
  list.sort((a, b) => {
    const da = toDate(a.createdAt)?.getTime() || 0;
    const db = toDate(b.createdAt)?.getTime() || 0;

    return sortSelect.value === "newest" ? (db - da) : (da - db);
  });

  return list;
}


/* =========================================================
   RENDER TIMELINE
========================================================= */
function render() {
  const list = applyFilters();
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = "<p>No incidents.</p>";
    return;
  }

  list.forEach(r => {
    const d = toDate(r.createdAt);
    const t = d ? d.toLocaleString("en-SG", { hour12: false }) : "—";

    const badge =
      r.caseType === "P1" ? "badge-P1" :
      r.caseType === "P2" ? "badge-P2" :
      "badge-P3";

    container.innerHTML += `
      <div class="timeline-card-item">
        <span class="timeline-badge ${badge}">${r.caseType}</span>
        <span class="timeline-time">${t}</span>
        <span class="timeline-title">${r.patientName || "Unnamed"}</span>
        <span class="timeline-location">${r.location || "Unknown"}</span>
        <span class="timeline-desc">${r.fullText || ""}</span>
      </div>
    `;
  });
}


/* =========================================================
   REALTIME LISTENER (Firestore Live Sync)
========================================================= */
onSnapshot(
  query(collection(db, "injuryReports"), orderBy("createdAt", "desc")),
  snap => {
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }
);


/* =========================================================
   FILTER + SORT LISTENERS
========================================================= */
caseFilter.onchange = render;
sortSelect.onchange = render;
