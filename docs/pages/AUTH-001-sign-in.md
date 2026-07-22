# AUTH-001: Sign in

**Route or surface:** `/sign-in`
**Access:** anonymous
**Status:** Planned

## Goal

Authenticate a user securely.

## Entry points

- Direct navigation to `/sign-in` or `/sign-up`
- Call to action from a public page
- Emailed link (email verification, password reset) carrying a single-use token
- Redirect after an expired session on a signed-in route

## Required regions

- Page heading
- Form with clearly labelled fields
- Primary action
- Error and validation region
- Link to the alternate auth flow (sign-in <-> sign-up, forgot password)

## Required states

- Default
- Submitting
- Invalid input (client-side validation)
- Rejected credentials or expired/invalid token
- Rate-limited
- Success and redirect

## Behaviour

- Forgot-password and sign-up never reveal whether a given email already has an
  account (no enumeration - same response either way).
- Token-based flows (verify email, reset password) state the token's expiry and
  offer a clear path to request a new one when expired.
- No dark patterns around account creation, consent, or cancellation.
- Password fields support password manager autofill (correct `autocomplete` values).

## Responsive behaviour

- Single-column, mobile-first layout.
- Usable at 320 CSS pixels.
- Browser zoom to 200 percent preserves the primary action.

## Keyboard and accessibility

- Logical tab order and visible focus.
- Every field has a programmatically associated label and error message.
- Enter submits the focused form.
- Status is not communicated by colour alone.

## Analytics

Record which auth step was reached and a stable success/failure code only. Never
record email addresses, passwords, or tokens.

## Acceptance criteria

- [ ] Enumeration protection is implemented on forgot-password and sign-up.
- [ ] Token expiry and re-request path are defined for verify-email and reset-password.
- [ ] Rate-limiting behaviour is defined.
- [ ] All required states have designs.
- [ ] Copy follows the product-copy principles.
