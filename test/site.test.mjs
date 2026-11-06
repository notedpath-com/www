// Guards the promises this site makes: it works with no JavaScript, it sends
// visitors to no third party (the reason it needs no cookie banner), and every
// page stays crawlable. Run with: node --test
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const ORIGIN = "https://notedpath.com";
const EMAIL = "hello@notedpath.com";

const PAGES = [
  { path: "/", file: "index.html" },
  { path: "/privacy/", file: "privacy/index.html" },
  { path: "/terms/", file: "terms/index.html" },
];

const PROJECTS = [
  ["https://boop.notedpath.com", "Boop"],
  ["https://cha-gio.notedpath.com", "Cha Gio Calculator"],
  ["https://paperstack.notedpath.com", "Paperstack"],
  ["https://max-rewards.notedpath.com", "Max Rewards"],
  ["https://patscanvas.com", "Pat's Canvas"],
  ["https://sat-tutor.notedpath.com", "SAT Tutor"],
];

const read = (file) => readFileSync(join(PUBLIC, file), "utf8");
const html = (page) => read(page.file);

function meta(source, attribute, name) {
  const tag = source.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`));
  return tag?.[1];
}

function attributeValues(source, attribute) {
  return [...source.matchAll(new RegExp(`\\s${attribute}="([^"]*)"`, "g"))].map((match) => match[1]);
}

// The tags that make a browser fetch something on page load. A plain <a> is
// excluded: it sends nothing until the visitor clicks. So is rel="canonical",
// which only names the page's URL for crawlers.
function loadedResources(source) {
  const tags = source.match(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/g) ?? [];
  return tags.filter((tag) => !tag.includes('rel="canonical"')).flatMap((tag) => {
    const value = tag.match(/\s(?:src|href|data)="([^"]*)"/)?.[1];
    return value === undefined ? [] : [value];
  });
}

