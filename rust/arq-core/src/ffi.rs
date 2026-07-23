//! ARQ-205: iPad and desktop FFI boundary.
//!
//! Plain C ABI (`extern "C"`, `#[no_mangle]`) - the lowest-level, most portable
//! surface, usable from a Swift bridging header (native iPad) or called directly by
//! a native desktop shell, per ADR-0020 ("desktop shell calls the Rust core
//! directly; iPad uses a generated stable FFI layer"). Deliberately separate from
//! `wasm_bindings.rs` (ARQ-204) - a different target, different calling convention,
//! but the same underlying logic in `units`/`ordering`/`hashing`.
//!
//! Inputs/outputs stay to primitive values and raw byte buffers only (no Rust
//! `Vec`/`String`/`Option` crossing the boundary directly), per ADR-0020: "Do not
//! expose internal Rust pointers or SQLite handles to the UI." A missing/invalid
//! result is a documented sentinel value, not a language-specific `Option`/`Result`
//! a C caller has no way to represent.
//!
//! **What is verified here:** these signatures compile for both the native target
//! this repository's own tests run on and, via `cargo check --target
//! aarch64-apple-ios`, the real iOS ABI's type layout - not a guess that C-compatible
//! Rust "should" cross-compile cleanly. **What is not verified:** an actual Swift
//! build calling into this, or linking a final iOS binary - both need Xcode on
//! macOS, which does not exist in this sandboxed Linux environment. See
//! `docs/architecture/ARQ-CORE-FFI-BOUNDARY.md`.

use crate::hashing::semantic_hash;
use crate::ordering::canonical_compare;
use crate::units::{canonical_micrometres_to_mm, mm_to_canonical_micrometres};
use std::ffi::{c_char, CStr, CString};
use std::os::raw::c_double;

/// Sentinel for "no valid value" - `i64::MIN` is not a real-world micrometre
/// quantity (see `units::MAX_SAFE_MICROMETRES`), so it is unambiguous as a failure
/// marker without needing a separate out-parameter.
pub const ARQ_CORE_FFI_INVALID_MICROMETRES: i64 = i64::MIN;

#[no_mangle]
pub extern "C" fn arq_core_mm_to_canonical_micrometres(mm: c_double) -> i64 {
    mm_to_canonical_micrometres(mm).unwrap_or(ARQ_CORE_FFI_INVALID_MICROMETRES)
}

#[no_mangle]
pub extern "C" fn arq_core_canonical_micrometres_to_mm(micrometres: i64) -> c_double {
    canonical_micrometres_to_mm(micrometres)
}

/// Hashes a raw byte buffer and returns a newly allocated, NUL-terminated C string
/// the caller must free with `arq_core_free_string` - Rust's own allocator owns it
/// until then, never the caller's.
///
/// # Safety
/// `bytes` must point to at least `len` readable bytes, and must outlive this call.
#[no_mangle]
pub unsafe extern "C" fn arq_core_semantic_hash(bytes: *const u8, len: usize) -> *mut c_char {
    let slice = if bytes.is_null() || len == 0 {
        &[]
    } else {
        std::slice::from_raw_parts(bytes, len)
    };
    let hash = semantic_hash(slice);
    CString::new(hash)
        .expect("hex digest never contains a NUL byte")
        .into_raw()
}

/// Frees a string previously returned by `arq_core_semantic_hash`. Safe to call with
/// a null pointer (a no-op), matching `free`'s own convention.
///
/// # Safety
/// `ptr` must be a pointer this crate itself returned (from
/// `arq_core_semantic_hash`) and not already freed.
#[no_mangle]
pub unsafe extern "C" fn arq_core_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(CString::from_raw(ptr));
    }
}

