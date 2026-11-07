"""Sampling and agreement helpers for the blind part of the note-status annotation (ANNOTATION_PROTOCOL.md)."""
from __future__ import annotations

import math
import random
from collections import Counter

SAMPLE_SEED = 20261107   # fixed in advance; the same input gives the same sample
SAMPLE_FRACTION = 0.30   # of the notes of every status, hence of all notes
MIN_PER_STATUS = 4


def stratified_sample(initial: dict[str, str], statuses: list[str], fraction: float = SAMPLE_FRACTION,
                      min_per_status: int = MIN_PER_STATUS, seed: int = SAMPLE_SEED) -> dict:
    """Pick the notes for blind annotation, stratified by the initial status.

    Per status: at least `fraction` of its notes (rounded up) and at least `min_per_status` (or all of them if fewer).
    `initial` maps note id to initial status. The ids are sorted before drawing, so only the seed decides.
    """
    unknown = set(initial.values()) - set(statuses)
    if unknown:
        raise ValueError(f"unknown statuses {sorted(unknown)}")
    rng = random.Random(seed)
    chosen, per_status, short = [], {}, []
    for status in statuses:
        ids = sorted(i for i, s in initial.items() if s == status)
        want = min(len(ids), max(math.ceil(fraction * len(ids)), min_per_status))
        if len(ids) < min_per_status:
            short.append(status)
        picked = rng.sample(ids, want)
        chosen += picked
        per_status[status] = {"sampled": want, "total": len(ids)}
    total = len(initial)
    return {"ids": sorted(chosen), "per_status": per_status, "seed": seed, "short_statuses": short,
            "actual_fraction": (len(chosen) / total) if total else None}


def cohen_kappa(a: list[str], b: list[str]) -> float | None:
    """Cohen's kappa; None when it is undefined (no items, or chance agreement is already 1)."""
    if len(a) != len(b):
        raise ValueError("label lists differ in length")
    n = len(a)
    if n == 0:
        return None
    observed = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    expected = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return None if expected == 1 else (observed - expected) / (1 - expected)


def agreement_report(initial: dict[str, str], blind: dict[str, str]) -> dict:
    """Raw agreement, kappa (or why it is missing) and the disagreements, before any adjudication."""
    ids = sorted(blind)
    missing = [i for i in ids if i not in initial]
    if missing:
        raise ValueError(f"blind labels for unknown notes: {missing[:3]}")
    a, b = [initial[i] for i in ids], [blind[i] for i in ids]
    kappa = cohen_kappa(a, b)
    return {"n": len(ids), "raw_agreement": (sum(x == y for x, y in zip(a, b)) / len(ids)) if ids else None,
            "kappa": kappa, "kappa_note": None if kappa is not None else "undefined (no items, or all labels in one category)",
            "disagreements": [{"id": i, "initial": initial[i], "blind": blind[i]} for i in ids if initial[i] != blind[i]]}
