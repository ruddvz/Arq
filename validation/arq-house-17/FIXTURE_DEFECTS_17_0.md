# ARQ House 17.0 — defect list for the file generator

Everything here was read out of `house.arq` and `model/canonical-model-17.0.json`
at revision 670. Counts are taken from the file, never estimated. The file was
opened read-only throughout and is byte-identical afterwards.

**Nothing in this list is a rendering preference.** Arq's own shortcomings are
tracked separately; this document is only about the file.

## What is already right

Worth stating first, because it sets the standard the defects fall short of. The
model is unusually clean:

| Check                                                        | Result                   |
| ------------------------------------------------------------ | ------------------------ |
| Unique ids across all 17 id-bearing collections              | 706 / 706, no collisions |
| Unresolved references (level, room, wall, opening)           | 0                        |
| Openings running past the end of their host wall             | 0 of 47                  |
| Rooms whose stated area disagrees with their own polygon     | 0 of 48                  |
| Rooms whose seed point falls outside their own boundary      | 0 of 48                  |
| Furniture whose centre falls outside its assigned room       | 0 of 140                 |
| Duplicate room numbers                                       | 0 of 48                  |
| Stair arithmetic (19 risers × 168.42 mm, 17 treads × 280 mm) | exact                    |
| Container integrity, foreign keys, table set                 | passes, arqfs v2         |

The defects below are real, but they sit on top of a model that is internally
consistent almost everywhere.

---

## 1. Correctness — wrong data in the file

### 1.1 Two structural grids that disagree

The model carries a grid in two places and they are not the same grid. Nothing
states which is authoritative.

| Axis | `structuralConcept.gridX/gridY`                     | `structuralModel.grid`                             |
| ---- | --------------------------------------------------- | -------------------------------------------------- |
| x    | 300, 4500, 6000, **12000**, 13500, **14000**, 17700 | 300, 4500, 6000, **9000**, 12000, 13500, 17700     |
| y    | 300, 3500, 5000, **8500**, 11000, **12500**, 15700  | 300, 3500, 5000, **8000**, 11000, **13700**, 15700 |

Any consumer — Arq, the PDF generator, a structural engineer — picks one and is
right half the time. This is the only outright contradiction found in the model.

**Fix:** collapse to one grid, or state which is authoritative and what the other
one is for.

### 1.2 Four services points sit outside the room they are assigned to

| Point                  | Kind           | At           | Assigned room | Room extent               | Off by                  |
| ---------------------- | -------------- | ------------ | ------------- | ------------------------- | ----------------------- |
| `pl-rf-drain-2`        | roof-drain     | 17400, 600   | `rm-rf-open`  | 300–6000 × 5000–11000     | 11 400 mm x, 4 400 mm y |
| `pl-rf-drain-3`        | roof-drain     | 600, 15400   | `rm-rf-mech`  | 12000–17700 × 12200–15700 | 11 400 mm x             |
| `pl-rf-drain-1`        | roof-drain     | 600, 600     | `rm-rf-open`  | 300–6000 × 5000–11000     | 4 400 mm y              |
| `ep-rf-solar-isolator` | solar-isolator | 12500, 12000 | `rm-rf-mech`  | 12000–17700 × 12200–15700 | 200 mm y                |

The three roof drains are at the corners of the roof, which is where drains
belong — their **positions** look right and their **room assignments** are wrong.
They appear to have been given whichever roof room was nearest to hand.

The solar isolator is a different case: 200 mm outside its room is a placement
slip, not a labelling one.

**Fix:** re-derive `roomId` from the point for all 126 services points, and
either move the isolator inside `rm-rf-mech` or assign it to the room it is
actually in. All 47 lighting and all 15 HVAC points already pass this test, so
the rule is clearly intended.

### 1.3 Three walls carry no height, alignment, join intent or role

| Wall                   | Level  | Length   | Missing                                        |
| ---------------------- | ------ | -------- | ---------------------------------------------- |
| `gf-guest-bath-east`   | ground | 3 200 mm | height, alignment, joinStart/End, semanticRole |
| `gf-dining-south-join` | ground | 500 mm   | same                                           |
| `uf-bed02-south-join`  | upper  | 700 mm   | same                                           |

Two are short junction stubs where defaulting is defensible. `gf-guest-bath-east`
is not — it is a **3.2 metre interior wall**, the full depth of the guest
bathroom, and it is the only wall of its length in the file with no stated
height. Every other wall on that level states 3 000 mm.