/// Computes the canonical sort order of `count` read-only, caller-owned C strings as
/// a permutation of indices, written into `out_indices` (which the caller allocates
/// with room for `count` `usize` values). Touches none of the input strings' memory
/// and transfers no ownership either direction - deliberately safer than a "sort in
/// place, taking ownership of each pointer" design would be, since this boundary has
/// no real Swift/C caller to test the ownership contract of that riskier
/// alternative against (see docs/architecture/ARQ-CORE-FFI-BOUNDARY.md). Batches the
/// whole list in one call, per ADR-0020's WASM-boundary guidance applied equally
/// here ("avoid frequent small calls...batch queries and operations").
///
/// # Safety
/// `strings` must point to `count` valid, non-null, NUL-terminated `*const c_char`
/// pointers, live for the duration of this call. `out_indices` must point to at
/// least `count` writable `usize` slots.
#[no_mangle]
pub unsafe extern "C" fn arq_core_canonical_sort_order(
    strings: *const *const c_char,
    count: usize,
    out_indices: *mut usize,
) {
    if strings.is_null() || out_indices.is_null() || count == 0 {
        return;
    }
    let pointers = std::slice::from_raw_parts(strings, count);
    let values: Vec<String> = pointers
        .iter()
        .map(|&ptr| CStr::from_ptr(ptr).to_string_lossy().into_owned())
        .collect();

    let mut indices: Vec<usize> = (0..count).collect();
    indices.sort_by(|&a, &b| canonical_compare(&values[a], &values[b]));

    let out = std::slice::from_raw_parts_mut(out_indices, count);
    out.copy_from_slice(&indices);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mm_to_canonical_micrometres_matches_the_safe_wrapper() {
        assert_eq!(arq_core_mm_to_canonical_micrometres(4000.0), 4_000_000);
    }

    #[test]
    fn mm_to_canonical_micrometres_returns_the_documented_sentinel_for_invalid_input() {
        assert_eq!(
            arq_core_mm_to_canonical_micrometres(f64::NAN),
            ARQ_CORE_FFI_INVALID_MICROMETRES
        );
    }

    #[test]
    fn canonical_micrometres_to_mm_round_trips() {
        assert_eq!(arq_core_canonical_micrometres_to_mm(4_000_000), 4000.0);
    }

    #[test]
    fn semantic_hash_round_trips_through_the_c_string_boundary() {
        let bytes = b"hello";
        let ptr = unsafe { arq_core_semantic_hash(bytes.as_ptr(), bytes.len()) };
        let hash = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap().to_owned();
        assert_eq!(hash, semantic_hash(bytes));
        unsafe { arq_core_free_string(ptr) };
    }

    #[test]
    fn semantic_hash_of_a_null_pointer_hashes_as_empty_rather_than_crashing() {
        let ptr = unsafe { arq_core_semantic_hash(std::ptr::null(), 0) };
        let hash = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap().to_owned();
        assert_eq!(hash, semantic_hash(b""));
        unsafe { arq_core_free_string(ptr) };
    }

    #[test]
    fn free_string_accepts_a_null_pointer_as_a_no_op() {
        unsafe { arq_core_free_string(std::ptr::null_mut()) };
    }

    #[test]
    fn canonical_sort_order_computes_the_sorted_permutation_without_touching_input_strings() {
        let a = CString::new("wall-2").unwrap();
        let b = CString::new("wall-1").unwrap();
        let pointers = [a.as_ptr(), b.as_ptr()];
        let mut out_indices = [usize::MAX; 2];

        unsafe {
            arq_core_canonical_sort_order(
                pointers.as_ptr(),
                pointers.len(),
                out_indices.as_mut_ptr(),
            )
        };

        // index 1 ("wall-1") sorts before index 0 ("wall-2").
        assert_eq!(out_indices, [1, 0]);
        // The original strings are untouched - still readable, still owned by `a`/`b`.
        assert_eq!(
            unsafe { CStr::from_ptr(pointers[0]) }.to_str().unwrap(),
            "wall-2"
        );
        assert_eq!(
            unsafe { CStr::from_ptr(pointers[1]) }.to_str().unwrap(),
            "wall-1"
        );
    }

    #[test]
    fn canonical_sort_order_is_a_no_op_for_a_null_pointer_or_zero_count() {
        let mut out = [0usize; 5];
        unsafe {
            arq_core_canonical_sort_order(std::ptr::null(), 0, out.as_mut_ptr());
            arq_core_canonical_sort_order(std::ptr::null(), 5, out.as_mut_ptr());
        }
    }
}
