/* ===================================================================
   REPORT LOGS EDITOR — CLEAN, STRUCTURED, ZERO FEATURE CHANGES
=================================================================== */

import { db } from "./app.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

/* ================================================================
   DOM REFERENCES
================================================================ */
const logsContainer      = document.getElementById("logsContainer");
const editModal          = document.getElementById("editModal");
const editSteps          = document.getElementById("editSteps");
const editCloseBtn       = document.getElementById("editCloseBtn");
const prevBtn            = document.getElementById("prevStepBtn");
const nextBtn            = document.getElementById("nextStepBtn");
const saveBtn            = document.getElementById("saveChangesBtn");

let currentEditId = null;
let currentStep   = 0;


/* ================================================================
   FORM STEPS (INJECT HTML)
================================================================ */
editSteps.innerHTML = `
  <!-- STEP 1: TIME + PATIENT -->
  <div class="form-step" data-step="0">
    <h2 class="section-title">⏱ Time Details</h2>
    <div class="grid-2">
      <div class="form-group"><label>Time In (### hrs):</label><input id="timeIn"></div>
      <div class="form-group"><label>Time Out (### hrs):</label><input id="timeOut"></div>
    </div>

    <h2 class="section-title">🧑 Patient</h2>
    <div class="form-group"><label>Patient Name:</label><input id="patientName"></div>

    <div class="grid-2">
      <div class="form-group">
        <label>Gender:</label>
        <select id="gender"><option>Male</option><option>Female</option></select>
      </div>
      <div class="form-group"><label>Age:</label><input id="age"></div>
    </div>

    <div class="form-group"><label>Contact No.:</label><input id="contact"></div>
  </div>

  <!-- STEP 2: CASE INFO -->
  <div class="form-step" data-step="1">
    <h2 class="section-title">📌 Case Information</h2>

    <div class="grid-2">
      <div class="form-group">
        <label>Case Type:</label>
        <select id="caseType">
          <option>P3</option>
          <option>P2</option>
          <option>P1</option>
        </select>
      </div>

      <div class="form-group">
        <label>Location (Event Area):</label>
        <input id="location">
      </div>
    </div>

    <h2 class="section-title">⚠️ Mechanism of Injury (MOI)</h2>
    <div class="form-group"><textarea id="moi" rows="3"></textarea></div>
  </div>

  <!-- STEP 3: TREATMENT -->
  <div class="form-step" data-step="2">
    <h2 class="section-title">🩹 Treatment Provided</h2>
    <div class="form-group"><textarea id="treatment" rows="3"></textarea></div>
  </div>

  <!-- STEP 4: DISCHARGE -->
  <div class="form-step" data-step="3">
    <h2 class="section-title">🚑 Discharge Method</h2>

    <div class="form-group">
      <label>Discharge Method:</label>
      <select id="discharge">
        <option value="self">Self-discharged and continued with activity</option>
        <option value="ambulance">Conveyed by Ambulance</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div id="ambulanceFields" style="display:none; margin-top:10px;">
      <div class="grid-2">
        <div class="form-group"><label>Alpha No.:</label><input id="alphaNo"></div>
        <div class="form-group"><label>Receiving Hospital:</label><input id="hospital"></div>
      </div>

      <div class="form-group"><label>Paramedic Rank & Name:</label><input id="paramedic"></div>
    </div>

    <div class="form-group"><label>Other Discharge:</label><input id="dischargeOther"></div>
  </div>
`;


/* ================================================================
   STEP NAVIGATION CONTROLLER
================================================================ */
const steps = [...document.querySelectorAll(".form-step")];

function showStep(index) {
  steps.forEach((step, i) => {
    step.style.display = i === index ? "block" : "none";
  });

  prevBtn.style.display = index === 0               ? "none" : "inline-block";
  nextBtn.style.display = index === steps.length-1 ? "none" : "inline-block";
  saveBtn.style.display = index === steps.length-1 ? "inline-block" : "none";
}

showStep(0);

prevBtn.onclick = () => {
  if (currentStep > 0) currentStep--;
  showStep(currentStep);
};

nextBtn.onclick = () => {
  if (currentStep < steps.length - 1) currentStep++;
  showStep(currentStep);
};


