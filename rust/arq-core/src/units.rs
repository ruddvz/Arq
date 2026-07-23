//! ARQ-224: canonical numeric normalisation (D-014).
//!
//! Runtime geometry/editor code keeps double-precision millimetres unchanged
//! (zero migration of shipped TypeScript packages, matches IFC/DXF's own native
//! floating-point representation). The canonical `.arq` storage and cross-platform
//! semantic hash instead use exact integer micrometres (i64), because
//! `docs/architecture/SHARED-RUST-CORE.md` forbids "platform-dependent
//! floating-point formatting as a canonical value" - raw floats risk drift between
//! native Rust, WASM and JS. This module is the single place that conversion happens,
//! so every target calls the same rule rather than each reimplementing rounding.

/// `i64::MAX` micrometres is far beyond any building-scale project; `f64` itself
/// loses exact integer precision above 2^53 (~9,000 km in micrometres), which is
/// the practically-relevant bound - documented here, not silently ignored.
pub const MAX_SAFE_MICROMETRES: i64 = 1 << 53;

const MICROMETRES_PER_MILLIMETRE: f64 = 1000.0;

/// Converts a millimetre value to canonical integer micrometres. Rounds half away
/// from zero (`f64::round`'s own documented behaviour) - the specific rule matters
/// less than every target using the same one, so this is the one place it is decided.
pub fn mm_to_canonical_micrometres(mm: f64) -> Option<i64> {
    if !mm.is_finite() {
        return None;
    }
    let micrometres = (mm * MICROMETRES_PER_MILLIMETRE).round();
    if micrometres.abs() > MAX_SAFE_MICROMETRES as f64 {
        return None;
    }
    Some(micrometres as i64)
}

/// The inverse of `mm_to_canonical_micrometres` - exact for any value that conversion
/// could have produced, since micrometre integers up to `MAX_SAFE_MICROMETRES` are
/// exactly representable as `f64`.
pub fn canonical_micrometres_to_mm(micrometres: i64) -> f64 {
    micrometres as f64 / MICROMETRES_PER_MILLIMETRE
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_whole_millimetres_exactly() {
        assert_eq!(mm_to_canonical_micrometres(4000.0), Some(4_000_000));
        assert_eq!(canonical_micrometres_to_mm(4_000_000), 4000.0);
    }

    #[test]
    fn round_trips_a_fractional_millimetre_value() {
        let mm = 123.456;
        let micrometres = mm_to_canonical_micrometres(mm).expect("finite value");
        assert_eq!(micrometres, 123_456);
        assert_eq!(canonical_micrometres_to_mm(micrometres), 123.456);
    }

    #[test]
    fn rounds_half_away_from_zero_deterministically() {
        // 0.0005 mm = 0.5 µm exactly at this scale - the documented tie-breaking rule.
        assert_eq!(mm_to_canonical_micrometres(0.0005), Some(1));
        assert_eq!(mm_to_canonical_micrometres(-0.0005), Some(-1));
    }

    #[test]
    fn rejects_non_finite_input_rather_than_producing_a_garbage_value() {
        assert_eq!(mm_to_canonical_micrometres(f64::NAN), None);
        assert_eq!(mm_to_canonical_micrometres(f64::INFINITY), None);
        assert_eq!(mm_to_canonical_micrometres(f64::NEG_INFINITY), None);
    }

    #[test]
    fn rejects_a_value_beyond_the_documented_safe_integer_boundary() {
        assert_eq!(mm_to_canonical_micrometres(1e30), None);
    }

    #[test]
    fn handles_negative_values_symmetrically() {
        assert_eq!(mm_to_canonical_micrometres(-4000.0), Some(-4_000_000));
        assert_eq!(canonical_micrometres_to_mm(-4_000_000), -4000.0);
    }

    #[test]
    fn zero_round_trips_to_zero() {
        assert_eq!(mm_to_canonical_micrometres(0.0), Some(0));
        assert_eq!(canonical_micrometres_to_mm(0), 0.0);
    }
}
