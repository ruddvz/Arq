# System overview

Start as a modular monolith.

Deployables:

- web editor;
- marketing and documentation site;
- API;
- asynchronous worker only when required.

Core packages must remain independent from renderer and external format classes.
