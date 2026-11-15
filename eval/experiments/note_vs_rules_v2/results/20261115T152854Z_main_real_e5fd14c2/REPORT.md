> Custodian verification completed; independent post-run cross-review is pending. This is a synthetic note-status comparison, not a before/after optimisation result.

# Note understanding: model scheme vs rules (round 2)

Status **completed** (completed all planned calls); records 180, model requests started 180, not started 0; **complete: True**.

note status accuracy (the main metric of this round); the primary route and the executed action are reported apart.

| Scheme | Note status correct | Accuracy | Note macro-F1 | Primary route correct | Missed halt | Needless halt | Note-only-risk missed halt |
|---|---:|---:|---:|---:|---:|---:|---:|
| model | 173/180 | 0.9611 | 0.9605 | 180/180 | 0 | 0 | 0 of 42 |
| R1 | 60/180 | 0.3333 | 0.2954 | 131/180 | 31 | 8 | 31 of 42 |
| R2 | 41/180 | 0.2278 | 0.1076 | 116/180 | 28 | 21 | 28 of 42 |
| R3 | 77/180 | 0.4278 | 0.4001 | 138/180 | 26 | 10 | 26 of 42 |

**model_vs_R3**: both correct 75, only first 98, only second 2, both wrong 5; difference 53.33 points, family bootstrap 95% [43.33, 63.33] (60 families, 2000 resamples, seed 20261109).

**model_vs_R1**: both correct 59, only first 114, only second 1, both wrong 6; difference 62.78 points, family bootstrap 95% [53.33, 71.67] (60 families, 2000 resamples, seed 20261109).

**model_vs_R2**: both correct 41, only first 132, only second 0, both wrong 7; difference 73.33 points, family bootstrap 95% [63.33, 82.78] (60 families, 2000 resamples, seed 20261109).

Model latency (one API request): all {'n': 180, 'median': 1750.05, 'p95_nearest_rank': 3314.7, 'max': 10885.4}, successful {'n': 180, 'median': 1750.05, 'p95_nearest_rank': 3314.7, 'max': 10885.4}. wall clock of one API request around the client call (network + service + hidden reasoning); not an HTTP business end-to-end latency and not comparable with local rule time
Cost: $0.109678 from reported usage over 180 requests (mean $0.000609); reserved for 0 requests without usage: $0.0. estimate at the configured rates (not a bill); a request with no reported usage keeps its worst-case reservation, which is an upper bound and not a spend, and is never counted as zero

Local rule time: R1 median 77.541 us, P95 125.792 us; R2 median 30.25 us, P95 49.042 us; R3 median 64.041 us, P95 293.833 us. Not the same kind of time as a model request.
