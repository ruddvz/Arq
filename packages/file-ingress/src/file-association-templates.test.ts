import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * FP-012: a lightweight cross-consistency check for the OS file-association
 * templates (packages/file-ingress/platform-templates/, see
 * docs/platform/FILE-ASSOCIATION-PLAN.md) - proves the three fragments agree
 * on the same extension, MIME type and identifiers rather than only asserting
 * that in prose. Not a full registry/plist/manifest schema validator (none of
 * those formats has one this repo already depends on) - regex/JSON.parse
 * checks on real file content, matching this issue's own "lightweight" scope.
 */
const templatesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'platform-templates',
);

const EXTENSION = '.arq';
const MIME_TYPE = 'application/vnd.arq.project+sqlite';
const WINDOWS_PROG_ID = 'Arq.Project.1';
const APPLE_UTI = 'com.arq.project';

describe('OS file-association templates (FP-012)', () => {
  const windowsReg = readFileSync(
    path.join(templatesDir, 'windows', 'arq-file-association.reg'),
    'utf-8',
  );
  const applePlist = readFileSync(
    path.join(templatesDir, 'apple', 'ArqDocumentType.plist.fragment.xml'),
    'utf-8',
  );
  const pwaManifestRaw = readFileSync(
    path.join(templatesDir, 'pwa', 'file-handlers.webmanifest.fragment.json'),
    'utf-8',
  );

  it('the Windows .reg fragment associates .arq with a consistent ProgID and content type', () => {
    expect(windowsReg).toContain('Windows Registry Editor Version 5.00');
    expect(windowsReg).toMatch(/\[HKEY_CURRENT_USER\\Software\\Classes\\\.arq\]/);
    expect(windowsReg).toContain(`@="${WINDOWS_PROG_ID}"`);
    expect(windowsReg).toContain(`"Content Type"="${MIME_TYPE}"`);
    expect(windowsReg).toContain(
      `[HKEY_CURRENT_USER\\Software\\Classes\\${WINDOWS_PROG_ID}\\shell\\open\\command]`,
    );
  });

  it('the Apple plist fragment declares a UTI that both CFBundleDocumentTypes and UTExportedTypeDeclarations agree on', () => {
    expect(applePlist).toContain('<key>CFBundleDocumentTypes</key>');
    expect(applePlist).toContain('<key>UTExportedTypeDeclarations</key>');

    const contentTypesMatch = applePlist.match(
      /<key>LSItemContentTypes<\/key>\s*<array>\s*<string>([^<]+)<\/string>/,
    );
    const exportedUtiMatch = applePlist.match(
      /<key>UTTypeIdentifier<\/key>\s*<string>([^<]+)<\/string>/,
    );
    expect(contentTypesMatch?.[1]).toBe(APPLE_UTI);
    expect(exportedUtiMatch?.[1]).toBe(APPLE_UTI);

    const extensionMatch = applePlist.match(
      /<key>public\.filename-extension<\/key>\s*<array>\s*<string>([^<]+)<\/string>/,
    );
    expect(extensionMatch?.[1]).toBe(EXTENSION.slice(1));

    const mimeMatch = applePlist.match(/<key>public\.mime-type<\/key>\s*<string>([^<]+)<\/string>/);
    expect(mimeMatch?.[1]).toBe(MIME_TYPE);
  });

  it('the PWA file_handlers fragment is real, parseable JSON that accepts the same extension and MIME type', () => {
    const manifest = JSON.parse(pwaManifestRaw) as {
      readonly file_handlers: ReadonlyArray<{
        readonly accept: Readonly<Record<string, readonly string[]>>;
      }>;
    };

    const handler = manifest.file_handlers[0];
    expect(handler).toBeDefined();
    expect(handler?.accept[MIME_TYPE]).toEqual([EXTENSION]);
  });

  it('all three templates agree on the same extension and MIME type as each other', () => {
    expect(windowsReg).toContain(EXTENSION);
    expect(windowsReg).toContain(MIME_TYPE);
    expect(applePlist).toContain(EXTENSION.slice(1));
    expect(applePlist).toContain(MIME_TYPE);
    expect(pwaManifestRaw).toContain(EXTENSION);
    expect(pwaManifestRaw).toContain(MIME_TYPE);
  });
});
