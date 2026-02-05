# Claude Code Instructions

## Metamodel Structure (4-type classification)

### Categories
```
metamodel/
├── 1_declarative/  # IND.1.* — User-editable (Read/Write)
├── 2_collected/    # IND.2.* — System-collected (Read only)
├── 3_derived/      # IND.3.* — Calculated (Read only)
├── 4_generated/    # IND.4.* — On-demand (Read only)
└── _shared/        # Shared definitions (stages.md, degrees.md)
```

### Access Control
| Category | User | Guide | System |
|----------|------|-------|--------|
| 1_declarative | Read/Write | Read | Read/Write |
| 2_collected | Read | Read | Write |
| 3_derived | Read | Read | Write (calc) |
| 4_generated | Read | Read/Generate | Generate |

### Naming Rules

**No Dots in Names**: Do not use dots (`.`) in folder or file names (except `.md` extension).

Dots are path separators. Use underscores (`_`) instead.

**Correct:**
- `1_declarative/1_2_goals/`
- `09_Цели обучения.md`

**Incorrect:**
- `1.declarative/1.2.goals/`
- `09.Цели обучения.md`

### Adding New Indicators

1. Determine the type (IND.1–4)
2. Place in the correct category folder
3. Use format: `NN_Name.md`
4. Include in the MD file:
   ```markdown
   # IND.X.Y.Z

   **Name:** Название показателя
   **Name (EN):** English name
   **Type:** semantic|temporal|categorical
   **Format:** string|float|enum|structured_text
   ```

5. Run `node scripts/build-metamodel.js` to regenerate data
6. Run `npm test` to verify
