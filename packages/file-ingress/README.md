# @arq/file-ingress

A dependency-light boundary for untrusted project files.

The package detects and hashes immutable source bytes, chooses a declared adapter, runs conversion outside canonical project state, and returns staged results plus a complete report. Unknown or proprietary files can be preserved as attachments without pretending they became editable Arq elements.
