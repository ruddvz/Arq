/**
 * ARQ-064: define type and instance property states.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 35 ("Type and instance") states verbatim: "Every property state is:
 * inherited; overridden; calculated; imported; missing; invalid." This
 * models that as a discriminated union so the inspector (section 35's
 * "Inspector behaviour": show source type, reset override, promote
 * repeated overrides into a new type, bulk edit, prevent cyclic
 * inheritance) has one place to read where a property's current value
 * actually came from.
 *
 * `resolveOverride` implements section 35's "reset override" action:
 * turning an Overridden state back into an Inherited one that reads
 * through to whatever the type currently provides - not a fixed snapshot
 * of the value at the moment of resetting.
 */

export type PropertyState<T> =
  | { readonly kind: 'inherited'; readonly value: T; readonly sourceTypeId: string }
  | { readonly kind: 'overridden'; readonly value: T; readonly sourceTypeId: string }
  | { readonly kind: 'calculated'; readonly value: T }
  | { readonly kind: 'imported'; readonly value: T; readonly importSource: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid'; readonly rawValue: unknown; readonly reason: string };

export function inheritedProperty<T>(value: T, sourceTypeId: string): PropertyState<T> {
  return { kind: 'inherited', value, sourceTypeId };
}

export function overriddenProperty<T>(value: T, sourceTypeId: string): PropertyState<T> {
  return { kind: 'overridden', value, sourceTypeId };
}

export function calculatedProperty<T>(value: T): PropertyState<T> {
  return { kind: 'calculated', value };
}

export function importedProperty<T>(value: T, importSource: string): PropertyState<T> {
  return { kind: 'imported', value, importSource };
}

export function missingProperty<T>(): PropertyState<T> {
  return { kind: 'missing' };
}

export function invalidProperty<T>(rawValue: unknown, reason: string): PropertyState<T> {
  return { kind: 'invalid', rawValue, reason };
}

/** True for states with a usable value (inherited, overridden, calculated, imported) - false for missing/invalid. */
export function hasValue<T>(
  state: PropertyState<T>,
): state is Extract<PropertyState<T>, { value: T }> {
  return state.kind !== 'missing' && state.kind !== 'invalid';
}

/**
 * "Reset override" (blueprint section 35): turns an Overridden state back
 * into Inherited, reading through to the type's current value rather than
 * freezing the value the property happened to hold at reset time. A
 * non-overridden state is returned unchanged.
 */
export function resolveOverride<T>(state: PropertyState<T>, currentTypeValue: T): PropertyState<T> {
  if (state.kind !== 'overridden') {
    return state;
  }
  return inheritedProperty(currentTypeValue, state.sourceTypeId);
}