**Fix:** state the four fields on all three, and check whether
`gf-guest-bath-east` was meant to be a full-height wall or a partial screen. A
reader has no way to tell.

### 1.4 `side: "configured"` on all 39 doors and windows

`side` is the literal string `"configured"` on 26 doors and 13 windows. It never
states which face a door leaf swings into or which way a window faces.

This is the most expensive defect in the file, because it looks like data.
Arq derives the door side from `swingDirection` and the hand from
`hand: "start" | "end"` — and got it wrong twice before settling it against the
package's own A101, which draws the front door hinged at the right-hand jamb.
The first reading hinged it on the wrong jamb; the second flipped both fields and
swung it onto the street.

**Fix:** replace `"configured"` with the real value on all 39, or remove the
field entirely. An absent field makes a reader ask; a placeholder makes every
reader guess, and they will guess differently.

---

## 2. Missing data — things the PDF draws that the file does not contain

These appear in `ARQ_House_Complete_Documentation_17_0.pdf` and exist nowhere in
the model, so no renderer can produce them.

### 2.1 There are no dimensions, anywhere

The PDF's `16 000` and `18 000` overall dimensions are drawn by the generator and
never stored. Searched and absent at every level: `linearDimensions`,
`dimensions`, `annotations`, `textNotes`, `grids`.

A dimensioned drawing is not a rendering preference — it is the difference
between a picture of a house and a document someone can build from. Every Arq
drawing of this file will be undimensioned until this exists.

**Fix:** emit dimensions as data. Each needs two reference points, the level it
belongs to, and whether it measures to centreline or to face.

### 2.2 The courtyard tree is a sentence

`semanticExtensions.landscape.courtyard.tree` reads:

> "medium-canopy native species subject to horticultural confirmation"

There is no position, no canopy radius, no trunk, no level, no id. The whole
`landscape` block is prose — `courtyard`, `external`, `roofGarden`, `terraces`.

The contrast that matters: the **11 planters** in the same file _are_ real
objects with bounds, heights and levels, and Arq draws all 11. So this is not
about the reader.

**Fix:** if the tree is meant to appear, give it the shape a planter already has
— footprint, height, level, id. Prose in a model cannot reach a drawing.

### 2.3 North is stated but the origin is only described

`coordinateSystem` reads `{ north: "+Y", origin: "south-west outer corner" }`.
`north` is machine-readable; `origin` is a phrase. It happens to be true — the
model's minimum is (0, 0) — but a consumer cannot verify or use it.

**Fix:** state the origin as coordinates alongside the description.

---

## 3. Packaging — the file is roughly twice the size it needs to be

This is the section that bears on portability, and it is the largest single
finding.

`house.arq` is **34 689 024 bytes**. About **17 MB of that is duplicate bytes.**

### 3.1 Sixty-six of the 72 resources are stored twice

Every drawing, schedule, document and the PDF appears both in `archive_entry`
and in the `resource` / `resource_chunk` tables, byte for byte.

|                                           | Count | Bytes                     |
| ----------------------------------------- | ----- | ------------------------- |
| Resources also present in `archive_entry` | 66    | **13 676 715 duplicated** |
| Resources stored once                     | 6     | 5 963 758                 |

**Fix:** store each blob once. `resource` + `resource_reference` is the store
designed for this; `archive_entry` should point at it rather than hold a second
copy.

### 3.2 The model is stored three times

| Path                                     | Bytes     | Note                        |
| ---------------------------------------- | --------- | --------------------------- |
| `model.json`                             | 1 090 546 |                             |
| `model/canonical-model-17.0.json`        | 1 090 546 | byte-identical to the above |
| `model/canonical-model-17.0.pretty.json` | 2 468 846 | same model, whitespace      |

**3 559 392 bytes for one model**, where 1 090 546 would do. The pretty-printed
copy in particular is a development convenience shipped to every user on every
device.

**Fix:** keep `model.json`. Drop the other two, or generate the pretty form on
demand.

### 3.3 Two different documentation PDFs

| Bytes     | Role             | Where                        |
| --------- | ---------------- | ---------------------------- |
| 5 244 027 | portable-preview | `archive_entry` + `resource` |
| 5 228 395 | portable-preview | `resource` only              |

These are **different files** — different byte lengths — both marked
`portable-preview`, with nothing saying which is current. A reader offered "the
documentation" has two answers.

