const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3174);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "links.json");
const HOME_FILE = path.join(__dirname, "public", "index.html");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "{}\n", "utf8");
  }
}

async function readLinks() {
  await ensureStore();
  const text = await fs.readFile(DATA_FILE, "utf8");
  try {
    const links = JSON.parse(text);
    return links && typeof links === "object" && !Array.isArray(links) ? links : {};
  } catch {
    return {};
  }
}

async function writeLinks(links) {
  await ensureStore();
  await fs.writeFile(DATA_FILE, `${JSON.stringify(links, null, 2)}\n`, "utf8");
}

function send(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(text);
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isValidUrl(urlString) {
  try {
    // If the URL doesn't start with a protocol, add https://
    const urlToTest = /^https?:\/\//i.test(urlString) ? urlString : `https://${urlString}`;
    const url = new URL(urlToTest);
    
    // Check if it has a valid hostname with at least a dot or is localhost
    const hostname = url.hostname;
    if (!hostname) return false;
    
    // Allow localhost without a dot, otherwise require at least one dot for a domain
    if (hostname !== 'localhost' && !hostname.includes('.')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

async function createLink(req, res) {
  const body = await readBody(req);
  const form = new URLSearchParams(body);
  const slug = normalizeSlug(form.get("slug"));
  const url = String(form.get("url") || "").trim();

  if (!slug || !url) {
    send(res, 400, "Short text and URL are required.");
    return true;
  }

  if (!isValidUrl(url)) {
    send(res, 400, "Please add valid URL.");
    return true;
  }

  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const links = await readLinks();
    links[slug] = parsed.toString();
    await writeLinks(links);

    res.writeHead(302, { location: "/" });
    res.end();
  } catch {
    send(res, 400, "Please add valid URL.");
  }

  return true;
}

async function redirectShortLink(res, url) {
  const slug = normalizeSlug(decodeURIComponent(url.pathname.replace("/s/", "")));
  const links = await readLinks();
  const destination = links[slug];

  if (!destination) {
    send(res, 404, "Short link not found.");
    return;
  }

  res.writeHead(302, { location: destination });
  res.end();
}

async function showHome(res) {
  let html = await fs.readFile(HOME_FILE, "utf8");
  const links = await readLinks();
  const items = Object.keys(links)
    .map((slug) => `<li><a href="/s/${slug}">/s/${slug}</a> - ${links[slug]}</li>`)
    .join("");

  html = html.replace("{{links}}", items || "<li>No links yet.</li>");
  send(res, 200, html, "text/html; charset=utf-8");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/") {
      await showHome(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/add") {
      await createLink(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/s/")) {
      await redirectShortLink(res, url);
      return;
    }

    send(res, 404, "Not found.");
  } catch (error) {
    send(res, 500, error.message || "Something went wrong.");
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Link shortener running at http://localhost:${PORT}`);
  });
}

module.exports = server;
