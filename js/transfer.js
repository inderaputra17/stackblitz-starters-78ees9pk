import { db } from "./app.js";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("transfer.js loaded");

// DOM refs
const itemListEl = document.getElementById("itemList");
const fromLocationEl = document.getElementById("fromLocation");
const toLocationEl = document.getElementById("toLocation");
const qtyInput = document.getElementById("transferQty");
const summaryBox = document.getElementById("summaryBox");

const previewBtn = document.getElementById("previewTransfer");

// Modal refs
const confirmModal = document.getElementById("confirmModal");
const confirmText = document.getElementById("confirmText");
const confirmBtn = document.getElementById("confirmBtn");
const cancelBtn = document.getElementById("cancelBtn");

// State
let allItems = [];
let selectedItemId = null;

// ---------------- STATUS HELPER (similar to inventory.js) -------------
function getStatus(qty, par, min, max) {
  qty = Number(qty);
  par = Number(par ?? 0);
  min = Number(min ?? 0);
  max = Number(max ?? 9999);

  if (qty <= min) return { label: "Critical", cls: "critical" };
  if (qty < par) return { label: "Low", cls: "low" };
  if (qty > max) return { label: "Overstock", cls: "overstock" };
  return { label: "OK", cls: "ok" };
}

// ---------------- RENDER ITEM CARDS ----------------
function renderItems() {
  if (!allItems.length) {
    itemListEl.textContent = "No items in inventory.";
    return;
  }

  itemListEl.innerHTML = "";

  const sorted = [...allItems].sort((a, b) =>
    (a.displayName || "").localeCompare(b.displayName || "")
  );

  sorted.forEach((item) => {
    const locations = item.locations || {};
    let totalQty = 0;
    Object.values(locations).forEach((loc) => {
      totalQty += Number(loc.qty || 0);
    });

    const par = item.defaultPar ?? totalQty;
    const min = item.defaultMin ?? 0;
    const max = item.defaultMax ?? par * 2;

    const status = getStatus(totalQty, par, min, max);

    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.itemId = item.id;

    // Highlight if selected
    if (item.id === selectedItemId) {
      card.style.borderColor = "#1565c0";
      card.style.backgroundColor = "#e3f2fd";
    }

    card.innerHTML = `
      <div>
        <div class="item-name">${item.displayName || "Unnamed item"}</div>
        <div style="font-size:12px;color:#555;">
          Total: ${totalQty} unit(s)
        </div>
      </div>
      <div>
        <span class="badge ${status.cls}">${status.label}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      selectItem(item.id);
    });

    itemListEl.appendChild(card);
  });
}

// ---------------- SELECT ITEM + POPULATE LOCATIONS ----------------
function selectItem(id) {
  selectedItemId = id;

  // Highlight selected card
  [...itemListEl.querySelectorAll(".item-card")].forEach((card) => {
    if (card.dataset.itemId === id) {
      card.style.borderColor = "#1565c0";
      card.style.backgroundColor = "#e3f2fd";
    } else {
      card.style.borderColor = "#ddd";
      card.style.backgroundColor = "#fafafa";
    }
  });

  const item = allItems.find((i) => i.id === id);
  if (!item) return;

  const locs = Object.keys(item.locations || {});

  // Populate "From" locations (only locations that actually have stock)
  fromLocationEl.innerHTML = `<option value="">Select from location</option>`;
  locs.forEach((loc) => {
    const qty = Number(item.locations[loc].qty || 0);
    if (qty > 0) {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = `${loc} (${qty} in stock)`;
      fromLocationEl.appendChild(opt);
    }
  });

  // Populate "To" locations (all locations for the item)
  toLocationEl.innerHTML = `<option value="">Select to location</option>`;
  locs.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    toLocationEl.appendChild(opt);
  });

  // Reset quantity + summary
  qtyInput.value = "";
  summaryBox.style.display = "none";
}

// ---------------- UPDATE SUMMARY BOX ----------------
function updateSummaryBox() {
  if (!selectedItemId) {
    summaryBox.style.display = "none";
    return;
  }

  const item = allItems.find((i) => i.id === selectedItemId);
  if (!item) {
    summaryBox.style.display = "none";
    return;
  }

  const fromLoc = fromLocationEl.value;
  const toLoc = toLocationEl.value;
  const qty = Number(qtyInput.value || 0);
  const locations = item.locations || {};
  const fromData = locations[fromLoc] || {};
  const avail = Number(fromData.qty || 0);

  if (!fromLoc) {
    summaryBox.style.display = "none";
    return;
  }

  let html = `
    <div><strong>${item.displayName}</strong></div>
    <div>From <strong>${fromLoc}</strong>: ${avail} in stock.</div>
  `;

  if (toLoc) {
    html += `<div>To <strong>${toLoc}</strong></div>`;
  }

  if (qty > 0) {
    if (qty > avail) {
      html += `<div style="margin-top:6px;color:#c62828;font-weight:bold;">
        ⚠ Requested quantity (${qty}) is more than available (${avail}).
      </div>`;
    } else {
      html += `<div style="margin-top:6px;color:#2e7d32;">
        ✅ Transfer of ${qty} unit(s) is within available stock.
      </div>`;
    }
  }

  summaryBox.innerHTML = html;
  summaryBox.style.display = "block";
}

// Events to refresh summary
fromLocationEl.addEventListener("change", updateSummaryBox);
toLocationEl.addEventListener("change", updateSummaryBox);
qtyInput.addEventListener("input", updateSummaryBox);

// ---------------- PREVIEW TRANSFER (OPEN MODAL) ----------------
previewBtn.addEventListener("click", () => {
  if (!selectedItemId) {
    alert("Please select an item to transfer.");
    return;
  }

  const item = allItems.find((i) => i.id === selectedItemId);
  if (!item) {
    alert("Selected item not found.");
    return;
  }

  const fromLoc = fromLocationEl.value;
  const toLoc = toLocationEl.value;
  const qty = Number(qtyInput.value || 0);

  if (!fromLoc) {
    alert("Please choose a 'From' location.");
    return;
  }
  if (!toLoc) {
    alert("Please choose a 'To' location.");
    return;
  }
  if (fromLoc === toLoc) {
    alert("From and To locations cannot be the same.");
    return;
  }
  if (!qty || qty <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }

  const avail = Number(item.locations?.[fromLoc]?.qty || 0);
  if (qty > avail) {
    alert(
      `Cannot transfer ${qty}. Only ${avail} available at ${fromLoc}.`
    );
    return;
  }

  confirmText.textContent = `Transfer ${qty} unit(s) of "${item.displayName}" from ${fromLoc} → ${toLoc}? (Available at ${fromLoc}: ${avail})`;
  confirmModal.style.display = "flex";
});

// ---------------- CONFIRM / CANCEL MODAL ----------------
cancelBtn.addEventListener("click", () => {
  confirmModal.style.display = "none";
});

confirmBtn.addEventListener("click", async () => {
  confirmModal.style.display = "none";
  await performTransfer();
});

// ---------------- PERFORM TRANSFER (FIREBASE UPDATE) ----------------
async function performTransfer() {
  if (!selectedItemId) return;

  const itemRef = doc(db, "inventory", selectedItemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) {
    alert("Item not found. Please refresh.");
    return;
  }

  const item = { id: snap.id, ...snap.data() };
  const fromLoc = fromLocationEl.value;
  const toLoc = toLocationEl.value;
  const qty = Number(qtyInput.value || 0);

  if (!fromLoc || !toLoc || !qty || qty <= 0) {
    alert("Missing transfer details.");
    return;
  }

  const locations = item.locations || {};
  const fromData = locations[fromLoc] || { qty: 0 };
  const toData = locations[toLoc] || {};

  const avail = Number(fromData.qty || 0);
  if (qty > avail) {
    alert(
      `Cannot transfer ${qty}. Only ${avail} available at ${fromLoc}.`
    );
    return;
  }

  const newFromQty = avail - qty;
  const newToQty = Number(toData.qty || 0) + qty;

  const updates = {};
  updates[`locations.${fromLoc}.qty`] = newFromQty;
  updates[`locations.${toLoc}.qty`] = newToQty;

  // Ensure thresholds exist for destination if missing
  if (!toData.par && !toData.min && !toData.max) {
    updates[`locations.${toLoc}.par`] = item.defaultPar ?? 0;
    updates[`locations.${toLoc}.min`] = item.defaultMin ?? 0;
    updates[`locations.${toLoc}.max`] = item.defaultMax ?? 9999;
  }

  await updateDoc(itemRef, updates);

  // Log transfer in inventoryLogs (note: using from/to fields)
  await addDoc(collection(db, "inventoryLogs"), {
    type: "transfer",
    item: item.displayName,
    from: fromLoc,
    to: toLoc,
    qty,
    reason: "Manual transfer",
    timestamp: serverTimestamp(),
  });

  alert("✔ Transfer completed.");
  qtyInput.value = "";
  summaryBox.style.display = "none";
}

// ---------------- LIVE SNAPSHOT OF INVENTORY ----------------
onSnapshot(collection(db, "inventory"), (snap) => {
  allItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderItems();

  // If selected item no longer exists, reset selection
  if (selectedItemId && !allItems.find((i) => i.id === selectedItemId)) {
    selectedItemId = null;
    fromLocationEl.innerHTML = "";
    toLocationEl.innerHTML = "";
    summaryBox.style.display = "none";
  } else if (selectedItemId) {
    // Re-populate locations for the selected item after update
    selectItem(selectedItemId);
  }
});
