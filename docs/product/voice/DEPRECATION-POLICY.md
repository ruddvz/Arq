# Language deprecation policy

Renaming a product concept is an API migration for humans.

## Canonical rename

When a visible term changes:

1. choose one new canonical term;
2. retain the old term as a search/support alias for a defined transition where useful;
3. update command labels, tooltips, docs, onboarding, accessibility names, templates, support and AI context together;
4. do not show old and new terms as interchangeable primary labels;
5. record the rename and removal condition.
6. retain a consumer-compatible resolver until the declared major-version
   removal in `language-contract-version.json`.

## Internal identifiers

Do not rename stable internal IDs merely to match copy unless there is an engineering reason. Map internal ID to visible term.

## Removed capability

Do not leave a disabled control indefinitely as a memorial to a removed feature. Distinguish:

- temporarily unavailable;
- capability-gated;
- removed;
- not committed.

Support and docs should state removal or replacement explicitly.

## Aliases

Aliases are for recognition, search and migration. They are not permission to create multiple canonical names.

## Message and claim IDs

Message IDs and claim IDs are consumer contracts. Do not reuse an ID with a new
meaning. Deprecate it, map it to the replacement and keep the old resolver for
the defined transition. Removing an ID or changing a required message variable
is a major language-contract change.
