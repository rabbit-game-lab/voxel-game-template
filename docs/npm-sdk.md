# Rabbit SDK from npm

This template pins the private package `@rabbit-game-lab/sdk@1.0.0`.
Its runtime, TypeScript declarations, checker and model inspector share that
version. There are no template-local copies of SDK/checker source.

## Install and upgrade

Use Node 24+ and an npm account with read access to the package:

```sh
npm login --scope=@rabbit-game-lab --registry=https://registry.npmjs.org
npm ci
npm run check
npm run build
```

Upgrade or roll back by installing the desired reviewed exact version:

```sh
npm install --save-exact @rabbit-game-lab/sdk@1.0.0
npx --no-install rabbit-kit status --check
```

Commit both `package.json` and `package-lock.json`, rerun check/build and the
iframe harness. Existing Studio projects keep their immutable template version.
Never edit installed SDK files or loosen the version into a range.

## Imports and API reference

```ts
import * as sdk from '@rabbit-game-lab/sdk'
import { createKeyboard } from '@rabbit-game-lab/sdk/common/keyboard'
import { createSound } from '@rabbit-game-lab/sdk/common/sound'
import { defineAssets } from '@rabbit-game-lab/sdk/playcanvas-3d/assets'
```

Common modules include runtime, input, pause, sound, pointer-lock and spatial.
Engine modules use `@rabbit-game-lab/sdk/playcanvas-3d/<module>`. Read the
installed `docs/`, `sdk/` sources and `dist/` declarations under
`node_modules/@rabbit-game-lab/sdk`; import only through package exports.
`npm run check` runs the installed `rabbit-check`. Inspect GLBs with
`npx --no-install rabbit-kit inspect-model <file-or-directory> --json`.

## CI and platform prerequisites

GitHub dependency-install steps use `actions/setup-node` registry configuration
and a step-scoped `NODE_AUTH_TOKEN` from the repository/organization secret
`NPM_TOKEN`. It must be a read-only token authorized for this package.
Credentials do not belong in source, lockfiles, Starter Files or snapshots.
Local npm login works without a repository npmrc placeholder.

Before merging or promoting this migration, the Rabbit API import gate must
accept the npm SDK layout. The API worker's Vercel Sandbox install, Studio cold
boot and any clean dependency reinstall must have private npm read access.
A Railway environment variable alone does not forward credentials into a sandbox.
Verify a cold boot without a snapshot, remove installation credentials before
agent access/snapshot creation, and keep release promotion blocked until these
prerequisites are ready. This repository change does not configure or deploy
those platform services.
