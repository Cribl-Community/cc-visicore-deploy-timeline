# Deployment Timeline

A GitHub-style history of every configuration commit across all of your Worker Groups and Edge Fleets, with what is deployed where.

## What you get

- **Commit graph** – one colored rail per group, a dot on every rail a commit touches, and a rocket on the commit each group is running.
- **Deploy drift** – how many commits each group is behind its deployed version, with uncommitted-change counts.
- **Activity calendar** – commits per day for the last 26 weeks. Click a day to focus the graph.
- **Change footprint** – which config areas (pipelines, routes, sources, destinations, packs, lookups) a set of commits touched.
- **Authors** – who is committing, with you highlighted.
- **Commit drawer** – full message, changed files, and a color-coded diff for any commit.

Filter by group, author, time range, or free text. Switch to a table view at any time. Filters are remembered per user.

## Actions, always confirmed

The same actions as Cribl's own commit history view, each behind a confirmation that names the exact commit and group:

- **Deploy** any commit to a group it belongs to (including an older one, which is how you roll back).
- **Revert** a commit by creating a new inverse commit. History is never rewritten.
- **Commit** a group's pending changes with a message.

Nothing runs automatically. Reading is `GET` only; the three actions above are the only write permissions requested.

## Requirements

Cribl.Cloud 4.20 or later with Apps enabled. Works with both Stream Worker Groups and Edge Fleets.
