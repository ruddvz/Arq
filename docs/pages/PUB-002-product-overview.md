# PUB-002: Product overview

**Route or surface:** `/product`
**Access:** public
**Status:** Implemented in `apps/marketing` (static build; see its README for enforced acceptance tests)

## Goal

Describe the complete product direction without unsupported compatibility claims.

## Entry points

- Direct navigation and bookmarks
- Search engines
- Marketing links, ads, and social shares
- Cross-links from other public pages and from in-product upgrade or help prompts
- Documentation and changelog references

## Required regions

- Page heading
- Primary content
- Primary call to action (sign-up, contact, or next public page)
- Global public navigation and footer
- Cookie or consent notice where applicable

## Required states

- Default (populated)
- Loading (rare - content is mostly static, but images/embeds may lazy-load)
- Not found (bad or removed route)
- Reduced-motion variant

## Behaviour

- Every product claim matches `business/LAUNCH-CLAIMS-CHECKLIST.md` - no unsupported claim (full CAD, full BIM, full IFC, DWG, Revit replacement, survey-grade capture, code compliance, structural safety, zero data loss).
- Route clearly to product, pricing, security, and sign-up without dead ends.
- No dark patterns in call-to-action placement or copy.
- Works without JavaScript for core content where reasonably possible.

## Responsive behaviour

- Usable at 320 CSS pixels.
- Standard responsive web layout - this is a marketing page, not an app shell; no canvas or panel layout applies here.
- Browser zoom to 200 percent preserves the primary call to action.

## Keyboard and accessibility

- Logical tab order and visible focus.
- One page heading (`h1`) and correct landmark regions.
- Skip-to-content link.
- Status is not communicated by colour alone.
- Images have accessible alternative text; decorative images are marked as such.

## Analytics

Record page viewed and outbound call-to-action clicked, with standard web analytics
only. No project content applies to public pages.

## Acceptance criteria

- [ ] Copy follows `docs/product/PRODUCT-COPY-PRINCIPLES.md` and the launch claims checklist.
- [ ] No unsupported product claim appears.
- [ ] Works at 320 CSS pixels and at 200 percent browser zoom.
- [ ] One `h1`, correct landmarks, and a skip-to-content link are present.
- [ ] Not-found and loading states are designed.
