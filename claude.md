# Claude Code Instructions

## Metamodel Naming Rules

### No Dots in Names
**IMPORTANT**: Do not use dots (`.`) in folder names or file names (except for the file extension).

Dots are used as path separators in the metamodel. Using dots in names will break path resolution.

**Correct:**
- `01_preferences/`
- `09_Цели обучения.md`
- `02_agency/01_Среднее число часов.md`

**Incorrect:**
- `01.preferences/`
- `09.Цели обучения.md`
- `02.agency/01.Среднее число часов.md`

Use underscores (`_`) instead of dots for separating prefixes from names.
