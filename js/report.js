import { db } from "./app.js";
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Same discharge text logic as preview
function dischargeText() {
  const method = document.getElementById("discharge").value;

  if (method === "self") {
    return "Self-discharged and continued with activity";
  }

  if (method === "ambulance") {
    return `Sent by Alpha ${document.getElementById("alphaNo").value} to ${document.getElementById("hospital").value}, handed over to ${document.getElementById("paramedic").value}`;
  }

  if (method === "other") {
    return document.getElementById("dischargeOther").value;
  }

  return "";
}

// Reuse the same duration logic as HTML (simplified)
function parseTime(str) {
  if (!str) return null;
  const clean = str.trim();
  if (!/^\d{3,4}$/.test(clean)) return null;
  const padded = clean.padStart(4, "0");
  const h = parseInt(padded.slice(0, 2), 10);
  const m = parseInt(padded.slice(2), 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function getDurationText() {
  const timeIn = document.getElementById("timeIn").value;
  const timeOut = document.getElementById("timeOut").value;
  const tIn = parseTime(timeIn);
  const tOut = parseTime(timeOut);
  if (tIn == null || tOut == null) return "";

  let diff = tOut - tIn;
  if (diff < 0) diff += 24 * 60;

  if (diff === 0) return "0 minutes";

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  const parts = [];
  if (hours) parts.push(hours + " hour" + (hours !== 1 ? "s" : ""));
  if (mins) parts.push(mins + " minute" + (mins !== 1 ? "s" : ""));
  return parts.join(" ");
}

document.getElementById("injuryForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullReport = document.getElementById("previewText").textContent;

  const reportData = {
    timeIn: document.getElementById("timeIn").value,
    timeOut: document.getElementById("timeOut").value,
    duration: getDurationText(),   // ✅ new field
    patientName: document.getElementById("patientName").value,
    gender: document.getElementById("gender").value,
    age: document.getElementById("age").value,
    contact: document.getElementById("contact").value,
    caseType: document.getElementById("caseType").value,
    location: document.getElementById("location").value,
    moi: document.getElementById("moi").value,
    treatment: document.getElementById("treatment").value,
    discharge: dischargeText(),    // full discharge text
    alphaNo: document.getElementById("alphaNo").value,
    hospital: document.getElementById("hospital").value,
    paramedic: document.getElementById("paramedic").value,
    fullText: fullReport,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "injuryReports"), reportData);

    alert("✔ Report saved!");
    document.getElementById("injuryForm").reset();

    // optional: reload page so wizard resets properly
    window.location.reload();

  } catch (err) {
    console.error(err);
    alert("❌ Error saving report");
  }
});
