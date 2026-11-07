# Baseline B on the dev set — 20261107T070908Z_dry-run_f296f338

- Mode `dry-run`, status **stopped_bound_violation**, canary: False, counts as a measurement: False
- Prompt `B-1.0` sha256 `9247896719b66e13…`; dev set sha256 `bad376fce65d0b71…`; spec `1.0`
- Calls recorded 51 of 180; truncated replies 2; parse errors {'empty reply': 1, 'no reply': 2, 'not a single JSON value': 2, 'not an object with exactly the keys primary and note_status': 1, 'primary is not one of the six classes': 1}
- Spend implied by reported usage: US$ 10.057384; booked 10.072997 of 1
- Model identity: REHEARSAL: fake model (owner-stated, actual version unverified); aliases reported: ['fake-model-b']
- Stop reason: bound violated by call #51: reported usage (10000000 prompt + 3 completion tokens) is above the reserved bound (3122 + 2048)

dry run with a fake client: no accuracy or safety figure is published for it

