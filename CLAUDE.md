# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static marketing site for Nurse Your Nails (Middleton, WI), live at https://nurseyournails.com. Deployed via Cloudflare Pages on push to `main`. Cloudflare serves `public/` as the deployed artifact; the project uses a local build step to generate `public/` from `src/`.

**Source of truth is `src/` for HTML and CSS.** `src/` holds hand-edited, Prettier-formatted HTML and CSS with semantic identifiers. `public/` is the minified build output for HTML/CSS — still checked in so Cloudflare can serve it without running any build — and must never be hand-edited for those file types. Every HTML or CSS change flows: edit `src/` → `npm run build` → commit both.

**Images are the exception.** The canonical image tree lives at `public/assets/images/` and is not duplicated into `src/`. `npm run build` never touches that tree; `npm run optimize` writes into it in place. When replacing or adding an image:

1. Drop the new file into `public/assets/images/<page-folder>/`.
2. Run `npm run optimize` to regenerate the `-400.webp`/`-800.webp`/`-1200.webp` responsive variants and refresh `public/assets/images/variants.json`. Skipping this leaves stale variants or a stale manifest.
3. Update the `<img src>` references in `src/`.
4. If the change leaves a bare `<img>` in `src/` that should now be wrapped — i.e. a new path, or a replacement whose old source had no `variants.json` entry (so the `<img>` was never wrapped in `<picture>`) and whose new source is ≥ 400px wide — run `node scripts/wrap-pictures.mjs` to wrap it from the refreshed manifest. The script only wraps bare `<img>` tags and skips anything already inside `<picture>`, so if a replacement upgrades an already-wrapped image (e.g. 700px → 1300px adds new `800w`/`1200w` variants), update the existing `<source srcset>` in `src/` by hand.
5. Run `npm run build` to regenerate `public/` HTML/CSS and commit everything together.

## Commands

- `npm install` — installs build and tooling dependencies (`sharp`, `lighthouse`, `prettier`, `html-minifier-terser`, `lightningcss`, `browserslist`)
- `npm run build` — runs `scripts/build.mjs`, which minifies `src/` HTML via `html-minifier-terser` and `src/assets/css/site.css` via the `lightningcss` JS API into `public/`. Also copies `robots.txt` and `sitemap.xml`.
- `npm run format` — runs Prettier over `src/**/*.{html,css}` in place
- `npm run serve` — serves `public/` locally via `npx serve`
- `npm run optimize` — runs `scripts/optimize-images.mjs` over `public/assets/images/`
- `npm run lighthouse -- <url> [--preset=desktop] [--only-categories=performance] [--output=json] [--output-path=...]` — runs Lighthouse audits against local or production. Example: `npm run lighthouse -- http://localhost:3000 --preset=desktop --output=json --output-path=./lh.json --quiet --chrome-flags='--headless'`. Output artifacts (`lh-*.json`, `*.report.html`) are gitignored at the repo root.
- `npm run lint:css` — runs ESLint with `@eslint/css` over `src/assets/css/**/*.css`. Enforces `css/use-baseline` at `available: "widely"`, so any CSS feature that is not in the widely-available Baseline is a lint error.

The only lint is `npm run lint:css` (CSS Baseline enforcement). There is no test command. Node >= 20.19.0.

## Architecture

**Static HTML, one directory per route.** Each page lives at `src/<slug>/index.html` and is built to `public/<slug>/index.html`, served at `/<slug>/`. The home page is `src/index.html` → `public/index.html`, served at `/`. `src/sitemap.xml` lists the canonical public URLs the site wants indexed. Adding a new public page means creating `src/<slug>/index.html`, adding it to the `PAGES` array in `scripts/build.mjs`, and adding the URL to `src/sitemap.xml`.

