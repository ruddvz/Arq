/**
 * V3-172 / AC3-099: an extension declares what it needs, and gets nothing else.
 *
 * Placed in this package rather than in a new one because it is the same
 * question the omission contracts here already answer for AI context - what a
 * non-human actor is allowed to see and change - applied to a second kind of
 * non-human actor. A plugin package with one file in it would separate two
 * halves of one policy.
 *
 * AC3-099's failure is "plugin has implicit access", and implicit access is
 * almost never granted deliberately. It arrives because a capability was not
 * thought of when the manifest format was designed, so there was nothing to
 * declare and nothing to check, and the extension simply had it. The defence is
 * a closed set: `EXTENSION_CAPABILITIES` names every capability that exists, a
 * manifest may only name those, and the broker (`extension-host-boundary.ts`)
 * answers only requests whose capability is both in that set and in the
 * manifest. A capability nobody has enumerated cannot be requested, because
 * there is no request shape that carries it.
 *
 * Canonical data effects are declared separately from capabilities and are the
 * part reviewers actually read. "This extension may read the model" and "this
 * extension may propose changes to walls and openings on the active level" are
 * different claims, and the second is the one that decides whether installing
 * it is safe.
 */

/**
 * Every capability that exists.
 *
 * Closed by construction. Adding one is a deliberate act with a review attached,
 * which is the property that makes "not declared" mean "not available" rather
 * than "not thought about".
 */
export const EXTENSION_CAPABILITIES = [
  /** Read the semantic model through the mediated read API. Never a database handle. */
  'model.read',
  /** Submit typed operations as a proposal. Not apply - see the AI proposal path. */
  'model.propose',
  /** Read the current selection. */
  'selection.read',
  /** Ask the host to change the selection. */
  'selection.request',
  /** Contribute panels and commands to the workspace. */
  'ui.contribute',
  /** Read the extension's own scoped key-value store. Never the project file. */
  'storage.own',
  /** Reach a network origin the manifest names. */
  'network.declared-origins',
] as const;

export type ExtensionCapability = (typeof EXTENSION_CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(EXTENSION_CAPABILITIES);

export function isKnownCapability(value: string): value is ExtensionCapability {
  return CAPABILITY_SET.has(value);
}

/** What an extension may do to canonical project data, in the terms a reviewer reads. */
export interface CanonicalDataEffect {
  /** Element categories touched, e.g. "Wall", "Room". `'*'` must be justified in `reason`. */
  readonly categories: readonly string[];
  readonly access: 'read' | 'propose';
  /** Why, in one sentence, for the install dialog. */
  readonly reason: string;
}

export interface ExtensionManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly publisher: string;
  readonly capabilities: readonly ExtensionCapability[];
  readonly canonicalDataEffects: readonly CanonicalDataEffect[];
  /** Required when `network.declared-origins` is requested, forbidden otherwise. */
  readonly networkOrigins?: readonly string[];
}

export const MANIFEST_REJECTION_CODES = {
  malformed: 'ARQ_EXT_MALFORMED',
  unknownCapability: 'ARQ_EXT_UNKNOWN_CAPABILITY',
  effectWithoutCapability: 'ARQ_EXT_EFFECT_WITHOUT_CAPABILITY',
  undeclaredNetwork: 'ARQ_EXT_UNDECLARED_NETWORK',
  networkWithoutCapability: 'ARQ_EXT_NETWORK_WITHOUT_CAPABILITY',
  unjustifiedWildcard: 'ARQ_EXT_UNJUSTIFIED_WILDCARD',
  insecureOrigin: 'ARQ_EXT_INSECURE_ORIGIN',
} as const;

export type ManifestRejectionCode =
  (typeof MANIFEST_REJECTION_CODES)[keyof typeof MANIFEST_REJECTION_CODES];

export type ManifestValidation =
  | { readonly status: 'valid'; readonly manifest: ExtensionManifest }
  | { readonly status: 'rejected'; readonly code: ManifestRejectionCode; readonly detail: string };

/**
 * Validates a manifest before anything is installed.
 *
 * The checks are all forms of one rule: nothing is available that was not
 * asked for in terms a person could have read and refused. A data effect
 * without the capability that performs it, a network origin without the
 * capability that reaches it, a capability requested for a network the manifest
 * never names - each is a gap between what the install dialog shows and what
 * the extension can do, which is the whole of AC3-099's failure.
 */
