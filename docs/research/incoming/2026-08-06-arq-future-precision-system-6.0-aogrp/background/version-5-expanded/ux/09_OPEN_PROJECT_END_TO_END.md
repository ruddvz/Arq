# End-to-end open project UX

The user selects a file. ARQ copies or stages it according to platform policy, performs bounded byte preflight, identifies the application, checks capabilities, plans migration without writing the source, opens in an isolated worker, validates integrity and semantics, then hydrates the workspace. Progress names the current phase. Cancel leaves the source unchanged.
