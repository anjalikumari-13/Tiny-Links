const fs = require("node:fs/promises");
const path = require("node:path");
const https = require("node:https");

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "anjalikumari-13";
const REPO_NAME = process.env.GITHUB_REPO_NAME || "Tiny-Links";
const REPO_BRANCH = process.env.GITHUB_BRANCH || "main";
const DATA_FILE_PATH = process.env.LINKS_FILE_PATH || "data/links.json";
const LOCAL_DATA_FILE = path.join(process.cwd(), DATA_FILE_PATH);

function requestJson(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || "GET",
      headers: {
        "user-agent": "tiny-links",
        accept: "application/vnd.github+json",
        ...options.headers,
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          const error = new Error(data && data.message ? data.message : `Request failed with ${res.statusCode}`);
          error.status = res.statusCode;
          error.data = data;
          reject(error);
        }
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function sanitizeLinks(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);

  if (!url.hostname) {
    throw new Error("Please add valid URL.");
  }

  if (url.hostname !== "localhost" && !url.hostname.includes(".")) {
    throw new Error("Please add valid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Please add valid URL.");
  }

  return url.toString();
}

async function readLocalLinks() {
  try {
    const text = await fs.readFile(LOCAL_DATA_FILE, "utf8");
    return sanitizeLinks(JSON.parse(text));
  } catch {
    return {};
  }
}

async function writeLocalLinks(links) {
  await fs.mkdir(path.dirname(LOCAL_DATA_FILE), { recursive: true });
  await fs.writeFile(LOCAL_DATA_FILE, `${JSON.stringify(links, null, 2)}\n`, "utf8");
}

async function readLinksFromGitHub() {
  const encodedPath = DATA_FILE_PATH.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${encodedPath}`;
  try {
    return sanitizeLinks(await requestJson(url));
  } catch {
    return {};
  }
}

async function getGitHubFile(token) {
  const encodedPath = DATA_FILE_PATH.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}?ref=${encodeURIComponent(REPO_BRANCH)}`;
  return requestJson(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
}

async function writeLinksToGitHub(links) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    const error = new Error("GITHUB_TOKEN is missing in Vercel environment variables.");
    error.status = 500;
    throw error;
  }

  let sha;
  try {
    const current = await getGitHubFile(token);
    sha = current.sha;
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }

  const content = Buffer.from(`${JSON.stringify(links, null, 2)}\n`, "utf8").toString("base64");
  const encodedPath = DATA_FILE_PATH.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`;

  await requestJson(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
  }, JSON.stringify({
    message: "Update short links",
    branch: REPO_BRANCH,
    content,
    sha,
  }));
}

async function readLinks() {
  if (process.env.VERCEL || process.env.GITHUB_TOKEN) {
    return readLinksFromGitHub();
  }

  return readLocalLinks();
}

async function saveLink(slug, destination) {
  const links = await readLinks();
  links[slug] = destination;

  if (process.env.VERCEL || process.env.GITHUB_TOKEN) {
    await writeLinksToGitHub(links);
  } else {
    await writeLocalLinks(links);
  }

  return links;
}

module.exports = {
  normalizeSlug,
  normalizeUrl,
  readLinks,
  saveLink,
};
