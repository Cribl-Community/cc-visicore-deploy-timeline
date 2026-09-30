# Changelog

All notable changes to Deployment Timeline are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.3] - 2026-09-30

### Added
- Every standalone value is actionable: stat tiles set filters or open Cribl screens, author names and group chips filter the timeline, footprint segments filter by config area, drift legend names open the group in Cribl, the drawer hash copies.

### Fixed
- Table view no longer overflows its card into the next column.

## [1.0.2] - 2026-09-30

### Added
- Single-spine timeline replaces the multi-rail graph.
- Deploy, Revert, and Commit-pending actions, each behind a confirmation naming the commit and group.
- Version awareness: leader version tile, per-group running-version pills, "Version change" tags.

### Fixed
- Edge Fleet deployed versions in `<hash>-<bundle>` form now match their commit.

## [1.0.1] - 2026-09-30

### Added
- Initial release: commit timeline, deploy drift, activity calendar, change footprint, authors, stat tiles, diff drawer. Read-only.
