const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { normalizeSlug, normalizeUrl, readLinks, saveLink } = require("./api/_linksStore");

const PORT = Number(process.env.PORT || 3174);
const HOME_FILE = path.join(__dirname, "public", "index.html");

function send(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(text);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), "application/json; charset=utf-8");
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/") {
      send(res, 200, await fs.readFile(HOME_FILE, "utf8"), "text/html; charset=utf-8");
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/links") {
      sendJson(res, 200, await readLinks());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/links") {
      const body = JSON.parse(await readBody(req) || "{}");
      const slug = normalizeSlug(body.slug);

      if (!slug || !body.url) {
        sendJson(res, 400, { error: "Short text and URL are required." });
        return;
      }

      const destination = normalizeUrl(body.url);
      await saveLink(slug, destination);
      sendJson(res, 200, { success: true, slug, url: destination });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/s/")) {
      const slug = normalizeSlug(decodeURIComponent(url.pathname.replace("/s/", "")));
      const links = await readLinks();
      const destination = links[slug];

      if (!destination) {
        send(res, 404, "Short link not found.");
        return;
      }

      res.writeHead(302, { location: destination });
      res.end();
      return;
    }

    send(res, 404, "Not found.");
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Something went wrong." });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Tiny Links running at http://localhost:${PORT}`);
  });
}

module.exports = server;
