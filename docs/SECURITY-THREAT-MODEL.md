# Zeus and Arq Delivery Threat Model

Assets: source, `.arq` data, credentials, releases, artifacts, user projects and build
provenance.

Threats include prompt/tool injection, malicious imported files, dependency compromise,
CI token abuse, secret exfiltration, unauthorized merge/deploy, stale-head merge,
artifact substitution, parser denial of service, raw database sync and unsafe migration.

Controls are defined in `.zeus/SECURITY-SUPPLY-CHAIN.md`, repository policy and
provider environment protection. Unknown controls are evidence gaps, not implied safety.
