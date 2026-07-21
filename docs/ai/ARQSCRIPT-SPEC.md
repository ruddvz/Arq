# ArqScript specification v0

ArqScript is a deterministic, unit-aware language for architectural operations.

It is not the only project representation and does not execute arbitrary code.

Initial constructs:

- version;
- units;
- level;
- wall;
- door;
- window;
- room;
- dimension;
- select;
- update;
- rename.

Every script parses to typed model operations and passes semantic and geometry
validation before preview.
