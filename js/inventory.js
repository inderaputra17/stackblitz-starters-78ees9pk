import { db } from "./app.js";
import {
  collection,
  doc,
  updateDoc,
  deleteField,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("inventory.js loaded");

const container = document.getElementById("inventoryContainer");

const editModal = document.getElementById("editModal");
const editName = document.getElementById("editName");
const editUnit = document.getElementById("editUnit");
const editSize = document.getElementById("editSize");
const saveItemEdit = document.getElementById("saveItemEdit");
const closeItemEdit = document.getElementById("closeItemEdit");

let allItems = [];
let editingItemID = null;

/* ---------------- STATUS LOGIC ---------------- */
function getStatus(qty, par, min, max) {
  qty = Number(qty);
  par = Number(par ?? 0);
  min = Number(min ?? 0);
  max = Number(max ?? 99999);

  if (qty <= min) return { label: "Critical", cls: "critical" };
  if (qty < par) return { label: "Low", cls: "low" };
  if (qty > max) return { label: "Overstock", cls: "overstock" };
  return { label: "OK", cls: "ok" };
}

/* ---------------- RENDER INVENTORY ---------------- */
function renderInventory() {
  container.innerHTML = "";

  allItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "location-card";

    let html = `
      <div class="item-title">${item.displayName}</div>
      <div class="item-meta">
        Unit: ${item.unit || "-"} &nbsp; | &nbsp; Size: ${item.size || "-"}
        <br>
        <button class="action-btn edit-btn" data-edit="${item.id}">Edit Item</button>
        <button class="action-btn delete-btn" data-deleteitem="${item.id}">Delete Item</button>
      </div>

      <table>
        <tr>
          <th>Location</th>
          <th>Qty</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
    `;

    const locs = Object.keys(item.locations || {}).sort();
    locs.forEach(loc => {
      const L = item.locations[loc];
      const st = getStatus(L.qty, L.par, L.min, L.max);

      html += `
        <tr>
          <td>${loc}</td>
          <td>${L.qty}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td>
            <button class="action-btn add-btn" data-type="add" data-item="${item.id}" data-loc="${loc}">+</button>
            <button class="action-btn minus-btn" data-type="minus" data-item="${item.id}" data-loc="${loc}">−</button>
            <button class="action-btn delete-btn" data-type="deleteLoc" data-item="${item.id}" data-loc="${loc}">Del</button>
          </td>
        </tr>
      `;
    });

    html += `</table>`;
    card.innerHTML = html;
    container.appendChild(card);
  });
}

/* ---------------- FIRESTORE LIVE LISTENER ---------------- */
onSnapshot(collection(db, "inventory"), snap => {
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderInventory();
});

/* ---------------- CLICK HANDLER ---------------- */
document.addEventListener("click", async e => {
  const type = e.target.dataset.type;
  const itemId = e.target.dataset.item;
  const loc = e.target.dataset.loc;

  /* ----- OPEN EDIT MODAL ----- */
  if (e.target.dataset.edit) {
    const item = allItems.find(i => i.id === e.target.dataset.edit);
    editingItemID = item.id;
    editName.value = item.displayName;
    editUnit.value = item.unit || "";
    editSize.value = item.size || "";
    editModal.style.display = "flex";
    return;
  }

  /* ----- DELETE ENTIRE ITEM ----- */
  if (e.target.dataset.deleteitem) {
    const id = e.target.dataset.deleteitem;
    const item = allItems.find(i => i.id === id);

    if (!confirm(`⚠️ Delete entire item:\n\n${item.displayName}\n\nThis cannot be undone.`))
      return;

    await deleteDoc(doc(db, "inventory", id));
    alert("Item deleted.");
    return;
  }

  if (!type) return;

  const item = allItems.find(i => i.id === itemId);
  const ref = doc(db, "inventory", itemId);

  /* ----- ADD QTY ----- */
  if (type === "add") {
    const q = prompt("Add how many?");
    if (!q) return;
    const qty = Number(q);
    await updateDoc(ref, {
      [`locations.${loc}.qty`]: (item.locations[loc]?.qty || 0) + qty
    });
    return;
  }

  /* ----- REDUCE QTY ----- */
  if (type === "minus") {
    const q = prompt("Reduce by how many?");
    if (!q) return;
    const qty = Number(q);
    await updateDoc(ref, {
      [`locations.${loc}.qty`]: Math.max(0, (item.locations[loc]?.qty || 0) - qty)
    });
    return;
  }

  /* ----- DELETE LOCATION ----- */
  if (type === "deleteLoc") {
    if (!confirm(`Delete location "${loc}"?`)) return;
    await updateDoc(ref, { [`locations.${loc}`]: deleteField() });
    return;
  }
});

/* ---------------- SAVE ITEM EDIT ---------------- */
saveItemEdit.addEventListener("click", async () => {
  const ref = doc(db, "inventory", editingItemID);

  await updateDoc(ref, {
    displayName: editName.value.trim(),
    unit: editUnit.value.trim(),
    size: editSize.value.trim(),
  });

  editModal.style.display = "none";
});

/* CLOSE MODAL */
closeItemEdit.addEventListener("click", () => {
  editModal.style.display = "none";
});
