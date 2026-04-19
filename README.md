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
npm run lint:css    # ESLint CSS Baseline check on src/assets/css/
```

## Refreshing the gallery

`npm run refresh-gallery` downloads a fresh image set from the shared Google
Drive folder, replaces everything under `public/assets/images/gallery/`, and
rewrites the gallery tile block and home-page preview to match. Requires
`pipx` on PATH (used to invoke `gdown`). Install with
`brew install pipx && pipx ensurepath` on macOS.

The command is end-to-end: it stages WebP conversions in a temp directory,
swaps them into `public/assets/images/gallery/` only after all succeed, runs
`npm run optimize` to regenerate responsive variants, wraps new `<img>` tags
via `scripts/wrap-pictures.mjs`, and runs `npm run build` at the end. After
it finishes, verify locally with `npm run serve` at `/` and `/gallery/`,
including a mobile viewport.

Files numbered in the Drive folder (e.g. `01_intro.jpg`) keep their numbers
as their gallery slot. Unnumbered files get appended after the highest
existing slot in alphabetical order. Two files claiming the same slot, or
fewer than four images total, is an error.

Typical edit loop: edit `src/`, run `npm run build`, check the output via
`npm run serve`, commit both `src/` and `public/`.

## Deployment

Deployed via Cloudflare Pages connected to the GitHub repo. Cloudflare
serves `public/` directly; there is no remote build step.
