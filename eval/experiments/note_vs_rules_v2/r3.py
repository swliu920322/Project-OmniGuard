"""R3: a deterministic, explainable rule for the operator note (round 2, note_vs_rules_v2).

A serious rule control for the question "is a model needed to understand the note?". It reads the SAME rendered text as the
model and R1/R2 (eval/spec/rule_control.py, unchanged) and returns the same shape: {"primary", "note_status"}. The primary
route is composed by the frozen reference rules from the telemetry and the note status, exactly as for R1/R2.

What it does (plain strings and regular expressions only; no model, no network, no data table of sentences):
  1. split the note into clauses at punctuation and at contrast words (but / 但 / however ...), plus "and now" / "而现在";
  2. decide per clause whether it is about the topic (a person or an obstacle ahead, or "the path is clear"), with a small
     typo tolerance (one edit, only for long words) and a few explicit variants for short cue words;
  3. a clause with no topic word but a short departure / continuation cue ("现在走了", "still there") inherits the topic of
     the nearest earlier clause that had one (reference carry-over);
  4. per clause status, by scope: condition (hypothetical) > uncertainty > past-only (historical) > negation > affirmed.
     A negation word only decides ITS clause, never the whole note;
  5. combine with the specification's own rule (reference_labeler.combine_clause_statuses): current-state clauses outrank
     the past, conditions and unrelated matters; among current-state clauses AFFIRMED > UNCERTAIN > NEGATED.

Known limits are listed in R3_DEV_LOG.md; unresolved clause readings are returned by `explain()` as flags, not guessed.
"""
from __future__ import annotations

import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "eval/spec"))
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402  (only split_note: the marker split, shared with R1/R2)

VERSION = "v0"

# ---- lexicons -------------------------------------------------------------------------------------------------------------------
TOPIC_EN = {"person", "persons", "people", "worker", "workers", "human", "humans", "someone", "somebody", "anyone", "anybody", "pedestrian",
            "pedestrians", "staff", "nobody", "noone", "obstacle", "obstacles", "obstruction", "box", "boxes", "pallet", "pallets", "crate", "crates",
            "cargo", "goods", "package", "parcel", "debris", "object", "cart", "forklift", "trolley", "block", "blocks", "blocked", "blocking"}
TOPIC_EN_PHRASES = ("no one", "in the way")
TOPIC_ZH = ("人", "工人", "行人", "路人", "员工", "人员", "障碍", "阻挡", "挡", "堵", "拦", "箱", "货盘", "托盘", "货物", "杂物", "叉车", "手推车")
ZH_NOT_TOPIC = ("机器人", "人工", "别人", "人家", "人数", "人生")          # words that contain 人 but are not a person ahead
PATH_EN = {"path", "aisle", "lane", "corridor", "road", "way", "passage"}
PATH_ZH = ("通道", "车道", "路径", "路", "过道", "走廊", "前方", "前面")
CLEAR_EN = {"clear", "cleared", "empty", "free", "open", "unobstructed", "unblocked"}
CLEAR_ZH = ("畅通", "通畅", "空的", "空着", "空闲", "无阻", "没有阻碍")

HYP_EN = {"if", "unless", "suppose", "supposing", "whenever", "once"}
HYP_EN_PHRASES = ("in case",)
HYP_ZH = ("如果", "假如", "万一", "要是", "一旦", "倘若", "假设", "若是")
UNC_EN = {"maybe", "might", "possibly", "perhaps", "unsure", "uncertain", "probably", "seems", "seem", "appears", "suspect", "suspected", "unclear",
          "mybe", "mabye", "maybee", "maby", "migth"}
UNC_EN_PHRASES = ("not sure", "not certain", "could be", "may be", "looks like", "i think")
UNC_ZH = ("可能", "也许", "或许", "不确定", "不清楚", "好像", "似乎", "大概", "疑似", "看起来", "不一定", "说不准")
PAST_EN = {"earlier", "ago", "before", "previously", "yesterday", "was", "were", "had", "formerly"}
PAST_ZH = ("刚才", "刚刚", "之前", "以前", "先前", "曾经", "曾", "昨天", "前几分钟")
PAST_RE = re.compile(r"\d+\s*(?:分钟|小时|秒|天)前|[一二两三四五六七八九十几]+\s*(?:分钟|小时|秒|天)前")
NOW_EN = {"now", "currently", "still", "today"}
NOW_EN_PHRASES = ("right now", "at the moment")
NOW_ZH = ("现在", "目前", "此刻", "正在", "仍", "还在", "依然", "眼下")
NEG_EN = {"no", "not", "none", "nobody", "noone", "nothing", "without", "never", "gone", "left", "away", "empty", "clear", "cleared", "free", "unobstructed",
          "unblocked", "isnt", "arent", "wasnt", "werent"}
NEG_EN_PHRASES = ("no one",)
NEG_ZH = ("没有", "没", "无", "不在", "走了", "离开", "离去", "不见", "空的", "空着", "畅通", "通畅", "清空", "撤走", "移走", "搬走", "拿走", "无阻")

# short clause + one of these may inherit the topic of an earlier clause ("刚才有人，现在走了")
CARRY_ZH = ("走了", "离开", "离去", "不见了", "没了", "撤走", "移走", "还在", "仍在", "依然", "仍然", "没人了")
CARRY_EN = {"gone", "left", "still"}
CARRY_EN_PHRASES = ("moved away", "still there", "still here", "no longer")

# words one edit away from a lexicon word that are NOT typos of it (a false-positive guard)
NOT_TYPOS = {"persona", "personas", "personal", "personnel", "worked", "works", "working", "place", "palette", "wooden"}
FUZZY_TOPIC = {"person", "worker", "pallet", "someone", "somebody", "anyone", "anybody", "pedestrian", "obstacle", "nobody", "forklift", "blocking", "blocked", "trolley",
               "workers", "persons", "people", "obstruction", "package"}
