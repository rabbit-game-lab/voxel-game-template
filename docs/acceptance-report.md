# Acceptance report

## Breakable, support-aware decorations — 2026-09-18

- Merged bushes, flowers, reeds, rocks, signposts, and campfires now participate in center-ray targeting through engine-independent bounds while remaining non-colliding and batched by category.
- Breaking a decoration clears its active bit, rebuilds the existing merged content meshes, and emits pooled break feedback. It adds no entity, collider, material, or draw call per prop.
- Breaking a decoration's exact supporting voxel clears the same bit and removes the prop in the same interaction cycle. Removed decoration state survives respawn when world edits are preserved and resets with the deterministic world.
- `node scripts/test-content-interaction.mjs` verified a direct flower hit/removal and removal caused by breaking its supporting voxel against a generated seed-1337 session.
- Physical mouse, touch, and gamepad targeting of every decoration archetype remains a manual acceptance path.

## Pointer capture and pause correction — 2026-09-18

- Follow-up: the browser's post-Escape cooldown was being treated as a permanent capture failure. Chromium's `PointerLockController` defines a 1250 ms cooldown. The game now waits until 1500 ms after unlock and retries once when a recapture fails inside that window, without requiring a second click. Successful initial requests have no added delay.
- Regression coverage also includes temporary denial followed by successful automatic recapture, persistent denial without a retry loop, and cancellation of the scheduled retry by Escape, reset, destruction, or Studio pause. These use a deterministic clock; a real quick Escape/Continue cycle remains a manual browser check.

This section supersedes the historical optional-pointer-lock and hover-look observations below.

- Desktop mouse gameplay now waits for capture, and capture loss enters Rabbit pause immediately. Escape and P only pause; Continue reacquires capture before resuming.
- `node --experimental-strip-types scripts/test-play-focus.mjs` exercises the actual Rabbit pause authority with simulated browser capture events: both Escape/unlock event orders, key repeat, five resume/loss cycles, denial, Studio pause and resume, touch/gamepad entry, switching to mouse, end-state releases, and late completions after reset, Escape, or destruction.
- Automated clicks in both Codex's embedded browser and Chrome rejected pointer capture; both showed the blocking retry overlay rather than starting free-cursor gameplay.
- The entry overlay was visually reviewed at 390×844. This is viewport testing, not physical multitouch certification.
- Real granted pointer lock and hardware Escape in an external browser, deployment inside Rabbit's iframe, physical multitouch, and physical gamepad remain to be verified manually. No production deployment was performed.
- Required checks: TypeScript/template check, production build, and Rabbit contract audit. The regression script is independent of runtime dependencies.

Evidence observed on 2026-08-23/24 (America/Argentina/Buenos_Aires).

## Automated gates

- `npm ci`: passed; the lockfile was installed without changing dependencies.
- `npm run check`: passed.
- `npm run build`: passed with Vite 8.1.5. The chunk-size warning above 1.5 MB corresponds to the PlayCanvas engine bundle.
- `audit-template.mjs`: 24 checks passed, 0 warnings.
- `quick_validate.py`: the `rabbit-voxel-lab-gamedev` skill is valid.
- Production preview: successful boot with no console errors or warnings.

The environment expansion on 2026-08-24 reran `check`, `build`, and the audit: 24 contract checks passed with 0 warnings. The final build retains only the informational PlayCanvas bundle-size warning.

The camera expansion reran the same gates and local-skill validation; all passed. The production preview at `127.0.0.1:4174` started with a clean console.

## Rabbit and lifecycle

- Sandboxed iframe without `allow-same-origin`: `rabbit:ready=1`, `rabbit:error=0`.
- Missing atlas in an opaque iframe: visible overlay, `ready=0`, `error=1`.
- Studio pause: the overlay appears; the local Continue button cannot override it, while Studio resume can.
- After five `rabbit:restart` messages, `ready` remained at 1 and exactly one HUD, one canvas, one touch root, and six slots remained.
- Direct boot and production preview: clean console.
- With the sky, water, and environment active, five consecutive restarts preserved exactly one canvas, one HUD, one touch root, and six slots. Inventory, objective, and phase returned to their initial state.
- Two PNG captures taken 1.2 seconds apart during pause were byte-for-byte identical; clouds, particles, and the scene remained frozen.

## Gameplay and responsive behavior

