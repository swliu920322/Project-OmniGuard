#!/bin/sh
# Verify the baseline-v1 archive. Run from the repository root:
#   sh eval/baseline_v1/verify.sh
# It checks the tag, the commit it points to, every file hash, and that every archived
# file is byte-identical to the same path at the tag. No network, no model calls.
set -eu

TAG=eval-baseline-v1
BASE_COMMIT=a58b1258280567d3061973197151a0c917276fd8
DIR=eval/baseline_v1
fail=0
check() { if [ "$2" = "ok" ]; then echo "PASS  $1"; else echo "FAIL  $1"; fail=1; fi; }

[ "$(git cat-file -t "$TAG")" = "tag" ] && r=ok || r=bad
check "tag $TAG is an annotated tag object" "$r"

[ "$(git rev-parse "$TAG^{commit}")" = "$BASE_COMMIT" ] && r=ok || r=bad
check "tag points to commit $BASE_COMMIT" "$r"

( cd "$DIR/original" && shasum -a 256 -c ../SHA256SUMS >/dev/null 2>&1 ) && r=ok || r=bad
check "all SHA-256 hashes in SHA256SUMS match the archived files" "$r"

n_list=$(wc -l < "$DIR/SHA256SUMS" | tr -d ' ')
n_files=$(find "$DIR/original" -type f | wc -l | tr -d ' ')
[ "$n_list" = "$n_files" ] && r=ok || r=bad
check "SHA256SUMS lists every archived file ($n_list listed, $n_files on disk)" "$r"

bad=0
while IFS= read -r line; do
  f=${line#*  }
  a=$(git hash-object "$DIR/original/$f")
  b=$(git rev-parse "$TAG:$f" 2>/dev/null || echo missing)
  [ "$a" = "$b" ] || { echo "      differs from tag: $f"; bad=1; }
done < "$DIR/SHA256SUMS"
[ "$bad" = 0 ] && r=ok || r=bad
check "every archived file is byte-identical to the same path at the tag" "$r"

[ "$fail" = 0 ] && echo "RESULT: baseline_v1 archive verified" || { echo "RESULT: verification FAILED"; exit 1; }
