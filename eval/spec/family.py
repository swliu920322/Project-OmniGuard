"""Family ids, the split algorithm and the duplicate check for the extended-task datasets.

A FAMILY is one base scenario with all its numeric variants, paraphrases and translations. A family never spans two
splits. Semantically similar risk combinations are allowed in different families (the same pattern can occur in dev and
test); what must never be shared is a base scenario or any rewording of it.

The id pool and the hash rule are committed before any sample exists, so nobody can move a family after seeing results.
"""
from __future__ import annotations

import hashlib
import re

SALT = "omniguard-eval-split-v1"  # public and fixed; a different salt is a different split (new version)
POOL_SIZE = 1200                  # F-0001 .. F-1200; a pool, deliberately larger than needed
CUTS = {"dev": 30, "test": 90}    # bucket (0..99): < 30 dev, < 90 test, else reserve (unused, or extra stress)
FAMILY_RE = re.compile(r"^F-(\d{4})$")


def family_id(n: int) -> str:
    if not 1 <= n <= POOL_SIZE:
        raise ValueError(f"family number {n} outside 1..{POOL_SIZE}")
    return f"F-{n:04d}"


def bucket(fid: str) -> int:
    if not FAMILY_RE.match(fid) or not 1 <= int(fid[2:]) <= POOL_SIZE:
        raise ValueError(f"not a family id of this pool: {fid!r}")
    return int(hashlib.sha256(f"{SALT}|{fid}".encode()).hexdigest()[:8], 16) % 100


def assign_split(fid: str) -> str:
    b = bucket(fid)
    return "dev" if b < CUTS["dev"] else "test" if b < CUTS["test"] else "reserve"


def pool_by_split() -> dict[str, list[str]]:
    out = {"dev": [], "test": [], "reserve": []}
    for n in range(1, POOL_SIZE + 1):
        out[assign_split(family_id(n))].append(family_id(n))
    return out


def normalize_text(text: str) -> str:
    """Same text up to case, spacing and punctuation width: used for duplicate detection."""
    text = text.lower().translate(str.maketrans("，。；！？：（）", ",.;!?:()"))
    return re.sub(r"\s+", " ", text).strip()


def fingerprint(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode()).hexdigest()


def check_records(records: list[dict], split: str) -> list[str]:
    """Violations in one split's records. Each record: {"family_id", "text"} (text = the rendered input)."""
    problems, seen = [], {}
    for i, r in enumerate(records):
        fid = r["family_id"]
        try:
            actual = assign_split(fid)
        except ValueError as e:
            problems.append(f"record {i}: {e}")
            continue
        if actual != split:
            problems.append(f"record {i}: family {fid} belongs to '{actual}', not '{split}'")
        fp = fingerprint(r["text"])
        if fp in seen:
            problems.append(f"record {i}: same text as record {seen[fp]}")
        seen.setdefault(fp, i)
    return problems


def cross_duplicates(a: list[dict], b: list[dict]) -> list[tuple[int, int]]:
    """Pairs (i, j) where a[i] and b[j] have the same normalised text; the public examples go in `a`."""
    index = {}
    for j, r in enumerate(b):
        index.setdefault(fingerprint(r["text"]), []).append(j)
    return [(i, j) for i, r in enumerate(a) for j in index.get(fingerprint(r["text"]), [])]
