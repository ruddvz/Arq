# Crash injection matrix

Inject failure after every write, flush, manifest, recovery-root, rename, and cleanup boundary. Test zero-byte tail, partial segment header, partial payload, corrupt checksum, stale root, root pointing past EOF, duplicate object ID, decompression bomb, and interrupted repack. The previous valid revision must remain discoverable or the source must remain untouched.
