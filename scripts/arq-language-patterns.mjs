/**
 * Shared machine-checkable language rules for Arq.
 *
 * Hard means zero-false-positive class suitable for CI.
 * Warn means human judgement is required.
 *
 * Scopes:
 * raw     whole file
 * prose   extracted user-facing prose
 * public  public marketing prose only
 * ui      product UI prose only
 * rendered-public  rendered public HTML, decoded before scanning
 */

const AI_ARTIFACT_RE =
  /utm_source=(chatgpt\.com|openai|copilot\.com)|citeturn\d|turn\d+(search|image|news|file)\d+|:contentReference|oai_?citation|oaicite|:::writing\{|\[insert [a-z ]+\]|PASTE_[A-Z_]*URL|as an ai( language)? model/gi;

const HARD_CLAIMS = [
  /\bfull cad\b/i,
  /\bfull bim\b/i,
  /\bfull ifc\b/i,
  /\brevit replacement\b/i,
  /\breplaces revit\b/i,
  /\bsurvey[- ]grade\b/i,
  /\bzero data loss\b/i,
  /\blossless (exchange|import|export|round[- ]?trip)\b/i,
  /\bautomatically code[- ]compliant\b/i,
  /\bautomatic code compliance\b/i,
  /\bstructural safety (is )?guaranteed\b/i,
  /\bguaranteed structurally safe\b/i,
];

const NEGATION_NEAR =
  /\b(not|never|no|without|cannot|can't|does not|doesn't|will not|won't|prohibit(?:ed|s)?|defer(?:red|s)?|not committed|do not claim)\b/i;

export const RULES = [
  {
    id: 'ai-artifact',
    severity: 'hard',
    scope: 'raw',
    label: 'AI/tool artifact',
    re: AI_ARTIFACT_RE,
    note: 'Rewrite the pasted material. Do not merely strip the marker.',
  },
  {
    id: 'prohibited-public-claim',
    severity: 'hard',
    scope: 'public',
    label: 'Prohibited affirmative public claim',
    matcher(text) {
      const findings = [];
      const sentences = text.split(/(?<=[.!?])\s+|\n+/);
      for (const sentence of sentences) {
        for (const re of HARD_CLAIMS) {
          if (!re.test(sentence)) continue;
          if (NEGATION_NEAR.test(sentence)) continue;
          findings.push(sentence.trim());
        }
      }
      return findings;
    },
    note: 'The repo explicitly prohibits this claim unless it is a disclaimer/negation.',
  },
  {
    id: 'ai-authority-claim',
    severity: 'hard',
    scope: 'prose',
    label: 'AI professional-authority claim',
    matcher(text) {
      const claim = /\b(ai|arq ai|the ai)\s+(approves?|certifies?|signs off|guarantees?)\b/i;
      const findings = [];
      const sentences = text.split(/(?<=[.!?])\s+|\n+/);
      for (const sentence of sentences) {
        if (!claim.test(sentence)) continue;
        if (NEGATION_NEAR.test(sentence)) continue;
        findings.push(sentence.trim());
      }
      return findings;
    },
    note: 'AI may propose and validate against deterministic product rules; it is not a professional approver or certifier.',
  },
  {
    id: 'committed-dwg-rvt',
    severity: 'hard',
    scope: 'public',
    label: 'DWG/RVT support claimed as current or committed',
    matcher(text) {
      const claim =
        /\b(opens?|imports?|exports?|supports?)\s+(dwg|rvt)\b|\b(dwg|rvt)\s+(support|import|export)\s+(is|works|available|committed)\b/i;
      const findings = [];
      const sentences = text.split(/(?<=[.!?])\s+|\n+/);
      for (const sentence of sentences) {
        if (!claim.test(sentence)) continue;
        if (NEGATION_NEAR.test(sentence)) continue;
        findings.push(sentence.trim());
      }
      return findings;
    },
    note: 'DWG and RVT are not committed in the current format matrix.',
  },
  {
    id: 'em-dash-public',
    severity: 'hard',
    scope: 'public',
    label: 'Em dash in public copy',
    re: /\u2014/g,
    note: 'Use a full stop, colon, parentheses or a shorter direct sentence. Public copy must not contain em dashes.',
  },
  {
    id: 'em-dash-ui',
    severity: 'hard',
    scope: 'ui',
    label: 'Em dash in product UI copy',
    re: /\u2014/g,
    note: 'Use a full stop, colon, parentheses or a shorter literal label. Product UI copy must not contain em dashes.',
  },

  {
    id: 'generic-error',
    severity: 'warn',
    scope: 'ui',
    label: 'Generic error copy',
    re: /\b(oops|something went wrong|invalid input|operation failed|an error occurred|unknown error)\b/gi,
    note: 'Name the failed object/action, reason, safe state, and next action.',
  },
  {
    id: 'generic-success',
    severity: 'warn',
    scope: 'ui',
    label: 'Generic success copy',
    re: /\b(success!|all done!|you'?re all set|everything worked|completed successfully)\b/gi,
    note: 'State the exact completed result.',
  },
  {
    id: 'ambiguous-action',
    severity: 'warn',
    scope: 'ui',
    label: 'Ambiguous action label',
    re: /^(ok|yes|no|continue|confirm|proceed|submit)$/gim,
    note: 'Name the outcome, especially for destructive or consequential actions.',
  },
  {
    id: 'save-sync-conflation',
    severity: 'warn',
    scope: 'prose',
    label: 'Local save and sync may be conflated',
    re: /\b(saved and synced|autosaved? to (the )?cloud|cloud save|saving to sync|sync save)\b/gi,
    note: 'Local save and remote sync are separate states in Arq.',
  },
  {
    id: 'ambiguous-project-saved',
    severity: 'warn',
    scope: 'ui',
    label: 'Ambiguous save-state copy',
    re: /\b(project saved|saved project|autosaved?)\b/gi,
    note: 'Use Saved locally, local journal/recovery language, or explicit sync wording as appropriate.',
  },
  {
    id: 'generic-permission',
    severity: 'warn',
    scope: 'ui',
    label: 'Generic permission denial',
    re: /\b(permission denied|access denied|you are not allowed|not permitted)\b/gi,
    note: 'Name the required role/action when known; distinguish permission from unavailable capability.',
  },
  {
    id: 'safe-mode-user-copy',
    severity: 'warn',
    scope: 'ui',
    label: 'Internal safe-mode term exposed to users',
    re: /\bsafe mode\b/gi,
    note: 'Translate the actual condition: read-only, incompatible writer version, interrupted write, incomplete project data, or other specific reason.',
  },
  {
    id: 'overbroad-safe-status',
    severity: 'warn',
    scope: 'ui',
    label: 'Overbroad safety/health reassurance',
    re: /\b(all safe|everything is safe|project is safe|healthy project|all healthy)\b/gi,
    note: 'State the exact check that passed. File integrity, model validation, professional safety, and code compliance are different concepts.',
  },
  {
    id: 'absolute-lifetime-claim',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Absolute lifetime/availability claim',
    re: /\b(can never lock|will always open|outlive your software|our outage can never|can never be your outage|still open if arq stops existing|never be inaccessible)\b/gi,
    note: 'Describe the local-first architecture instead of guaranteeing every future condition.',
  },
  {
    id: 'hardware-universal',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Broad hardware/device claim',
    re: /\b(modest laptop is enough|works on any device|works everywhere|any browser|every browser|any computer)\b/gi,
    note: 'Use tested environments or benchmark evidence.',
  },
  {
    id: 'volatile-data-location-absolute',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Absolute data-location/privacy claim',
    re: /\b(nothing leaves your device|never leaves your device|sends nothing anywhere|data never leaves)\b/gi,
    note: 'State the exact current architecture and scope. Hosted, AI, support, import, or future services may have different data flows.',
  },
  {
    id: 'volatile-count',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Volatile implementation count',
    re: /\b\d[\d,]*\s+(tests?|packages?|components?|icons?|tools?|commands?|viewports?|benchmarks?)\b|\b(several|hundreds? of)\s+(tests?|packages?)\b/gi,
    note: 'Generate or CI-guard exact public counts, otherwise omit them.',
  },
  {
    id: 'combative-marketing',
    severity: 'warn',
    scope: 'public',
    label: 'Combative competitor/industry tone',
    re: /\b(marketing (usually )?lies|that would be a lie|most .* products .* pretend|unlike (other|legacy) tools|everyone else gets this wrong)\b/gi,
    note: 'Prove honesty through specific behaviour, not accusation.',
  },
  {
    id: 'universal-exchange',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Universal interoperability statement',
    re: /\bnothing round[- ]trips perfectly\b|\bno (cad|bim) tool can\b/gi,
    note: 'State Arq fidelity behaviour instead of a universal law.',
  },
  {
    id: 'hype',
    severity: 'warn',
    scope: 'prose',
    label: 'Generic product hype',
    re: /\b(seamless(?:ly)?|effortless(?:ly)?|revolutionary|revolutionise|game[- ]changing|cutting[- ]edge|next[- ]generation|world[- ]class|best[- ]in[- ]class|future[- ]proof|magic(?:al)?|powerful platform|enterprise[- ]grade)\b/gi,
    note: 'Name the capability or measurable behaviour.',
  },
  {
    id: 'ai-anthropomorphism-ui',
    severity: 'warn',
    scope: 'ui',
    label: 'AI anthropomorphism in product UI',
    re: /\b(ai architect|arq thinks|arq decided|the ai decided|expert ai|autonomous designer|your ai architect)\b/gi,
    note: 'Use proposal, assumption, operation, validation, and approval language.',
  },
  {
    id: 'ui-metaphor',
    severity: 'warn',
    scope: 'ui',
    label: 'Metaphor in high-risk product copy',
    re: /\b(ghost hand|red pen|careful junior|magic wand|brain|copilot)\b/gi,
    note: 'Keep product-state and error copy literal.',
  },
  {
    id: 'coming-soon',
    severity: 'warn',
    scope: 'ui',
    label: 'Vague future-state label',
    re: /\bcoming soon\b/gi,
    note: 'Use not available in this build, planned release, or a specific capability gate.',
  },
  {
    id: 'native-open-overclaim',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Compatibility or file preflight presented as a live open project',
    re: /\b(\.arq|arq project|project file)\b[^.\n]{0,110}\bopens? (in|inside) (your )?browser\b|\bopens? in your browser\b/gi,
    note: 'Current file UI establishes compatibility before a live browser project exists. Use compatibility/preflight wording until the opening pipeline is tested.',
  },
  {
    id: 'journal-portable-file-conflation',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Journal/local save may be presented as portable-file publication',
    re: /\b(single )?\.arq file\b[\s\S]{0,220}\b(saving is a local write|saved locally|local write)\b|\b(saving is a local write|saved locally)\b[\s\S]{0,220}\b\.arq file\b/gi,
    note: 'Name the actual persistence target. A current IndexedDB journal write does not establish that a portable .arq file was updated.',
  },
  {
    id: 'end-to-end-import-overclaim',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Import/export contract presented as current reachable workflow',
    re: /\bevery import\b[^.\n]{0,120}\b(import report|report)\b|\bimport pipeline\b[^.\n]{0,120}\b(in the development build|current build)\b/gi,
    note: 'Tested adapters are not proof of a user-reachable import/export path. State the library boundary or verified end-to-end evidence.',
  },
  {
    id: 'ai-current-enforcement-overclaim',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Future AI guardrails presented as a current shipping capability',
    re: /\b(ai capability|ai feature|ai in arq)\b[^.\n]{0,120}\b(enforced in (the )?(kernel|product)|ships|is available)\b/gi,
    note: 'Describe guardrails as the required contract for a future feature unless a current proposal flow is enabled and tested.',
  },
  {
    id: 'unearned-significance',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Unsupported significance or legacy claim',
    re: /\b(pivotal|transformative|landmark|defining moment|key turning point|enduring legacy|a testament to|stands as a reminder|marks a significant shift|focal point)\b/gi,
    note: 'State the specific capability, evidence or user consequence. Do not use importance as a substitute for proof.',
  },
  {
    id: 'vague-attribution',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Vague attribution or social proof',
    re: /\b(industry reports|observers (?:say|note|have cited)|experts (?:say|argue|agree)|some critics (?:say|argue)|many (?:users|architects|teams) (?:say|believe|find)|it is widely (?:considered|regarded))\b/gi,
    note: 'Name the source and what it establishes, or remove the attribution.',
  },
  {
    id: 'canned-assurance',
    severity: 'warn',
    reviewRequired: true,
    scope: 'prose',
    label: 'Canned assurance or didactic disclaimer',
    re: /\b(it(?:'s| is) (?:important|worthwhile|critical|crucial) to (?:note|remember|consider)|rest assured|you can be confident|we are committed to)\b/gi,
    note: 'State the check, boundary, evidence or next action directly.',
  },
  {
    id: 'stock-conclusion',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Stock conclusion',
    re: /^\s*(in summary|in conclusion|overall|to sum up)\b/gim,
    note: 'Keep a conclusion only when it adds a decision, action or new fact.',
  },
  {
    id: 'template-transition-cluster',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Repeated template transitions',
    matcher(text) {
      const hits = [
        ...text.matchAll(
          /\b(additionally|furthermore|moreover|consequently|notably|ultimately)\b/gi,
        ),
      ].map((match) => match[0]);
      return hits.length >= 3 ? hits : [];
    },
    note: 'Use transitions only when they state a real relationship. Cut formulaic connective tissue.',
  },
  {
    id: 'promotional-ornament',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Decorative promotional language',
    re: /\b(vibrant|rich heritage|groundbreaking|renowned|showcasing|exemplifies|at the heart of|a new era|seamless experience)\b/gi,
    note: 'Replace decorative language with the supported behaviour, condition or limit.',
  },
  {
    id: 'not-only-but-also',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Formulaic paired emphasis',
    re: /\bnot only\b[\s\S]{0,160}\bbut also\b/gi,
    note: 'Check whether two independent, concrete sentences are clearer.',
  },
  {
    id: 'negative-parallelism',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Formulaic negative contrast',
    re: /\bnot (?:only|just)\b[\s\S]{0,160}\b(?:but|also)\b|\bnot every [^.\n]{0,120}\b(?:but|that would be a lie)\b|\bnot (?:a|the) [^.\n]{0,120}\bbut\b/gi,
    note: 'Keep a contrast only when it corrects a concrete likely misunderstanding. Otherwise state the capability or limit directly.',
  },
  {
    id: 'self-attestation',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Self-attesting trust language',
    re: /\b(honest(?:ly)?|genuinely|not pretending|will not pretend|actually happened|what actually works)\b/gi,
    note: 'Do not ask the reader to trust a character claim. State the source, behaviour, limit or evidence instead.',
  },
  {
    id: 'unbounded-evidence-claim',
    severity: 'warn',
    reviewRequired: true,
    scope: 'public',
    label: 'Unbounded evidence claim',
    re: /\btests? behind every\b|\bevery (?:entry|commit|release)[^.\n]{0,100}\btested\b|\ball (?:pages|claims|features)[^.\n]{0,100}\btested\b/gi,
    note: 'Link or name the exact evidence. Do not use an all-encompassing test claim as reassurance.',
  },
  {
    id: 'assistant-filler',
    severity: 'warn',
    reviewRequired: true,
    scope: 'prose',
    label: 'Assistant-like conversational filler',
    re: /\b(of course|certainly|i hope this helps|would you like me to|you'?re absolutely right|happy to help)\b/gi,
    note: 'Lead with the answer, state or action. Offer follow-up only when a real choice remains.',
  },
];

export const CODE_EXT = /\.(tsx|jsx|ts|js|mjs)$/i;
export const DOC_EXT = /\.(md|mdx|txt)$/i;
export const JSON_EXT = /\.json$/i;

const CLASSY_TOKEN = /^[a-z0-9:\-[\]/.%()#!,]+$/i;
const DEV_SINK =
  /\b(console\.\w+|logger\.\w+|throw new \w*Error?|new Error|assert\w*|invariant)\s*\($/;

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

function isProse(value) {
  const text = value.trim();
  if (text.length < 3) return false;
  if (!/[A-Za-z]/.test(text)) return false;

  const tokens = text.split(/\s+/);
  if (
    tokens.length > 1 &&
    tokens.every((token) => CLASSY_TOKEN.test(token)) &&
    tokens.some((token) => /[-:[\]]/.test(token))
  ) {
    return false;
  }

  if (/^[A-Z0-9_./:-]+$/.test(text) && !/\s/.test(text)) return false;
  return true;
}

export function extractCodeProse(text) {
  const src = stripComments(text);
  const out = [];
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

  for (const match of src.matchAll(literal)) {
    const before = src.slice(Math.max(0, match.index - 80), match.index).trimEnd();
    if (DEV_SINK.test(before)) continue;

    let value = match[1] ?? match[2] ?? match[3] ?? '';
    value = value.replace(/\$\{[^}]*\}/g, ' ');
    if (isProse(value)) out.push(value);
  }

  for (const match of src.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    const value = match[1] ?? '';
    if (isProse(value)) out.push(value);
  }

  return out.join('\n');
}

export function classifySurface(filePath) {
  const p = filePath.replace(/\\/g, '/');

  if (/^apps\/marketing\/src\/content\//.test(p)) return 'public';
  if (/^apps\/marketing\/src\//.test(p)) return 'public';
  if (/^apps\/web\/src\//.test(p)) return 'ui';
  if (/^packages\/design-system\/src\//.test(p)) return 'ui';
  if (/^packages\/workspace\/src\/registry\/.*\.json$/.test(p)) return 'ui';
  return 'other';
}

function targetFor(rule, surface, rawText, proseText) {
  if (rule.scope === 'raw') return rawText;
  if (rule.scope === 'public') return surface === 'public' ? proseText : '';
  if (rule.scope === 'ui') return surface === 'ui' ? proseText : '';
  return proseText;
}

export function scanSurfaceText(surface, rawText, proseText = rawText) {
  const findings = [];

  for (const rule of RULES) {
    const target = targetFor(rule, surface, rawText, proseText);
    if (!target) continue;

    let hits = [];
    if (rule.matcher) {
      hits = rule.matcher(target);
    } else {
      hits = [...target.matchAll(rule.re)].map((m) => (m[0] ?? '').trim()).filter(Boolean);
    }

    if (hits.length) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        reviewRequired: rule.reviewRequired === true,
        label: rule.label,
        note: rule.note,
        hits,
      });
    }
  }

  return findings;
}

function decodeRenderedHtml(html) {
  return html
    .replace(/&mdash;|&#0*8212;|&#x0*2014;/gi, String.fromCodePoint(0x2014))
    .replace(/&nbsp;|&#0*160;|&#xa0;/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ');
}

export function scanRenderedPublicHtml(html) {
  const decoded = decodeRenderedHtml(html);
  return scanSurfaceText('public', decoded, decoded);
}

export function externalLoadedResourceUrls(html) {
  const urls = [];
  const tags = html.match(/<(?:script|img|source|audio|video|iframe|link)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const isLink = /^<link\b/i.test(tag);
    if (
      isLink &&
      !/\brel\s*=\s*["'][^"']*(?:stylesheet|preload|modulepreload|icon|manifest)[^"']*["']/i.test(
        tag,
      )
    ) {
      continue;
    }
    const attribute = tag.match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (attribute && /^(?:https?:)?\/\//i.test(attribute[1])) urls.push(attribute[1]);
    for (const srcset of tag.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const candidate of srcset[1].split(',')) {
        const url = candidate.trim().split(/\s+/)[0] ?? '';
        if (/^(?:https?:)?\/\//i.test(url)) urls.push(url);
      }
    }
  }
  for (const match of html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^)'"\s]+)["']?\s*\)/gi)) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
}

export function scanFile(filePath, text) {
  const prose = CODE_EXT.test(filePath) ? extractCodeProse(text) : text;
  return scanSurfaceText(classifySurface(filePath), text, prose);
}
