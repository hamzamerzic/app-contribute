# Contributing upstream

How to send an improvement back to the Möbius ecosystem: checking the GitHub
connection, studying existing issues and PRs before building, staging a
reviewable plan in the Contribute app, what may leave this instance (and what
never does), the partner-approval gate and the green light, and the exact
`gh` sequences for PRs, issues, and comments. `Read` this before ANY public
GitHub action — fork, push, PR, issue, comment. The end-of-task checklist in
the constitution routes you here when a change you just made would help other
Möbius users; a partner saying "share this" or "report that bug upstream"
lands here too.

---

## Check you're set up

```bash
curl -s -H "Authorization: Bearer $AGENT_TOKEN" "$API_BASE_URL/api/github/status" | python3 -m json.tool
```

Use the `$API_BASE_URL` + `$AGENT_TOKEN` idiom for every chat-context command
in this file — they're in every agent turn; never hardcode localhost. The
payload tells you everything you need:

- `connected: true` with a `login` — the owner has connected GitHub, and `gh`
  is already authenticated as them. You never see or handle the token itself;
  `gh` resolves it from the platform's credential store. Don't go digging for
  it, and never print it. Note the credential is wired GLOBALLY: once connected,
  ANY `git push` to a github.com remote (including a stray push in a normal
  platform-edit turn) authenticates as the owner. Nothing at the git layer gates
  that — the approval gate below is the whole safety net. So NEVER run a bare
  `git push` to a github remote outside the approved fork flow.
