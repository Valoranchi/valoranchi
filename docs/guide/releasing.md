# Releasing

Releases for `@valoranchi/riot-client` are automated through GitHub Actions, ensuring consistent versioning, changelog updates, npm provenance, and GitHub Release tags.

## Automated Release Workflow

Releases are published to npm and GitHub Releases using the repository's GitHub Actions workflow:

1. Navigate to the **Actions** tab in the GitHub repository and select the **Release** workflow.
2. Click **Run workflow** (workflow dispatch).
3. Select the version increment (`patch`, `minor`, or `major`). You can optionally provide additional release notes in the input field.
4. The workflow runs the full verification suite: ESLint, TypeScript typecheck, Vitest unit tests, build compilation, JSON schema generation, and package tarball verification.
5. The `## [Unreleased]` section in `CHANGELOG.md` is automatically transformed into the new release header (`## [X.Y.Z] - YYYY-MM-DD`).
6. `@valoranchi/riot-client` is published to npm with cryptographic provenance first. Only after npm confirms successful receipt are the version commit and Git tag (`vX.Y.Z`) pushed and the GitHub Release created with the changelog release notes. If the publish step fails, the repository remains completely untouched.

## Recovery and Idempotency

If a release publish fails after a version is tagged or committed (for instance, due to network interruptions or registry issues):

- Resolve the underlying issue and trigger the Release workflow again.
- The workflow detects that the version specified in `package.json` has not yet been published to the npm registry and publishes it directly without generating a redundant version bump.
- Alternatively, check the **Publish the version already in package.json** option in the workflow dispatch dialog to force this behavior.

## Token Scope Requirements

The workflow verifies npm permissions before starting the build. It expects a granular npm access token configured with **Read and write** permissions across all packages under the `@valoranchi` organization scope. An HTTP 404 during the publish step indicates that the token cannot access the `@valoranchi` scope or the organization is not accessible.

## Recording fixtures

`npm run fixtures:record` reads the live Riot Client (loadout, entitlements, wallet, storefront, MMR, rank history, match history and one match, names, party, friends, presences, requests, blocked, conversations, messages) through the raw layer and writes each payload to `test/fixtures/recorded/`, anonymized: every player and match id becomes a stable fake uuid, names become `Player1`, `Player2`..., tags become `TAG`, and message bodies and notes are redacted. Tokens never appear in these payloads.

`test/recorded.test.ts` runs the builders over the recorded payloads and compares the result with a Vitest snapshot, so a change in a builder or in Riot's response shape shows up as a diff. Record again after a game patch and review the snapshot changes with `npx vitest run -u`.
