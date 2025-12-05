console.log("help.js loaded");

// Elements
const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const helpText = document.getElementById("helpText");
const helpTitle = document.getElementById("helpTitle");
const closeHelp = document.getElementById("closeHelp");

// Detect current page
const page = window.location.pathname.split("/").pop().toLowerCase();

// Page-specific instructions
const helpMessages = {

  "index.html": {
    title: "Dashboard Help",
    text: `
The dashboard is your main menu.

• Injury Report – create a new first aid case
• Report Logs – view or edit previous reports
• Inventory – view all medical items
• Add Stock – add or top-up items
• Transfer – move items between locations
• Logs & Summary – audit trail & total counts

Tip: Always check inventory before and after an event.
`
  },

  "inventory.html": {
    title: "Inventory Help",
    text: `
This page shows ALL your first aid items across ALL locations.

You can:
• Add stock (+1)
• Reduce stock (–1)
• Delete location for item
• Edit item name, size, unit
• Delete entire item (warning: irreversible)

Status colours:
🟩 OK
🟧 Low stock
🟥 Critical
🟦 Overstock

Tip: Keep commonly used items above MIN level.
`
  },

  "addstock.html": {
    title: "Add / Top-Up Stock",
    text: `
Use this page to add NEW items or top-up existing ones.

Steps:
1. Select item (or choose "Add New Item")
2. Enter quantity
3. Choose location
4. (Optional) Expand Advanced Settings:
   – Unit (e.g., box, pack, bottle)
   – Size (e.g., 60ml, 100s)
   – PAR (ideal level)
   – MIN (warning level)
   – MAX (overstock level)

If you don't edit PAR/MIN/MAX:
• App auto-generates safe defaults.
`
  },

  "transfer.html": {
    title: "Transfer Help",
    text: `
Use when moving items between event bags, stations, or stores.

Steps:
1. Select item
2. Choose FROM location
3. Choose TO location
4. Enter quantity

Automatic:
• FROM location decreases
• TO location increases
• A log entry is created

Good for event redeployment.
`
  },

  "inventorylogs.html": {
    title: "Logs & Summary Help",
    text: `
This page has 2 sections:

1️⃣ **Summary Table**
Shows inventory totals by item + location.

2️⃣ **Audit Trail**
Tracks every action:
• New item creation
• Top-ups
• Reductions
• Transfers
• Location deletion

Useful for:
• Accountability
• Event handovers
• Stock investigation
`
  },

  "report.html": {
    title: "Injury Report Help",
    text: `
Follow the form to generate a correct first aid report.

Sections:
• Time in/out
• Patient info
• MOI (Cause of injury)
• Treatment provided
• Discharge method

Ambulance:
Selecting ambulance shows Alpha No., hospital, paramedic fields.

Report Preview:
Updates automatically below the form.
Copy button lets you paste into WhatsApp/Telegram.

Saved reports appear in Logs.
`
  },

  "reportlogs.html": {
    title: "Report Logs Help",
    text: `
This page stores ALL past injury reports.

You can:
• Copy (paste into message apps)
• Edit (reopens report form)
• Delete (irreversible)

Use this page for:
• Event documentation
• Post-event reporting
• Case verification
`
  }
};

// Default message if page not found
const defaultMessage = {
  title: "Help",
  text: "Instructions not found for this page."
};

// Show popup
helpButton.addEventListener("click", () => {
  const msg = helpMessages[page] || defaultMessage;
  helpTitle.textContent = msg.title;
  helpText.textContent = msg.text;
  helpModal.style.display = "flex";
});

// Close popup
closeHelp.addEventListener("click", () => {
  helpModal.style.display = "none";
});

// Close when clicking outside content
helpModal.addEventListener("click", (e) => {
  if (e.target === helpModal) {
    helpModal.style.display = "none";
  }
});
