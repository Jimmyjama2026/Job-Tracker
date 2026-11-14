const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SEARCH = '{ "thank you for applying" "thanks for applying" "application received" "received your application" "application confirmation" "application has been received" "application submitted" "submitted your application" "thank you for your application" } -in:sent -in:drafts';
const RECEIPT = /\b(?:thank(?:s| you) for applying|(?:thank(?:s| you) for|we(?: have|'ve)? received) your application|your application (?:has been |was |was successfully )?(?:received|submitted)|application (?:received|confirmation|submitted))\b/i;
const UPDATE = /\b(?:unfortunately|regret to inform|not (?:moving forward|selected|considering)|(?:move|moving) forward with other|interview invitation|schedule (?:an |your )?interview|complete (?:an |your |the )?assessment|application (?:status|update|withdrawn)|position has been filled)\b/i;

function cleanField(value) {
  return value?.replace(/^[\s"'“‘:–-]+|[\s"'”’.!]+$/gu, "").replace(/\s+/g, " ");
}

function validField(value) {
  return value && value.length <= 120 && /\p{L}/u.test(value)
    && !/(?:https?:|@|\b(?:our team|our company|the company|the team|this position|the position|this role|the role)\b)/i.test(value);
}

export function extractConfirmation({ subject = "", from = "", body = "" }) {
  if (/^\s*(?:re|fw|fwd)\s*:/i.test(subject)) return null;
  const original = body.split(/^(?:On .+ wrote:|[- ]*Forwarded message[- ]*|>)/im, 1)[0];
  const text = original.replace(/[’‘]/g, "'");
  if (!RECEIPT.test(subject + "\n" + text) || UPDATE.test(subject + "\n" + text)) return null;

  const candidates = [];
  function add(company, role) {
    company = cleanField(company);
    role = cleanField(role)?.replace(/\s+(?:position|role)$/i, "");
    if (/\s+(?:and\s+\w+ing|where|which)\b/i.test(company || "")) return;
    if (validField(company) && validField(role)) candidates.push({ company, role });
  }

  for (const source of [subject, text]) {
    for (const match of source.matchAll(/(?:\b(?:for applying (?:for|to)|application for)\s+(?:the\s+)?|^\s*application (?:received|confirmation|submitted)\s*[:–—-]\s*)([^\n.!?]{1,120}?)\s+(?:at|with)\s+([^\n!?]{1,120}?)(?=\.(?:\s|$)|[!?\n]|$)/gim)) {
      add(match[2], match[1]);
    }
    for (const match of source.matchAll(/\bfor applying to\s+([^\n.!?]{1,120}?)\s+for\s+(?:the\s+)?([^\n.!?]{1,120})(?=[.!?\n]|$)/gi)) {
      add(match[1], match[2]);
    }
  }

  const companyFields = [...text.matchAll(/^[ \t]*(?:company|employer)[ \t]*:[ \t]*([^\n]+)$/gim)];
  const roleFields = [...text.matchAll(/^[ \t]*(?:position|role|job title)[ \t]*:[ \t]*([^\n]+)$/gim)];
  if (companyFields.length > 1 || roleFields.length > 1) return null;
  if (companyFields.length && roleFields.length) add(companyFields[0][1], roleFields[0][1]);

  const subjectRole = subject.match(/^application (?:received|confirmation|submitted)\s*[:–—-]\s*(.+)$/i)?.[1];
  const senderCompany = from.match(/^(.+?)\s+(?:recruiting|talent acquisition|careers|hiring)(?:\s*<[^>]+>)?$/i)?.[1];
  const role = roleFields[0]?.[1] || subjectRole;
  if (candidates.length === 0 && role && !/\s+(?:at|with)\s+/i.test(role)) {
    add(companyFields[0]?.[1] || senderCompany, role);
  }

  const first = candidates[0];
  if (!first) return null;
  return candidates.every(({ company, role }) =>
    company.toLowerCase() === first.company.toLowerCase() && role.toLowerCase() === first.role.toLowerCase()
  ) ? first : null;
}

function header(payload, name) {
  return payload?.headers?.find(item => item.name.toLowerCase() === name)?.value || "";
}

function decodePart(part) {
  const value = part.body?.data?.replace(/-/g, "+").replace(/_/g, "/");
  if (!value) return "";
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const charset = header(part, "content-type").match(/charset="?([^";\s]+)/i)?.[1];
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function bodyText(payload) {
  const plain = [];
  const html = [];
  function collect(part) {
    if (part.filename || /^attachment\b/i.test(header(part, "content-disposition"))) return;
    if (part.mimeType === "text/plain") plain.push(decodePart(part));
    if (part.mimeType === "text/html") html.push(part);
    if (part.mimeType?.startsWith("multipart/")) part.parts?.forEach(collect);
  }
  if (!payload) return "";
  collect(payload);
  if (plain.some(text => text.trim())) return plain.join("\n");
  if (!html.length) return "";
  // Template content stays inert. Never insert mail markup into the page.
  const template = document.createElement("template");
  template.innerHTML = html.map(decodePart).join("\n").replace(/<\/(?:p|div|li|tr)>|<br\s*\/?>/gi, "$&\n");
  template.content.querySelectorAll("script,style,blockquote").forEach(node => node.remove());
  return template.content.textContent;
}

export function createGmailClient(clientId) {
  let session = null;
  let connection = null;
  let connectionVersion = 0;

  function connected() {
    return Boolean(session && Date.now() < session.expiresAt);
  }

  async function request(path, active, signal) {
    signal?.throwIfAborted();
    if (active !== session || !connected()) throw new Error("Reconnect Gmail to continue.");
    const response = await fetch(GMAIL_API + path, {
      headers: { Authorization: "Bearer " + active.token },
      signal,
    });
    if (active !== session) throw new DOMException("Gmail disconnected.", "AbortError");
    if (response.status === 401) {
      session = null;
      throw new Error("Gmail authorization expired. Reconnect Gmail to continue.");
    }
    if (response.status === 403) {
      throw new Error("Gmail access was denied. Check that Gmail API is enabled and this account has read-only access.");
    }
    if (!response.ok) {
      const error = new Error("Gmail could not complete the request (" + response.status + ").");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function connect() {
    if (connection) return connection;
    const oauth = globalThis.google?.accounts?.oauth2;
    if (!oauth) return Promise.reject(new Error("Google sign-in is unavailable. Reload the page and try again."));

    const version = ++connectionVersion;
    connection = new Promise((resolve, reject) => {
      const client = oauth.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        include_granted_scopes: false,
        callback(response) {
          if (version !== connectionVersion) {
            reject(new DOMException("Gmail disconnected.", "AbortError"));
            return;
          }
          if (response.error || !response.access_token) {
            reject(new Error("Google did not authorize Gmail access. Try connecting again."));
            return;
          }
          if (!oauth.hasGrantedAllScopes(response, GMAIL_SCOPE)) {
            reject(new Error("Allow read-only Gmail access to import an application."));
            return;
          }
          session = {
            token: response.access_token,
            expiresAt: Date.now() + Number(response.expires_in) * 1000,
          };
          resolve();
        },
        error_callback(error) {
          reject(new Error(error.type === "popup_closed"
            ? "The Google sign-in window was closed."
            : "Google sign-in could not open. Allow pop-ups and try again."));
        },
      });
      client.requestAccessToken({ prompt: "select_account" });
    }).finally(() => {
      if (version === connectionVersion) connection = null;
    });

    return connection;
  }

  async function importOne({ signal, onProgress } = {}) {
    const active = session;
    if (!connected()) throw new Error("Connect Gmail to import an application.");
    let checked = 0;
    let pageToken;
    do {
      const query = new URLSearchParams({ q: SEARCH, maxResults: "50" });
      if (pageToken) query.set("pageToken", pageToken);
      const page = await request("/messages?" + query, active, signal);
      for (const { id } of page.messages ?? []) {
        let message;
        try {
          message = await request("/messages/" + encodeURIComponent(id) + "?format=full", active, signal);
        } catch (error) {
          if (error.status === 404) continue; // A candidate may have been deleted after listing.
          throw error;
        }
        onProgress?.({ checked: ++checked });
        const match = extractConfirmation({
          subject: header(message.payload, "subject"),
          from: header(message.payload, "from"),
          body: bodyText(message.payload),
        });
        if (!match) continue;
        const receivedAt = new Date(Number(message.internalDate));
        if (!message.internalDate || !Number.isFinite(receivedAt.getTime())) continue;
        const profile = await request("/profile", active, signal);
        const inbox = "https://mail.google.com/mail/u/" + encodeURIComponent(profile.emailAddress) + "/";
        return {
          ...match,
          messageId: message.id,
          threadId: message.threadId,
          receivedAt: receivedAt.toISOString(),
          gmailUrl: inbox + "#all/" + encodeURIComponent(message.threadId || message.id),
        };
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return null;
  }

  return {
    connect,
    get connected() { return connected(); },
    disconnect() {
      session = null;
      connection = null;
      connectionVersion += 1;
    },
    importOne,
  };
}
