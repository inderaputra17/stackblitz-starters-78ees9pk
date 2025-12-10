// ===============================================
// staff.js — Cleaned & Security-Aligned Version
// ===============================================

import { db } from "./app.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ======================================================
// 1. SESSION + PERMISSION PRIMER (Required by Lock-In)
// ======================================================
const user = JSON.parse(sessionStorage.getItem("faUser")) || {};
const perms = user.permissions || {};


// ======================================================
// 2. DOM ELEMENTS
// ======================================================
const staffForm = document.getElementById("staffForm");
const formTitle = document.getElementById("formTitle");

const nameInput = document.getElementById("staffName");
const roleInput = document.getElementById("staffRole");
const pinInput = document.getElementById("staffPin");
const activeInput = document.getElementById("staffActive");

const togglePinBtn = document.getElementById("togglePin");
const resetBtn = document.getElementById("resetForm");
const staffList = document.getElementById("staffList");

const permInputs = {
  dashboard: document.getElementById("permDashboard"),
  inventory: document.getElementById("permInventory"),
  addStock: document.getElementById("permAddStock"),
  transfer: document.getElementById("permTransfer"),
  reports: document.getElementById("permReports"),
  adminPage: document.getElementById("permAdminPage")
};

let editingId = null;


// ======================================================
// 3. PIN VISIBILITY TOGGLE
// ======================================================
togglePinBtn.addEventListener("click", () => {
  const isHidden = pinInput.type === "password";
  pinInput.type = isHidden ? "text" : "password";
  togglePinBtn.textContent = isHidden ? "Hide" : "Show";
});


// ======================================================
// 4. RESET FORM
// ======================================================
function resetForm() {
  editingId = null;
  formTitle.textContent = "Add Staff";

  staffForm.reset();
  activeInput.checked = true;

  Object.values(permInputs).forEach(el => (el.checked = false));
}

resetBtn.addEventListener("click", resetForm);


// ======================================================
// 5. PIN VALIDATION
// ======================================================
function isValidPin(pin) {
  return /^\d{6}$/.test(pin);
}


// ======================================================
// 6. SUBMIT HANDLER (Add or Edit Staff)
// ======================================================
staffForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const pin = pinInput.value.trim();
  if (!isValidPin(pin)) {
    alert("PIN must be exactly 6 digits.");
    return;
  }

  const permissions = {};
  for (const key in permInputs) {
    permissions[key] = permInputs[key].checked;
  }

  const data = {
    name: nameInput.value.trim(),
    role: roleInput.value.trim() || null,
    pin,
    active: activeInput.checked,
    permissions,
    updatedAt: serverTimestamp()
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, "staff", editingId), data);
      alert("Staff updated.");
    } else {
      await addDoc(collection(db, "staff"), {
        ...data,
        createdAt: serverTimestamp()
      });
      alert("Staff added.");
    }

    resetForm();
    loadStaff();
  } catch (err) {
    console.error(err);
    alert("Error saving staff.");
  }
});


// ======================================================
// 7. LOAD STAFF LIST
// ======================================================
async function loadStaff() {
  staffList.innerHTML = `<p class="empty">Loading...</p>`;

  const snap = await getDocs(collection(db, "staff"));
  staffList.innerHTML = "";

  if (snap.empty) {
    staffList.innerHTML = `<p class="empty">No staff yet.</p>`;
    return;
  }

  snap.forEach(docSnap => {
    staffList.appendChild(renderStaffCard(docSnap.id, docSnap.data()));
  });
}


// ======================================================
// 8. RENDER STAFF CARD
// ======================================================
function renderStaffCard(id, staff) {
  const name = staff.name || "Unnamed";
  const role = staff.role || "—";

  const permList =
    Object.entries(staff.permissions || {})
      .filter(([_, allowed]) => allowed)
      .map(([p]) => p)
      .join(", ") || "None";

  const card = document.createElement("div");
  card.className = "staff-card";

  card.innerHTML = `
    <div class="staff-main">
      <div>
        <div class="staff-name">${name}</div>
        <div class="staff-role">${role}</div>
      </div>
      <span class="badge ${staff.active ? "active" : "inactive"}">
        ${staff.active ? "Active" : "Inactive"}
      </span>
    </div>

    <div class="staff-meta">
      <span>PIN: ••••••</span><br>
      <small>Permissions: ${permList}</small>
    </div>

    <div class="staff-actions">
      <button class="btn secondary-btn" onclick="window.fillForm('${id}')">Edit</button>
      <button class="chip-btn" onclick="window.toggleActive('${id}', ${staff.active})">
        ${staff.active ? "Set Inactive" : "Set Active"}
      </button>
      <button class="btn danger-btn" onclick="window.deleteStaff('${id}', '${name}')">Delete</button>
    </div>
  `;

  return card;
}


// ======================================================
// 9. EDIT: FILL FORM
// ======================================================
window.fillForm = async (id) => {
  const snap = await getDocs(collection(db, "staff"));

  snap.forEach(docSnap => {
    if (docSnap.id === id) {
      const s = docSnap.data();

      editingId = id;
      formTitle.textContent = "Edit Staff";

      nameInput.value = s.name;
      roleInput.value = s.role || "";
      pinInput.value = s.pin;
      activeInput.checked = s.active !== false;

      for (const key in permInputs) {
        permInputs[key].checked = s.permissions?.[key] || false;
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
};


// ======================================================
// 10. TOGGLE ACTIVE
// ======================================================
window.toggleActive = async (id, current) => {
  await updateDoc(doc(db, "staff", id), {
    active: !current,
    updatedAt: serverTimestamp()
  });

  loadStaff();
};


// ======================================================
// 11. DELETE STAFF
// ======================================================
window.deleteStaff = async (id, name) => {
  if (!confirm(`Delete staff "${name}"?`)) return;
  await deleteDoc(doc(db, "staff", id));
  loadStaff();
};


// ======================================================
// 12. INITIALIZE
// ======================================================
loadStaff();