**Assets use descriptive nested paths.** CSS source lives at `src/assets/css/site.css` (minified to `public/assets/css/site.css` at build time). Images live only under `public/assets/images/<page-folder>/<role>.{jpg,jpeg,png,webp}` — they are not duplicated into `src/`, since the build copies the existing `public/assets/images/` tree through untouched. Layout: `shared/` for cross-page chrome (logo, favicon, social-share), plus a folder named after each page that has its own images (`home/`, `about-me/`, `foot-care/`, `gallery/`, `manicures/`, `my-business/`, `new-client-special/`, `products/`, `reviews/`). Routes with no images (currently `price-list/`) have no image folder. Names are kebab-case and semantic (`hero`, `studio-interior`, `family-portrait`); generic gallery tiles are numbered (`gallery/01.webp`). Responsive variants live alongside their source as `<role>-400.webp` / `-800.webp` / `-1200.webp`. When replacing an asset, update all HTML references in `src/` — there is no asset pipeline to rewrite them.

**CSS architecture.** `src/assets/css/site.css` is a tiny entrypoint that `@import`s `theme.css` (CSS custom properties), `base.css` (element resets and typography), `components.css` (hand-written component classes like `.hero`, `.cta-button`, `.service-card`), `utilities.css` (a small `u-`-prefixed utility set used sparingly), and `photoswipe.css` (PhotoSwipe's own CSS, required by the reviews page lightbox). `lightningcss` bundles them during build. Theme colors use semantic custom properties (`--color-navy`, `--color-gold`, etc.) and the canonical breakpoints are `max-width: 1200px` (tablet) and `max-width: 767px` (mobile). No `!important` outside `photoswipe.css`. No inline `<style>` blocks anywhere in `src/*.html` — page-specific one-offs live inside `components.css` scoped under the page's section IDs (`#home-sNN`, `#foot-care-sNN`).

**Semantic section IDs.** Builder-generated opaque hashes were renamed to readable names in `src/`: the outer page wrapper is `#page-wrapper`, cross-page chrome is `#shared-sNN`, and page-local sections are `#<page-slug>-sNN` numbered in body DOM order.

**Structured data and SEO metadata** (JSON-LD `NailSalon`, OG tags, canonical URLs) are inlined per-page in `<head>`. When editing business details (address, phone, hours), update the JSON-LD block in addition to any visible HTML.

## Image optimization

`scripts/optimize-images.mjs` runs two passes over `public/assets/images/`:

1. **In-place re-encode.** JPG/JPEG/PNG/WebP files ≥ 50KB are re-encoded only if the output saves ≥ 10%. JPEG/WebP at q80; PNG at max zlib. No resizing, no format change, no filename change. Recurses into the per-page subdirectories.
2. **Responsive WebP variants.** For each JPG/JPEG/PNG/WebP original ≥ 400px wide, writes `<role>-400.webp`, `-800.webp`, and `-1200.webp` alongside the source under its page folder (where the original is wide enough). Updates `public/assets/images/variants.json` — keyed by relative path without extension (e.g. `"foot-care/spa-pedicure"`) — mapping each original to its variants. Only regenerates variants that are missing or older than the source, so the script stays idempotent.

`scripts/wrap-pictures.mjs` wraps every `<img>` in `src/` that references an asset in `variants.json` with `<picture>` + `<source type="image/webp" srcset="...">`. Idempotent: re-running detects already-wrapped images by scanning for the nearest unmatched `<picture>...</picture>` pair. Skips the site logo (`shared/logo*`) since both logo instances are hand-tuned in-place. The manifest still lives under `public/assets/images/variants.json` because that's where `optimize-images.mjs` writes it.

## Making changes

For HTML and CSS, always edit `src/`, never `public/`. After any source change, run `npm run build` to regenerate `public/` and commit both directories together. The build step is deterministic — a rebuild with no source changes should produce zero diffs in `public/`. Images are the exception: edit them under `public/assets/images/` (see Architecture above).

When making a set of changes, use chrome-devtools to take a snapshot before and after you make the changes to ensure nothing unexpected has changed. Also use list_console_messages to ensure nothing unexpected is happening.

Ensure all changes look reasonable at a mobile screen size.

After any edit to a file under `src/assets/css/`, run `npm run lint:css` and ensure it exits clean. CSS changes that introduce non-Baseline (widely-available) features must be reverted or guarded with `@supports`.

For significant changes, run lighthouse against the built `public/` output (served via `npm run serve`) at the end and ensure all numbers are at 98 or above.