FUZZY_NEG = {"nobody", "nothing", "without", "cleared"}
FUZZY_HYP_UNC = {"possibly", "perhaps", "unsure", "uncertain", "probably", "suspect", "unclear"}

CLAUSE_PUNCT = re.compile(r"[;!?,，；。！？、:：]|(?<!\d)\.(?!\d)")
CLAUSE_CONTRAST = re.compile(r"\b(?:but|however|although|though|yet)\b|\band (?:now|then|currently)\b|但是|但|然而|不过|可是|而现在|虽然")


def _norm(text: str) -> str:
    return unicodedata.normalize("NFKC", text).lower()


def _osa(a: str, b: str) -> int:
    """Optimal string alignment distance (insert, delete, substitute, adjacent swap each cost 1)."""
    if abs(len(a) - len(b)) > 1:
        return 2
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = a[i - 1] != b[j - 1]
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[-1][-1]


def _fuzzy_in(token: str, exact: set, fuzzy: set) -> bool:
    if token in exact:
        return True
    if len(token) < 5 or token in NOT_TYPOS:
        return False
    return any(token[0] == w[0] and abs(len(token) - len(w)) <= 1 and _osa(token, w) <= 1 for w in fuzzy if len(w) >= 6)


def _tokens(clause: str) -> list[str]:
    return re.findall(r"[a-z]+(?:'[a-z]+)?", clause.replace("n't", "nt").replace("'", ""))


def _has_phrase(clause: str, phrases) -> bool:
    return any(p in clause for p in phrases)


def _has_zh(clause: str, words) -> bool:
    return any(w in clause for w in words)


def _strip_zh_not_topic(clause: str) -> str:
    for w in ZH_NOT_TOPIC:
        clause = clause.replace(w, "")
    return clause


# ---- clause level ---------------------------------------------------------------------------------------------------------------
def split_clauses(note: str) -> list[str]:
    out = []
    for part in CLAUSE_PUNCT.split(_norm(note)):
        out += [p.strip() for p in CLAUSE_CONTRAST.split(part)]
    return [c for c in out if c]


def _is_topic(clause: str) -> bool:
    toks = _tokens(clause)
    zh = _strip_zh_not_topic(clause)
    if any(_fuzzy_in(t, TOPIC_EN, FUZZY_TOPIC) for t in toks) or _has_phrase(clause, TOPIC_EN_PHRASES) or _has_zh(zh, TOPIC_ZH):
        return True
    path = any(t in PATH_EN for t in toks) or _has_zh(clause, PATH_ZH)
    clear = any(t in CLEAR_EN for t in toks) or _has_zh(clause, CLEAR_ZH)
    return path and clear                                    # "the aisle is clear": a statement about the path ahead


def _carry_ok(clause: str) -> bool:
    """A short clause with a departure / continuation cue and no topic word of its own."""
    toks = _tokens(clause)
    short = len(toks) <= 5 and len(clause) <= 24
    return short and (_has_zh(clause, CARRY_ZH) or any(t in CARRY_EN for t in toks) or _has_phrase(clause, CARRY_EN_PHRASES))


def _status(clause: str) -> tuple[str, list[str]]:
    toks = _tokens(clause)
    flags = []
    if any(_fuzzy_in(t, HYP_EN, set()) for t in toks) or _has_phrase(clause, HYP_EN_PHRASES) or _has_zh(clause, HYP_ZH):
        return "HYPOTHETICAL", flags
    if any(_fuzzy_in(t, UNC_EN, FUZZY_HYP_UNC) for t in toks) or _has_phrase(clause, UNC_EN_PHRASES) or _has_zh(clause, UNC_ZH):
        return "UNCERTAIN", flags
    past = any(t in PAST_EN for t in toks) or _has_zh(clause, PAST_ZH) or bool(PAST_RE.search(clause))
    now = any(t in NOW_EN for t in toks) or _has_phrase(clause, NOW_EN_PHRASES) or _has_zh(clause, NOW_ZH)
    neg = any(_fuzzy_in(t, NEG_EN, FUZZY_NEG) for t in toks) or _has_phrase(clause, NEG_EN_PHRASES) or _has_zh(clause, NEG_ZH)
    if past and not now:
        return "HISTORICAL", flags
    if neg:
        return "NEGATED", flags
    return "AFFIRMED_CURRENT", flags


def explain(note: str | None) -> dict:
    """Clause readings with flags (carry-over, typo-tolerant match) so that an unresolved reading can be listed instead of guessed."""
    if not note:
        return {"status": None, "clauses": []}
    clauses, last_topic, found = [], False, []
    for c in split_clauses(note):
        topic = _is_topic(c)
        carried = False
        if not topic and last_topic and _carry_ok(c):
            topic, carried = True, True
        if not topic:
            clauses.append({"text": c, "status": None})
            continue
        last_topic = True
        st, flags = _status(c)
        if carried:
            flags = flags + ["carry_over"]
        clauses.append({"text": c, "status": st, "flags": flags})
        found.append(st)
    return {"status": R.combine_clause_statuses(found) if found else "IRRELEVANT", "clauses": clauses}


def note_status(note: str | None) -> str | None:
    return explain(note)["status"] if note else None


def predict(text: str) -> dict:
    """Same interface as the model reply and rule_control.predict: {"primary", "note_status"} from the rendered input text."""
    head, note = C.split_note(text)
    rec = R.parse_rendered(head)
    status = note_status(note)
    return {"primary": R.compose(rec, status)["primary"], "note_status": status}