- Desktop hover mouse-look was verified: moving the cursor between two canvas points without pressing a button changed the camera orientation; pointer lock remains an optional mode.
- The test browser rejected pointer lock; hover-look fallback kept camera control available.
- Camera and DDA aligned with the crosshair after correcting the pitch sign.
- Breaking grass increased dirt from 12 to 13 exactly once.
- Placing dirt decreased dirt from 13 to 12 exactly once and changed the selection to Dirt.
- Clicking the hotbar selected Stone; clicking during pause did not alter inventory.
- Layout was inspected at 1920×1080, 844×390, and 390×844.

## Natural environment

- Final boot: 10 clouds, 34 reeds, 18 rocks, and 18 particles, with a deterministic layout for seed `1337`.
- The default lake occupies three liquid chunks. Inspection from the shore showed a transparent surface without z-fighting, complete side faces, merged reeds, and readable particles.
- Water was verified through a disposable internal test that was removed before delivery:
  - DDA passed through water and hit the solid floor.
  - Placing or replacing a natural cell and restoring it returned `BlockId 7`.
  - Entering the water produced exactly one `splash`.
  - Stabilized speed was `3.348 m/s` in water versus `5.4 m/s` on land, for an exact ratio of `0.62`.
  - A liquid edit at a chunk corner invalidated the owner and two neighbors (`3` dirty chunks).
- The hotbar kept six slots and did not expose water.
- A minimal preset with clouds, water, decorations, particles, and ambience disabled produced 0 liquid chunks, 0 props or particles, and only two sky/sun draw calls.
- A temporary configuration with a second valid lake booted successfully and increased liquid draw calls from three to four without changing the compositor.
- `opacity: 1.68` was rejected before boot with the readable overlay `environment.water.opacity must be in (0, 1)`.
- Review captures were taken in the acceptance browser at 1280×720 and 691×807; the historical README screenshot was not replaced.

## Day and night modes

- The temporary authoring button appeared next to Pause only during `playing`: during the day it showed a moon icon with the accessible label “Switch to night mode”; at night it showed a sun icon with “Switch to day mode.”
- The visual transition was verified at runtime: the night gradient, moon, stars, clouds, fog, lighting, terrain, and water changed as a coordinated preset; the HUD, crosshair, and hotbar retained their contrast.
- All 72 stars are merged into one mesh. The profile changed from seven environment draw calls during the day to eight at night, without rebuilding chunks or creating entities when switching.
- A temporary `initialMode: 'night'` plus `showToggleButton: false` configuration started directly at night without rendering the button, confirming the plug-and-play path that remains after removing the UI.
- Restarting from night restored the configured `initialMode` and kept exactly one canvas, one HUD, and six slots, without duplicating resources or listeners.
- Responsive review was performed at 1280×720 and 691×807: the mode and Pause buttons did not overlap. The console remained free of errors and warnings.
- Delivered configuration: `showToggleButton: false`; the selector is hidden by default while the day/night presets and controller remain available to AI.

## Cameras and visible character

- FPS remains the initial mode and preserves the same eye height, hover-look, optional pointer lock, crosshair, and DDA. The avatar and its shadow remain disabled in this view.
- The `3P/1P` button switched to centered third person without releasing focus; `V` was verified with a keypress held long enough to cross an input frame.
- Third person displayed the complete procedural explorer standing on the terrain, with a shadow and at most 10 draw calls (nine parts plus the shadow). Movement still uses the same AABB and is relative to camera yaw.
- The `Character_Male_2` backend loaded from the distributed GLB, displayed with its rig intact, and registered all six required clips: `Idle`, `Walk`, `Run`, `Jump`, `Jump_Idle`, and `Jump_Land`. The delivered configuration uses `renderer: 'procedural'` again.
- A nonexistent GLB path produced a visible overlay and never reached gameplay. A configuration with an invalid FOV left only the error overlay, with no residual interactive controls.
- Temporary configurations were verified and then reverted:
  - `initialMode: 'third-person'` plus `showButton: false` started with the avatar visible and no camera buttons.
  - `switching.enabled: false` hid the button and ignored `V`.
  - `showToggleButton: true` kept the day/night, camera, and Pause controls from overlapping in portrait.
- During Pause, `V` did not change the view; continuing preserved the previous mode.
- Fifty consecutive selector clicks ended in FPS with exactly one camera button, one canvas, and six slots.
- Visual review was performed at 1280×720, 691×807, and 390×844. In portrait, the objective, camera, and Pause controls remained readable without overlap.
- The third-person interaction ray comes from the true camera center and keeps a target only when a second DDA from the player's eyes hits the same voxel first and remains within range.

## Observed profile

Three-second sample in the test browser at a 1920×1080 viewport:

- 120.0 average FPS; worst frame 9.4 ms.
- 18 chunks and 18 terrain draw calls.
- 14,124 terrain triangles.
- Maximum observed boot remesh: 2.2–2.4 ms; an earlier run recorded 2.7 ms.

