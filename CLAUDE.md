# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static marketing site for Nurse Your Nails (Middleton, WI), live at https://nurseyournails.com. Deployed via Cloudflare Pages on push to `main` — there is no build step. The entire deployed artifact is `public/`.

## Commands

- `npm install` — installs `sharp` (only needed for image optimization)
- `npm run serve` — serves `public/` locally via `npx serve`
- `npm run optimize` — runs `scripts/optimize-images.mjs` over `public/assets/images/`

There is no lint, test, or build command. Node >= 20.18.1.

## Architecture

**Static HTML, one directory per route.** Each page lives at `public/<slug>/index.html` and is served at `/<slug>/`. The home page is `public/index.html`, served at `/`. `public/sitemap.xml` lists the canonical public URLs the site wants indexed. Adding a new public page means creating `public/<slug>/index.html` and adding the URL to `sitemap.xml`.

The site-builder export originally wrote the home page out twice (at `public/index.html` and `public/home/index.html`) and every page's nav "Home" link pointed at `home/`. That duplicate has been removed — all navs now link "Home" to `/`, which matches each page's canonical URL and `sitemap.xml`. If a future builder re-export reintroduces `public/home/` or rewrites Home links to `home/` or `/index.html`, delete the duplicate directory and rewrite the nav links back to `/`.

**Shared assets use content-hashed filenames.** CSS lives at `public/assets/css/<hash>.css` (currently a single file). Images live at `public/assets/images/<hash>.{jpg,jpeg,png,webp}`. When replacing an asset, update all HTML references — there is no asset pipeline to rewrite them.

**HTML is exported from a site builder** (evident from generated class names like `vwb-*`, large inline `<style>` blocks, `v-site`/`v-button` conventions, and repeated structural boilerplate). Treat pages as mostly hand-edited output: small targeted edits are fine, but wholesale restructuring of a page's markup risks breaking builder-generated CSS selectors that reference IDs like `#vZa50e...`.

**Structured data and SEO metadata** (JSON-LD `NailSalon`, OG tags, canonical URLs) are inlined per-page in `<head>`. When editing business details (address, phone, hours), update the JSON-LD block in addition to any visible HTML.

## Image optimization

`scripts/optimize-images.mjs` runs two passes over `public/assets/images/`:

1. **In-place re-encode.** JPG/JPEG/PNG/WebP files ≥ 50KB are re-encoded only if the output saves ≥ 10%. JPEG/WebP at q80; PNG at max zlib. No resizing, no format change, no filename change.
2. **Responsive WebP variants.** For each JPG/JPEG/PNG/WebP original ≥ 400px wide, writes `<hash>-400.webp`, `-800.webp`, and `-1200.webp` (where the original is wide enough). Updates `public/assets/images/variants.json` mapping each original to its variants. Only regenerates variants that are missing or older than the source, so the script stays idempotent.

`scripts/wrap-pictures.mjs` wraps every `<img>` that references an asset in `variants.json` with `<picture>` + `<source type="image/webp" srcset="...">`. Idempotent: re-running detects already-wrapped images by scanning for the nearest unmatched `<picture>...</picture>` pair. Skips the site logo (`f55b6d7ad9*`) since both logo instances are hand-tuned in-place.

## Builder re-export checklist

If the site builder re-exports pages and clobbers the perf/a11y work, reapply in this order. All changes are grep-able from `git log`.

1. Remove any reintroduced `public/home/` directory and rewrite nav "Home" links back to `/`.
2. Viewport meta on every page: drop `maximum-scale=1` so the viewport reads `width=device-width, initial-scale=1`.
3. Wrap each page's content in `<main id="divcontent">` (replacing `<div id="divcontent">`).
4. Desktop nav: wrap the `<li>` children of `<nav class="full-screen-navigation ...">` in `<ul class="nav-list">`. Run `node scripts/wrap-nav-ul.mjs` to do this across all pages.
5. Hero image on each page (first non-logo `<img>` inside `#divcontent`):
   - Remove `loading="lazy"`.
   - Add `fetchpriority="high"`, `decoding="async"`, and explicit `width`/`height` attributes matching the source image's natural dimensions.
   - Add a `<link rel="preload" as="image" href="<800w variant>" imagesrcset="..." imagesizes="100vw" fetchpriority="high">` in `<head>`.
6. Logo (`f55b6d7ad9*`, both desktop and mobile nav instances): remove `loading="lazy"`. The external CSS sets aspect-ratio + object-fit on `.logo-container img`, so width/height attributes are not needed on the logo itself.
7. Font Awesome: remove `<script src="https://kit.fontawesome.com/..."></script>` and replace every `far fa-check` / `far fa-warning` with inline SVG using the existing social-icon pattern (`<svg viewBox=... fill="currentColor" height="1em" aria-hidden="true">`).
8. Typekit: replace the blocking `<script src="https://use.typekit.net/kjo7nmc.js">...Typekit.load()` loader with non-blocking CSS: `<link rel="preconnect" href="https://use.typekit.net" crossorigin>` + `<link rel="preconnect" href="https://p.typekit.net" crossorigin>` + `<link rel="preload" as="style" href="https://use.typekit.net/kjo7nmc.css" onload="this.onload=null;this.rel='stylesheet'">` + `<noscript><link rel="stylesheet" href="https://use.typekit.net/kjo7nmc.css"></noscript>`.
9. Google Fonts: replace the two separate `fonts.googleapis.com/css?family=...` links with a single `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alata&family=Archivo+Narrow&display=swap">` plus the matching `preconnect` hints.
10. Re-run `npm run optimize` to regenerate `variants.json` and WebP variants.
11. Re-run `node scripts/wrap-pictures.mjs` to re-wrap raster `<img>` tags in `<picture>` with WebP `<source>`.
12. Confirm the external CSS (`public/assets/css/<hash>.css`) still contains `picture{display:contents}`, `picture>source{display:none}`, the `.v-site .v-grid .inner-grid > picture > .hierarchy` sizing override, the `.logo-container img{aspect-ratio:967/738;object-fit:contain}` rule, the `.full-screen-navigation>ul.nav-list{display:contents}` rule, and the `.review-stars.nyn-star-rating .verified svg` badge styling. These are appended after the bundled bootstrap block and must survive any CSS re-export.

## Making changes

When making a set of changes, use chrome-devtools to take a snapshot before and after you make the changes to ensure nothing unepxected has changed.  Also use list_console_messages to ensure nothing unexpected is happening.

Ensure all changes look reasonable at a mobile screen size.
