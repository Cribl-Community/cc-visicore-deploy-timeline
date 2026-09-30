# Deployment Timeline agent notes

Only what is specific to this app. The Cribl App platform guide (fetch proxy, KV store,
policies, theming, packaging) ships with the `@cribl/apps` CLI and is not repeated here.

## Working here

- Node comes from the shared nix dev shell in the parent folder through `direnv`. Run scripts
  as `direnv exec . npm run <script>`. No global npm and no Homebrew Node.
- `npm run package` bumps the version and writes `build/<name>-<version>.tgz`. The Live Preview
  Deploy button uploads the newest tgz, so package before asking anyone to deploy.
- `openapi.json` and `build/` are git-ignored. `openapi.json` embeds the tenant hostname.
- `npm test` runs `src/model.test.ts` with `node:test`. Pure logic lives in `src/model.ts` so it
  stays testable without React.

## Structure

- `src/api.ts`: typed calls to the Cribl API through the platform fetch proxy. `pLimit` and
  `firstGroup` gate lazy per-commit requests. Every path used here has a grant in
  `config/policies.yml`.
- `src/model.ts`: merge and dedupe per-group commit logs, deploy lag, version states,
  config-area classification, time-scale bucketing.
- `src/links.ts`: the only place Leader UI paths live (`/stream/m/<gid>`, `/edge/m/<gid>`).
- `src/viz/*`: one component per panel. Group lists use `GroupRow` and `SectionLabel`. Labels
  are HTML and only marks are SVG or divs, so text never scales with a chart. Colors come from
  Capra tokens through classes in `src/viz/viz.css`. The VisiCore accent is `--vct-accent` in
  `App.css`.
- `src/actions.tsx`: deploy, revert, commit. Every write goes through `confirm()`.

## Conventions

- Worker Groups and Edge Fleets are never intermingled. Use `byKind()` and `SectionLabel`.
- Panels hide uninteresting rows by default and expose a `Switch` in the card header to show all.
- Every displayed value links somewhere: a filter, a drawer, or a Leader screen in a new tab.
- No product comparisons in copy or comments.
- The README follows the VisiCore Cribl pack layout: About, What It Shows, Installation, Usage,
  Requirements, Permissions and Data, Troubleshooting, Author, Release Notes, Contributing,
  License.