This satisfies the 60 FPS desktop target in the tested environment. It is not equivalent to a mobile hardware benchmark.

Profile of the environment expansion in the instrumented browser:

- 18 chunks, 21 terrain draw calls (three liquid), and seven environment draw calls.
- 14,570 terrain and liquid triangles; the environment uses merged geometry and fixed capacity.
- Normal observed boot remesh: 3.9–4.4 ms; 10.7 ms peak with eight simultaneous WebGL tabs.
- The instrumented browser limited both the full and minimal presets to 30.0 FPS / approximately 34.3 ms. Because both profiles hit the same limit, this run cannot certify 60 FPS desktop or attribute the limitation to the environment. The earlier 120 FPS desktop benchmark of the base template remains as evidence.
- The available API did not expose a reliable GPU-memory measurement, so no estimate is reported.

Production profile observed with the procedural third-person avatar:

- 18 chunks, 21 terrain draw calls, seven environment draw calls, and 10 avatar/shadow draw calls.
- 14,570 terrain triangles and a maximum boot remesh of 3.9 ms.
- The instrumented browser recorded 32.6 average FPS and a 34.3 ms worst frame; this reflects the browser limit described above and does not certify mobile hardware.

## Paths not physically tested

- Pointer lock granted by an external browser.
- Real simultaneous multitouch (joystick plus look plus action) and hardware `pointercancel`.
- Physical gamepad, disconnection, and reconnection.
- Gamepad `Y` and walk, run, jump, and landing animations with physical hardware.
- Camera-boom collision against every boundary geometry through exhaustive human traversal; the implementation uses five voxel DDA rays and was visually inspected near the spawn and beacon.
- Performance on a mid-range mobile phone.
- Environment-expansion performance on desktop without the instrumented browser's 30 FPS cap.
- Complete human traversal from all three crystals to victory, falling into the void, and manually editing a chunk boundary.

Structural coverage for these paths is implemented and passed type checks and audit, but they are not marked as accepted without real hardware or a complete manual traversal.

## Sandbox and procedural forest expansion — 2026-08-27

### Gates and boot

- `npm run check`: passed with strict TypeScript, file-size limits, and protected contracts.
- `npm run build`: passed; only the informational warning for the PlayCanvas bundle above 1.5 MB remains.
- Rabbit audit: 24 checks passed, 0 warnings.
- The local skill passed an equivalent frontmatter validation. The official Python helper could not start on this host because its environment does not include PyYAML; no dependency was added to hide that limitation.
- Production preview at `127.0.0.1:4174`: correct initial overlay and clean console, with one informational profile log.

### Plug-and-play configuration

- Final default verified: `content.preset: 'forest'` and `mission.active: 'none'`; no persistent objective is shown and no accidental victory is possible.
- `minimal + none`: successful boot, three trees, 10 props, 0 collectibles, and two content draw calls.
- `forest + beacon`: successful boot with the generic “Activate the beacon: 0/3” HUD; the beacon, sockets, and crystals are generated only for this mission.
- `minimal + collect`: successful boot with the “Forest Collector: 0/8” HUD; the planner added eight apples even though the minimal preset declares 0 collectibles.
- After temporary tests, the delivered configuration returned to `forest + none`.

### Content and responsive behavior

- Observed default profile: 32 chunks, 34 terrain draw calls (two liquid), five environment draw calls, five content draw calls, and 10 procedural-avatar draw calls in third person.
- Default content: 17 editable voxel trees, 68 props or structures, and 20 collectibles; 27,114 terrain triangles and a maximum observed remesh of 3.8–4.4 ms.
- Desktop visual inspection: sharp atlas, oak and pine trees visible from spawn, wood in the fifth slot, and sandbox mode without an objective overlay.
- Inspection at `390×844`: centered six-slot hotbar, non-overlapping top actions, centered crosshair, and a correctly visible procedural avatar in third person.
- Pause was verified with two captures taken 700 ms apart: identical bytes and a “The world is frozen” overlay, confirming that environment and content remained frozen.

### Paths not manually certified in this expansion

- Complete human traversal to every ruin, overlook, signpost, apple, and mushroom.
- Manual collection of all eight units through `victory` and the `continue` variant.
- A real user-driven fall into the void and respawn; configuration, types, and event composition cover the path.
- Five restarts measured again with DOM instrumentation; the lifecycle reuses the same handles, but the earlier certification was not repeated here.
- Physical multitouch and gamepad testing, and performance on mid-range mobile hardware.
