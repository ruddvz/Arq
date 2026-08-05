import {
  isKnownCapability,
  manifestPermits,
  type ExtensionCapability,
  type ExtensionManifest,
} from './extension-manifest';

/**
 * V3-173 / AC3-100: an untrusted extension never reaches the canonical Worker.
 *
 * The failure named is "arbitrary SQLite or OPFS access", and the way it
 * actually happens is not a missing permission check. It happens because
 * something convenient was passed across the boundary - the worker's port, a
 * database handle, an OPFS directory handle, a callback that closes over one -
 * and after that no check exists to fail, because the extension is not asking
 * the host for anything. It already has the thing.
 *
 * So the boundary is defined by what can be *expressed*, not by what is
 * allowed. `ExtensionRequest` is a closed union of plain serialisable messages.
 * There is no variant carrying a handle, a port, a function or a path, so there
 * is no arrangement of a conforming extension that obtains one, and a broker
 * bug can at worst answer the wrong question rather than hand over the database.
 * The test that matters here is the structural one: every request is
 * round-trippable through JSON, which a handle is not.
 *
 * On top of that structure the broker checks two things per request, in this
 * order: is the capability declared, and does the manifest cover this specific
 * category. Capability first, because a request for something the extension
 * never declared should be reported as undeclared rather than as out-of-scope -
 * they call for different fixes from the publisher.
 */

/**
 * Everything an extension can say.
 *
 * Plain data only. Adding a variant that carries anything but data is the one
 * change that would reopen AC3-100, which is why `requestIsSerialisable` exists
 * and is asserted over every variant in the tests.
 */
export type ExtensionRequest =
  | {
      readonly kind: 'model.read';
      readonly category: string;
      readonly elementIds: readonly string[];
    }
  | {
      readonly kind: 'model.propose';
      readonly category: string;
      readonly operations: readonly unknown[];
    }
  | { readonly kind: 'selection.read' }
  | { readonly kind: 'selection.request'; readonly elementIds: readonly string[] }
  | { readonly kind: 'ui.contribute'; readonly surface: string; readonly title: string }
  | { readonly kind: 'storage.own.get'; readonly key: string }
  | { readonly kind: 'storage.own.set'; readonly key: string; readonly value: string }
  | { readonly kind: 'network.fetch'; readonly url: string };

export const BROKER_DENIAL_CODES = {
  unknownRequest: 'ARQ_EXT_UNKNOWN_REQUEST',
  capabilityNotDeclared: 'ARQ_EXT_CAPABILITY_NOT_DECLARED',
  categoryNotDeclared: 'ARQ_EXT_CATEGORY_NOT_DECLARED',
  originNotDeclared: 'ARQ_EXT_ORIGIN_NOT_DECLARED',
  malformedUrl: 'ARQ_EXT_MALFORMED_URL',
} as const;

export type BrokerDenialCode = (typeof BROKER_DENIAL_CODES)[keyof typeof BROKER_DENIAL_CODES];

export type BrokerDecision =
  | { readonly allowed: true; readonly capability: ExtensionCapability }
  | { readonly allowed: false; readonly code: BrokerDenialCode; readonly detail: string };

/** Which capability each request needs. Exhaustive over the union, so a new variant will not compile without one. */
function capabilityFor(request: ExtensionRequest): ExtensionCapability {
  switch (request.kind) {
    case 'model.read':
      return 'model.read';
    case 'model.propose':
      return 'model.propose';
    case 'selection.read':
      return 'selection.read';
    case 'selection.request':
      return 'selection.request';
    case 'ui.contribute':
      return 'ui.contribute';
    case 'storage.own.get':
    case 'storage.own.set':
      return 'storage.own';
    case 'network.fetch':
      return 'network.declared-origins';
  }
}

/**
 * Decides whether the host answers a request.
 *
 * Returns a decision rather than performing the work, so the check and the
 * effect are separable and the check can be exercised on its own. A broker that
 * did both would have to be tested by observing what it changed, and a test
 * that has to change something to prove nothing changed is not much of a test.
 */
