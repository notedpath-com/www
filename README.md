# Noted Path

The website for Noted Path LLC at https://notedpath.com. It is static HTML and
CSS with no build step and no JavaScript.

## Layout

- `public/` is the site root. Deploy this folder.
- `test/site.test.mjs` checks the rules below.

## Rules

- **No JavaScript.** Pages must render and be crawlable without it. The only
  `<script>` allowed is `application/ld+json` data.
- **No third-party requests.** Fonts and all other assets are self-hosted. The
  site sets no cookies, so it needs no cookie banner. If you add analytics,
  embeds, or remote fonts, update `public/privacy/index.html` and check whether
  you now need a consent banner.

## Run

    python3 -m http.server --directory public
    node --test
