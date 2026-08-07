/**
 * Optical Glass 2.0: does the downgrade ladder actually hold in a browser?
 *
 * `resolveOpticalQuality` is unit-tested, but a unit test proves the decision,
 * not the rendering. What matters to a user is that when their system asks for
 * reduced transparency or forced colours, the surfaces they are looking at
 * really do become opaque - and that is a question about CSS media queries,
 * cascade order and whether the fallbacks were written for every surface, none
 * of which a pure function can answer.
 *
 * It asserts the default state as strictly as the fallbacks, and that is not
 * symmetry for its own sake. The first version of this check only asserted the
 * downgrades, and it passed while three of the four surfaces were having the
 * optical material overridden out from under them by the shell stylesheet -
 * two into a fully opaque fill with a `backdrop-filter` still running
 * underneath, one into no fill at all. A check that only watches a feature
 * turn off cannot notice it was never on.
 *
 * Limits, stated because this is evidence: Chromium only, and
 * `prefers-reduced-transparency` cannot be emulated by Playwright, so that one
 * is asserted through the stylesheet rather than through a rendered page. Every
 * other row is a real page in a real browser.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'apps/web/dist');
const outDir = path.join(repoRoot, 'benchmarks/results');
const materialCss = path.join(repoRoot, 'packages/design-system/src/appearance/material.css');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

/** The surfaces the package's matrix permits, and which this check holds to it. */
const OPTICAL_SURFACES = ['.arq-top-bar', '.arq-workspace__dock', '.arq-status-bar'];

/**
 * Not a material - it is nested inside the top bar, which is one - but it must
 * survive every configuration, because it is how a reader changes view.
 */
const REQUIRED_CONTROLS = ['.arq-view-kinds'];

