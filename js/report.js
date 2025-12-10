/* =========================================================
   IMPORTS
========================================================= */
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


/* =========================================================
   STEP NAVIGATION SYSTEM
========================================================= */
let currentStep = 1;

function showStep(step) {
  currentStep = step;

  for (let i = 1; i <= 4; i++) {
    const card  = document.getElementById(`step${i}`);
    const label = document.getElementById(`stepLabel${i}`);

    if (card) {
      card.classList.toggle("active-step-card", i === step);
      card.style.display = i === step ? "block" : "none";
    }
    if (label) {
      label.classList.toggle("active-step", i === step);
    }
  }

  updatePreview();
}

window.nextStep = () => {
  if (!validateStep(currentStep)) return;
  if (currentStep < 4) showStep(currentStep + 1);
};

window.prevStep = () => {
  if (currentStep > 1) showStep(currentStep - 1);
};


/* =========================================================
   VALUE GETTER
========================================================= */
const v = id => (document.getElementById(id)?.value || "").trim();


/* =========================================================
   STEP VALIDATION (No behavior changes)
========================================================= */
function validateStep(step) {
  let required = [];

  if (step === 1) {
    required = [
      { id: "timeIn",      label: "Time In" },
      { id: "timeOut",     label: "Time Out" },
      { id: "patientName", label: "Patient Name" },
      { id: "age",         label: "Age" }
    ];
  }

  if (step === 2) {
    required = [
      { id: "location",  label: "Location" },
      { id: "moi",       label: "Mechanism of Injury (MOI)" },
      { id: "treatment", label: "Treatment" }
    ];
  }

  if (step === 3 && v("discharge") === "ambulance") {
    required = [
      { id: "alphaNo",  label: "Ambulance Alpha No." },
      { id: "hospital", label: "Receiving Hospital" },
      { id: "paramedic", label: "Paramedic" }
    ];
  }

  for (const f of required) {
    if (v(f.id) === "") {
      alert(`⚠ Please fill in: ${f.label}`);
      return false;
    }
  }

  return true;
}


/* =========================================================
   DISCHARGE LOGIC (Same formatting as elsewhere)
========================================================= */
function toggleAmbulance() {
  const box = document.getElementById("ambulanceFields");
  const isAmb = v("discharge") === "ambulance";

  if (isAmb) {
    box.classList.remove("hidden");
    box.style.display = "block";
  } else {
    box.classList.add("hidden");
    box.style.display = "none";
  }
}

function dischargeText() {
  const method = v("discharge");

  if (method === "self") {
    return "Self-discharged and continued with activity.";
  }

  if (method === "ambulance") {
    return `Sent by Alpha ${v("alphaNo")} to ${v("hospital")}, handed over to ${v("paramedic")}.`;
  }

  const other = v("dischargeOther");
  return other ? (other.endsWith(".") ? other : other + ".") : "";
}


/* =========================================================
   LIVE PREVIEW (Identical format)
========================================================= */
function updatePreview() {
  const box = document.getElementById("previewBox");
  if (!box) return;

  box.textContent =
`Time in: ${v("timeIn")} hrs
Time out: ${v("timeOut")} hrs
Patient’s name: ${v("patientName")}
Gender: ${v("gender")}
Age: ${v("age")}
Contact no.: ${v("contact")}

Case Type: ${v("caseType")}
Location: ${v("location")}

Mechanism of Injury:
${v("moi")}

Treatment:
${v("treatment")}

Discharge:
${dischargeText()}`;
}


/* Auto-update preview + ambulance toggler */
[
  "timeIn","timeOut","patientName","gender","age","contact",
  "caseType","location","moi","treatment",
  "discharge","dischargeOther",
  "alphaNo","hospital","paramedic"
].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("input", () => {
    if (id === "discharge") toggleAmbulance();
    updatePreview();
  });
});

toggleAmbulance();
updatePreview();


/* =========================================================
   COPY BUTTON
========================================================= */
document.getElementById("copyButton").onclick = () => {
  navigator.clipboard.writeText(document.getElementById("previewBox").textContent);
  alert("✔ Report text copied!");
};


/* =========================================================
   LOAD EXISTING REPORT (EDIT MODE)
========================================================= */
const editId = new URLSearchParams(window.location.search).get("id");

async function loadExisting(id) {
  const snap = await getDoc(doc(db, "injuryReports", id));
  if (!snap.exists()) return;

  const data = snap.data();

  const keys = [
    "timeIn","timeOut","patientName","age","contact",
    "location","moi","treatment","alphaNo","hospital","paramedic"
  ];

  keys.forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = data[k] || "";
  });

  document.getElementById("gender").value   = data.gender   || "Male";
  document.getElementById("caseType").value = data.caseType || "P3";

  if (data.alphaNo || data.hospital || data.paramedic) {
    document.getElementById("discharge").value = "ambulance";
  } else if ((data.discharge || "").toLowerCase().includes("self")) {
    document.getElementById("discharge").value = "self";
  } else {
    document.getElementById("discharge").value = "other";
    document.getElementById("dischargeOther").value = data.discharge || "";
  }

  toggleAmbulance();
  updatePreview();
}

if (editId) loadExisting(editId);


/* =========================================================
   SUBMIT REPORT (NEW OR EDIT)
========================================================= */
document.getElementById("injuryForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
    alert("⚠ Please complete all required fields.");
    return;
  }

  const payload = {
    timeIn:     v("timeIn"),
    timeOut:    v("timeOut"),
    patientName:v("patientName"),
    gender:     v("gender"),
    age:        v("age"),
    contact:    v("contact"),
    caseType:   v("caseType"),
    location:   v("location"),
    moi:        v("moi"),
    treatment:  v("treatment"),
    discharge:  dischargeText(),
    alphaNo:    v("alphaNo"),
    hospital:   v("hospital"),
    paramedic:  v("paramedic"),

    fullText:   document.getElementById("previewBox").textContent
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "injuryReports", editId), payload);
      alert("✔ Report updated successfully");
    } else {
      await addDoc(collection(db, "injuryReports"), {
        ...payload,
        createdAt: serverTimestamp()
      });
      alert("✔ Report saved successfully");
    }

    window.location.href = "reportLogs.html";

  } catch (err) {
    console.error(err);
    alert("❌ Error saving the report");
  }
});
