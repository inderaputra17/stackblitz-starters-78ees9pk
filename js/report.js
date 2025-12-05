import { db } from "./app.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("report.js loaded");

let currentStep = 1;

/* STEP HANDLING */
function showStep(step) {
  currentStep = step;

  for (let i = 1; i <= 4; i++) {
    document.getElementById("step" + i).style.display =
      i === step ? "block" : "none";

    document.getElementById("stepLabel" + i).classList.toggle(
      "active-step",
      i === step
    );
  }

  updatePreview();
}

window.nextStep = function () {
  if (currentStep < 4) showStep(currentStep + 1);
};

window.prevStep = function () {
  if (currentStep > 1) showStep(currentStep - 1);
};

/* VALUE HELPER */
function v(id) {
  return document.getElementById(id).value || "";
}

/* Toggle ambulance fields */
function toggleAmbulance() {
  const d = v("discharge");
  document.getElementById("ambulanceFields").style.display =
    d === "ambulance" ? "block" : "none";
}

/* Build discharge text */
function dischargeText() {
  const d = v("discharge");

  if (d === "self") return "Self-discharged and continued with activity";

  if (d === "ambulance")
    return `Sent by Alpha ${v("alphaNo")} to ${v("hospital")}, handed over to ${v("paramedic")}`;

  return v("dischargeOther") || "";
}

/* Build preview */
function updatePreview() {
  document.getElementById("previewBox").textContent =
`Time in: ${v("timeIn")} hrs
Time out: ${v("timeOut")} hrs
Patient’s name: ${v("patientName")}
Gender: ${v("gender")}
Age: ${v("age")}
Contact no.: ${v("contact")}

Case Type: ${v("caseType")}
Location: ${v("location")}

Mechanism (MOI) & Treatment:
${v("moi")}

${v("treatment")}

Discharge Method:
${dischargeText()}.`;
}

/* Attach listeners */
[
  "timeIn","timeOut","patientName","gender","age","contact",
  "caseType","location","moi","treatment",
  "discharge","dischargeOther","alphaNo","hospital","paramedic"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", () => {
    if (id === "discharge") toggleAmbulance();
    updatePreview();
  });
});

toggleAmbulance();
updatePreview();

/* Copy button */
document.getElementById("copyButton").onclick = () => {
  navigator.clipboard.writeText(document.getElementById("previewBox").textContent)
    .then(() => alert("Report copied!"));
};

/* EDIT MODE */
const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("id");

async function loadExisting(id) {
  const ref = doc(db, "injuryReports", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const r = snap.data();

  document.getElementById("timeIn").value = r.timeIn || "";
  document.getElementById("timeOut").value = r.timeOut || "";
  document.getElementById("patientName").value = r.patientName || "";
  document.getElementById("gender").value = r.gender || "Male";
  document.getElementById("age").value = r.age || "";
  document.getElementById("contact").value = r.contact || "";
  document.getElementById("caseType").value = r.caseType || "P3";
  document.getElementById("location").value = r.location || "";
  document.getElementById("moi").value = r.moi || "";
  document.getElementById("treatment").value = r.treatment || "";

  // Discharge parsing
  if (r.discharge?.startsWith("Sent by Alpha")) {
    document.getElementById("discharge").value = "ambulance";
  } else if (r.discharge === "Self-discharged and continued with activity") {
    document.getElementById("discharge").value = "self";
  } else {
    document.getElementById("discharge").value = "other";
    document.getElementById("dischargeOther").value = r.discharge || "";
  }

  document.getElementById("alphaNo").value = r.alphaNo || "";
  document.getElementById("hospital").value = r.hospital || "";
  document.getElementById("paramedic").value = r.paramedic || "";

  toggleAmbulance();
  updatePreview();
}

if (editId) loadExisting(editId);

/* SUBMIT */
document.getElementById("injuryForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    timeIn: v("timeIn"),
    timeOut: v("timeOut"),
    patientName: v("patientName"),
    gender: v("gender"),
    age: v("age"),
    contact: v("contact"),
    caseType: v("caseType"),
    location: v("location"),
    moi: v("moi"),
    treatment: v("treatment"),
    discharge: dischargeText(),
    alphaNo: v("alphaNo"),
    hospital: v("hospital"),
    paramedic: v("paramedic"),
    fullText: document.getElementById("previewBox").textContent
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "injuryReports", editId), payload);
      alert("✔ Report updated.");
    } else {
      await addDoc(collection(db, "injuryReports"), {
        ...payload,
        createdAt: serverTimestamp()
      });
      alert("✔ Report saved.");
    }

    window.location.href = "reportLogs.html";
  } catch (err) {
    console.error(err);
    alert("❌ Error saving report");
  }
});
