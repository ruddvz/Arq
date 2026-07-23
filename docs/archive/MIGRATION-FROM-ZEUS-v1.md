# Migration from Zeus v1

Zeus v1 was a strong foundation. It introduced silent-first execution, domain
invariants, bounded verification and honest status. The v2 audit found several areas
that still needed senior-level strengthening.

## Removed or reduced

- Large generic prompt-template catalogue
- Repeated domain rules across wrappers
- Section-filling behaviour that could produce formal but shallow output
- Reliance on a single broad critique pass
- Implicit visual-quality expectations

## Added

- Project Intelligence Protocol
- Senior Quality Gate with scoring and repair requirements
- Pixel Precision Protocol
- Explicit existing-system reuse requirement
- Evidence and decision ledgers
- Architecture contradiction linter
- Visual contract linter
- Stronger release, migration and benchmark evidence rules
- Separate implementation-state and policy truth hierarchies
- Stronger anti-generic output standard

## Compatibility

The canonical file remains `.zeus/ZEUS.md`. Existing integrations should be replaced
or manually merged after the installer creates a backup.