function pngSize(file) {
  const bytes = readFileSync(join(PUBLIC, file));
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const full = join(directory, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

function resolvesToFile(pathname) {
  const target = join(PUBLIC, pathname);
  return pathname.endsWith("/") ? existsSync(join(target, "index.html")) : existsSync(target);
}

describe("works without JavaScript", () => {
  for (const page of PAGES) {
    it(`${page.path} loads script only as an enhancement`, () => {
      const scripts = (html(page).match(/<script\b[^>]*>/g) ?? [])
        .filter((tag) => !tag.includes('type="application/ld+json"'));
      for (const tag of scripts) {
        // Deferred and same-origin, so it can neither block nor change the
        // render a crawler receives.
        assert.match(tag, /\sdefer\b/, `must be deferred: ${tag}`);
        assert.match(tag, /\ssrc="\/[^"]+"/, `must be a local file: ${tag}`);
      }
    });

    it(`${page.path} has no inline event handlers`, () => {
      assert.doesNotMatch(html(page), /<[^>]+\son[a-z]+="/);
    });

    it(`${page.path} has no leftover design runtime markup`, () => {
      assert.doesNotMatch(html(page), /\{\{|<x-dc|<helmet|<sc-if|\[CONTACT/);
    });
  }

  it("ships no script beyond the one enhancement", () => {
    const names = filesUnder(PUBLIC)
      .filter((file) => file.endsWith(".js"))
      .map((file) => file.slice(PUBLIC.length + 1));
    assert.deepEqual(names, ["motion.js"]);
    // Decoration, not an app: small enough that anyone can read all of it.
    assert.ok(statSync(join(PUBLIC, "motion.js")).size < 4096, "motion.js is getting big");
  });

  it("never hides the element the observer is watching", () => {
    // A zero-width clip rect makes IntersectionObserver report no
    // intersection, so a clipped target is never revealed at all.
    const css = read("styles.css");
    const clipping = css.split("\n")
      .filter((line) => line.includes("clip-path:inset(0 100%") && !line.startsWith("@keyframes"));
    assert.ok(clipping.length > 0, "no resting clip rule found");
    for (const rule of clipping) {
      assert.match(rule, /\bsvg\{/, `clip the child, not the observed element: ${rule}`);
    }
  });

  it("leaves the page finished when the script never runs", () => {
    // The reveal rules are the only thing that can hide content, and every one
    // of them needs np-js, which only the script adds.
    const css = read("styles.css");
    const reveals = css.split("\n").filter((line) =>
      /\.(sv|light|zoom|path-link)[^{]*\{/.test(line) && /animation:|opacity:0|clip-path:/.test(line));
    assert.ok(reveals.length > 0, "no reveal rules found");
    for (const rule of reveals) {
      assert.match(rule, /^\.np-js /, `reveal rule must require the script: ${rule}`);
    }
    assert.match(read("motion.js"), /prefers-reduced-motion: reduce/);
  });

  it("puts the real content in the HTML that crawlers receive", () => {
    const home = html(PAGES[0]);
    for (const text of ["Small ideas.", "Carefully made.", "What we make.", "Follow the path."]) {
      assert.ok(home.includes(text), `missing: ${text}`);
    }
  });
});

describe("sends visitors to no third party, so no cookie banner is needed", () => {
  for (const page of PAGES) {
    it(`${page.path} loads only same-origin resources`, () => {
      const external = loadedResources(html(page)).filter((url) => !url.startsWith("/"));
      assert.deepEqual(external, []);
    });
  }

  it("the stylesheet loads only same-origin files", () => {
    const urls = [...read("styles.css").matchAll(/url\(['"]?([^'")]+)/g)].map((match) => match[1]);
    assert.ok(urls.length > 0, "expected the font url");
    assert.deepEqual(urls.filter((url) => !url.startsWith("/")), []);
    assert.doesNotMatch(read("styles.css"), /@import/);
  });

  it("the privacy policy says what the site actually does", () => {
    const policy = read("privacy/index.html");
    assert.match(policy, /does not set cookies/);
    assert.match(policy, /no analytics/);
    assert.match(policy, /does not load fonts, scripts or other content from third parties/);
  });

  it("ships the licence that the self-hosted font requires", () => {
    assert.match(read("fonts/OFL.txt"), /SIL Open Font License/);
  });
});

describe("projects", () => {
  const home = html(PAGES[0]);
  const cards = [...home.matchAll(/<a class="card sv" href="([^"]+)">.*?<h3 class="card-name">([^<]+)<\/h3>/gs)]
    .map((match) => [match[1], match[2]]);

  it("lists exactly the six projects, in order, each linked to its own site", () => {
    assert.deepEqual(cards, PROJECTS);
  });

  it("every card ends with a call to action, not a bare URL", () => {
    const ctas = [...home.matchAll(/<p class="card-cta">\s*([^<\n]+)/g)].map((match) => match[1].trim());
    assert.deepEqual(ctas, PROJECTS.map(() => "Check it out"));
    for (const [url] of PROJECTS) {
      assert.ok(!home.includes(`>${new URL(url).host}<`), `still printing the URL for ${url}`);
    }
  });

  it("has no card left from the mockup", () => {
    for (const text of ["Practice that adapts to you.", "Apps that respect your time.", "Less paperwork, more life."]) {
      assert.ok(!home.includes(text), `stale copy: ${text}`);
    }
  });
});


describe("scroll animations", () => {
  const home = html(PAGES[0]);
  const css = read("styles.css");

  it("keeps the page wrapper transparent so the aurora behind it shows", () => {
    // The aurora sits at z-index -1, which paints under any background on an
    // in-flow ancestor. A background here makes it silently invisible.
    const wrapper = home.match(/<div class="np-anim" style="([^"]*)"/)?.[1];
    assert.ok(wrapper, "missing the animation wrapper");
    assert.doesNotMatch(wrapper, /background/);
    assert.match(css, /body\{[^}]*background:#000/);
  });

  it("hides every decorative graphic from screen readers", () => {
    for (const tag of home.match(/<svg\b[^>]*>/g) ?? []) {
      assert.ok(tag.includes('aria-hidden="true"'), `needs aria-hidden: ${tag.slice(0, 60)}`);
    }
    assert.match(home, /<div class="aurora" aria-hidden="true">/);
  });

  it("leaves the drawn paths finished when nothing animates them", () => {
    // No script, or reduced motion, means no animation at all, so the resting
    // state of a path has to be the fully revealed one.
    assert.match(css, /@keyframes np-wipe\{.*?to\{clip-path:inset\(0 0 0 0\)\}\}/);
    assert.doesNotMatch(css, /^\.path-link\{[^}]*clip-path/m);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.np-anim \*\{animation:none !important\}\}/);
  });

  it("relies on no scroll-driven CSS", () => {
    // Firefox reports support for animation-timeline and then does not drive
    // it, which left every reveal on this page frozen. The observer replaced
    // all of it; bringing it back would silently break the page there again.
    assert.doesNotMatch(css, /animation-timeline/);
    assert.doesNotMatch(css, /animation-range/);
  });

  it("observes every element the reveal rules style", () => {
    const styled = [...new Set([...css.matchAll(/^\.np-js \.([a-z-]+)[.:]/gm)].map((match) => match[1]))];
    assert.ok(styled.length > 0, "no reveal rules found");
    const observed = read("motion.js").match(/querySelectorAll\("([^"]+)"\)/)?.[1] ?? "";
    for (const name of styled) {
      assert.ok(observed.includes(`.${name}`), `${name} is styled but never observed`);
    }
  });
});

describe("contact and legal links", () => {
  for (const page of PAGES) {
    it(`${page.path} footer gives the email and both policies`, () => {
      const footer = html(page).match(/<footer.*<\/footer>/s)?.[0] ?? "";
      assert.ok(footer.includes(`href="mailto:${EMAIL}"`));
      assert.ok(footer.includes('href="/privacy/"'));
      assert.ok(footer.includes('href="/terms/"'));
      assert.ok(footer.includes("Noted Path LLC"));
    });
  }

  it("the Say hello button opens an email, not the section it is in", () => {
    assert.match(html(PAGES[0]), new RegExp(`href="mailto:${EMAIL}"[^>]*>Say hello`));
  });

  for (const file of ["privacy/index.html", "terms/index.html"]) {
    it(`${file} names the legal entity, a contact and a date`, () => {
      const page = read(file);
      assert.match(page, /Noted Path LLC/);
      assert.ok(page.includes(`mailto:${EMAIL}`));
      assert.match(page, /Effective [A-Z][a-z]+ \d{1,2}, \d{4}/);
    });
  }
});

describe("every link resolves", () => {
  for (const page of PAGES) {
    it(`${page.path} internal links and assets exist`, () => {
      const source = html(page);
      const internal = [...attributeValues(source, "href"), ...attributeValues(source, "src")]
        .filter((url) => url.startsWith("/"));
      assert.ok(internal.length > 0);
      for (const url of internal) {
        const [pathname, fragment] = url.split("#");
        assert.ok(resolvesToFile(pathname), `broken: ${url}`);
        if (fragment) {
          const target = read(pathname === "/" ? "index.html" : join(pathname, "index.html"));
          assert.ok(target.includes(`id="${fragment}"`), `broken anchor: ${url}`);
        }
      }
    });

    it(`${page.path} same-page anchors exist`, () => {
      const source = html(page);
      for (const url of attributeValues(source, "href").filter((value) => value.startsWith("#"))) {
        assert.ok(source.includes(`id="${url.slice(1)}"`), `broken anchor: ${url}`);
      }
    });
  }
});

describe("crawl metadata", () => {
  for (const page of PAGES) {
    const url = `${ORIGIN}${page.path}`;

    it(`${page.path} has the tags search and social previews read`, () => {
      const source = html(page);
      assert.match(source, /<html lang="en">/);
      assert.match(source, /<meta name="viewport"/);
      assert.ok(source.includes(`<link rel="canonical" href="${url}">`));
      assert.equal(meta(source, "property", "og:url"), url);
      assert.equal(meta(source, "property", "og:image"), `${ORIGIN}/og-image.png`);
      assert.equal(meta(source, "name", "twitter:card"), "summary_large_image");
      assert.equal(source.match(/<h1\b/g)?.length, 1, "exactly one h1");
      assert.doesNotMatch(source, /noindex/);
    });

    it(`${page.path} description fits a search result`, () => {
      const description = meta(html(page), "name", "description");
      assert.ok(description, "missing description");
      assert.ok(description.length >= 50 && description.length <= 160, `length ${description.length}`);
    });
  }

  it("gives each page its own title and description", () => {
    const titles = PAGES.map((page) => html(page).match(/<title>(.*?)<\/title>/)?.[1]);
    const descriptions = PAGES.map((page) => meta(html(page), "name", "description"));
    assert.equal(new Set(titles).size, PAGES.length);
    assert.equal(new Set(descriptions).size, PAGES.length);
  });

  it("publishes valid structured data for the organization", () => {
    const block = html(PAGES[0]).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
    assert.ok(block, "missing JSON-LD");
    const organization = JSON.parse(block)["@graph"].find((node) => node["@type"] === "Organization");
    assert.equal(organization.legalName, "Noted Path LLC");
    assert.equal(organization.email, EMAIL);
    assert.ok(existsSync(join(PUBLIC, new URL(organization.logo).pathname)));
  });

  it("the sitemap lists exactly the pages that exist", () => {
    const listed = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(listed, PAGES.map((page) => `${ORIGIN}${page.path}`));
  });

  it("robots.txt allows crawling and points to the sitemap", () => {
    const robots = read("robots.txt");
    assert.doesNotMatch(robots, /Disallow: \//);
    assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
  });
});

describe("icons", () => {
  it("favicon.ico holds the sizes browsers ask for", () => {
    const bytes = readFileSync(join(PUBLIC, "favicon.ico"));
    assert.equal(bytes.readUInt16LE(2), 1, "not an ICO file");
    const sizes = Array.from({ length: bytes.readUInt16LE(4) }, (_, index) => bytes[6 + index * 16]);
    assert.deepEqual(sizes.sort((a, b) => a - b), [16, 32, 48]);
  });

  for (const [file, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
    it(`${file} is ${size}px square`, () => {
      assert.deepEqual(pngSize(file), [size, size]);
    });
  }

  it("the social card is the size that platforms expect", () => {
    assert.deepEqual(pngSize("og-image.png"), [1200, 630]);
  });

  it("the web manifest points to icons that exist", () => {
    const manifest = JSON.parse(read("site.webmanifest"));
    assert.ok(manifest.icons.length > 0);
    for (const icon of manifest.icons) {
      assert.ok(existsSync(join(PUBLIC, icon.src)), `missing: ${icon.src}`);
    }
  });
});
