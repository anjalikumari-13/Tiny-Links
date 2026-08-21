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

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

module.exports = async (req, res) => {
  try {
    const slug = normalizeSlug(decodeURIComponent(req.query.slug || ""));

    if (!slug) {
      res.status(400).json({ error: "Slug is required." });
      return;
    }

    const links = await getLinksFromGitHub();
    const destination = links[slug];

    if (!destination) {
      res.status(404).json({ error: "Short link not found." });
      return;
    }

    res.redirect(302, destination);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message || "Something went wrong." });
  }
};