- `connected: false` — point the partner to the **Contribute app** (install
  it from the App Store if they don't have it) and its Connect GitHub card.
  You can still prepare a contribution (branch, commit, record it as
  `prepared` in the ledger below); nothing goes public until they connect
  AND approve.
- `gh_version: null` — the platform image predates GitHub support. Tell the
  partner a platform update is needed; don't improvise around it.

---

## Study existing work first

Before writing a new app or a fix from scratch, spend a few minutes finding
out whether the ecosystem already has it — or has already tried:

```bash
gh search issues --owner mobius-os "<a few words describing the problem>" --limit 10
gh search prs --owner mobius-os "<the same words>" --limit 10
curl -s https://raw.githubusercontent.com/mobius-os/app-store/main/catalog.json | python3 -m json.tool
```

`gh search` spans open AND closed by default — do NOT pass `--state` (it is
not a valid flag on `gh search`, and a closed issue or a merged PR is exactly
the history you want to see). When you already know the repo, list it
directly and keep the same everything-included stance:

```bash
gh issue list -R <owner>/<repo> -s all --search "<terms>"
gh pr list -R <owner>/<repo> -s all --search "<terms>"
```

The catalog lists installable apps with their manifests — if one already does
what the partner wants, installing it beats rebuilding it. Empty results are
normal early — the ecosystem is young; silence means "nothing found", not
"search is broken".

**On a hit, study it — don't just note that it exists:**

```bash
gh issue view <url> --comments
gh pr view <url> --json title,body,state,comments
gh pr diff <url>
```

Compare the approaches concretely: what does theirs cover that yours doesn't,
and what does yours cover that theirs doesn't? Then stage exactly ONE of:

- **A comment** — when the existing work is the right vehicle and your
  experience sharpens it. The draft is your findings plus a concrete
  suggestion: "We hit this too — <what you observed>. This approach covers
  <X> but not <Y>; <specific suggestion>." Findings first, suggestion
  second, both concrete.
- **A superseding PR** — when your change genuinely covers more. Its body
  references the issue ("Fixes #N") and explains the delta over the existing
  attempt, so the maintainer sees you built on the prior work rather than
  ignored it.

No hit → stage a fresh PR (or issue) plan.

Searching and studying are read-only and need no approval. Everything from
the fork onward does — and every outcome above is STAGED for review (next
section), never posted directly.

---

## What may leave this instance — the privacy allowlist

**Contributable: source code only.** Source diffs of apps
(`/data/apps/<slug>/` — the code, not the data), the platform
(`/data/platform/`), and the shell. That is the whole allowlist.

**Never contributable, no exceptions:** anything under
`/data/shared/memory/`, app storage (`/data/apps/<int-id>/` — the numeric-id
dirs are runtime data, not source), the database, logs, `/data/cli-auth/`,
chat content, and anything personal — names, schedules, health data,
locations, habits, the partner's writing. Commit messages, branch names, and
PR bodies can leak too: keep them generic ("fix empty-state crash", not "fix
crash when <partner's name>'s workout log is empty").

**Re-read the FULL diff before proposing anything public.** Not the file
list — every changed line (in an installed app's repo,
`git diff upstream...HEAD` shows everything local; in a `/tmp` clone, diff
against `origin/main`). Local commits routinely carry partner data into
source files: a seeded example, a hardcoded name, a test fixture with real
entries. If anything personal is in the diff, strip it first or don't
propose. The same check covers everything you stage for review — the
`body_draft` and the `.diff` file below are exactly what will go public.

---

## The approval gate — nothing public without a yes

**You NEVER fork, push, comment, or open anything public without the
partner's explicit yes for THAT action.** Not a standing preference, not
"they approved a PR last week", not an inferred "they'd probably want this" —
a yes, for this specific action. Ask in plain words ("Want me to open this
as a draft PR on <repo>?") and wait, or stage the plan (next section) and let
them review it in the Contribute app. If the answer is anything but yes,
stop: prepared-but-unapproved work stays `status: "prepared"` in the ledger
and waits — it costs nothing to leave it there.

PRs open as **drafts** by default; the partner decides when one is ready for
review.

---

## Stage the plan

Nothing goes public at this step. Whatever the study produced — a comment, a
superseding PR, a fresh PR or issue — write it up as a `prepared` ledger
record in the Contribute app (endpoints in *The ledger* below) with a `plan`
object that carries everything the partner needs to review it and a future
session needs to execute it:

```
plan: {action: pr|issue|issue_comment|discussion_comment  # mirrors
       record.type so the executor picks the right gh sequence,
       repo, target_url?, title?, body_draft,
       branch?, repo_path?,          # workspace: branch MUST live
                                     # under /data (app repo) — /tmp
                                     # clones don't survive restarts;
                                     # otherwise the .diff file is the
                                     # source of truth
       base_sha?, head_sha?, diff_sha256?, diff_stat?,
       diff_excerpt?  # ≤4KB inline for the review card}
```

- `body_draft` is the FULL text you propose to publish — the PR body, the
  issue body, or the comment, word for word. The partner reviews this text in
  the app; never publish anything that differs from what they approved.
- For code changes, store the full diff as a sibling storage file
  `contributions/<id>.diff` (raw-text PUT — example in the ledger section;
  the 50 MB request cap and 1 GB app quota are nowhere near a real diff).
  Put `diff_stat` (the `git diff --stat` tail) and a ≤4 KB `diff_excerpt`
  inline in the plan so the review card shows the shape without a fetch, and
  record `base_sha`, `head_sha`, and `diff_sha256` so a later session can
  tell whether the staged work has gone stale.
- If the change lives on a branch, that branch MUST be under `/data` (the
  installed app's own repo) — a `/tmp` clone does not survive a restart.
  When there is no durable branch, the `.diff` file IS the source of truth.

Status stays `prepared`. Then tell the partner what you found and what you
staged in one short paragraph, and close with: "staged in the Contribute app
for your review".

---

## The green light

The partner's yes arrives in one of two ways:

- a plain yes in the CURRENT chat, right after you proposed the action, or
- a message — in any chat, possibly days later — matching
  **"Approved contribution <id>"** (the Contribute app's Approve button
  drafts exactly this).

Either way it approves ONE record. When the yes arrives in a fresh chat,
receive it like this:

1. **Locate the ledger.** Find the Contribute app's id (`GET /api/apps/`,
   slug `contribute`) — or, if this is an app-attributed chat,
   `$APP_STORAGE_DIR` already points at its storage.
2. **Read the record.** `GET .../contributions/<id>.json` with the header
   `x-mobius-version: 1` and note the `ETag` response header. If the record
   doesn't exist, say so and stop.
3. **Claim it.** PUT the record back with `status: "submitting"` (and a
   fresh `updated_at`), sending `If-Match: <etag>`. A **412** means the
   record changed under you: re-read it — if its status is no longer
   `prepared`, someone already handled it (another session submitted it, or
   the partner dismissed it); say that and STOP. Never submit a record you
   didn't claim.
4. **Check freshness.** If `plan.head_sha` no longer matches the branch tip,
   or `diff_sha256` no longer matches the `.diff` file, the staged work has
   drifted since the partner reviewed it. If the branch was rebased, or
   `base_sha` no longer matches, regenerate the diff from `base..HEAD` and
   compare it against the stored one. ANY mismatch means the partner
   reviewed something other than what would go out: do NOT submit —
   re-stage (back to `prepared`, with the updated plan and diff, via the
   CAS update in the ledger section) and tell the partner what changed
   instead.
5. **Execute** per the action type using the command sequences below,
   publishing exactly the approved `body_draft`.
6. **Record the outcome.** Fill `url` (and `number` for PRs and issues),
   flip the status — `pr` → `draft`, `issue` → `open`, comment actions →
   `commented` — and notify the partner with the link.

A record flipped to `abandoned` means the partner dropped it — never argue
with an abandoned record, and never resurrect one without being asked.

---

## The command sequences

### An app with a real origin

Most catalog apps are real clones — `git -C /data/apps/<slug> remote get-url
origin` succeeds. Work in the app's own repo:

```bash
cd /data/apps/<slug>                      # the app's own repo; main is checked out
git checkout -b fix/<slug>-<short>        # branch from main
# Squash the watcher's incremental commits into ONE clean commit for the PR —
# reviewable upstream, and it carries the Möbius co-author mark:
git reset --soft "$(git merge-base HEAD upstream)"
git commit -m "<one line, generic>" \
  -m "Co-Authored-By: Möbius Agent <mobius-agent@users.noreply.github.com>"
gh repo fork --remote --remote-name fork  # inside the clone; idempotent
git push fork HEAD   # forks are created async: on failure wait 2s, retry (3x)
gh pr create -R <upstream-owner>/<repo> -H <login>:fix/<slug>-<short> --draft \
  --title "<one line, generic>" \
  --body "<what / why / how you tested it>

Prepared by a Möbius agent with owner review."

git checkout main    # INVARIANT — see below
```

`<login>` is the owner's GitHub login from the status payload. The
`Co-Authored-By: Möbius Agent` trailer goes on every contributed commit — it
is how a commit visibly carries the Möbius mark on GitHub (the partner stays
the author; Möbius appears as co-author).

**`git checkout main` before the turn ends is an invariant, not a
courtesy.** The watcher auto-commits partner edits onto whatever branch is
checked out, and store updates merge into `main` — leave the app dir on
`fix/…` and the partner's next edit lands on the wrong branch while the next
update conflicts. The `fix/` branch itself stays around for PR follow-ups;
only the checkout returns to `main`.

### An app without an origin

Some apps were installed from a manifest with no clone — no `origin`. Derive
the repo from the app's `manifest_url`: a manifest at
`https://raw.githubusercontent.com/<org>/<repo>/<ref>/mobius.json` means the
source lives at `https://github.com/<org>/<repo>`. Clone to `/tmp`, apply the
local source diff there, then the same fork/push/PR steps from the `/tmp`
clone:

```bash
git clone https://github.com/<org>/<repo> /tmp/<repo> && cd /tmp/<repo>
git checkout -b fix/<slug>-<short>
# copy the changed source files over (or git apply a diff you generated),
# re-read the result against the privacy allowlist, then commit:
git commit -am "<generic message>" \
  -m "Co-Authored-By: Möbius Agent <mobius-agent@users.noreply.github.com>"
# then, from /tmp/<repo>: gh repo fork --remote --remote-name fork;
# git push fork HEAD (same 2s-retry rule); gh pr create ... --draft
```

The live app dir never leaves `main` on this path — you never branched it.
Remember the `/tmp` clone is disposable: it exists only for the submit turn,
which is why a staged plan stores the `.diff` file rather than pointing at a
`/tmp` branch.

### Platform / shell

Only when `/data/platform` has a real origin — `git -C /data/platform remote
get-url origin` succeeds. Then it's the same sequence from a branch there:
branch off `main`, fork, push, draft PR against `mobius-os/mobius`, and the
same back-to-`main` invariant before the turn ends. If there is no origin,
be honest with the partner: platform contributions need the updated platform
bootstrap; app contributions still work.

### Commenting on an issue or discussion

Only after the green light, and the published text is the approved
`body_draft`, word for word — a comment publishes the partner's words under
their name.

```bash
gh issue comment <issue-url> --body "<the approved text>"
```

Discussions go through GraphQL (`gh` has no discussion-comment subcommand):

```bash
gh api graphql \
  -f query='mutation($id: ID!, $body: String!) {
    addDiscussionComment(input: {discussionId: $id, body: $body}) {
      comment { url } } }' \
  -F id=<discussion-node-id> -F body="<the approved text>"
```

---

## When something fails

- **403 mentioning "OAuth App access restrictions"** — the org hasn't
  approved the Möbius OAuth app. Suggest the partner reconnect with a
  classic PAT instead (the Contribute app's Connect card has that option). A
  **`public_repo`-scoped** PAT is enough for contributing and is the safer
  choice — a full `repo` token also grants read of the owner's PRIVATE repos
  through the read passthrough, which upstream contribution never needs.
- **`gh: command not found`** — the platform image is too old; a platform
  update is needed.
- **`git push fork` fails right after the fork** — forks are created
  asynchronously. Wait 2s and retry, up to 3 times, before treating it as a
  real failure.
- **Empty search results** — normal while the ecosystem is young; not an
  error.

---

## The ledger

The Contribute app tracks every contribution so the partner can see status
at a glance. Find its id (slug `contribute`):

```bash
curl -s -H "Authorization: Bearer $AGENT_TOKEN" "$API_BASE_URL/api/apps/" \
  | python3 -c 'import sys,json;[print(a["id"]) for a in json.load(sys.stdin) if a.get("slug")=="contribute"]'
```

If it's installed, write one JSON per contribution. **Every ledger write is
CAS** — the same If-Match discipline as the green-light claim, because the
ledger has three writers (you, the daily refresh job, the app's Dismiss
button) and an unconditional PUT can silently erase one of them.

**Creating a record** (on prepare): send `If-None-Match: *`, which makes the
PUT fail with 412 if the record somehow already exists — on 412 pick a new
id rather than overwriting:

```bash
curl -s -X PUT "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.json" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
  -H "If-None-Match: *" \
  -d '{
    "id": "<record-id>",
    "type": "pr",
    "repo": "<owner>/<repo>",
    "number": 12,
    "url": "https://github.com/<owner>/<repo>/pull/12",
    "title": "<the PR/issue title>",
    "status": "draft",
    "branch": "fix/<slug>-<short>",
    "chat_id": "'"$CHAT_ID"'",
    "created_at": "<ISO timestamp>",
    "updated_at": "<ISO timestamp>",
    "summary": "<one line for the partner>"
  }'
```

**Updating a record** — the claim, the post-submission outcome write, a
re-stage, any status change: read it with `x-mobius-version: 1`, note the
`ETag` response header, and PUT the edited record with `If-Match`. A **412**
means it changed under you: re-read, check the fresh status still allows
your change (a claim needs `prepared`; an outcome write needs `submitting`
— YOUR claim), reconcile, and only then retry with the new ETag:

```bash
curl -si -H "Authorization: Bearer $AGENT_TOKEN" -H "x-mobius-version: 1" \
  "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.json"
# note the ETag header, edit the JSON, then:
curl -s -X PUT "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.json" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
  -H 'If-Match: <etag-from-the-read>' \
  -d '{ ...the full updated record... }'
```

A `prepared` record staged for review also carries the `plan` object (see
*Stage the plan*), and its full diff lives beside it as a raw-text file:

```bash
curl -s -X PUT "$API_BASE_URL/api/storage/apps/<id>/contributions/<record-id>.diff" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: text/plain" \
  --data-binary @/tmp/<record-id>.diff
```

`type` is one of `pr | issue | issue_comment | discussion_comment`; `status`
is one of `prepared | submitting | draft | open | merged | closed |
commented | abandoned`; `number`, `url`, and `branch` are optional until
they exist (a `prepared` record has no URL yet). `submitting` means a
session has claimed the record and the action is in flight; `commented` is
the terminal status for comment actions. If you find a record stuck in
`submitting` with an old `updated_at` (a crashed session), verify via
`gh search` whether the action actually happened before redoing it. The
daily refresh job only tracks `pr | issue` records in `draft | open` —
everything else it leaves alone.

If the Contribute app is NOT installed: the approval gate is absolute and
independent of this app — a plain yes in chat approves an action either
way. But without the app there is no staging, no review card, and no
tracking. Tell the partner that, recommend installing it from the App Store
BEFORE contributing, and go app-less only if they explicitly want to —
their yes in chat still gates every public action.

---

## After submitting

Tell the partner what was opened and give them the URL, in partner-facing
language: "I opened the fix as a draft on the notes app's project page —
here's the link" beats a recitation of branches and remotes. If they want
changes, the `fix/` branch is still there — push follow-up commits to the
fork and the PR updates itself.
