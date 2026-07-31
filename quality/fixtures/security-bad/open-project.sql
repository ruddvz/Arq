-- Security lint fixture: intentionally unsafe.
-- This directory is excluded from repository-wide security lint runs and exists
-- only to prove the lint fails. Do not copy these settings into real code.
PRAGMA trusted_schema = ON;

SELECT load_extension('./unvetted-extension.so');
