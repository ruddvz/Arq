# Production Operations and Incident Protocol

## Deployment discovery

Detect the real deployment path from workflows and configuration: GitHub Deployments,
Vercel, Netlify, Fly, Render, containers/Kubernetes or another provider. Do not assume
one from memory.

## Minimum production evidence

- merged SHA;
- deployed SHA;
- environment and URL;
- deployment status and timestamps;
- health/smoke results;
- critical error telemetry source;
- observation window;
- rollback mechanism and owner.

## Arq smoke catalogue

Run only safe configured probes, but include applicable critical paths:

- marketing/app shell loads;
- authentication boundary responds correctly;
- editor shell opens;
- create a project;
- create/open a minimal `.arq` fixture;
- perform one protected semantic edit;
- durable local save and reopen;
- plan/3D selection identity;
- export a small vector PDF in a non-destructive test context;
- no critical console/network error.

Production smoke must not create persistent user-visible garbage or expose secrets.

## Rollback criteria

Rollback for data corruption, project-open failure, authorization bypass, critical
crash loop, unusable core workflow or material performance regression with no rapid
safe forward fix.

## Incident levels

- SEV-1: data loss/security/core product unavailable;
- SEV-2: major workflow or deployment degraded;
- SEV-3: limited feature regression with workaround;
- SEV-4: cosmetic/non-urgent defect.

Record timeline, affected SHA/environment, detection, mitigation, evidence, restored
state, root cause and preventive action.
