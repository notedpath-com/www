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
    it(`${page.path} has no executable script`, () => {
      const scripts = html(page).match(/<script\b[^>]*>/g) ?? [];
      const executable = scripts.filter((tag) => !tag.includes('type="application/ld+json"'));
      assert.deepEqual(executable, []);
    });

    it(`${page.path} has no inline event handlers`, () => {
      assert.doesNotMatch(html(page), /<[^>]+\son[a-z]+="/);
    });

    it(`${page.path} has no leftover design runtime markup`, () => {
      assert.doesNotMatch(html(page), /\{\{|<x-dc|<helmet|<sc-if|\[CONTACT/);
    });
  }

  it("keeps the runtime out of the published folder", () => {
    const javascript = filesUnder(PUBLIC).filter((file) => file.endsWith(".js"));
    assert.deepEqual(javascript, []);
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

  it("has no card left from the mockup", () => {
    for (const text of ["Practice that adapts to you.", "Apps that respect your time.", "Less paperwork, more life."]) {
      assert.ok(!home.includes(text), `stale copy: ${text}`);
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

  it("the contact section finishes its scroll reveal before the page ends", () => {
    // A "cover" range needs more scroll than the last section has, which left
    // the button dim at the bottom of the page.
    assert.match(read("styles.css"), /#contact \.sv,\.np-anim #contact \.zoom\{animation-range:entry 0% entry 100%\}/);
  });

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
