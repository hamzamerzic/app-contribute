# app-contribute — Contribute

See what your agent has proposed upstream — pull requests, issues, and
comments across the Möbius ecosystem, from prepared to merged.

A [Möbius](https://github.com/mobius-os) catalog mini-app. Install it from
the in-app App Store.

## What it does

Möbius apps and the platform itself are open source. When your agent fixes
a bug or adds a feature, it can offer to share that change upstream so it
ships to every Möbius user — but only with your explicit go-ahead on each
contribution. This app is the dashboard for that loop:

- **Stat tiles** — Merged / Open / Ready at a glance.
- **Connection card** — connect GitHub right here, in the app. Two paths to
  the same server-side credential: the GitHub **device flow** (shown when the
  platform has an OAuth client configured — tap Connect, then enter the
  one-time code at github.com/login/device) and a **classic personal access
  token** fallback (`public_repo` scope). Once connected it shows "Connected
  as <login>" with a Disconnect button. On an older platform the card says an
  update is needed instead.
- **Feed**, grouped:
  - **Ready to propose** — prepared but not yet submitted. Ask your agent to
    submit these; nothing goes public without your yes.
  - **Open** — draft/open PRs and issues, live on GitHub. Their state is
    refreshed on open (and daily by a background job).
  - **History** — merged, closed, and abandoned.

Beyond connecting/disconnecting your account, the app only *reads* GitHub.
Every content write — fork, push, PR, comment — happens through your agent in
chat, after you approve that specific action. The GitHub token stays
server-side and never reaches this app; the connect flow talks only to the
platform's own `/api/github/*` endpoints.

## Requirements

- A Möbius platform version that provides the `/api/github/*` surface
  (`/api/github/status` and the read-only `/api/github/graphql`). On an older
  platform the connection card says so and points you to update. If the status
  request 404s, ask your agent to update the platform.
- This app declares `permissions.github_access: true` in its manifest. That
  permission is what lets its app-scoped token reach the read-only GitHub
  status + GraphQL endpoints; the platform enforces it server-side.

## How it stores data

The ledger is one JSON file per contribution under the app's own storage
(`contributions/<id>.json`), written by your agent from chat and by a daily
cron job (`job.sh`). This app reads it via `window.mobius.storage`; the cron
job reads and updates it via the storage API with the service token. Record
shape:

```jsonc
{
  "id": "…",
  "type": "pr | issue | issue_comment | discussion_comment",
  "repo": "mobius-os/app-notes",
  "number": 42,
  "url": "https://github.com/mobius-os/app-notes/pull/42",
  "title": "Fix note reordering",
  "status": "prepared | draft | open | merged | closed | abandoned",
  "branch": "fix/notes-reorder",
  "chat_id": "…",
  "created_at": "2026-07-06T09:00:00Z",
  "updated_at": "2026-07-06T09:00:00Z",
  "summary": "One-line, partner-facing description."
}
```

## License

MIT — see [LICENSE](LICENSE).
