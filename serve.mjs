import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const files = new Map([
  ["/", ["index.html", "text/html"]],
  ["/style.css", ["style.css", "text/css"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/storage.js", ["storage.js", "text/javascript"]],
  ["/gmail.js", ["gmail.js", "text/javascript"]],
]);

createServer(async (request, response) => {
  const entry = files.get(request.url);
  if (!entry || request.method !== "GET") {
    response.writeHead(404).end("Not found");
    return;
  }
  const [file, type] = entry;
  try {
    const content = await readFile(new URL(file, import.meta.url));
    response.writeHead(200, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store" });
    response.end(content);
  } catch {
    response.writeHead(500).end("Could not read the requested file");
  }
}).listen(8000, "localhost", () => console.log("Open http://localhost:8000"));
