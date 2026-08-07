# Local index alternatives

LMDB-like copy-on-write B+ trees offer predictable read behaviour and zero-copy patterns. RocksDB-style LSM engines offer high write throughput and manifest-driven recovery but involve compaction and write amplification tradeoffs. SQLite offers mature transactions and queries. ARQ should benchmark actual workloads before selecting an index engine. The portable pack must remain independent of the choice.
