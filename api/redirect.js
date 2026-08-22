const { normalizeSlug, readLinks } = require("./_linksStore");

module.exports = async (req, res) => {
  try {
    const slug = normalizeSlug(req.query && req.query.slug);

    if (!slug) {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Slug is required." }));
      return;
    }

    const links = await readLinks();
    const destination = links[slug];

    if (!destination) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Short link not found.");
      return;
    }

    res.statusCode = 302;
    res.setHeader("location", destination);
    res.end();
  } catch (error) {
    res.statusCode = error.status || 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message || "Something went wrong." }));
  }
};
