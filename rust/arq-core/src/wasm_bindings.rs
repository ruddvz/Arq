//! ARQ-204: thin `#[wasm_bindgen]` wrappers over the real logic in `units`,
//! `ordering` and `hashing` - no behaviour of its own, so those modules' native tests
//! remain the source of truth; this module only proves the same functions are
//! callable from JS. Per ADR-0020's WASM guidance ("avoid frequent small calls
//! across the JS and WASM boundary; batch queries and operations"), `sort_ids_js`
//! batches a whole list in one call rather than exposing a per-comparison call.

use wasm_bindgen::prelude::*;

use crate::hashing::semantic_hash;
use crate::ordering::canonical_sort_ids;
use crate::units::{canonical_micrometres_to_mm, mm_to_canonical_micrometres};

/// Returns the canonical micrometre value, or `null` for non-finite/out-of-range
/// input - `Option<i64>` maps to `bigint | undefined` under wasm-bindgen, surfaced
/// here as `null` for a cleaner JS-side check.
#[wasm_bindgen(js_name = mmToCanonicalMicrometres)]
pub fn mm_to_canonical_micrometres_js(mm: f64) -> Option<i64> {
    mm_to_canonical_micrometres(mm)
}

#[wasm_bindgen(js_name = canonicalMicrometresToMm)]
pub fn canonical_micrometres_to_mm_js(micrometres: i64) -> f64 {
    canonical_micrometres_to_mm(micrometres)
}

#[wasm_bindgen(js_name = canonicalSortIds)]
pub fn canonical_sort_ids_js(ids: Vec<String>) -> Vec<String> {
    canonical_sort_ids(ids)
}

#[wasm_bindgen(js_name = semanticHash)]
pub fn semantic_hash_js(canonical_bytes: &[u8]) -> String {
    semantic_hash(canonical_bytes)
}
