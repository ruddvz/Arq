# Localisation and translation contract

Arq's canonical language is semantic before it is English.

## Stable identifiers

Never translate:

- internal IDs;
- error codes;
- file extensions;
- schema/version identifiers;
- package names;
- imported external identifiers.

Translate visible labels through a locale catalogue while preserving the canonical term ID.

## Units are not translation

Locale affects presentation, not stored geometry. Unit display, decimal separators and fractional formats must follow the unit/number contract and never change canonical values.

## Do not concatenate grammar

Avoid constructing a sentence from translated fragments such as:
`{action} + {object} + {status}`.

Use complete message templates so grammar can change by locale.

## Product names

`Arq` and `.arq` are not translated.

Technical standards and format names such as IFC, DXF, PDF, SQLite and WebAssembly remain their established names unless the locale has an accepted conventional rendering.

## Terminology QA

Every locale must preserve distinctions between:

- save and sync;
- project and view;
- view and tab instance;
- warning and blocking error;
- open and import;
- import and link/reference;
- current and planned;
- proposal and applied change;
- read-only and unavailable.

A translation that collapses one of these distinctions fails review even if it is grammatically fluent.

High-risk strings resolve through stable message IDs and typed variables, not
concatenated fragments. A translation may change grammar or word order, but it
may not turn **compatible file** into **opened project**, **local journal** into
**saved file**, or **saved locally** into **synced**. The visible label remains
inside the accessible name in every locale.
