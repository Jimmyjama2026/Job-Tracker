import assert from "node:assert/strict";
import test from "node:test";
import { createGmailClient, extractConfirmation } from "./gmail.js";

test("extracts employer and role from common confirmation formats", () => {
  const expected = { company: "Acme", role: "Software Engineer Intern" };
  assert.deepEqual(extractConfirmation({
    subject: "Thank you for applying",
    body: "We've received your application for the Software Engineer Intern position at Acme.",
  }), expected);
  assert.deepEqual(extractConfirmation({
    subject: "Application received: Software Engineer Intern",
    from: "Acme Recruiting <jobs@example.org>",
  }), expected);
  assert.deepEqual(extractConfirmation({
    subject: "Application confirmation",
    body: "Company: Acme\nPosition: Software Engineer Intern",
  }), expected);
});

test("skips updates, quoted confirmations, and conflicting roles", () => {
  const confirmation = "Thank you for applying for the Software Engineer Intern role at Acme.";
  assert.equal(extractConfirmation({
    subject: "Application status",
    body: confirmation + "\nUnfortunately we are moving forward with other candidates.",
  }), null);
  assert.equal(extractConfirmation({
    subject: "Quick question",
    body: "Can you confirm your availability?\nOn Monday someone wrote:\n" + confirmation,
  }), null);
  assert.equal(extractConfirmation({
    subject: "Application confirmation: Data Scientist at Acme",
    body: confirmation,
  }), null);
  assert.equal(extractConfirmation({ subject: "Application received" }), null);
  assert.equal(extractConfirmation({
    subject: "Thank you for applying",
    body: "Thank you for applying for the Engineer position at Acme and taking the time to meet us.",
  }), null);
});

test("searches across pages, returns the first clear match, and stops reading messages", async t => {
  const originalGoogle = globalThis.google;
  t.after(() => { globalThis.google = originalGoogle; });
  globalThis.google = {
    accounts: { oauth2: {
      initTokenClient(options) {
        assert.equal(options.scope, "https://www.googleapis.com/auth/gmail.readonly");
        assert.equal(options.include_granted_scopes, false);
        return {
          requestAccessToken() {
            options.callback({ access_token: "fake-token", expires_in: 300 });
          },
        };
      },
      hasGrantedAllScopes: () => true,
    } },
  };

  const requests = [];
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    assert.equal(options.headers.Authorization, "Bearer fake-token");
    requests.push(url.pathname.split("/").at(-1));
    if (url.pathname.endsWith("/messages")) {
      return Response.json(url.searchParams.has("pageToken")
        ? { messages: [{ id: "match" }, { id: "later" }] }
        : { messages: [{ id: "unclear" }], nextPageToken: "page2" });
    }
    if (url.pathname.endsWith("/profile")) return Response.json({ emailAddress: "me@example.test" });
    const id = url.pathname.split("/").at(-1);
    return Response.json({
      id,
      threadId: "thread-" + id,
      internalDate: "1794531600000",
      payload: {
        mimeType: "multipart/alternative",
        headers: [{ name: "Subject", value: "Application received" }],
        parts: [{
          mimeType: "text/plain",
          body: { data: Buffer.from(id === "match"
            ? "Company: Acme\nPosition: Software Engineer Intern"
            : "Thank you.").toString("base64url") },
        }],
      },
    });
  });

  const client = createGmailClient("example.apps.googleusercontent.com");
  await client.connect();
  const progress = [];
  const first = await client.importOne({ onProgress: ({ checked }) => progress.push(checked) });
  assert.equal(first.messageId, "match");
  assert.equal(first.company, "Acme");
  assert.equal(first.role, "Software Engineer Intern");
  assert.deepEqual(progress, [1, 2]);
  assert.deepEqual(requests, ["messages", "unclear", "messages", "match", "profile"]);
  assert.deepEqual(await client.importOne(), first);
  client.disconnect();
  assert.equal(client.connected, false);
  await assert.rejects(client.importOne(), /Connect Gmail/);
});
