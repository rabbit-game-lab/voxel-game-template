# Rabbit Voxel Lab — implementation brief

Title: Rabbit Voxel Lab
Fantasy: Explore and reshape a compact open voxel island full of procedural places and collectibles.
Core loop: Move, discover, collect, mine blocks, select a material and place blocks; missions are optional presets.
Player actions: Move, sprint, jump, look, switch camera, break, place, select hotbar, pause, restart.
Camera/movement: Configurable first/third-person strategies over the same fixed-step kinematic AABB movement; third person has a voxel-colliding camera and camera-center aim validation from the player's eyes.
Objective: `none` for sandbox by default; optional beacon and collection missions selected in config.
Failure/restart: Falling below the island respawns while preserving edits/inventory; restart regenerates seed 1337.
Content: Eight solid block types, hidden water, one 64×32×64 island, mixed forest, lake, breakable support-aware merged decoration, discoveries, pickups and optional mission landmarks.
Controls: Keyboard with required pointer lock for mouse look; Escape or capture loss pauses immediately and Continue reacquires capture. Touch joystick plus drag-look/buttons and standard gamepad remain capture-independent; camera switch via HUD/V/Y.
Assets and licenses: Quaternius `Blocks_PixelArt.png` and optional `Character_Male_2` GLB, CC0 1.0; procedural audio, environment and default voxel avatar.
Config sections: Session, mission, player, camera, controls, world, content, interaction, HUD, environment, visuals, audio, performance.
Environment: Configurable day/night presets with sun, moon and merged stars; camera-centered gradient sky, two merged voxel-cloud layers, transparent chunk water, fixed particles and procedural ambience.
System order: Input → fixed movement/collision/wading/pickups → mission → camera/aim → validated raycast/actions → edits → mesh queues → avatar/content/environment → render/HUD/audio.
Rabbit capabilities: audio yes / pointerLock yes / storage no.
Performance target: 60 FPS desktop 1080p; at least 30 FPS mid-range mobile.  
Non-goals: Infinite streaming, greedy meshing, crafting, enemies, swimming or fluid simulation, multiplayer, persistence, voxel lighting.