function startServer() {
  const server = createServer((request, response) => {
    const requested = (request.url ?? '/').split('?')[0];
    let filePath = path.join(distDir, decodeURIComponent(requested));
    if (!existsSync(filePath) || !path.extname(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }
    response.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] ?? 'text/plain');
    response.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

/** Reads what each surface actually resolved to, in the page. */
async function measure(page, selectors, controls) {
  return page.evaluate(
    ({ list, controlList }) => {
      /*
       * The alpha, as a number, parsed rather than pattern-matched.
       *
       * The first version of this tested the computed background against a
       * regular expression written for the `rgb(r g b / a)` form. Chromium
       * serialises the legacy `rgba(r, g, b, a)` form, so it matched nothing -
       * in either direction. Every row reported `translucent: false`, the
       * check passed, and it was passing over four surfaces on which the
       * optical material was being overridden into either a fully opaque fill
       * or no fill at all. An assertion that cannot fail is not evidence, and
       * this one read as evidence for a whole stage.
       */
      const alphaOf = (colour) => {
        const inside = /^rgba?\((.*)\)$/.exec(colour.trim());
        if (inside === null) return colour === 'transparent' ? 0 : 1;
        const parts = inside[1].split(/[,/]/).map((part) => part.trim());
        if (parts.length < 4) return 1;
        const raw = parts[3];
        const value = raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
        return Number.isFinite(value) ? value : 1;
      };

      const read = (selector) => {
        const element = document.querySelector(selector);
        if (element === null) return null;
        const style = getComputedStyle(element);
        const alpha = alphaOf(style.backgroundColor);
        return {
          present: true,
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
          backgroundAlpha: Number(alpha.toFixed(3)),
          // A gradient counts as fill: the optical variant layers one over the
          // tint, and a surface carrying it is not bare.
          hasFillImage: style.backgroundImage !== 'none',
          boxShadow: style.boxShadow,
          // Translucent means genuinely see-through. Fully transparent is not
          // "translucent glass" - it is no surface at all, and it is tracked
          // separately below because it is a different defect.
          translucent: alpha > 0 && alpha < 1,
          bare: alpha === 0 && style.backgroundImage === 'none',
        };
      };

      return {
        surfaces: Object.fromEntries(list.map((selector) => [selector, read(selector)])),
        controls: Object.fromEntries(
          controlList.map((selector) => [selector, document.querySelector(selector) !== null]),
        ),
        quality:
          document.querySelector('.arq-view-kinds')?.getAttribute('data-optical-quality') ?? null,
        lensPresent: document.querySelector('.arq-refraction-lens') !== null,
      };
    },
    { list: selectors, controlList: controls },
  );
}

async function main() {
  execFileSync('pnpm', ['--filter', '@arq/web', 'build'], { cwd: repoRoot, stdio: 'inherit' });
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    ...(existsSync('/opt/pw-browsers/chromium')
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {}),
  });

  const rows = [];
  const failures = [];

  const configurations = [
    { name: 'default', options: {}, expect: { quality: 'refraction', lens: true, opaque: false } },
    /*
     * Dark appearance, which the first version of this check never ran.
     *
     * The dark tokens are a separate set of values in their own media block -
     * a dark material lightens what is behind it rather than darkening it - so
     * every way the light values could be overridden out from under the
     * material, the dark ones could be too, independently and invisibly. A
     * check that only ever runs in light appearance is testing half the
     * stylesheet and reporting on all of it.
     */
    {
      name: 'dark',
      options: { colorScheme: 'dark' },
      expect: { quality: 'refraction', lens: true, opaque: false },
    },
    {
      name: 'forced-colors',
      options: { forcedColors: 'active' },
      expect: { quality: 'off', lens: false, opaque: true },
    },
    {
      name: 'increased-contrast',
      options: { contrast: 'more' },
      expect: { quality: 'off', lens: false, opaque: true },
    },
  ];

  for (const configuration of configurations) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      ...configuration.options,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`);
    await page.waitForSelector('.arq-view-kinds', { timeout: 30_000 });
    // The lens is generated asynchronously; give it the frame it needs before
    // asserting that it is or is not there.
    await page.waitForTimeout(1200);

    const measured = await measure(page, OPTICAL_SURFACES, REQUIRED_CONTROLS);
    rows.push({ configuration: configuration.name, ...measured });

    for (const [selector, present] of Object.entries(measured.controls)) {
      if (!present) failures.push(`${configuration.name}: ${selector} is missing from the page`);
    }

    if (measured.quality !== configuration.expect.quality) {
      failures.push(
        `${configuration.name}: quality resolved to ${measured.quality}, expected ${configuration.expect.quality}`,
      );
    }
    if (measured.lensPresent !== configuration.expect.lens) {
      failures.push(
        `${configuration.name}: lens ${measured.lensPresent ? 'present' : 'absent'}, expected the opposite`,
      );
    }
    for (const [selector, surface] of Object.entries(measured.surfaces)) {
      if (surface === null) {
        failures.push(`${configuration.name}: ${selector} is not on the page at all`);
        continue;
      }
      /*
       * A surface with no fill at all fails in every configuration, and it is
       * the defect this check originally missed. The material's whole job is
       * to be a legible surface between the chrome and the drawing; strip the
       * fill and what is left is a blur you can read the model through, which
       * ADR-0031 treats as the unreadable outcome rather than a mild one.
       */
      if (surface.bare) {
        failures.push(
          `${configuration.name}: ${selector} has no fill at all (${surface.backgroundColor}, no gradient) - something outside material.css has overridden it`,
        );
      }

      if (configuration.expect.opaque) {
        // The control must never disappear, whatever the setting - the
        // fallback is the complete design, not a reduced one.
        if (surface.backdropFilter !== 'none') {
          failures.push(`${configuration.name}: ${selector} still blurs its backdrop`);
        }
        if (surface.translucent) {
          failures.push(
            `${configuration.name}: ${selector} is still translucent (alpha ${surface.backgroundAlpha})`,
          );
        }
        continue;
      }

      /*
       * The default configuration, asserted as strictly as the fallbacks.
       *
       * Only the downgrades were checked before, which is why three surfaces
       * could be overridden to an opaque fill - blur running underneath a
       * background nothing could be seen through - and still pass. An opaque
       * "glass" surface is not a cosmetic miss: it is the full GPU cost of the
       * effect for none of it.
       */
      if (surface.backdropFilter === 'none') {
        failures.push(`${configuration.name}: ${selector} carries the material but does not blur`);
      }
      if (!surface.translucent) {
        failures.push(
          `${configuration.name}: ${selector} is opaque (alpha ${surface.backgroundAlpha}), so its blur resolves a backdrop no pixel shows`,
        );
      }
    }
    await context.close();
  }

  /*
   * `prefers-reduced-transparency` has no Playwright emulation, so it is
   * asserted where it is written rather than where it renders. Stated as such
   * in the record: this row is weaker evidence than the others and should not
   * be read as a rendered result.
   */
  const css = readFileSync(materialCss, 'utf8');
  const reducedTransparencyDeclared =
    /@media[^{]*prefers-reduced-transparency:\s*reduce[\s\S]*?\.arq-material--optical/.test(css);
  if (!reducedTransparencyDeclared) {
    failures.push('material.css has no reduced-transparency fallback for the optical variant');
  }

  await browser.close();
  server.close();

  const report = {
    generatedFrom: 'scripts/run-optical-glass-capability-check.mjs',
    rows,
    reducedTransparency: {
      method: 'stylesheet inspection',
      declared: reducedTransparencyDeclared,
      why: 'Playwright cannot emulate prefers-reduced-transparency, so this is not a rendered result.',
    },
    failures,
    ok: failures.length === 0,
    limitation:
      'Chromium only. It proves the downgrade ladder and the opaque fallbacks at one viewport in one engine; it proves nothing about other engines, about GPU cost, or about how the material reads to a person.',
  };

  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `optical-glass-capability-${Date.now()}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

  for (const row of rows) {
    console.log(
      `${row.configuration.padEnd(20)} quality ${String(row.quality).padEnd(11)} lens ${row.lensPresent ? 'yes' : 'no '}`,
    );
  }
  console.log(`\nWrote ${path.relative(repoRoot, file)}`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nThe downgrade ladder holds at every configuration checked.');
}

await main();
