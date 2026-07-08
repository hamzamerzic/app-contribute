# Contributing upstream

How to send an improvement back to the Möbius ecosystem — the GitHub connection,
studying prior issues and PRs, staging a reviewable plan in the Contribute app,
and the exact `gh` sequences. `Read` this before ANY public GitHub action. The
constitution's end-of-task checklist routes you here when your change would help
other users; "share this" or "report that bug upstream" lands here too.

---

## Hard stops

Three rules never bend. The rest of this doc assumes them and points back here.

1. **No public action without a per-action yes.** Fork, push, PR, issue,
   comment — each needs the partner's explicit yes for THAT action. Not a
   standing preference, not "they approved one last week", not an inferred
   "they'd want this". Ask plainly, or stage the plan and wait.
2. **Only source code leaves the instance, and only after you re-read the FULL
   diff.** The allowlist below is exhaustive — never memory, storage, db, logs,
   creds, chat, or personal data. Re-read every changed line before proposing;
   the `body_draft` and the `.diff` are exactly what goes public.
3. **Never submit stale work.** If the staged plan's `head_sha` or diff has
   drifted since the partner reviewed it, do NOT submit — re-stage and tell them
   what changed.

---

## Check you're set up

```bash
curl -s -H "Authorization: Bearer $AGENT_TOKEN" "$API_BASE_URL/api/github/status" | python3 -m json.tool
```

Use the `$API_BASE_URL` + `$AGENT_TOKEN` idiom for every chat-context command in
this file — never hardcode localhost. The payload:

- `connected: true` with a `login` — `gh` is authenticated as the owner. You
  never see the token (`gh` resolves it from the platform store — don't dig for
  it, never print it). It's wired GLOBALLY: once connected, ANY `git push` to a
  github.com remote authenticates as the owner and nothing at the git layer gates
  that — Hard stop #1 is the whole safety net. NEVER run a bare `git push` to a
  github remote outside the approved fork flow.
- `connected: false` — point the partner to the **Contribute app** (App Store)
  and its Connect GitHub card. You can still prepare a contribution (branch,
  commit, record it `prepared`); nothing goes public until they connect AND
  approve.
- `gh_version: null` — the platform image predates GitHub support. Tell the
  partner a platform update is needed; don't improvise around it.

---

## Study existing work first

Before building from scratch, check whether the ecosystem already has it — or
already tried. Searching and studying are read-only: no approval needed.

```bash
gh search issues --owner mobius-os "<problem in a few words>" --limit 10
gh search prs --owner mobius-os "<same words>" --limit 10
curl -s https://raw.githubusercontent.com/mobius-os/app-store/main/catalog.json | python3 -m json.tool
```

gh search covers open+closed by default — don't pass `--state` (its search form
rejects `all`, and you want both). Know the repo? List it directly and keep
`-s all` (valid there):

```bash
gh issue list -R <owner>/<repo> -s all --search "<terms>"
gh pr list    -R <owner>/<repo> -s all --search "<terms>"
```

If the catalog already has the app, installing beats rebuilding; empty results
are normal, not a broken search.

On a hit, study it (`gh issue view <url> --comments`, `gh pr view <url> --json
title,body,state,comments`, `gh pr diff <url>`), compare approaches concretely,
and stage exactly ONE: a **comment** (their work is the right vehicle; findings
first, then a concrete suggestion) or a **superseding PR** (yours covers more;
body references the issue "Fixes #N" and explains the delta). No hit → stage a
fresh PR or issue plan. Every outcome is STAGED for review (next), never posted.

---

## What may leave — the privacy allowlist

Hard stop #2 names it; here it is in full.

**Contributable: source code only** — source diffs of apps (`/data/apps/<slug>/`,
the code not the data), the platform (`/data/platform/`), and the shell. That is
the whole list.

