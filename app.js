import { createGmailClient } from "./gmail.js";
import { listApplications, openTracker, saveApplication } from "./storage.js";

const byId = id => document.getElementById(id);
const clientId = byId("client-id");
const connect = byId("connect");
const importButton = byId("import");
const disconnect = byId("disconnect");
const status = byId("status");
let db;
let gmail;
let busy = false;

function refreshControls() {
  const connected = Boolean(gmail?.connected);
  clientId.disabled = busy || connected;
  connect.disabled = busy || connected || !db || !clientId.value.trim();
  importButton.disabled = busy || !connected;
  disconnect.disabled = busy || !gmail;
}

function show(message) {
  status.textContent = message;
}

async function render() {
  const records = await listApplications(db);
  const applications = byId("applications");
  byId("empty").hidden = records.length > 0;
  byId("count").textContent = records.length;
  applications.replaceChildren(...records.map(record => {
    const card = document.createElement("li");
    const heading = document.createElement("h3");
    heading.textContent = record.role;
    const details = document.createElement("p");
    details.textContent = record.company;
    const link = document.createElement("a");
    const url = new URL(record.gmailUrl);
    if (url.origin === "https://mail.google.com") link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open confirmation in Gmail";
    card.append(heading, details, link);
    return card;
  }));
}

async function perform(action) {
  busy = true;
  refreshControls();
  try {
    await action();
  } catch (error) {
    show(error instanceof Error ? error.message : "Something went wrong. Try again.");
  } finally {
    busy = false;
    refreshControls();
  }
}

window.addEventListener("focus", refreshControls);
clientId.addEventListener("input", refreshControls);
connect.addEventListener("click", () => perform(async () => {
  gmail = createGmailClient(clientId.value.trim());
  show("Connecting to Gmail…");
  await gmail.connect();
  show("Gmail connected. You can import one application.");
}));
importButton.addEventListener("click", () => perform(async () => {
  show("Searching Gmail for an application confirmation…");
  const record = await gmail.importOne({ onProgress: ({ checked }) => {
    show(`Checked ${checked} candidate messages…`);
  } });
  if (!record) {
    show("No clear application confirmation was found.");
    return;
  }
  await saveApplication(db, record);
  await render();
  show(`Saved ${record.role} at ${record.company}.`);
}));
disconnect.addEventListener("click", () => perform(async () => {
  await gmail.disconnect();
  gmail = undefined;
  show("Disconnected. Your saved applications are still available.");
}));

try {
  db = await openTracker();
  await render();
  show("Enter your Google OAuth web client ID to connect Gmail.");
} catch {
  db = undefined;
  show("Could not open local storage. Check that this browser allows IndexedDB, then reload.");
}
refreshControls();
