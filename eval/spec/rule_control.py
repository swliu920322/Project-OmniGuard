"""Rule controls R1 and R2 for the extended task. They read the SAME rendered input text the model reads.

Everything that decides a result is listed here and fixed before the test set is frozen (word lists, matching, clause
splitting, cue precedence). They are baselines, not part of the product, and are never tuned on the frozen test set.
"""
from __future__ import annotations

import re

import reference_labeler as R

NOTE_MARKER = "Operator note:"

# Topic words: a clause is about the topic only if it contains one. English: whole words, case-insensitive.
TOPIC_EN = ["person", "people", "worker", "workers", "human", "someone", "somebody", "pedestrian", "obstacle", "box",
            "pallet", "blocked", "blocking", "path", "aisle", "nobody"]
TOPIC_EN_PHRASES = ["in the way", "no one"]
TOPIC_ZH = ["人", "工人", "行人", "障碍", "箱子", "货物", "挡"]  # Chinese: plain substring

# Cue words per status, English whole words / phrases and Chinese substrings.
CUES = {
    "HYPOTHETICAL": (["if", "unless", "in case", "would"], ["如果", "假如", "万一", "要是"]),
    "UNCERTAIN": (["maybe", "might", "possibly", "perhaps", "not sure", "unsure", "could be"], ["可能", "也许", "或许", "不确定"]),
    "NEGATED": (["no", "not", "none", "nobody", "clear", "gone", "left", "cleared", "without"], ["没有", "没", "无", "不在", "走了", "离开"]),
    "HISTORICAL": (["was", "were", "earlier", "ago", "before", "previously"], ["刚才", "刚刚", "之前", "曾"]),
}
# When one clause carries several cues, the first status in this list wins.
CUE_PRECEDENCE = ["HYPOTHETICAL", "UNCERTAIN", "NEGATED", "HISTORICAL"]  # no cue at all: AFFIRMED_CURRENT

CLAUSE_SPLIT = re.compile(r"[,;.!?，；。！？]|\bbut\b|\bhowever\b|但是|但|然而", re.IGNORECASE)


def _has_en(text: str, words: list[str]) -> bool:
    return any(re.search(rf"\b{re.escape(w)}\b", text, re.IGNORECASE) for w in words)


def _has_zh(text: str, words: list[str]) -> bool:
    return any(w in text for w in words)


def _topic(clause: str) -> bool:
    return _has_en(clause, TOPIC_EN + TOPIC_EN_PHRASES) or _has_zh(clause, TOPIC_ZH)


def clause_status(clause: str) -> str | None:
    """None when the clause is not about the topic."""
    if not _topic(clause):
        return None
    for status in CUE_PRECEDENCE:
        en, zh = CUES[status]
        if _has_en(clause, en) or _has_zh(clause, zh):
            return status
    return "AFFIRMED_CURRENT"


def split_note(text: str) -> tuple[str, str | None]:
    head, sep, note = text.partition(NOTE_MARKER)
    return head, (note.strip() or None) if sep else None


def note_status_r1(note: str | None) -> str | None:
    if not note:
        return None
    found = [s for s in (clause_status(c) for c in CLAUSE_SPLIT.split(note)) if s]
    return R.combine_clause_statuses(found) if found else "IRRELEVANT"


def note_status_r2(note: str | None) -> str | None:
    """Fail-safe variant: any topic word anywhere means a current report; no cue analysis."""
    if not note:
        return None
    return "AFFIRMED_CURRENT" if _topic(note) else "IRRELEVANT"


def predict(text: str, variant: str = "R1") -> dict:
    """Same interface as the model reply: {"primary": ..., "note_status": ...}."""
    head, note = split_note(text)
    rec = R.parse_rendered(head)
    status = (note_status_r1 if variant == "R1" else note_status_r2)(note)
    out = R.compose(rec, status)
    return {"primary": out["primary"], "note_status": status}
