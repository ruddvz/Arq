# TypeScript SDK migration

The official v2 migration guide states that constructing a client or server does not automatically put 2026-07-28 bytes on the wire. ARQ must explicitly select the protocol profile, replace hidden per-session state with request state or explicit handles, update auth, support per-era codecs where required, and test wire captures. Dependency version alone is not evidence of protocol support.
