import { db } from "./app.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

console.log("transfer.js loaded");

// HTML refs
const itemSelect = document.getElementById("itemSelect");
const fromSelect = document.getElementById("fromLocation");
const toSelect = document.getElementById("toLocation");
const qtyInfo = document.getElementById("qtyInfo");

let allItems = [];

/*-----------------------------------------------------
  LOAD INVENTORY + FILL DROPDOWNS
-----------------------------------------------------*/
async function loadInventory() {
  const snap = await getDocs(collection(db, "inventory"));
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Fill items dropdown
  itemSelect.innerHTML = `<option value="">Select Item</option>`;
  allItems.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.displayName;
    itemSelect.appendChild(opt);
  });

  // Fill locations dropdown (all locations from ANY item)
  const locationSet = new Set();
  allItems.forEach(item => {
    const locs = item.locations || {};
    Object.keys(locs).forEach(l => locationSet.add(l));
  });

  fromSelect.innerHTML = `<option value="">Select Location</option>`;
  toSelect.innerHTML = `<option value="">Select Location</option>`;

  locationSet.forEach(loc => {
    const opt1 = document.createElement("option");
    const opt2 = document.createElement("option");
    opt1.value = opt2.value = loc;
    opt1.textContent = opt2.textContent = loc;
    fromSelect.appendChild(opt1);
    toSelect.appendChild(opt2);
  });
}

loadInventory();

/*-----------------------------------------------------
  UPDATE QTY INFO WHEN ITEM OR SOURCE CHANGES
-----------------------------------------------------*/
function updateQtyInfo() {
  const itemId = itemSelect.value;
  const locKey = fromSelect.value;

  if (!itemId || !locKey) {
    qtyInfo.textContent = "Select item + source to view quantity.";
    return;
  }

  const item = allItems.find(i => i.id === itemId);
  const qty = item?.locations?.[locKey]?.qty ?? 0;

  qtyInfo.textContent = `Available in ${locKey}: ${qty}`;
}

itemSelect.addEventListener("change", updateQtyInfo);
fromSelect.addEventListener("change", updateQtyInfo);

/*-----------------------------------------------------
  SUBMIT TRANSFER
-----------------------------------------------------*/
document.getElementById("transferForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const itemId = itemSelect.value;
  const fromLoc = fromSelect.value;
  const toLoc = toSelect.value;
  const amount = parseInt(document.getElementById("transferQty").value);
  const reason = document.getElementById("reason").value.trim();

  if (!itemId || !fromLoc || !toLoc) return alert("All fields required.");
  if (fromLoc === toLoc) return alert("Source and destination cannot be the same.");
  if (!amount || amount < 1) return alert("Invalid transfer amount.");
  if (!reason) return alert("Reason is required.");

  const item = allItems.find(i => i.id === itemId);

  const itemRef = doc(db, "inventory", itemId);

  const currentFromQty = item.locations[fromLoc]?.qty ?? 0;
  const currentToQty = item.locations[toLoc]?.qty ?? 0;

  if (currentFromQty < amount) return alert("Not enough quantity in source location.");

  // Apply transfer
  await updateDoc(itemRef, {
    [`locations.${fromLoc}.qty`]: currentFromQty - amount,
    [`locations.${toLoc}.qty`]: currentToQty + amount
  });

  // Log transfer
  await addDoc(collection(db, "inventoryLogs"), {
    type: "transfer",
    item: item.displayName,
    from: fromLoc,
    to: toLoc,
    qty: amount,
    reason,
    timestamp: serverTimestamp()
  });

  alert("Transfer completed!");

  e.target.reset();
  qtyInfo.textContent = "Select item + source to view quantity.";

  loadInventory();
});
