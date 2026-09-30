# Deployment Timeline

**Every configuration commit across your Worker Groups and Edge Fleets, what is deployed where, and the same deploy, revert, and commit actions as Cribl's own commit view, on one screen.**

![Deployment Timeline overview](docs/overview.png)

## What This App Does

Cribl keeps a Git history of every configuration change, but the built-in view shows one group at a time and no picture of drift between what is committed and what is running. Deployment Timeline reads that history for every Worker Group and Edge Fleet at once and turns it into:

| View | What it shows |
| --- | --- |
| **Commit timeline** | One vertical spine, newest first, with a card per commit: message, author, hash, the groups it belongs to, and a green "Live on <group>" marker when that commit is what a group is running. Day headers break up the flow. |
| **Stat tiles** | Commits in the last 7 days with a 30-day sparkline, active authors, groups behind deploy, uncommitted changes, and the Leader's software version. |
| **Deploy drift** | One bar per group: how many commits it is behind its deployed version, its uncommitted change count, and a pill showing the Cribl version its nodes run against the Leader. |
| **Activity calendar** | Commits per day for the last 26 weeks. |
| **Change footprint** | Changed files by config area: pipelines, routes, sources, destinations, packs, lookups. |
| **Authors** | Commits per author, with you highlighted. |
| **Commit drawer** | Full message, changed files, a color-coded diff, and the action buttons. |

Every value is clickable. Tiles, names, chips, and chart segments either set a filter or open the matching Cribl screen.

Intended users: Stream and Edge administrators, change reviewers, and anyone asked "what changed and is it live?". Supported products: Cribl Stream Worker Groups and Cribl Edge Fleets on Cribl.Cloud.

## When To Use This App

- Before a change window, to see what is committed but not yet deployed, per group.
- After an incident, to find the commit that went live right before it and open its diff.
- During an upgrade, to spot groups whose nodes run an older Cribl version than the Leader.
- For a rollback: open the last known-good commit and deploy it to the affected group.

## Before You Install

- Cribl.Cloud with Apps enabled, Cribl 4.20.0 or later.
- Users of the app need read access to Worker Groups and version history. Deploy, revert, and commit additionally need the corresponding write permission on the target group; the app cannot grant more than the signed-in member's role allows.
- No external systems, credentials, or configuration are required.
- Groups with no commit history show no commits; that is expected on a fresh workspace.

## Installation

1. Install from the Cribl Marketplace, or download the `.tgz` from the [latest GitHub release](https://github.com/Cribl-Community/cc-jevans/releases/latest) and use **Apps → Add App → Import from File**.
2. Share the app with the users or teams who should see it.
3. Open it from the **Apps** menu. It loads live data immediately.

## Configuration

There are no settings. Filters (group, author, time range, config area, search text, graph or table view) are remembered per user in the app's KV store.

## How To Use

1. Open the app. The timeline shows the last 90 days across all groups.
2. Narrow with the toolbar, or click any tile, group chip, author name, calendar day, or chart segment.
3. Click a commit card to open the drawer with its diff.
4. In the drawer footer, choose **Deploy to <group>** or **Revert this commit**. A confirmation names the exact commit and group before anything runs.
5. When a group has uncommitted changes, a **Commit N** button appears next to it in Deploy drift.

First-run checklist: confirm the stat tiles show non-zero commits, click one commit and confirm the diff loads, then toggle dark mode in your Cribl account menu and confirm the app follows.

## Permissions and External Access

All access is declared in `config/policies.yml` and reviewed by the admin at install. Reads:

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/master/groups`, `/master/groups/*` | Group and Fleet inventory, deployed version |
| GET | `/m/:gid/version`, `/m/:gid/version/*` | Commit history, changed files, diffs |
| GET | `/system/info` | Leader version |
| GET | `/master/workers` | Cribl version each connected node runs |

Writes, each only after the user confirms a dialog naming the commit and group:

| Method | Path | Action |
| --- | --- | --- |
| PATCH | `/master/groups/:id/deploy` | Deploy a commit to a group |
| POST | `/m/:gid/version/revert` | Create an inverse commit |
| POST | `/m/:gid/version/commit` | Commit a group's pending changes |

No external hosts. `config/proxies.yml` is empty. The app never handles authentication tokens; the Cribl platform proxies every call with the signed-in member's identity.

## Data and Storage

The app reads configuration history and node metadata only. Nothing leaves the Cribl platform. Persistent storage is one KV key per user, `ui/filters`, holding the filter selection. Uninstalling the app removes its KV store.

## Support

Built by VisiCore Tech for the CriblCon 2026 App Hackathon. It is community-maintained and carries no Cribl support commitment.

- Issues and feature requests: [GitHub Issues](https://github.com/Cribl-Community/cc-jevans/issues)
- Contact: CriblPacks@VisiCoreTech.com
- Security reports: the same address, subject line "security".

## Known Limitations and Troubleshooting

- Cribl does not record deploy events, only each group's current deployed version. The timeline marks what is live now; it cannot show when earlier deploys happened.
- The per-group commit log is capped at the most recent 200 commits.
- Version pills need at least one connected node in the group; groups with no connected nodes show no pill.
- "Version change" tags are a heuristic on the commit message.
- Links into Cribl screens (`/groups`, `/settings/diagnostics`, `/m/<group>`) only work in the installed app, not in Live Preview.

**The app opens but shows an error banner:** the signed-in user lacks read access to a group, or Apps are disabled under Settings → Global Settings → App Settings.

**Deploy or Revert fails:** the user's role lacks write access to that group. Nothing is changed when this happens.

**The app works in Live Preview but not when installed:** an API path was added without a matching entry in `config/policies.yml`.

## Development

```sh
npm install
npm run dev        # Live Preview via Apps → Create App
npm test           # node --test src/model.test.ts
npm run lint
npm run package    # build/<name>-<version>.tgz
```

Tag `vX.Y.Z` on `main` to cut a GitHub release with the packaged `.tgz` attached.

## AI Tool Disclosure

Built with Claude Code. Every generated change was reviewed, linted, and tested before commit.

## License

Apache-2.0. See [LICENSE](LICENSE).
