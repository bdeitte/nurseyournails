# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static marketing site for Nurse Your Nails (Middleton, WI), live at https://nurseyournails.com. Deployed via Cloudflare Pages on push to `main` — there is no build step. The entire deployed artifact is `public/`.

## Commands

- `npm install` — installs `sharp` (image optimization) and `lighthouse` (audits)
- `npm run serve` — serves `public/` locally via `npx serve`
- `npm run optimize` — runs `scripts/optimize-images.mjs` over `public/assets/images/`
- `npm run lighthouse -- <url> [--preset=desktop] [--only-categories=performance] [--output=json] [--output-path=...]` — runs Lighthouse audits against local or production. Example: `npm run lighthouse -- http://localhost:3000 --preset=desktop --output=json --output-path=./lh.json --quiet --chrome-flags='--headless'`. Output artifacts (`lh-*.json`, `*.report.html`) are gitignored at the repo root.
- `npm run lint:css` — runs ESLint with `@eslint/css` over `public/assets/css/**/*.css`. Enforces `css/use-baseline` at `available: "widely"`, so any CSS feature that is not in the widely-available Baseline is a lint error. Note: inline `<style>` blocks still left in HTML pages (per-page theme vars and per-page `vwb-*` builder classes) are NOT covered by this lint.

The only lint is `npm run lint:css` (CSS Baseline enforcement). There is no test or build command. Node >= 20.19.0.

## Architecture

**Static HTML, one directory per route.** Each page lives at `public/<slug>/index.html` and is served at `/<slug>/`. The home page is `public/index.html`, served at `/`. `public/sitemap.xml` lists the canonical public URLs the site wants indexed. Adding a new public page means creating `public/<slug>/index.html` and adding the URL to `sitemap.xml`.

**Assets use descriptive nested paths.** CSS lives at `public/assets/css/site.css`. Images live under `public/assets/images/<page-folder>/<role>.{jpg,jpeg,png,webp}` — `shared/` for cross-page chrome (logo, favicon, social-share), and a folder named after each page that has its own images (`home/`, `about-me/`, `foot-care/`, `gallery/`, `manicures/`, `my-business/`, `new-client-special/`, `products/`, `reviews/`). Routes with no images (currently `price-list/`) have no image folder. Names are kebab-case and semantic (`hero`, `studio-interior`, `family-portrait`); generic gallery tiles are numbered (`gallery/01.webp`). Responsive variants live alongside their source as `<role>-400.webp` / `-800.webp` / `-1200.webp`. When replacing an asset, update all HTML references — there is no asset pipeline to rewrite them.

**Treat pages as mostly hand-edited output** Small targeted edits are fine, but wholesale restructuring of a page's markup risks breaking builder-generated CSS selectors that reference IDs like `#vZa50e...`.

**Structured data and SEO metadata** (JSON-LD `NailSalon`, OG tags, canonical URLs) are inlined per-page in `<head>`. When editing business details (address, phone, hours), update the JSON-LD block in addition to any visible HTML.

## Image optimization

`scripts/optimize-images.mjs` runs two passes over `public/assets/images/`:

1. **In-place re-encode.** JPG/JPEG/PNG/WebP files ≥ 50KB are re-encoded only if the output saves ≥ 10%. JPEG/WebP at q80; PNG at max zlib. No resizing, no format change, no filename change. Recurses into the per-page subdirectories.
2. **Responsive WebP variants.** For each JPG/JPEG/PNG/WebP original ≥ 400px wide, writes `<role>-400.webp`, `-800.webp`, and `-1200.webp` alongside the source under its page folder (where the original is wide enough). Updates `public/assets/images/variants.json` — keyed by relative path without extension (e.g. `"foot-care/spa-pedicure"`) — mapping each original to its variants. Only regenerates variants that are missing or older than the source, so the script stays idempotent.

`scripts/wrap-pictures.mjs` wraps every `<img>` that references an asset in `variants.json` with `<picture>` + `<source type="image/webp" srcset="...">`. Idempotent: re-running detects already-wrapped images by scanning for the nearest unmatched `<picture>...</picture>` pair. Skips the site logo (`shared/logo*`) since both logo instances are hand-tuned in-place.

## Making changes

When making a set of changes, use chrome-devtools to take a snapshot before and after you make the changes to ensure nothing unepxected has changed.  Also use list_console_messages to ensure nothing unexpected is happening.

Ensure all changes look reasonable at a mobile screen size.

After any edit to a file under `public/assets/css/`, run `npm run lint:css` and ensure it exits clean. CSS changes that introduce non-Baseline (widely-available) features must be reverted or guarded with `@supports`.

For significant changes, run lighthouse at the end and ensure all numbers are at 98 or above.