**Fix:** ship one, or mark which supersedes the other.

### 3.4 `README_FIRST.md` is stored twice

`README_FIRST.md` and `documents/00_README_FIRST.md`, byte-identical, 254 bytes
each. Trivial in size, but it is the same defect as 3.1 and 3.2 and suggests the
duplication is systematic rather than incidental.

### 3.5 The five schema-v2 named indexes are absent

The container has every table schema v2 defines and none of the five named
indexes `migrateArqfsSchemaV1ToV2` creates. This affects lookup cost, not
semantics — but it does establish that the file was not produced by this
repository's migration path.

**Fix:** run the file through the migration, or create the indexes when writing v2.

---

## 4. Hygiene — five generations of superseded data

`semanticExtensions` carries **58 sections**, and five of them are version
series where only the newest is live:

| Series            | Sections present                                | Live                |
| ----------------- | ----------------------------------------------- | ------------------- |
| `validation`      | 12, 13, 14, 15, 16, 17                          | `validation17`      |
| `solidGeometry`   | 15, 16, 17 (plus an unnumbered `solidGeometry`) | `solidGeometry17`   |
| `planTopology`    | 14, 16, 17                                      | `planTopology17`    |
| `floorAssemblies` | 15, 16, 17                                      | `floorAssemblies17` |
| `walkability`     | 15, 16, 17                                      | `walkability17`     |

**379 334 bytes** of superseded blocks. `currentPlanTopology: "planTopology17"`
names the live one for that series only; the other four leave a consumer to infer
that a higher number wins.

**Fix:** keep the current block per series and move the history somewhere it is
not shipped, or name the live block explicitly for all five the way
`currentPlanTopology` does for one.

---

## 5. Vocabulary — 15 fields a conforming reader rejects

Not defects exactly. The model's `compatibilityRevision` (`62c5e5c`) predates
Arq's own `native-project-model.ts` (`d867e6a`), so two vocabularies developed in
parallel. Arq now adapts all 15. Listing them because closing them at the source
would remove the adapter, and with it the risk that an adaptation is wrong.

| Section   | Field                   | File says                                | Contract wants                         |
| --------- | ----------------------- | ---------------------------------------- | -------------------------------------- |
| model     | `modelSchema`           | absent                                   | a schema tag                           |
| model     | `project`               | id/name/revision/units at the root       | a nested project record                |
| wallTypes | `thickness`             | bare `width: 300`                        | `{ value, unit }`                      |
| wallTypes | `defaultHeight`         | absent (height is per wall)              | `{ value, unit }`                      |
| wallTypes | `function`              | absent (role is per wall)                | `exterior` / `interior`                |
| walls     | `alignment`             | absent on 3                              | `centre` / `interior` / `exterior`     |
| walls     | `joinStart` / `joinEnd` | `"union-solid"`                          | `auto` / `butt` / `mitre` / `disallow` |
| walls     | `height` _(lossy)_      | bare number per wall                     | `heightOverride: { value, unit }`      |
| openings  | `kind`                  | `sliding-door`, `pocket-door`, `opening` | `door` / `window` / `void`             |
| doors     | `side`                  | `"configured"`                           | `left` / `right`                       |
| doors     | `hand`                  | `"start"` / `"end"`                      | `left` / `right`                       |
| doors     | `swingAngle`            | absent                                   | degrees                                |
| windows   | `side`                  | `"configured"`                           | `left` / `right`                       |
| rooms     | `status`                | `coordinated-17.0`                       | `valid`                                |

The `walls.height` row is marked lossy rather than blocking for a reason: a
reader that ignored it would open the file successfully and silently lose all
**65 stated wall heights**. That is the most dangerous shape a divergence can
take, and it is worth knowing the file contains one.

---

## Priority

1. **Reconcile the two structural grids** (1.1). The only contradiction in the
   model, cheap at the source, impossible downstream.
2. **De-duplicate the container** (3.1–3.4). ~17 MB, no data loss, and it is what
   makes the file awkward to move between devices.
3. **Fix the four mis-assigned services points** (1.2) and state the three walls'
   missing fields (1.3).
4. **Emit dimensions** (2.1). Nothing can draw a dimensioned plan until this
   exists.
5. **Replace `side: "configured"`** (1.4) and **give the tree geometry or drop
   it** (2.2).
6. Then the hygiene and vocabulary items, which cost nothing today but compound.
