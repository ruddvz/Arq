# Dual-root append and recovery

Append writers write new immutable segments, flush them, write a new manifest, flush it, then write the inactive recovery root with a higher generation and checksum. Readers choose the highest valid root. Interrupted writes before root publication leave the prior revision reachable. Repacking writes a separate candidate and uses atomic promotion.
