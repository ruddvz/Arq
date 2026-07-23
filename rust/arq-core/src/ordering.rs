//! ARQ-225: deterministic record ordering.
//!
//! JS string comparison (`<`/`>`, and therefore `Array.prototype.sort`'s default
//! comparator) orders by UTF-16 code unit, which can disagree with a byte-wise UTF-8
//! ordering for characters outside the Basic Multilingual Plane (surrogate pairs sort
//! differently under the two schemes). Rust's `str`/`String` `Ord` is defined as
//! byte-wise UTF-8 comparison - this module exists so every target (JS, WASM, a
//! future native FFI caller) sorts stable IDs through the same rule rather than each
//! platform's own native string sort, which is exactly the kind of cross-platform
//! drift `docs/architecture/SHARED-RUST-CORE.md` warns semantic hashing against.

/// Sorts stable IDs into canonical order (byte-wise UTF-8, ascending, stable).
/// Duplicates are preserved in their relative input order (stable sort) rather than
/// removed; deduplication is a separate, deliberate concern this function does not
/// silently perform.
pub fn canonical_sort_ids(mut ids: Vec<String>) -> Vec<String> {
    ids.sort();
    ids
}

/// The comparator `canonical_sort_ids` uses, exposed directly for callers that need
/// to order something other than a plain `Vec<String>` (e.g. records keyed by ID)
/// by the same canonical rule.
pub fn canonical_compare(a: &str, b: &str) -> std::cmp::Ordering {
    a.cmp(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_ascii_ids_lexicographically() {
        let ids = vec![
            "wall-2".to_string(),
            "wall-10".to_string(),
            "wall-1".to_string(),
        ];
        // Byte-wise, not numeric: "wall-10" sorts before "wall-2" since '1' < '2'.
        assert_eq!(
            canonical_sort_ids(ids),
            vec![
                "wall-1".to_string(),
                "wall-10".to_string(),
                "wall-2".to_string()
            ]
        );
    }

    #[test]
    fn is_stable_for_exact_duplicates() {
        let ids = vec!["a".to_string(), "b".to_string(), "a".to_string()];
        assert_eq!(
            canonical_sort_ids(ids),
            vec!["a".to_string(), "a".to_string(), "b".to_string()]
        );
    }

    #[test]
    fn empty_input_produces_empty_output() {
        assert_eq!(canonical_sort_ids(Vec::new()), Vec::<String>::new());
    }

    #[test]
    fn orders_multi_byte_utf8_characters_by_byte_value_not_locale() {
        // 'é' (U+00E9, 2-byte UTF-8: 0xC3 0xA9) vs 'z' (1 byte, 0x7A) - byte-wise,
        // 'z' (0x7A) sorts before the first byte of 'é' (0xC3), unlike a
        // locale-aware collation which might place accented letters near their
        // unaccented counterpart.
        let ids = vec!["é".to_string(), "z".to_string()];
        assert_eq!(
            canonical_sort_ids(ids),
            vec!["z".to_string(), "é".to_string()]
        );
    }

    #[test]
    fn canonical_compare_matches_canonical_sort_ids_ordering() {
        assert_eq!(canonical_compare("a", "b"), std::cmp::Ordering::Less);
        assert_eq!(canonical_compare("b", "a"), std::cmp::Ordering::Greater);
        assert_eq!(canonical_compare("a", "a"), std::cmp::Ordering::Equal);
    }
}