export function validateExtensionManifest(manifest: ExtensionManifest): ManifestValidation {
  if (manifest.id.trim().length === 0 || manifest.name.trim().length === 0) {
    return reject(MANIFEST_REJECTION_CODES.malformed, 'an extension must have an id and a name');
  }
  if (manifest.publisher.trim().length === 0) {
    return reject(
      MANIFEST_REJECTION_CODES.malformed,
      'an extension must name its publisher, so an install decision has someone to be about',
    );
  }

  for (const capability of manifest.capabilities) {
    if (!isKnownCapability(capability)) {
      return reject(
        MANIFEST_REJECTION_CODES.unknownCapability,
        `"${capability}" is not a capability this host grants`,
      );
    }
  }

  const declared = new Set<string>(manifest.capabilities);

  for (const effect of manifest.canonicalDataEffects) {
    const needed = effect.access === 'read' ? 'model.read' : 'model.propose';
    if (!declared.has(needed)) {
      return reject(
        MANIFEST_REJECTION_CODES.effectWithoutCapability,
        `a "${effect.access}" effect needs the ${needed} capability, which is not declared`,
      );
    }
    if (effect.categories.includes('*') && effect.reason.trim().length === 0) {
      // A wildcard over every category is the broadest thing a manifest can
      // say. It is allowed, because a measuring tool genuinely needs it, but
      // never silently: a reviewer must be given something to weigh.
      return reject(
        MANIFEST_REJECTION_CODES.unjustifiedWildcard,
        'an effect covering every category must give a reason',
      );
    }
  }

  const wantsNetwork = declared.has('network.declared-origins');
  const origins = manifest.networkOrigins ?? [];

  if (wantsNetwork && origins.length === 0) {
    return reject(
      MANIFEST_REJECTION_CODES.undeclaredNetwork,
      'the network capability requires the origins it will reach',
    );
  }
  if (!wantsNetwork && origins.length > 0) {
    return reject(
      MANIFEST_REJECTION_CODES.networkWithoutCapability,
      'network origins were declared without the capability that reaches them',
    );
  }
  for (const origin of origins) {
    if (!origin.startsWith('https://')) {
      // Project content would travel over it. A plaintext origin is not a
      // choice an extension gets to make on the user's behalf.
      return reject(MANIFEST_REJECTION_CODES.insecureOrigin, `"${origin}" is not an https origin`);
    }
  }

  return { status: 'valid', manifest };
}

function reject(code: ManifestRejectionCode, detail: string): ManifestValidation {
  return { status: 'rejected', code, detail };
}

function isEffectCategoryCovered(effect: CanonicalDataEffect, category: string): boolean {
  return effect.categories.includes('*') || effect.categories.includes(category);
}

/**
 * Whether a manifest permits an access to a category.
 *
 * `propose` does not imply `read`. They are separate declarations because they
 * are separate risks: an extension that can propose a change to a wall it
 * cannot read is a strange thing to build, but an extension that can read every
 * room name while only proposing changes to walls is exactly what a naming tool
 * looks like, and collapsing the two would over-grant it.
 */
export function manifestPermits(
  manifest: ExtensionManifest,
  access: CanonicalDataEffect['access'],
  category: string,
): boolean {
  const needed = access === 'read' ? 'model.read' : 'model.propose';
  if (!manifest.capabilities.includes(needed)) {
    return false;
  }
  return manifest.canonicalDataEffects.some(
    (effect) => effect.access === access && isEffectCategoryCovered(effect, category),
  );
}

/**
 * A one-line summary per effect for the install dialog.
 *
 * Generated from the manifest rather than written by the publisher, so the
 * sentence the user reads is derived from the thing that will actually be
 * enforced. A publisher-authored description can say anything.
 */
export function describeCanonicalEffects(manifest: ExtensionManifest): readonly string[] {
  return manifest.canonicalDataEffects.map((effect) => {
    const scope = effect.categories.includes('*') ? 'every element' : effect.categories.join(', ');
    const verb = effect.access === 'read' ? 'Reads' : 'Proposes changes to';
    return `${verb} ${scope}. ${effect.reason}`.trim();
  });
}
