const {
  normalizeSlug,
  normalizeUrl,
  readLinks,
  saveLink,
} = require("./_linksStore");

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, await readLinks());
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readBody(req);
    const slug = normalizeSlug(body.slug);

    if (!slug || !body.url) {
      sendJson(res, 400, { error: "Short text and URL are required." });
      return;
    }

    const destination = normalizeUrl(body.url);
    await saveLink(slug, destination);
    sendJson(res, 200, { success: true, slug, url: destination });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Something went wrong.",
    });
  }
};
