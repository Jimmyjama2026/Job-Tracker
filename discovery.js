const discovery = document.getElementById("discovery");
discovery.onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const board = form.elements.board.value.trim().toLowerCase();
  const keywords = form.elements.keywords.value.trim().toLowerCase();
  const status = document.getElementById("discovery-status");
  const listings = document.getElementById("listings");
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "Checking the public board…";
  listings.replaceChildren();
  try {
    const response = await fetch("https://boards-api.greenhouse.io/v1/boards/" + encodeURIComponent(board) + "/jobs");
    if (!response.ok) throw new Error("Board unavailable");
    const { jobs } = await response.json();
    const matches = jobs.flatMap(job => {
      const title = job.title.toLowerCase();
      const summer = /\bsummer\s+(?:2027|['’]27)\b|\b2027\s+summer\b/.test(title);
      if (!/\bintern(?:ship)?s?\b/.test(title) || !title.includes(keywords)) return [];
      if (!summer && /\b(?:19|20)\d{2}\b|\b(?:spring|fall|winter)\b/.test(title)) return [];
      const url = new URL(job.absolute_url);
      return url.protocol === "https:" ? [{ job, url, summer }] : [];
    }).sort((a, b) => Number(b.summer) - Number(a.summer));
    for (const { job, url, summer } of matches) {
      const item = document.createElement("li");
      const posting = document.createElement("a");
      posting.href = url.href;
      posting.textContent = job.title;
      const save = document.createElement("button");
      save.textContent = "Add to shortlist form";
      save.onclick = () => {
        const shortlist = document.getElementById("form");
        shortlist.elements.company.value = board;
        shortlist.elements.role.value = job.title;
        shortlist.elements.url.value = url.href;
        shortlist.elements.company.focus();
      };
      item.append(posting, " · " + (summer ? "Summer 2027" : "Term unconfirmed") + " · " + (job.location?.name || "Location unlisted") + " ", save);
      listings.append(item);
    }
    status.textContent = matches.length
      ? matches.length + " matches on " + board + "."
      : "This board loaded successfully. No internship titles matched. Try a different board or clear the keyword.";
  } catch {
    status.textContent = "Could not load this board. Check its Greenhouse board name and try again.";
  } finally {
    button.disabled = false;
  }
};
