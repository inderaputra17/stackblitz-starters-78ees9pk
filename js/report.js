import { db } from "./app.js";
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Build discharge text same as preview
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

document.getElementById("injuryForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullReport = document.getElementById("previewText").textContent;

  const reportData = {
    timeIn: document.getElementById("timeIn").value,
    timeOut: document.getElementById("timeOut").value,
    patientName: document.getElementById("patientName").value,
    gender: document.getElementById("gender").value,
    age: document.getElementById("age").value,
    contact: document.getElementById("contact").value,
    caseType: document.getElementById("caseType").value,
    location: document.getElementById("location").value,
    moi: document.getElementById("moi").value,
    treatment: document.getElementById("treatment").value,

    // FIXED ✔ Now saving proper discharge text
    discharge: dischargeText(),

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

  } catch (err) {
    console.error(err);
    alert("❌ Error saving report");
  }
});
