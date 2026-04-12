# Nurse Your Nails

Static website for Nurse Your Nails (Middleton, WI), deployed to
Cloudflare Pages and live at https://nurseyournails.com.

## Structure

- `public/` — the deployed site (HTML, CSS, images, sitemap, robots.txt)
- `scripts/` — maintenance scripts

## Local development

```sh
npm install      # installs sharp (only used for `npm run optimize`)
npm run serve    # serves public/ on a local port
```

## Image optimization

Drop new images into `public/assets/images/` and run:

```sh
npm run optimize
```

This compresses any image over 50KB in place (jpeg/webp at q80, png at
max compression). Idempotent — safe to re-run.

## Deployment

Deployed via Cloudflare Pages connected to the GitHub repo. Pushes to
`main` deploy automatically. Pages settings:

- Build command: *(blank)*
- Build output directory: `public`
- Root directory: `/`
