# Tiny Links

A lightweight URL shortener built with Node.js, JavaScript, HTML, and CSS.

## Local Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3174
```

## Vercel Deployment

This project works on Vercel using serverless API routes:

- `GET /api/links` lists saved links.
- `POST /api/links` creates or updates a short link.
- `GET /s/:slug` redirects to the saved destination.

Because Vercel serverless functions cannot permanently write to local files, deployed link creation uses GitHub as storage. Add this environment variable in Vercel:

```text
GITHUB_TOKEN=your_github_token_with_repo_contents_access
```

For public read and redirect, the app reads `data/links.json` from GitHub.

## Example

Add:

```text
short text: github
full link: https://github.com/your-name
```

Then visit:

```text
/s/github
```
