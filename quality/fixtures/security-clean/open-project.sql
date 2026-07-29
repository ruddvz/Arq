-- Security lint fixture: clean.
-- Opening an untrusted project keeps the defaults that make an attacker-supplied
-- file safe to read.
PRAGMA trusted_schema = OFF;
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

SELECT schema_version, application_version FROM arq_meta LIMIT 1;
