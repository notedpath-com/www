// Regenerates every icon in public/ from the masters beside this file.
//
//   cd brand && npm i sharp && node icons.mjs
//
// sharp is a one-off tool for this script, not a dependency of the site: the
// site is static files and has no build step.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRAND = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(BRAND, "..", "public");

// The masters are 1254px square with the mark floating in the middle, more
// padding below it than above. Crop to the mark plus an even margin, or it
// renders as a tiny smudge at favicon sizes and sits off centre.
const CROP = { left: 135, top: 104, width: 980, height: 980 };

const source = (file) => sharp(join(BRAND, file)).extract(CROP);
const render = (file, size) => source(file).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// ICO: a header, one 16-byte directory entry per image, then the PNGs.
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

writeFileSync(
  join(PUBLIC, "favicon.ico"),
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await render("logo-black.png", size) })))),
);

// Tiles carry their own black, so they read as the logo on any surface.
for (const [file, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  writeFileSync(join(PUBLIC, file), await render("logo-black.png", size));
}

// ---------------------------------------------------------------------------
// The lockup (mark plus wordmark) arrives as one sheet holding both variants,
// stacked. Split it into the two assets.

const SHEET = { file: "lockup-variations.png", split: 362 };
// Both variants hold the same artwork at the same place, give or take a pixel.
const LIGHT = { left: 358, top: 7, width: 1446, height: 322 };
const DARK = { left: 358, top: 368, width: 1446, height: 320 };

writeFileSync(join(BRAND, "lockup-black.png"), await sharp(join(BRAND, SHEET.file)).extract(DARK).png().toBuffer());

// The light variant's transparency is a checkerboard painted into the pixels,
// so it has to be keyed out. Nothing in the artwork is light or grey (the text
// is black, the mark is saturated), which makes the key unambiguous:
//   - black text blended with the checker loses lightness in proportion to it
//   - the mark blended with the checker loses chroma in proportion to it
// Take whichever says more coverage, then unblend to get the true colour back.
const CHECKER = 237; // the darker of the two tones, 254 and 237, so both key to nothing
const MARK_CHROMA = 170; // just under the chroma of #31C1FD (204) and #34F0B1 (188)
{
  const { data, info } = await sharp(join(BRAND, SHEET.file))
    .extract(LIGHT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const lightness = (r + g + b) / 3;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const alpha = Math.min(1, Math.max(0, Math.max((CHECKER - lightness) / CHECKER, chroma / MARK_CHROMA)));
    if (alpha <= 0.02) {
      data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.min(255, Math.max(0, Math.round((data[i + c] - (1 - alpha) * CHECKER) / alpha)));
    }
    data[i + 3] = Math.round(alpha * 255);
  }
  writeFileSync(
    join(BRAND, "lockup.png"),
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer(),
  );
}

// The nav carries the whole lockup, on its own black, at 36px tall. Rendered
// at 3x so it stays sharp on a dense display.
writeFileSync(
  join(PUBLIC, "nav-logo.png"),
  await sharp(join(BRAND, "lockup-black.png")).resize({ height: 108 }).png({ compressionLevel: 9 }).toBuffer(),
);

console.log("icons written to public/, lockup split into brand/");
