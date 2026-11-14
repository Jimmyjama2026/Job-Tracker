(() => {
  const input = document.getElementById("resume");
  const status = document.getElementById("resume-status");
  const root = document.getElementById("match-profile");
  const seed = window.resumeSeed || {};
  const key = "cs191-resume-profile";
  root.innerHTML = `
    <form>
      <label>Degree <input name="degree" required></label>
      <label>Expected graduation <input name="graduation" type="month" required></label>
      <label>Skills (comma separated) <input name="skills" required></label>
      <label>Experience <select name="experience"><option value="projects">Coursework or projects</option><option value="prior internship">Prior internship</option></select></label>
      <button>Save profile and rank postings</button>
    </form>
    <p role="status"></p><ul></ul>`;
  const form = root.querySelector("form");
  const feedback = root.querySelector("p");
  const list = root.querySelector("ul");
  const fields = ["degree", "graduation", "skills", "experience"];
  let profile = seed;
  try { profile = JSON.parse(localStorage.getItem(key)) || seed; } catch {}
  for (const name of fields) form.elements[name].value = profile[name] || (name === "experience" ? "projects" : "");
  const jobs = [
    { company: "Rivian", role: "Software Engineering Intern", from: "2027-09", through: "2029-06", skills: ["Python", "JavaScript", "software development"], url: "https://careers.rivian.com/careers-home/jobs/34303?lang=en-US" },
    { company: "Visa", role: "Sophomore Software Engineer Intern", from: "2028-12", through: "2029-08", skills: ["Python", "JavaScript", "software development"], url: "https://visa.wd5.myworkdayjobs.com/en-US/Visa/job/XMLNAME-2027-Sophomore-Internship-Program---Software-Engineer-Intern--Foster-City_REF088591W-1" },
    { company: "Formulary Financial", role: "Software Engineering Intern", from: "2028-01", through: "2029-12", skills: ["Python", "SQL"], url: "https://jobs.ashbyhq.com/formulary/bbc4fef5-3cff-4879-89bc-65aba1214b04" },
    { company: "Vercel", role: "Software Engineering Intern", from: "2027-09", through: "2028-06", skills: ["JavaScript", "TypeScript"], url: "https://job-boards.greenhouse.io/vercel/jobs/6181759004-4" },
    { company: "Scale AI", role: "Software Engineering Intern", from: "2027-09", through: "2028-06", skills: ["Python", "TypeScript", "React", "MongoDB"], prior: true, url: "https://job-boards.greenhouse.io/scaleai/jobs/4730845005" },
  ];
  function rank() {
    list.replaceChildren();
    if (!profile.graduation || !profile.degree || !profile.skills) {
      feedback.textContent = "Save your degree, graduation date, and skills to see matches.";
      return;
    }
    const skills = new Set(profile.skills.toLowerCase().split(",").map(skill => skill.trim()));
    const results = jobs.filter(job => profile.graduation >= job.from && profile.graduation <= job.through && (!job.prior || profile.experience === "prior internship")).map(job => {
      const matched = job.skills.filter(skill => skills.has(skill.toLowerCase()));
      return { job, matched, score: Math.round(100 * matched.length / job.skills.length) };
    }).sort((a, b) => b.score - a.score);
    feedback.textContent = results.length + " eligible graduation windows in the curated Summer 2027 list. Percentages measure listed skill overlap. Check other eligibility requirements on the posting.";
    for (const { job, matched, score } of results) {
      const item = document.createElement("li");
      const apply = document.createElement("a");
      apply.href = job.url;
      apply.textContent = "Apply at " + job.company;
      const gaps = job.skills.filter(skill => !matched.includes(skill));
      item.append(job.company + " · " + job.role + " · " + score + "% skill match. Matches: " + (matched.join(", ") || "none") + ". Unconfirmed skills: " + (gaps.join(", ") || "none") + ". ", apply);
      list.append(item);
    }
  }
  form.onsubmit = event => {
    event.preventDefault();
    profile = Object.fromEntries(fields.map(name => [name, form.elements[name].value.trim()]));
    try { localStorage.setItem(key, JSON.stringify(profile)); }
    catch { status.textContent = "Browser storage is unavailable for profile changes."; }
    rank();
  };
  rank();
  if (seed.pdf) {
    const link = document.createElement("a");
    link.href = seed.pdf;
    link.textContent = "Open saved résumé";
    status.replaceChildren(link);
  }
  const request = indexedDB.open("cs191-resume", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("files");
  request.onsuccess = () => {
    const db = request.result;
    db.transaction("files").objectStore("files").get("resume").onsuccess = event => {
      const saved = event.target.result;
      if (saved) status.textContent = "Saved in this browser: " + saved.name;
    };
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      if (!/\.pdf$/i.test(file.name)) {
        status.textContent = "Choose a PDF résumé.";
        return;
      }
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, "resume");
      tx.oncomplete = () => { status.textContent = "Saved in this browser: " + file.name + ". Update the profile below if its details changed."; };
      tx.onabort = () => { status.textContent = "Could not save the PDF in this browser."; };
    };
  };
  request.onerror = () => { input.disabled = true; status.append(" Browser PDF storage is unavailable."); };
})();