**Never, no exceptions:** anything under `/data/shared/memory/`, app storage
(`/data/apps/<int-id>/` — numeric-id dirs are runtime data, not source), the
database, logs, `/data/cli-auth/`, chat content, and anything personal — names,
schedules, health data, locations, habits, the partner's writing. Commit
messages, branch names, and PR bodies leak too: keep them generic ("fix
empty-state crash", not "fix crash when <name>'s workout log is empty").

**Re-read the FULL diff — every changed line, not the file list.** In an
installed app's repo, `git diff upstream...HEAD` shows everything local, where
`upstream` is the Möbius per-app-git branch that exists INSIDE `/data/apps/<slug>`;
in a `/tmp` clone there is no `upstream` branch — diff against `origin/main`.
Local commits routinely carry partner data into source (a seeded example, a
hardcoded name, a test fixture with real entries) — strip anything personal or
don't propose.

---

## The approval gate

Hard stop #1 is the gate. In practice: ask in plain words ("Want me to open this
as a draft PR on <repo>?") and wait, or stage the plan and let the partner review
it in the Contribute app. Anything but yes → stop; prepared-but-unapproved work
stays `status: "prepared"` and waits — it costs nothing to leave it there. PRs
open as **drafts** by default; the partner decides when one is ready for review.

---

## Stage the plan

Nothing goes public here. Write whatever the study produced — comment,
superseding PR, fresh PR or issue — as a `prepared` ledger record (endpoints in
*The ledger*) with a `plan` object carrying everything the partner needs to
review and a future session needs to execute:

```
plan: {action: pr|issue|issue_comment|discussion_comment,  # mirrors record.type
       repo, target_url?, title?, body_draft, branch?, repo_path?,
       base_sha?, head_sha?, diff_sha256?, diff_stat?,
       diff_excerpt?}         # ≤4KB inline for the review card
```

- `body_draft` is the FULL text you propose to publish — PR body, issue body, or
  comment, word for word. The partner reviews exactly this; never publish
  anything that differs from what they approved.
- For code changes, store the full diff as a sibling `contributions/<id>.diff`
  (raw-text PUT — see the ledger); put `diff_stat` and a ≤4 KB `diff_excerpt`
  inline for the card, and record `base_sha`/`head_sha`/`diff_sha256` so a later
  session can detect drift (Hard stop #3).
- A branch MUST live under `/data` (the app's own repo) — a `/tmp` clone doesn't
  survive a restart. With no durable branch, the `.diff` file IS the source of
  truth.

Status stays `prepared`. Then tell the partner what you found and staged in one
short paragraph, closing with "staged in the Contribute app for your review".

---

## The green light

The yes arrives either as a plain yes in the current chat right after you
proposed, or as a message (any chat, possibly days later) matching **"Approved
contribution <id>"** (the Approve button drafts exactly this). Either way it
approves ONE record. When it arrives in a fresh chat:

1. **Locate the ledger** — the Contribute app's id (`GET /api/apps/`, slug
   `contribute`), or `$APP_STORAGE_DIR` if this is an app-attributed chat.
2. **Read the record** — `GET .../contributions/<id>.json` with
   `x-mobius-version: 1`; note the `ETag`. Missing → say so and stop.
3. **Claim it** — PUT back `status: "submitting"` + fresh `updated_at`, sending
   `If-Match: <etag>`. A **412** means it changed under you: re-read — if status
   is no longer `prepared`, someone already handled it (submitted or dismissed);
   say that and STOP. Never submit a record you didn't claim.
4. **Check freshness (Hard stop #3)** — if `plan.head_sha` ≠ branch tip, or
   `diff_sha256` ≠ the `.diff` file, the work drifted. If rebased or `base_sha`
   moved, regenerate the diff from `base..HEAD` and compare. ANY mismatch → do
   NOT submit; re-stage (back to `prepared` with the updated plan and diff, via
   the CAS update below) and tell the partner what changed.
5. **Execute** per action type using the sequences below, publishing exactly the
   approved `body_draft`.
6. **Record the outcome** — fill `url` (and `number` for PRs/issues), flip the
   status (`pr`→`draft`, `issue`→`open`, comment→`commented`), and notify the
   partner in partner-facing language with the link ("I opened the fix as a draft
   on the notes app's project page — here's the link" beats reciting branches and
   remotes). Want changes? The `fix/` branch is still there — push follow-ups to
   the fork and the PR updates itself.

A record flipped to `abandoned` means the partner dropped it — never argue with
one, never resurrect it unasked.

---

## The command sequences

Only after the green light. All paths end with a draft PR; they differ only in
where the working tree lives.

### An app with a real origin (most catalog apps)

`git -C /data/apps/<slug> remote get-url origin` succeeds → work in the app's own
repo:

```bash
cd /data/apps/<slug>                       # app's own repo; main is checked out
git checkout -b fix/<slug>-<short>
# Squash the watcher's commits into ONE clean, generic commit. `upstream` is the
# Möbius per-app-git branch inside /data/apps/<slug>:
git reset --soft "$(git merge-base HEAD upstream)"
git commit -m "<one line, generic>" \
  -m "Co-Authored-By: Möbius Agent <mobius-agent@users.noreply.github.com>"
gh repo fork --remote --remote-name fork   # inside the clone; idempotent
git push fork HEAD    # forks are created async: on failure wait 2s, retry (3x)
gh pr create -R <upstream-owner>/<repo> -H <login>:fix/<slug>-<short> --draft \
  --title "<one line, generic>" --body "<what / why / how you tested it>

Prepared by a Möbius agent with owner review."
git checkout main     # INVARIANT
```

`<login>` is the owner's login from the status payload. Two invariants: the
**`Co-Authored-By: Möbius Agent` trailer on every contributed commit** (the
visible Möbius mark on GitHub — partner stays author, Möbius co-author), and
**`git checkout main` before the turn ends** — the watcher auto-commits partner
edits onto the checked-out branch and store updates merge to `main`, so a dir left
on `fix/…` derails the next edit and conflicts the next update. The `fix/` branch
stays for follow-ups; only the checkout returns.

### An app with no origin, or platform/shell

**No origin** (installed from a manifest): derive the repo from `manifest_url`
(`.../<org>/<repo>/<ref>/mobius.json` → `github.com/<org>/<repo>`), `git clone` to
`/tmp`, `checkout -b fix/…`, copy the changed source over (re-read vs the
allowlist), `commit` with the co-author trailer, then the same `gh repo fork` /
`git push fork HEAD` (same 2s-retry) / `gh pr create … --draft`. The live app dir
never branches, so it never leaves `main`; the `/tmp` clone is disposable (why the
plan stores the `.diff`, not a `/tmp` branch).

**Platform/shell**: only when `/data/platform` has a real origin — same sequence
from a branch there, draft PR against `mobius-os/mobius`, same back-to-`main`
invariant. No origin → be honest: platform contributions need the updated
platform bootstrap; app contributions still work.

### Commenting on an issue or discussion

Publish the approved `body_draft` word for word — it posts under the partner's name.

```bash
gh issue comment <issue-url> --body "<the approved text>"
```

Discussions use GraphQL (`gh` has no discussion-comment subcommand):

```bash
gh api graphql -f query='mutation($id: ID!, $body: String!) {
  addDiscussionComment(input: {discussionId: $id, body: $body}) { comment { url } } }' \
  -F id=<discussion-node-id> -F body="<the approved text>"
```

---

## When something fails

| Symptom | What it means / what to do |
|---------|----------------------------|
| **403 "OAuth App access restrictions"** | Org hasn't approved the Möbius OAuth app. Have the partner reconnect with a **`public_repo`-scoped PAT** (Connect card) — safer than full `repo`, which also grants read of the owner's PRIVATE repos through the read passthrough. |
| **`gh: command not found`** | Platform image too old; a platform update is needed. |
| **`git push fork` fails right after the fork** | Forks are created async — wait 2s and retry, up to 3×, before treating it as real. |
| **Empty search results** | Normal while the ecosystem is young; not an error. |

---

## The ledger

The Contribute app tracks every contribution so the partner sees status at a
glance. Find its id (slug `contribute`):

```bash
curl -s -H "Authorization: Bearer $AGENT_TOKEN" "$API_BASE_URL/api/apps/" \
  | python3 -c 'import sys,json;[print(a["id"]) for a in json.load(sys.stdin) if a.get("slug")=="contribute"]'
```

**CAS governs every JSON RECORD write** — the same If-Match discipline as the
green-light claim, because the record has three writers (you, the daily refresh
job, the app's Dismiss button) and an unconditional PUT silently erases one. The
`.diff` blob is exempt: it's written once alongside the prepared record, not
concurrently edited.

**Create** (on prepare) — `If-None-Match: *` so the PUT 412s if the id somehow
exists (then pick a new id). A prepared record carries a `plan` and has NO public
url/number yet:

```bash
curl -s -X PUT "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.json" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
  -H "If-None-Match: *" -d '{
  "id": "<record-id>", "type": "pr", "repo": "<owner>/<repo>",
  "status": "prepared", "title": "<title>", "branch": "fix/<slug>-<short>",
  "chat_id": "'"$CHAT_ID"'", "created_at": "<ISO>", "updated_at": "<ISO>",
  "summary": "<one line for the partner>",
  "plan": {"action": "pr", "repo": "<owner>/<repo>", "title": "<title>",
           "body_draft": "<full PR body, word for word>",
           "branch": "fix/<slug>-<short>", "base_sha": "<sha>", "head_sha": "<sha>",
           "diff_sha256": "<sha256 of the .diff>", "diff_stat": "<git diff --stat tail>"}
}'
```

Store the full diff beside it as raw text (the once-only write named above):

```bash
curl -s -X PUT "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.diff" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: text/plain" \
  --data-binary @/tmp/<record-id>.diff
```

**Update** (claim, outcome write, re-stage, any status change) — read with
`x-mobius-version: 1`, note the `ETag`, PUT the edited record with `If-Match`. A
**412** means it changed under you: re-read, check the fresh status still allows
your change (a claim needs `prepared`; an outcome write needs `submitting` — YOUR
claim), reconcile, then retry with the new ETag:

```bash
curl -si -H "Authorization: Bearer $AGENT_TOKEN" -H "x-mobius-version: 1" \
  "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.json"
# note the ETag, edit the JSON, then PUT with -H 'If-Match: <etag>' -d '{ ...full record... }'
```

`type` ∈ `pr | issue | issue_comment | discussion_comment`; `status` ∈ `prepared
| submitting | draft | open | merged | closed | commented | abandoned`; `number`,
`url`, `branch` are optional until they exist. `submitting` = a session claimed
the record and the action is in flight; `commented` = terminal for comment
actions. A record stuck in `submitting` with an old `updated_at` (crashed session)
→ verify via `gh search` whether the action actually happened before redoing it.
The daily refresh job only tracks `pr | issue` records in `draft | open`.

App NOT installed: no staging, no review card, no tracking — but Hard stop #1
still holds (a plain yes in chat gates each action). Recommend installing it from
the App Store before contributing; go app-less only if the partner insists.
