# Repository licence decision required

> **Resolved 2026-07-21.** The owner chose **private and proprietary / all rights
> reserved** - see `LICENSE`. The considerations below remain useful background (e.g.
> if a future plugin SDK or open-core split is considered), but the top-level
> repository licence question is no longer open.

No licence has been selected for Arq.

Do not publish source code under an assumed licence.

The owner must decide whether the repository will be:

- private and proprietary;
- source-available under custom terms;
- open source under a permissive licence;
- open core with separate commercial modules.

The decision must consider:

- commercial plans;
- contributor policy;
- patent clauses;
- use of LGPL and MPL dependencies;
- future plugin SDK;
- server and client separation;
- model and dataset licences;
- contributor licence agreement requirements.

Create an ADR and obtain legal advice before public source distribution.

## Verified conflict, 2026-08-04

The recorded decision and the repository's observed state disagree. This is
recorded rather than resolved: changing a licence grant or repository visibility
is the owner's decision with legal advice, not an inference a contributor may
make.

Observed from the GitHub API on 2026-08-04:

| Field           | Value         |
| --------------- | ------------- |
| `visibility`    | `public`      |
| `private`       | `false`       |
| `allow_forking` | `true`        |
| `license`       | `NOASSERTION` |

`LICENSE` states that the contents are "proprietary and confidential". The
proprietary grant and "all rights reserved" are the owner's stated terms and are
untouched here. The word "confidential" is a different kind of statement: it
describes who can read the repository, and it is contradicted by the repository
being publicly readable and forkable by anyone.

Two mutually exclusive resolutions exist, and both belong to the owner:

1. The repository is meant to be private. Change visibility to private. The
   `LICENSE` text then matches the observed state and nothing else changes.
2. The repository is meant to be public. Then "confidential" is inaccurate and
   should be removed, and the owner should choose the terms under which the
   published source may be read, forked and used, because `NOASSERTION` leaves
   that undefined for every reader who already has a copy.

Until one is chosen:

- no public surface may describe the repository as confidential, private, or
  under an open-source licence;
- no public surface may invite contribution under terms that do not exist;
- the `LICENSE` grant is not modified by any automated or agent-authored change.

This does not block a release. It blocks any public claim about licensing, and
it means anything already published under the current visibility has been
readable and forkable for as long as that visibility has been set.
