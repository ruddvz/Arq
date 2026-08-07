# Discovery and caching

`server/discover` returns server identity, protocol support, extension support, authorization metadata, resource URI templates, and tool catalogs. Catalog order is deterministic. Cache hints may reduce repeated list calls, but clients must invalidate when the server capability version changes. Discovery never grants project access.
