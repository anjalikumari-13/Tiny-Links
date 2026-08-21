const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = "anjalikumari-13";
const REPO_NAME = "Tiny-Links";
const DATA_FILE_PATH = "data/links.json";

async function getLinksFromGitHub() {
  try {
    const response = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: DATA_FILE_PATH,
    });

    const content = Buffer.from(response.data.content, "base64").toString("utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      return {};
    }
    throw error;
  }
}

async function updateLinksOnGitHub(links, currentSha = null) {
  const content = Buffer.from(JSON.stringify(links, null, 2) + "\n").toString(
    "base64"
  );

  try {
    let sha = currentSha;
    if (!sha) {
      try {
        const response = await octokit.repos.getContent({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path: DATA_FILE_PATH,
        });
        sha = response.data.sha;
      } catch {
        // File doesn't exist yet
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: DATA_FILE_PATH,
      message: `Update links: ${new Date().toISOString()}`,
      content,
      sha,
    });
  } catch (error) {
    console.error("Error updating GitHub:", error);
    throw error;
  }
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

function isValidUrl(urlString) {
  try {
    const urlToTest = /^https?:\/\//i.test(urlString)
      ? urlString
      : `https://${urlString}`;
    const url = new URL(urlToTest);

    const hostname = url.hostname;
    if (!hostname) return false;

    if (hostname !== "localhost" && !hostname.includes(".")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    // Debug: Check if token is set
    if (!process.env.GITHUB_TOKEN) {
      console.error("GITHUB_TOKEN is not set");
      res.status(500).json({ error: "Server configuration error: GITHUB_TOKEN not set" });
      return;
    }

    if (req.method === "POST") {
      // Parse JSON body
      let body = {};
      if (req.body) {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      }

      const { slug: rawSlug, url: rawUrl } = body;
      const slug = normalizeSlug(rawSlug);
      const url = String(rawUrl || "").trim();

      if (!slug || !url) {
        res.status(400).json({ error: "Short text and URL are required." });
        return;
      }

      if (!isValidUrl(url)) {
        res.status(400).json({ error: "Please add valid URL." });
        return;
      }

      const links = await getLinksFromGitHub();
      const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      links[slug] = parsed.toString();
      await updateLinksOnGitHub(links);

      res.status(200).json({ success: true, slug, url: parsed.toString() });
    } else if (req.method === "GET") {
      const links = await getLinksFromGitHub();
      res.status(200).json(links);
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ 
      error: error.message || "Something went wrong.",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};
