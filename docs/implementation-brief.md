# Rabbit Voxel Lab — implementation brief

Title: Rabbit Voxel Lab
Fantasy: Explore and reshape a compact open voxel island full of procedural places and collectibles.
Core loop: Move, discover, collect, mine blocks, select a material and place blocks; missions are optional presets.
Player actions: Move, sprint, jump, look, switch camera, break, place, select hotbar, pause, restart.
Camera/movement: Configurable first/third-person strategies over the same fixed-step kinematic AABB movement; third person has a voxel-colliding camera and camera-center aim validation from the player's eyes.
Objective: `none` for sandbox by default; optional beacon and collection missions selected in config.
Failure/restart: Falling below the island respawns while preserving edits/inventory; restart regenerates seed 1337.
Content: Eight solid block types, hidden water, one 64×32×64 island, mixed forest, lake, breakable support-aware merged decoration, discoveries, pickups, optional mission landmarks, and a procedural creature catalog.
Controls: Keyboard mouse look with pointer lock. Escape unlocks the mouse without pausing; P pauses. Continue and canvas clicks recapture. Touch joystick plus drag-look/buttons and standard gamepad remain capture-independent; camera switch via HUD/V/Y.
Assets and licenses: Quaternius `Blocks_PixelArt.png` and optional `Character_Male_2` GLB, CC0 1.0; procedural audio, environment and default voxel avatar.
Config sections: Session, mission, player, camera, controls, world, content, interaction, HUD, environment, visuals, audio, performance.
Environment: Configurable day/night presets with sun, moon and merged stars; camera-centered gradient sky, two merged voxel-cloud layers, transparent chunk water, fixed particles and procedural ambience.
System order: Input → fixed player and creature movement/collision/wading/pickups → mission → camera/aim → validated voxel/decoration/creature actions → edits → mesh queues → avatar/content/environment/creatures → render/HUD/audio.
Rabbit capabilities: audio yes / pointerLock yes / storage no.
Performance target: 60 FPS desktop 1080p; at least 30 FPS mid-range mobile.  
Non-goals: Infinite streaming, greedy meshing, crafting, ranged combat, loot tables, mounts, taming, breeding, swimming or fluid simulation, multiplayer, persistence, voxel lighting.
