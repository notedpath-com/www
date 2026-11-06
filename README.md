# Noted Path

The website for Noted Path LLC at https://notedpath.com. It is static HTML and
CSS with no build step and no JavaScript.

## Layout

- `public/` is the site root. Deploy this folder.
- `test/site.test.mjs` checks the rules below.
- `public/icon.svg` is the source for every icon (the nav logo). The `.ico`
  and `.png` files are rendered from it; regenerate them if it changes.

## Rules

- **No JavaScript.** Pages must render and be crawlable without it. The only
  `<script>` allowed is `application/ld+json` data.
- **No third-party requests.** Fonts and all other assets are self-hosted. The
  site sets no cookies, so it needs no cookie banner. If you add analytics,
  embeds, or remote fonts, update `public/privacy/index.html` and check whether
  you now need a consent banner.

## Deploy

A push to `main` runs the tests, then `.github/workflows/pages.yml` publishes
`public/` to GitHub Pages. The custom domain is set in **Settings > Pages**, not
in a `CNAME` file, because Actions deployments ignore that file.

## Run

    python3 -m http.server --directory public
    node --test
