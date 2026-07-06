#!/bin/bash
# Contribute — daily ledger refresh (cron).
#
# For every ledger record that is still draft/open, ask GitHub for its live
# state in ONE batched GraphQL call (aliased resource() nodes, ~1 rate-limit
# point total), write back any change, and fire a celebratory push the first
# time something merges. The mini-app UI does the same refresh on open; this
# keeps the feed and the merged-count fresh even when nobody opens the app.
#
# Cron runs this as `mobius` with an EMPTY environment and passes the app's
# numeric id as $1, so the script sets its own SERVICE_TOKEN + API_BASE_URL and
# pins gh's config/HOME/PATH — without those, gh can't find the credential store
# and would look "not logged in" even on a connected instance. gh resolves auth
# from /data/cli-auth/gh (the boot symlink target), which the backend populates
# only when the owner connects GitHub from the Contribute app.
#
# Exits 0 quietly when gh is missing, unauthenticated, or there is nothing to
# refresh — an un-connected instance is a normal state, not an error.
set -u

APP_ID="${1:-}"
API_BASE_URL="http://localhost:8000"
SERVICE_TOKEN="$(cat /data/service-token.txt 2>/dev/null || true)"

# gh's auth store lives under its config dir; point straight at it so the lookup
# never depends on cron providing HOME or the ~/.config/gh symlink. Set both
# anyway for any tool that reads HOME, and make sure /usr/local/bin (where gh is
# installed) is on PATH before probing for it.
export HOME="${HOME:-/home/mobius}"
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-/data/cli-auth/gh}"
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export API_BASE_URL SERVICE_TOKEN APP_ID

if [ -z "$APP_ID" ] || [ -z "$SERVICE_TOKEN" ]; then
  # No app id (a malformed cron line) or no service token — nothing safe to do.
  exit 0
fi

# gh must be present AND authenticated. Either failing is the normal
# "GitHub not connected" state, so leave without touching the ledger.
command -v gh >/dev/null 2>&1 || exit 0
gh auth status >/dev/null 2>&1 || exit 0

mkdir -p /data/cron-logs

# The refresh logic is pure I/O against the local storage API (urllib) plus gh
# for the GraphQL round-trip. A quoted heredoc keeps the shell out of it; all
# inputs arrive via the exported environment. Diagnostics (an unhandled error)
# land in the cron log; every expected failure exits 0 silently above/below.
python3 - <<'PY' 2>>/data/cron-logs/contribute.log
import datetime
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

API = os.environ["API_BASE_URL"].rstrip("/")
TOKEN = os.environ["SERVICE_TOKEN"]
APP_ID = os.environ["APP_ID"]
PREFIX = "contributions/"


def _call(method, path, body=None):
  url = API + path
  headers = {"Authorization": "Bearer " + TOKEN}
  data = None
  if body is not None:
    data = json.dumps(body).encode("utf-8")
    headers["Content-Type"] = "application/json"
  req = urllib.request.Request(url, data=data, headers=headers, method=method)
  with urllib.request.urlopen(req, timeout=15) as resp:
    return resp.read()


def _get_json(path):
  raw = _call("GET", path)
  return json.loads(raw) if raw else None


# Enumerate the ledger, paging until the cursor is exhausted. The storage
# list endpoint caps a page at 100 records; reading only the first page would
# silently skip every contribution beyond it (and never refresh/notify them),
# so walk next_cursor like the app's runtime storage.list does. A missing dir
# (nothing recorded yet) is not an error. The page loop is bounded so a
# server bug can't spin it forever.
names = []
cursor = None
for _page in range(2000):
  path = "/api/storage/apps-list/%s/%s?limit=500" % (APP_ID, PREFIX)
  if cursor:
    path += "&cursor=" + urllib.parse.quote(cursor, safe="")
  try:
    listing = _get_json(path)
  except urllib.error.HTTPError as exc:
    if exc.code == 404:
      sys.exit(0)
    raise
  entries = (listing or {}).get("entries") or []
  names.extend(
    e["name"] for e in entries
    if e.get("type") != "dir" and str(e.get("name", "")).endswith(".json")
  )
  cursor = (listing or {}).get("next_cursor")
  if not cursor:
    break

records = []
for name in names:
  try:
    rec = _get_json("/api/storage/apps/%s/%s%s" % (APP_ID, PREFIX, name))
  except urllib.error.HTTPError:
    continue
  if isinstance(rec, dict) and rec.get("id"):
    records.append((name, rec))


def _is_target(rec):
  return (
    rec.get("type") in ("pr", "issue")
    and rec.get("status") in ("draft", "open")
    and isinstance(rec.get("url"), str)
    and rec["url"].startswith("https://github.com/")
  )


targets = [(name, rec) for (name, rec) in records if _is_target(rec)]
if not targets:
  sys.exit(0)

# One document, aliased resource() nodes. JSON string escaping is exactly the
# GraphQL string-literal escaping the url needs.
aliases = {}
parts = []
for i, (name, rec) in enumerate(targets):
  alias = "r%d" % i
  aliases[alias] = (name, rec)
  url_lit = json.dumps(rec["url"])
  parts.append(
    "%s: resource(url: %s) { __typename "
    "... on PullRequest { state isDraft } "
    "... on Issue { state } }" % (alias, url_lit)
  )
query = "query { " + " ".join(parts) + " }"

try:
  out = subprocess.run(
    ["gh", "api", "graphql", "-f", "query=" + query],
    capture_output=True, text=True, timeout=30,
  )
except Exception:
  sys.exit(0)
if out.returncode != 0:
  # gh error (rate limit, revoked token, org restriction) — leave state as-is.
  sys.exit(0)
try:
  data = (json.loads(out.stdout) or {}).get("data") or {}
except Exception:
  sys.exit(0)


def _live_status(node):
  # Mirrors domain.js liveStatusFor; keep the two in step. None = no verdict
  # (deleted, inaccessible, unexpected type) → the record is left unchanged.
  if not isinstance(node, dict):
    return None
  kind = node.get("__typename")
  if kind == "PullRequest":
    state = node.get("state")
    if state == "MERGED":
      return "merged"
    if state == "CLOSED":
      return "closed"
    if state == "OPEN":
      return "draft" if node.get("isDraft") else "open"
    return None
  if kind == "Issue":
    state = node.get("state")
    if state == "CLOSED":
      return "closed"
    if state == "OPEN":
      return "open"
  return None


now = (
  datetime.datetime.now(datetime.timezone.utc)
  .replace(microsecond=0)
  .isoformat()
  .replace("+00:00", "Z")
)

for alias, (name, rec) in aliases.items():
  new_status = _live_status(data.get(alias))
  if not new_status or new_status == rec.get("status"):
    continue
  was = rec.get("status")
  updated = dict(rec)
  updated["status"] = new_status
  updated["updated_at"] = now
  try:
    _call("PUT", "/api/storage/apps/%s/%s%s" % (APP_ID, PREFIX, name), updated)
  except Exception:
    continue
  if new_status == "merged" and was != "merged":
    title = rec.get("title") or "contribution"
    try:
      _call("POST", "/api/notifications/send", {
        "title": "Contribution merged 🎉",
        "body": "Your %s was merged — it ships to everyone 🎉" % title,
        "source_id": str(rec.get("id") or ""),
        "target": "/shell/?app=%s" % APP_ID,
      })
    except Exception:
      pass
PY

exit 0
