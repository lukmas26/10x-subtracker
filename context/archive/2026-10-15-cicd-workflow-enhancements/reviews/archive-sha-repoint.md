# Archive SHA repoint — cicd-workflow-enhancements

## 2026-10-20

- **Target**: `origin/master` @ `d85f0d5ade38f236335aeae49ea2035314c6248c` (fresh fetch, full history)
- **Integration commit**: `2fa9a97` — chore(ci): workflow hardening, format/audit gates, Dependabot (#26)
- **PR**: https://github.com/lukmas26/10x-subtracker/pull/26 (base `master`, merged by squash)
- **Evidence**: the PR commit list contains `69011bc`, `b94d5a3`, `22929fb`; none of them is an ancestor of the target; `2fa9a97` is. The squash touches the same file set as the PR diff, and the implementation files (`.github/`, `.prettierignore`, `package.json`, `.nvmrc`, `README.md`, `AGENTS.md`, `context/foundation/test-plan.md`) in `2fa9a97` are byte-identical to the PR head `82477c5`.
- **Decision**: user chose "Zaktualizuj i archiwizuj" (update and archive).

| Row ID | Old suffix (resolved OID)                             | New SHA   |
| ------ | ----------------------------------------------------- | --------- |
| 1.1–1.6 | `69011bc` (69011bcd27ba2c2b590c190081153725086bdae7, Workflow hygiene & pinning (p1)) | `2fa9a97` |
| 2.1–2.5 | `b94d5a3` (b94d5a38ee637d0fe1e77029e6269860cd3db257, Format & audit gates (p2))       | `2fa9a97` |
| 3.1–3.5 | `22929fb` (22929fbbfd28f5caa96d58bec148d5f150d26447, Dependabot & docs (p3))          | `2fa9a97` |

Affected rows: 16. Rows 4.1–4.6 have no SHA (Phase 4 changed GitHub settings only) and are unchanged.
