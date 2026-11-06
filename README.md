# Noted Path

The website for Noted Path LLC at https://notedpath.com. It is static HTML and
CSS with no build step and no JavaScript.

## Layout

- `public/` is the site root. Deploy this folder.
- `test/site.test.mjs` checks the rules below.
- `brand/` holds the logo masters and `icons.mjs`, which renders every icon in
  `public/` from them. It is not deployed. Run it again if the logo changes.

## Rules

- **The page must not need JavaScript.** It has to render and be crawlable
  without it. Script is allowed as enhancement only: deferred, self-hosted and
  safe to never run. `public/motion.js` reveals the scroll artwork that way.
  CSS scroll-driven animation (`animation-timeline`) is not an option here.
  Firefox reports support for it and then does not drive it, which leaves every
  reveal on the page frozen.
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
