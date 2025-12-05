import { db } from "./app.js";
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("reportLogs.js loaded");

// DOM Elements
const logsContainer = document.getElementById("logsContainer");
const searchInput = document.getElementById("searchInput");
const caseFilter = document.getElementById("caseFilter");

const countP1 = document.getElementById("countP1");
const countP2 = document.getElementById("countP2");
const countP3 = document.getElementById("countP3");

let allLogs = [];

/* ---------------------------------------
   FETCH ALL REPORTS  
--------------------------------------- */
async function loadLogs() {
  logsContainer.innerHTML = "Loading...";

  try {
    const q = query(collection(db, "injuryReports"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderSummary();
    renderLogs();

  } catch (err) {
    console.error(err);
    logsContainer.innerHTML = "❌ Error loading logs.";
  }
}

/* ---------------------------------------
   SUMMARY COUNTERS  
--------------------------------------- */
function renderSummary() {
  let p1 = 0, p2 = 0, p3 = 0;

  allLogs.forEach(r => {
    if (r.caseType === "P1") p1++;
    if (r.caseType === "P2") p2++;
    if (r.caseType === "P3") p3++;
  });

  countP1.textContent = p1;
  countP2.textContent = p2;
  countP3.textContent = p3;
}

/* ---------------------------------------
   FILTER + SEARCH  
--------------------------------------- */
function filterReports() {
  const keyword = searchInput.value.toLowerCase();
  const caseType = caseFilter.value;

  return allLogs.filter(r => {
    const text =
      `${r.patientName} ${r.fullText} ${r.caseType} ${r.location}`
        .toLowerCase();

    const matchKeyword = text.includes(keyword);
    const matchCase = caseType === "all" || r.caseType === caseType;

    return matchKeyword && matchCase;
  });
}

/* ---------------------------------------
   RENDER ALL CARDS  
--------------------------------------- */
function renderLogs() {
  const filtered = filterReports();

  if (filtered.length === 0) {
    logsContainer.innerHTML = "<p>No reports found.</p>";
    return;
  }

  logsContainer.innerHTML = "";

  filtered.forEach(r => {
    const card = document.createElement("div");
    card.className = "log-card";

    const badgeClass =
      r.caseType === "P1" ? "case-P1" :
      r.caseType === "P2" ? "case-P2" : "case-P3";

    const createdAt = r.createdAt?.toDate?.().toLocaleString("en-SG", { hour12: false }) || "–";

    card.innerHTML = `
      <div class="header-row">
        <div class="patient-name">${r.patientName}</div>
        <div class="case-badge ${badgeClass}">${r.caseType}</div>
      </div>

      <div class="meta">
        ${createdAt}<br>
        ${r.location}
      </div>

      <div class="report-preview">${r.fullText}</div>

      <div class="action-row">
        <button class="action-btn copy-btn">Copy</button>
        <button class="action-btn edit-btn">Edit</button>
        <button class="action-btn delete-btn">Delete</button>
      </div>
    `;

    /* COPY BUTTON */
    card.querySelector(".copy-btn").onclick = () => {
      navigator.clipboard.writeText(r.fullText)
        .then(() => alert("Copied to clipboard!"));
    };

    /* EDIT BUTTON */
    card.querySelector(".edit-btn").onclick = () => {
      window.location.href = `report.html?id=${r.id}`;
    };

    /* DELETE BUTTON */
    card.querySelector(".delete-btn").onclick = async () => {
      if (!confirm("Delete this report?")) return;
      await deleteDoc(doc(db, "injuryReports", r.id));
      alert("Report deleted.");
      loadLogs(); // refresh
    };

    logsContainer.appendChild(card);
  });
}

/* ---------------------------------------
   EVENT LISTENERS  
--------------------------------------- */
searchInput.addEventListener("input", renderLogs);
caseFilter.addEventListener("change", renderLogs);

/* ---------------------------------------
   START  
--------------------------------------- */
loadLogs();
