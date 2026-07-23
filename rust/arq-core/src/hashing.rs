//! ARQ-200: semantic project hashing.
//!
//! `docs/architecture/SHARED-RUST-CORE.md`: "The same model operation must produce
//! the same semantic result and model hash on all supported targets." SHA-256 over
//! already-canonicalised bytes (canonical numeric encoding from `units`, canonical
//! ordering from `ordering` applied by the caller before hashing) - this module does
//! not itself canonicalise a record's *shape*, only hashes whatever canonical bytes
//! it is given, so it has no opinion on schema/entity structure.

use sha2::{Digest, Sha256};

/// Hex-encoded SHA-256 of already-canonicalised bytes.
pub fn semantic_hash(canonical_bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(canonical_bytes);
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_identical_input_to_the_same_value() {
        let a = semantic_hash(b"canonical-bytes");
        let b = semantic_hash(b"canonical-bytes");
        assert_eq!(a, b);
    }

    #[test]
    fn hashes_different_input_to_different_values() {
        assert_ne!(semantic_hash(b"one"), semantic_hash(b"two"));
    }

    #[test]
    fn produces_a_64_character_lowercase_hex_string() {
        let hash = semantic_hash(b"anything");
        assert_eq!(hash.len(), 64);
        assert!(hash
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }

    #[test]
    fn matches_the_well_known_sha256_of_an_empty_input() {
        // A cross-check against a value independent of this crate's own
        // implementation, not just this crate agreeing with itself.
        assert_eq!(
            semantic_hash(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn is_sensitive_to_byte_order_not_just_byte_content() {
        assert_ne!(semantic_hash(b"ab"), semantic_hash(b"ba"));
    }
}
