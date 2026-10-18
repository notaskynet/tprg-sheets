# System package format

A **system** (a game, an edition, a house-ruled variant) is a small folder of TOML files. The
app contains no game-specific code: it reads the package and draws the sheet, rolls the dice
and walks the player through character creation.

```
my-system/                 (or my-system.zip with the same content)
  system.toml              id, name, languages, dice mechanic, card summary
  model.toml               the data: groups, catalogs, fields, derived values, tables
  sheet.toml               how the sheet is laid out
  creation.toml            optional: the step-by-step creation wizard
  locales/en.toml          every label, by key (one file per language)
  locales/ru.toml
```

Start from a built-in system: **Systems → Download .zip** in the app (or copy `systems/*`).
Import your zip with **Systems → Import**. Errors are listed with the file and key to fix,
e.g. `model.toml: fields.clan.from — unknown catalog "clans"`.

**Editor support.** `pnpm schema` writes JSON Schemas to `schema/`. Put
`#:schema ../../schema/model.schema.json` as the first line of a file and an editor with TOML
support (Taplo / “Even Better TOML”) offers completion and inline errors.

Everything below is validated by `src/engine/schema.ts` (zod). It is the reference.

---

## system.toml

```toml
id = "my-system"            # lowercase letters, digits, "-"; unique; built-in ids are reserved
version = "1.0.0"
languages = ["en", "ru"]    # each needs locales/<lang>.toml
name = { en = "My System", ru = "Моя система" }
description = { en = "One sentence about the game.", ru = "Одно предложение об игре." }   # shown in the Systems list
accent = "#a01e2e"          # optional default brand colour (the user can override it)
credits = "Licence / attribution line shown in the Systems list"

[summary]                   # the card in the library
title = "profile.name"      # a field path
subtitle = ["profile.class", "profile.race"]   # field paths (selects show their label)
stats = ["level", "hpMax"]  # derived names or field paths, shown as small numbers

[dice]
mechanic = "pool-successes" # see "Dice" below
```

### Dice

| mechanic | options | rolls |
|---|---|---|
| `pool-successes` | `die = 10`, `defaultDifficulty = 6`, `onesCancel = true`, `specialty = "extra-die"` or `"none"` | a pool of dice; each ≥ difficulty is a success, 1s cancel successes, a botch when only 1s |
| `d20-modifier` | `critSuccess = 20`, `critFail = 1` | d20 + modifier against a DC; advantage / disadvantage |
| `d100-under` | – | roll under the skill: regular, hard (½), extreme (⅕); bonus / penalty dice |
| `notation` | – | free text such as `2d6+3`, `4d6dl1`, `(2d6+6)*5` |

Dice notation supports `NdM`, `dl`/`dh`/`kl`/`kh` (drop/keep lowest/highest N), `+ - * /` and parentheses.

---

## model.toml

The data a character holds. A character is a tree of values; derived numbers are never stored.

### Groups: many items of the same kind

```toml
[groups.attributes]
categories = ["physical", "social", "mental"]     # optional; drawn as columns
field = { type = "dots", min = 1, max = 5 }       # how each item is stored and edited
items = [
  { id = "strength", cat = "physical" },
  { id = "charisma", cat = "social" },
]
```
`itemsFrom = "abilities"` reuses another group's items (e.g. one specialty text per ability).
`granted = "<expression>"` (checkbox groups) yields item ids that are on for free, for example the
saving throws of the chosen class. They read as ticked in every formula, are drawn locked, and a
`spend` step does not charge them.
Values live at `attributes.strength`. Item defaults come from the field (`default`, else `min`).

### Catalogs: lists of options

```toml
[catalogs.clans]
items = [{ id = "brujah", disciplines = ["celerity", "potence"] }]   # any extra properties
```
Read them in formulas with `lookup('clans', profile.clan, 'disciplines')`. A property can be a list
(`saves = ["str", "con"]`) or a table of lists keyed by level (`features = { "1" = ["rage"], "3" = ["path"] }`).

### Fields

`[fields]` keys are dotted paths (quote them: `"profile.name"`). Types:

| type | notes |
|---|---|
| `text`, `longtext` | `longtext` is Markdown (click to edit). `text` may have `suggest = "<catalog>"` (autocomplete, free text allowed) |
| `number` | `min`, `max`, `default`. Limits are soft: clamped when the box loses focus |
| `dots` | `min`, `max`, `default` |
| `percent`, `checkbox` | |
| `select` | `from = "<catalog>"` or `options = ["a", "b"]`; `scope = "<expression>"` offers only the catalog ids it yields (sub-races of the chosen race…) |
| `list` | rows of `{ name, level, note }`; `item = "dots" \| "number" \| "note" \| "text"`, `suggest = "<catalog>"`, `max` |
| `damage-track` | `levels = [...]`, `kinds = ["bashing", "lethal", "aggravated"]` (weakest → strongest) |
| `pool` | `max = "<expression>"`; `full = true` (untouched means full) or `initial = "<expression>"` |
| `checkboxes` | `count` boxes (e.g. death saves) |

### Derived values

```toml
[derived]
humanity = "virtues.conscience + virtues.selfControl"
bloodMax = "table('bloodPool', profile.generation)[0]"
```

### Tables

```toml
[tables.bloodPool]
13 = [10, 1]      # a key is matched exactly, else the greatest key <= the value
9  = [14, 2]
```

### Expression language

