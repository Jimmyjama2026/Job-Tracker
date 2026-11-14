export function openTracker() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("personal-application-tracker", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("applications", { keyPath: "messageId" });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other tracker tabs and reload."));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function run(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("applications", mode);
    const request = operation(transaction.objectStore("applications"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? new Error("Storage operation was interrupted."));
  });
}

export function listApplications(db) {
  return run(db, "readonly", store => store.getAll());
}

export function saveApplication(db, application) {
  const { messageId, threadId, company, role, receivedAt, gmailUrl } = application;
  return run(db, "readwrite", store => store.put({
    messageId, threadId, company, role, receivedAt, gmailUrl, stage: "Applied",
  }));
}
