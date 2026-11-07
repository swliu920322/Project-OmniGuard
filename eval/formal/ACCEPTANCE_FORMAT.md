# What the formal runner expects from the private files

The tuning session has not seen the private files, so this is the format the runner is written to. If the custodian's files differ, `check-format` says which line breaks the contract (line numbers only, never the record), and the custodian converts the file or tells the tuning session the schema, not the data. A changed file changes its SHA-256 and needs a new freeze.

## `test_set.jsonl` (main suite), one JSON object per line

| Key | Type | Meaning |
|---|---|---|
| `id` | string, unique | record id (stays private) |
| `telemetry` | object with exactly `distance_cm`, `velocity_ms`, `hp`, `battery_pct`, `temperature_c` | numbers with at most 2 decimals, inside the contract's domain |
| `note` | string or `null` | operator note, non-blank, at most 500 characters |
| `note_status` | one of the six statuses, or `null` | `null` exactly when `note` is `null` |
| `family_id` | string, optional | kept in the private record, never published |
| `gold` | object, optional | if present, `gold.primary` must equal the route the runner **recomputes** from `telemetry` and `note_status` by the frozen specification; the file's gold is never trusted |

The runner recomputes the gold route, the risk set, the physical gate and the gold action with `eval/spec/reference_labeler.py` (spec 1.0), renders the model input with `render_telemetry` (the exact numbers, no cast), and checks the counts of the frozen file against `FROZEN_MANIFEST.json`: 300 records, 50 per class, 72 noted, 12 per note status.

## `stress_cases.jsonl` (stress suite), one object per line

| Key | Type | Meaning |
|---|---|---|
| `id` | string, unique | |
| `type` | integer 1 to 11 | stress type of `DATA_PLAN.md` section 5 |
| `telemetry` | any | raw, may be invalid on purpose (types 1, 2, 9) |
| `note` | any | raw, may be empty, over-long or not text (type 9) |
| `note_status` | status or `null` | the gold status of a valid noted case |
| `estop` | boolean, optional | the emergency-stop flag; default `false` |
| `fault` | `TIMEOUT` / `RATE_LIMIT` / `API_ERROR`, optional | for types 10 and 11 defaults to `TIMEOUT` / `RATE_LIMIT`; injected by the runner, **no API request is made** |

Checked: 55 cases, 5 per type, as in the manifest. Cases that fail the input contract are rejected in code and send nothing; cases with a fault send nothing; the others go through the backend decision path (`router_v2.decide`) and one model request each.

## Passing the data to the runner

Either `--acceptance-dir D` (the hashes come from the manifest) or `--data PATH --expect-sha256 HEX` (and `--stress-data` / `--stress-expect-sha256`). The hash is compared **before** a line is parsed for scoring. A file whose hash is not the manifest's (for example `eval/dev/dev_set.jsonl`) runs without the manifest's count check and is flagged `data_is_frozen_acceptance_file: false`; such a run is never a formal measurement.