/* ================================================================
   UTILITIES
================================================================ */
function v(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function toggleAmbulance() {
  const show = v("discharge") === "ambulance";
  document.getElementById("ambulanceFields").style.display = show ? "block" : "none";
}


/* ================================================================
   DISCHARGE TEXT BUILDER (UNCHANGED FORMAT)
================================================================ */
function dischargeText() {
  const d = v("discharge");

  if (d === "self") {
    return "Self-discharged and continued with activity.";
  }

  if (d === "ambulance") {
    return `Sent by Alpha ${v("alphaNo")} to ${v("hospital")}, handed over to ${v("paramedic")}.`;
  }

  if (d === "other") {
    return v("dischargeOther") ? v("dischargeOther") + "." : "";
  }

  return "";
}


/* ================================================================
   TEXT PREVIEW RENDERER
================================================================ */
function updatePreview() {
  const txt =
`Time in: ${v("timeIn")} hrs
Time out: ${v("timeOut")} hrs
Patient’s name: ${v("patientName")}
Gender: ${v("gender")}
Age: ${v("age")}
Contact no.: ${v("contact")}

Case Type : ${v("caseType")}
Location : ${v("location")}

Mechanism (MOI) & Treatment :
${v("moi")}

${v("treatment")}

Discharge Method :
${dischargeText()}`;

  document.getElementById("previewText").textContent = txt;
}


/* Auto-update preview */
[
 "timeIn","timeOut","patientName","gender","age","contact",
 "caseType","location","moi","treatment","discharge",
 "alphaNo","hospital","paramedic","dischargeOther"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updatePreview);
});


/* ================================================================
   OPEN EDIT MODAL
================================================================ */
function openEditModal(id, data) {
  currentEditId = id;

  // BASIC INFO
  document.getElementById("timeIn").value       = data.timeIn || "";
  document.getElementById("timeOut").value      = data.timeOut || "";
  document.getElementById("patientName").value  = data.patientName || "";
  document.getElementById("gender").value       = data.gender || "Male";
  document.getElementById("age").value          = data.age || "";
  document.getElementById("contact").value      = data.contact || "";

  // CASE DETAILS
  document.getElementById("caseType").value     = data.caseType || "P3";
  document.getElementById("location").value     = data.location || "";
  document.getElementById("moi").value          = data.moi || "";
  document.getElementById("treatment").value    = data.treatment || "";

  // DISCHARGE PRIORITY LOGIC (UNCHANGED)
  const dis = document.getElementById("discharge");
  if (data.alphaNo || data.hospital || data.paramedic) {
    dis.value = "ambulance";
  } else if (data.discharge?.toLowerCase().includes("self")) {
    dis.value = "self";
  } else {
    dis.value = "other";
    document.getElementById("dischargeOther").value = data.discharge || "";
  }

  document.getElementById("alphaNo").value   = data.alphaNo || "";
  document.getElementById("hospital").value  = data.hospital || "";
  document.getElementById("paramedic").value = data.paramedic || "";

  toggleAmbulance();
  updatePreview();

  currentStep = 0;
  showStep(0);
  editModal.style.display = "flex";
}

editCloseBtn.onclick = () => {
  editModal.style.display = "none";
};


/* ================================================================
   SAVE EDITS
================================================================ */
document.getElementById("editForm").addEventListener("submit", async e => {
  e.preventDefault();

  const updated = {
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

    fullText:   document.getElementById("previewText").textContent
  };

  await updateDoc(doc(db, "injuryReports", currentEditId), updated);

  alert("✔ Report updated successfully");
  editModal.style.display = "none";
});


/* ================================================================
   LOAD REPORT LOGS (LIVE)
================================================================ */
const qReports = query(
  collection(db, "injuryReports"),
  orderBy("createdAt", "desc")
);

onSnapshot(qReports, snapshot => {
  logsContainer.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    const card = document.createElement("div");
    card.className = "log-card";

    card.innerHTML = `
      <div class="log-header">${data.patientName} (${data.caseType})</div>
      <div class="log-meta">${data.timeIn}–${data.timeOut} hrs • ${data.location}</div>

      <div class="full-report">${data.fullText}</div>

      <div class="log-actions">
        <button class="copy-btn">📋 Copy</button>
        <button class="edit-btn">✏️ Edit</button>
        <button class="delete-btn">🗑 Delete</button>
      </div>
    `;

    card.querySelector(".copy-btn").onclick = () =>
      navigator.clipboard.writeText(data.fullText);

    card.querySelector(".edit-btn").onclick = () =>
      openEditModal(docSnap.id, data);

    card.querySelector(".delete-btn").onclick = async () => {
      if (confirm("Delete this report?")) {
        await deleteDoc(doc(db, "injuryReports", docSnap.id));
      }
    };

    logsContainer.appendChild(card);
  });
});


/* ================================================================
   END OF FILE
================================================================ */
});
