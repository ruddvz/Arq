import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-006. The SEO brief prohibits "automatic compliant design"; the project's
 * kernel rules require AI to propose typed operations with assumptions,
 * validation, diff and undo.
 *
 * Claim bindings: pub-ai-current (current-ai-authoring, PLANNED) and
 * pub-ai-mcp-boundary (mcp-proposal-boundary, LIBRARY_ONLY). The repository
 * contains a tested MCP proposal boundary, but apps/web has no host or Review
 * Centre surface and no client run is recorded. Product authoring remains
 * unavailable.
 */
export const aiPage: Page = {
  meta: {
    id: 'PUB-006',
    route: '/ai',
    title: 'AI',
    family: 'capability',
    description:
      'ARQ has a tested MCP proposal boundary in the repository, but no AI authoring is connected to the product. Any future capability must use typed operations, validation, review and undo.',
  },
  render: () => html`
    ${hero({
      heading: 'AI has to show its working before it changes anything.',
      lede: 'No AI-driven authoring is available in the ARQ product. The repository now contains a tested proposal boundary, but it is not connected to the application and has not been exercised by a recorded client run.',
    })}
    ${notes([
      {
        title: 'What exists in the repository',
        kind: 'state',
        body: html`
          <p>
            <code>packages/mcp-server</code> implements the boundary described by ADR-0027. It
            exposes 24 scoped tools for reading project context and preparing reviewable proposals.
            It has no tool that commits, approves, accepts a raw path or runs an unrestricted query.
          </p>
          <p>
            This is library code, not a product feature. The web application does not provide its
            project host, no screen renders the Review Centre model, and no Claude Code, Codex or
            Cursor run has been recorded. A proposal cannot change a user's project through the
            current product.
          </p>
        `,
      },
      {
        title: 'The contract every AI feature must meet',
        body: html`
          <p>
            This is a design rule recorded in the project's guardrails
            (<code>docs/ai/AI-GUARDRAILS.md</code>). The MCP package enforces this proposal shape at
            its own boundary. A product capability may ship only with all five parts:
          </p>
          ${specList([
            { term: 'Intent', detail: 'What you asked, restated so you can catch a misreading.' },
            {
              term: 'Assumptions',
              detail: 'What the model had to guess, listed rather than buried.',
            },
            {
              term: 'Operations',
              detail:
                'The exact typed edits it wants to make, the same operations your own tools produce.',
            },
            {
              term: 'Preview and validation',
              detail:
                'A diff against the current model, checked by the same validation as any manual edit.',
            },
            { term: 'Undo', detail: 'One step back, always, like any other operation.' },
          ])}
          <p>
            The library tests do not establish a safe product workflow. That requires the real
            project host, a user-visible review surface, deterministic validation against the open
            project, explicit approval, grouped undo and recovery evidence.
          </p>
        `,
      },
      {
        title: 'What AI in ARQ will not claim',
        kind: 'limit',
        body: html`
          <p>
            Generated geometry is not accurate until you have checked it. ARQ's AI will not produce
            building-code compliance, will not approve designs and will not replace professional
            judgement. The copy principles in the repository forbid describing it otherwise, and
            this site follows them.
          </p>
        `,
      },
      {
        title: 'Where it stands',
        body: html`
          <p>
            AI modifications are Release 3 scope, after the editor they would operate on is solid.
            The planned first steps are deliberately small: explain a selection, then single-step
            modifications under the contract above. This page will change when the build does.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The boring parts make the clever parts safe.',
      'Typed operations, validation and undo are being built for every edit, whoever proposes it. That is the product underneath.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/security', label: 'Security' },
      ],
    )}
  `,
};
