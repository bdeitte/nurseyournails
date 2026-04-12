# Nurse Your Nails

Static website for Nurse Your Nails deployed to Cloudflare Pages.
Live at https://nurseyournails.com.

## Structure

- `public/` — the deployed site (HTML, CSS, images, sitemap, robots.txt)
- `scripts/` — maintenance scripts

## Local development

```sh
npm install      # installs sharp (only used for `npm run optimize`)
npm run serve    # serves public/ on a local port
```

## Deployment

Deployed via Cloudflare Pages connected to the GitHub repo. Build output directory: `public`