export function decideExtensionRequest(
  manifest: ExtensionManifest,
  request: ExtensionRequest,
): BrokerDecision {
  const capability = capabilityFor(request);
  if (!isKnownCapability(capability)) {
    return deny(BROKER_DENIAL_CODES.unknownRequest, `"${capability}" is not a capability`);
  }

  if (!manifest.capabilities.includes(capability)) {
    return deny(
      BROKER_DENIAL_CODES.capabilityNotDeclared,
      `${manifest.id} did not declare ${capability}`,
    );
  }

  if (request.kind === 'model.read' || request.kind === 'model.propose') {
    const access = request.kind === 'model.read' ? 'read' : 'propose';
    if (!manifestPermits(manifest, access, request.category)) {
      return deny(
        BROKER_DENIAL_CODES.categoryNotDeclared,
        `${manifest.id} declared no ${access} effect covering ${request.category}`,
      );
    }
  }

  if (request.kind === 'network.fetch') {
    let origin: string;
    try {
      origin = new URL(request.url).origin;
    } catch {
      return deny(BROKER_DENIAL_CODES.malformedUrl, `"${request.url}" is not a URL`);
    }
    const declared = manifest.networkOrigins ?? [];
    // Compared as origins rather than by prefix: "https://api.example.com.evil
    // .test" starts with a declared origin string and is a different host.
    if (!declared.some((candidate) => originOf(candidate) === origin)) {
      return deny(BROKER_DENIAL_CODES.originNotDeclared, `${origin} is not a declared origin`);
    }
  }

  return { allowed: true, capability };
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function deny(code: BrokerDenialCode, detail: string): BrokerDecision {
  return { allowed: false, code, detail };
}

/**
 * Whether a request carries only data.
 *
 * This is the structural half of AC3-100 and the reason the union is written
 * the way it is. A message that survives `JSON.parse(JSON.stringify(x))`
 * unchanged cannot be carrying a MessagePort, a FileSystemHandle, a database
 * connection or a closure - those either throw or come back as `{}`. Enforcing
 * it here means the boundary stays a data boundary even if a future variant is
 * added carelessly.
 */
export function requestIsSerialisable(request: ExtensionRequest): boolean {
  let round: unknown;
  try {
    round = JSON.parse(JSON.stringify(request)) as unknown;
  } catch {
    return false;
  }
  return JSON.stringify(round) === JSON.stringify(request) && !containsNonData(request);
}

function containsNonData(value: unknown): boolean {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsNonData);
  }
  if (typeof value === 'object' && value !== null) {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      // A class instance - a port, a handle, a stream - is not plain data even
      // when its own enumerable fields happen to be.
      return true;
    }
    return Object.values(value).some(containsNonData);
  }
  return false;
}

/**
 * The requests a manifest could ever have answered.
 *
 * Shown at install time so the user sees the boundary rather than being told
 * about it. It is derived from the manifest, so it cannot drift from what the
 * broker will enforce.
 */
export function permittedRequestKinds(manifest: ExtensionManifest): readonly string[] {
  const kinds: ExtensionRequest['kind'][] = [
    'model.read',
    'model.propose',
    'selection.read',
    'selection.request',
    'ui.contribute',
    'storage.own.get',
    'storage.own.set',
    'network.fetch',
  ];
  return kinds
    .filter((kind) => manifest.capabilities.includes(capabilityForKind(kind)))
    .map((kind) => String(kind));
}

function capabilityForKind(kind: ExtensionRequest['kind']): ExtensionCapability {
  switch (kind) {
    case 'model.read':
      return 'model.read';
    case 'model.propose':
      return 'model.propose';
    case 'selection.read':
      return 'selection.read';
    case 'selection.request':
      return 'selection.request';
    case 'ui.contribute':
      return 'ui.contribute';
    case 'storage.own.get':
    case 'storage.own.set':
      return 'storage.own';
    case 'network.fetch':
      return 'network.declared-origins';
  }
}
