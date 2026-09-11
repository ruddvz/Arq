# Browser and device matrix evidence

Issue: #219 / ARQ-189  
Evidence date: 2026-09-11  
Owner: ARQ platform validation  
Matrix: `validation/BROWSER-AND-DEVICE-MATRIX.csv`

## Evidence-state rule

This record separates three kinds of evidence:

- **Primary-source capability evidence** says a browser/device vendor ships a capability.
- **Repository engine evidence** says ARQ exercised a browser engine or input contract in an automated environment.
- **Physical-device release evidence** requires the named shipping browser on the named hardware. It is not satisfied by headless Chromium, synthetic pointer events, or Playwright WebKit.

A browser version is never sufficient proof that WebGPU or an input capability is usable on a particular machine. Release validation must combine the version policy with runtime capability detection and measured device evidence.

## Primary-source evidence

### BDM-E01

Chrome shipped WebGPU initially in Chrome 113 on ChromeOS/Vulkan, Windows/D3D12 and macOS; Android followed in Chrome 121. Chrome's WebGPU release series records Linux support from Chrome 144 and expanded Linux NVIDIA support in 147-148.

Primary evidence: https://developer.chrome.com/docs/web-platform/webgpu/overview and https://developer.chrome.com/blog/new-in-webgpu-149-150

### BDM-E02

Microsoft documents WebGPU enabled by default from Edge 113 on Mac, Windows and ChromeOS.

Primary evidence: https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/

### BDM-E03

Safari 26.0 shipped WebGPU on macOS; Safari 26.6 shipped on 2026-07-27 and is the stable Safari evidence point used in this pass.

Primary evidence: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ and https://webkit.org/blog/18178/webkit-features-for-safari-26-6/

### BDM-E04

Safari 26.0 shipped WebGPU on iPadOS. Apple documents the exact iPad/Pencil combinations that support Apple Pencil hover; Pencil Pro requires iPadOS 17.5+ on its compatible devices.

Primary evidence: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ ; https://support.apple.com/en-ca/guide/ipad/-ipadc55b6c7a/ipados ; https://support.apple.com/en-ca/108937

### BDM-E05

Firefox 141 shipped WebGPU on Windows. Firefox 147 enabled WebGPU on all supported macOS versions on Apple Silicon. Current Mozilla documentation keeps Linux and Intel macOS in Nightly/flag-enabled territory rather than stable default support.

Primary evidence: https://www.mozilla.org/firefox/releasenotes/ ; https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/141 ; https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/147 ; https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features

### BDM-E06

Safari 26.0 shipped WebGPU on iOS. This capability fact does not change ARQ's existing iPhone viewer/review-only product scope.

Primary evidence: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/

## Repository evidence reviewed

- `package.json` already depends on Playwright and exposes multiple browser capability benchmarks.
- `scripts/run-pencil-pointer-capability-check.mjs` intentionally launches **Chromium** and records that it is not physical iPad/Apple Pencil evidence.
- `docs/research/PENCIL-WEB-INPUT.md` explicitly states that no physical iPad or Apple Pencil hardware was tested. It distinguishes real Chromium Pointer Events evidence from real iPadOS Safari/Pencil validation.
- Issues #201 and #202 preserve that same evidence boundary for Pencil role classification and hover-preview behaviour.

This means ARQ already has useful real-browser evidence, but not a cross-browser release gate and not physical Apple-device certification.

## Decision register

### BDM-D01 — Capability detection stays authoritative

**Status:** accepted for this matrix refresh.  
**Decision:** browser/version eligibility is a test-selection rule, not proof that WebGPU is available. Runtime capability detection plus a supported fallback remains required.  
**Reason:** GPU availability depends on OS, hardware, driver, browser build and feature status. The matrix must not turn a vendor release note into a machine-specific pass.

### BDM-D02 — Do not expand product platform scope in a research refresh

**Status:** accepted.  
**Decision:** keep the existing matrix roles intact: desktop Chrome/Edge and Safari surfaces remain `required`, Safari iPadOS remains `required`, Firefox remains `decision required`, and iPhone Safari remains `later` / viewer-and-review-only.  
**Reason:** #219 is a validation-matrix task. Browser capability changes are not authority to widen product scope.

### BDM-D03 — Firefox must be decided per OS

**Status:** open product decision, tracked in #360.  
**Decision for this matrix:** replace the ambiguous Firefox capability text with the current OS-specific evidence and retain `decision required` until #360 records an explicit support envelope.  
**Reason:** Windows, Apple Silicon macOS, Intel macOS and Linux do not currently have the same default WebGPU support state.

### BDM-D04 — Physical Safari/iPad evidence is a separate release gate

**Status:** open validation work, tracked in #359.  
**Decision:** engine-level WebKit or Chromium evidence must not be relabelled as shipping Safari, Apple Pencil, VoiceOver or physical-GPU evidence.  
**Reason:** the repository's own Pencil research already documents this limitation.

## Contradictions corrected in the draft matrix

1. Removed the stale `current 26.5 as of May 2026` wording. Safari 26.6 shipped on 2026-07-27.
2. Replaced the broad `M-series or A15+ device` Pencil-hover wording with Apple's exact documented device/Pencil combinations.
3. Corrected Firefox macOS support: Firefox 145/146 had narrower Apple Silicon enablement; Firefox 147 is the documented point for all supported macOS versions on Apple Silicon.
4. Removed `Android targeted late 2026` from the Firefox row because the current primary evidence reviewed for this pass does not support that product-release claim.
5. Updated the Chrome evidence boundary: older overview text said Linux was coming later, while Chrome's subsequent WebGPU release notes record Linux support from Chrome 144 and additional NVIDIA coverage in 147-148.

## Required follow-up work

- #358 — add browser-matrix smoke validation across Chromium, WebKit and Firefox. Playwright WebKit is engine evidence, not Safari certification.
- #359 — run physical Safari/macOS and Safari/iPadOS input, accessibility and performance validation on the actual supported hardware.
- #360 — decide the Firefox desktop support envelope per OS and fallback path.

## Security, accessibility, performance and licence effects

**Security:** WebGPU exposes low-level GPU capability and therefore remains gated by browser security/validation. This refresh does not weaken secure-context, browser or runtime capability checks. Safari's shipping notes explicitly call out security review for WebGPU.

**Accessibility:** GPU support alone is not a browser-support pass. Required surfaces still need keyboard/focus and relevant assistive-technology checks. #359 includes physical VoiceOver/keyboard smoke where the product surface requires it; #358 covers engine-level keyboard smoke.

**Performance:** WebGPU availability is not equivalent to acceptable ARQ editor performance. Physical-device and sustained-rendering benchmarks remain required before a device/browser combination becomes release evidence.

**Licence:** this change adds no dependency and ships no browser binary. Playwright is already a repository dev dependency. Any future browser-test packaging must continue through the repository's existing dependency-licence checks.

## Completion state for #219

The research matrix is now evidence-linked, stale capability claims are corrected, product-scope decisions are not silently widened, and every unresolved validation/implementation decision has a bounded follow-up issue. Physical-device results remain explicitly **not yet verified** and belong to #359 rather than being fabricated here.