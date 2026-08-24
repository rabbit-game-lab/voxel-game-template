# Rabbit Voxel Lab — implementation brief

Title: Rabbit Voxel Lab  
Fantasy: Explore and reshape a tiny block island, then repair its crystal beacon.  
Core loop: Move, aim, mine blocks, select a material, place blocks, repair three sockets.  
Player actions: Move, sprint, jump, look, switch camera, break, place, select hotbar, pause, restart.
Camera/movement: Configurable first/third-person strategies over the same fixed-step kinematic AABB movement; third person has a voxel-colliding camera and camera-center aim validation from the player's eyes.
Objective: Mine three exposed crystals and place one in each beacon socket.  
Failure/restart: Falling below the island defeats the run; restart regenerates seed 1337.  
Content: Six solid block types, one hidden water block, one bounded island, three trees, three crystal quarries, one beacon, a procedural lake and shore.
Controls: Keyboard with hover mouse-look and optional pointer lock, touch joystick plus drag-look/buttons, standard gamepad; camera switch via HUD/V/Y.
Assets and licenses: Quaternius `Blocks_PixelArt.png` and optional `Character_Male_2` GLB, CC0 1.0; procedural audio, environment and default voxel avatar.
Config sections: Session, player, camera, controls, world, interaction, HUD, environment, visuals, audio, performance.
Environment: Configurable day/night presets with sun, moon and merged stars; camera-centered gradient sky, two merged voxel-cloud layers, transparent chunk water, merged shore decoration meshes, fixed particle system and procedural ambience.
System order: Input → fixed movement/collision/wading → camera/aim → validated raycast/actions → edits → opaque/liquid mesh queue → avatar/environment → render/HUD/audio.
Rabbit capabilities: audio yes / pointerLock yes / storage no.  
Performance target: 60 FPS desktop 1080p; at least 30 FPS mid-range mobile.  
Non-goals: Infinite streaming, greedy meshing, crafting, enemies, swimming or fluid simulation, multiplayer, persistence, voxel lighting.
