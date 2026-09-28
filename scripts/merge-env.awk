# merge-env.awk — upsert an incoming env file into an existing one.
#
# Usage: awk -f merge-env.awk <incoming> <existing> > <merged>
#
# The deploy env-sync used to scp .env.local over the server's .env
# wholesale, which deleted ~17 server-only keys (AGENTIC_ID_PRIVATE_KEY,
# PRIVY_APP_SECRET, TABLESTORE_*, ZERO_G_* …). This merger instead:
#   - replaces values for keys present in BOTH files,
#   - keeps every existing line that has no incoming counterpart
#     (server-only keys, comments, blanks, ordering),
#   - appends incoming keys the file didn't have, at the end.

NR == FNR {
  if (match($0, /^[A-Za-z_][A-Za-z0-9_]*=/)) {
    key = substr($0, 1, RLENGTH - 1)
    vals[key] = $0
    order[++n] = key
  }
  next
}
{
  if (match($0, /^[A-Za-z_][A-Za-z0-9_]*=/)) {
    key = substr($0, 1, RLENGTH - 1)
    if (key in vals) { print vals[key]; seen[key] = 1; next }
  }
  print
  next
}
END {
  for (i = 1; i <= n; i++) {
    key = order[i]
    if (!(key in seen)) print vals[key]
  }
}
