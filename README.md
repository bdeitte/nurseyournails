# Nurse Your Nails

Static website for Nurse Your Nails deployed to Cloudflare Pages.
Live at https://nurseyournails.com.

## Structure

- `src/` — source of truth: hand-edited, Prettier-formatted HTML and CSS
- `public/` — minified build output served by Cloudflare (do not edit by hand)
- `scripts/` — `build.mjs`, image tooling, and other maintenance scripts

Both `src/` and `public/` are checked in. `src/` is where you make changes;
`public/` is regenerated from it by `npm run build`.

## Local development

```sh
npm install         # install build and tooling dependencies
npm run build       # regenerate public/ from src/
npm run serve       # serve public/ on a local port
npm run format      # Prettier over src/**/*.{html,css}
npm run lint        # ESLint CSS Baseline check on src/assets/css/
npm run refresh-gallery # Update gallery images and HTML for it
```

## Deployment

Deployed via Cloudflare Pages connected to the GitHub repo. Cloudflare
serves `public/` directly; there is no remote build step.