Numbers, `'strings'`, `true/false`, dotted paths (`attributes.strength`, derived names),
`+ - * / %`, `== != < > <= >=`, `and or not`, `x[0]` (index into a table row).

| function | meaning |
|---|---|
| `sum(group)`, `sum(group.category)`, `sum(field)` | add up a group, a category, an object or a list's levels |
| `count(list)` | number of rows |
| `if(cond, a, b)` | |
| `min(...)`, `max(...)`, `floor(x)`, `ceil(x)`, `round(x)`, `abs(x)` | |
| `table('name', key)` | table lookup |
| `lookup('catalog', id, 'property')` | read a property of a catalog item; unknown → 0 / empty |
| `has(list, x)` | whether a list contains `x` |
| `concat(a, b, ...)` | join lists (a single string counts as a one-item list, anything else as empty) |
| `upto(table, level)` | join the lists of a level-keyed table for every key `<= level` |

Missing values count as 0 in arithmetic. Cycles between derived values are reported.

---

## sheet.toml

```toml
[roll]
pools = [["attributes"], ["abilities"]]   # slots: each slot is one pick, slots add up
specialties = "specialties"               # group with a text per item (pool-successes)
penalty = "healthPenalty"                 # derived value added to the roll
[roll.value]                              # roll with a derived number instead of the stored one
skills = "skill_{id}"

[[sections]]
id = "attributes"
title = "attributes.title"                # a locale key
columns = 3                               # 1-4
when = "level >= 2"                       # optional: shown only while this is truthy
blocks = [{ type = "group-columns", group = "attributes" }]
```
Groups listed in the same slot of `pools` are alternatives (D&D: one skill *or* save *or* check);
separate slots add up (WoD: attribute + ability).

### Blocks

| type | settings |
|---|---|
| `plate` | `fields = [...]` header fields |
| `fields` | `fields = [...]` a small grid of fields |
| `text` | `field` (a `longtext`) |
| `group-columns` | `group`; one column per category. `specialties`, `derived` |
| `group` | `group`; a single column |
| `list` | `field`; `scope = "<expression>"` limits the quick-pick to some catalog ids |
| `track` | `field` (a damage track); `penalty = "<table>"` shows the penalty per level |
| `pool` | `field`; `note = "<derived>"` extra line |
| `stepper` | `field` (a stored bonus), `derived` (the total shown as dots), `max` |
| `checkboxes` | `field` |
| `stats` | `items = [...]` derived names (read-only) or field paths; `signed = true` |
| `stack` | `blocks = [...]` blocks stacked in one column |
| `refs` | `catalog`, `ids = "<expression>"`: entries of a catalog (e.g. class features up to the level), each with its `desc.<catalog>.<id>` text |

`group` blocks accept `derived = ["{id}_score", "+{id}_mod"]`: derived columns per item
(`{id}` is the item id; a leading `+` always shows a sign).
The control per item follows the group's field type (dots, checkbox, number).

---

## creation.toml

A list of steps. Every step has `id`, optional `title` (a label key, default `steps.<id>`) and
`show = [derived names]` (stat boxes shown on the step) and `when = "<expression>"`: the step exists
only while it is truthy (a sub-class step once the level allows one); hidden steps leave the wizard and the checklist.

| kind | settings |
|---|---|
| `fields` | `fields = [...]`, `required = [...]` (default: all) |
| `pick` | `field`, `from = "<catalog>"`, `fields = [...]` extra fields on the same step |
| `priority` | `group`, `budgets = [7, 5, 3]` (largest budget goes to the category with most points), `base`, `maxPerItem` |
| `list` | `field`, `budget`, `scope = "<expression>"` |
| `scores` | `group`, `methods = ["pointbuy", "array", "roll"]` with `[pointbuy] budget min max costs`, `array = [...]`, `[roll] formula, items.<id>` |
| `spend` | `group`, `budget` (a number or an expression), `maxPerItem`, `scope = "<expression>"` (only these item ids may be chosen; the rest are locked and flagged if already ticked) |
| `freebies` | `budget`, `costs = [{ step = "<id>", per = 5 }, { field = "<path>", per = 2 }]` — extra points beyond earlier budgets, and stored bonus fields |
| `recap` | the checklist |

The checklist and the “what is wrong” texts are derived from these steps; no validation code.

---

## Locales

`locales/<lang>.toml` is a flat dictionary (tables are flattened with dots). Keys:

| key | label for |
|---|---|
| `<group>.title`, `<group>.cat.<category>`, `<group>.<item>` | groups, their categories and items |
| `<catalog>.<id>` | catalog options |
| `desc.<catalog>.<id>` | one-line description shown under an option |
| `fields.<path>` | field labels |
| `derived.<name>` | derived values shown as labels |
| `levels.<id>`, `damage.<kind>` | damage-track levels and kinds |
| `steps.<id>`, `hints.<id>`, `guide.<id>` | step title, one-line hint, Markdown guide card |
| `help.<field path>` | text under a field in the wizard |
| `labels.*` | anything else referenced by `title =` in `sheet.toml` |

The test suite (`src/systems/packages.test.ts`) checks that every bundled package has all of
these in every declared language and that every formula evaluates; run it on your own
package by placing it in `systems/`.

## Licensing

Packages for commercial games should contain **mechanics only** (names of traits, numbers,
formulas) and your own wording. Put the licence / attribution line in `credits`.
