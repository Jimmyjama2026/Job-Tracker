# Personal application tracker and Summer 2027 internship finder

## Gmail sync through Codex

Use the Gmail connector already connected to my account. To run a sync, say **Sync my applications** in Codex with this project open. Codex searches and reads recruiting messages and updates [private/applications.md](private/applications.md). This workflow runs on demand and requires no local server, Node installation, Google Cloud project, or additional account connection.

For the first import, save one clear confirmation. For broader sync, ask how far back to scan, record the completed scan window, and include a small overlap on subsequent runs. Paginate search results before marking the window complete. Use read operations on Gmail and save only the company, role, stage, dated event summaries, identifiers needed for matching, and source links.

Match updates by Gmail thread or requisition ID first, then by an unambiguous company and role. Deduplicate events by Gmail message ID. If an older email is found later, add it to the timeline and keep the newer stage. Keep manual corrections and route uncertain messages to a review queue where I can attach, create, or dismiss them.

Track Applied, Response, Assessment, Interview, Offer, Rejected, and Withdrawn. Keep the Markdown tracker readable with a summary table and dated timelines. Store manual entries in the same tracker.

## Internship discovery

Use my confirmed résumé skills and preferences for roles, locations, and work arrangements. Allow manual entry when a résumé has no usable text. Search an editable list of verified public Greenhouse boards and report the boards checked and any failures. Rank explicit Summer 2027 matches first, label plausible undated internships **Term unconfirmed**, and exclude explicitly different terms. Explain matches and include the original posting links.

Save interesting roles in the project. Opening a posting leaves it saved. Mark a saved role applied manually or link a clear Gmail confirmation. Route uncertain links to review.

## Verification

Repeat a sync and verify it adds no duplicate applications or timeline events. Check multiple roles at one employer, ambiguous replies, older emails found later, and saved listings followed by confirmations. For discovery, check explicit and missing terms, duplicate postings, and partial board failures. A future dashboard can read the saved tracker data, with Gmail sync continuing through Codex.
