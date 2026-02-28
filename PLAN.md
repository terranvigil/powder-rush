# Powder Rush — Game Development Plan

## Vision

A stylized 3D downhill skiing game focused on the feel of skiing glades at speed. Smooth shading, soft snow, organic terrain, and natural-looking trees. The retro identity lives in the **audio** (chiptune / 8-bit music and SFX), the **arcade structure** (levels, credits, gear shop, high scores), and the **UI aesthetic** (pixel-font HUD, chunky menus).

The core fantasy: threading through trees at speed, carving powder, catching air,
and landing tricks — all with tight, responsive controls and heavy "game juice"
feedback that makes every turn feel satisfying.

---

## Engine & Stack

**Babylon.js 7.x + TypeScript + Havok Physics + Vite**

| Factor | Rationale |
|--------|-----------|
| Babylon.js | Full-featured WebGL/WebGPU 3D engine, tree-shakeable |
| Havok WASM | Production-grade physics (same engine as Unity/Unreal) |
| TypeScript | Type safety, great tooling |
| Vite | Fast HMR dev server, optimized production builds |
| Web-native | Runs in any browser, deploy to GitHub Pages, no install |

**Dependencies:**
- `@babylonjs/core` — 3D engine (meshes, materials, lighting, post-processing)
- `@babylonjs/gui` — HUD overlay (AdvancedDynamicTexture)
- `@babylonjs/havok` — Physics engine (WASM)
- `vite` — Build tool
- `typescript` — Language
- `playwright` — E2E testing

---

## Art Style

| Element | Current State | Target |
|---------|--------------|--------|
| Shading | Smooth shading, soft lighting | Painterly toon ramp (2-3 step diffuse) |
| Snow | Smooth mesh + vertex color height tinting + specular | Soft billowy snow with blue shadows |
| Trees | Smooth-shaded cones (pine) + ellipsoid spheres (aspen) with snow caps | Done |
| Character | Articulated box model with orange-red ski jacket, round helmet | IK-driven arm balance, gear swaps |
| Camera | Follow cam with FOV boost, Dutch tilt, landing punch | Done |
| Trail | Dual-ski mesh tracks, width-dynamic, fade-out | Done |
| Spray | Brake + carve particle modes, terrain-positioned | Done |
| Fog | Linear distance fog (80-300m, blue-grey haze) | Atmospheric depth |

**Done:**
- Chiptune / 8-bit soundtrack (32-bar E minor, 4 sections) and retro SFX
- Pixel-font HUD (speed, timer, collision flash)
- Animated wildlife (30 bunnies/deer with flee AI)
- Snow effects (trails, spray, powder burst)

**Planned:**
- Gear shop and visual gear progression
- Day/night lighting cycle within each run
- Arcade-style score popups

---

## What's Built (Current State)

### Core Skiing Physics
- Rigidbody-based movement on Havok dynamic sphere (mass 75kg)
- Terrain detection via physics raycasts
- Real skiing physics: aerodynamic drag (CdA model), snow friction (mu·g·cos), constant brake decel
- Steering with speed-dependent turn rate + edge grip (lateral friction decay model)
- Tuck (70% less drag), brake (constant 6 m/s² decel), crouch-charge jump
- Safety speed cap at 45 m/s (~162 km/h), natural terminal velocity from drag
- Lean angle with visual tilt (35° max)

### Terrain System
- **Spline-driven 1200m run** with Catmull-Rom interpolation (15-20 control points)
- **8 × 150m streaming chunks** with 5-chunk active window, recycling
- **5+ noise layers**: rolling terrain (FBM), mogul fields (zone-masked), gullies (ridge FBM), cellular dips (Worley), surface texture
- Smooth shading with per-vertex height-based color tinting
- Havok mesh colliders per chunk
- **3 tabletop jumps** (realistic profile with approach/lip/table/landing/runout, blue dye lip marking, physics mesh colliders)
- **25 collectible gold coins** (spinning, proximity pickup, coin counter HUD, pickup SFX)
- Finish gate at end of run

### Trees & Obstacles
- **Trees**: 60% pine / 40% aspen, 3 growth stages, per-tree variation, snow caps, cylinder physics proxies
- **80 obstacles**: clustered rocks (multi-box) + snow-capped stumps, physics proxies
- Deterministic placement via spline + hash functions

### Wildlife & NPCs
- **30 animals** (60% bunny / 40% deer): flee AI, 25m detection radius, spawn/despawn window
- **4 NPC skiers**: wobble steering, tuck animation, spline following

### Collision System
- State machine: NORMAL → STUMBLE / WIPEOUT → RECOVERING
- Stumble (< 8 m/s): 0.5s, 70% speed penalty
- Wipeout (≥ 8 m/s): 1.5s, 20% speed penalty, 1s recovery
- HUD flash + audio feedback per collision

### Skier Model
- Articulated body: torso, head (sphere helmet), arms, legs, skis
- Animated poses: normal, tuck, brake, crouch, airborne, stumble, wipeout, recovering
- Orange-red ski jacket with darker accent arms, round helmet
- Visual model synced to physics body with terrain alignment

### Snow Effects
- **Snow trails**: dual-ski mesh tracks, width-dynamic (carve/brake), 300-point ringbuffer with fade-out
- **Snow spray**: brake fan + carve sideways particles, speed/turn reactive
- **Powder burst**: speed-scaled particle burst on landing (40-140 particles)

### Camera
- Follow camera: offset behind/above skier
- FOV boost at speed (65 to 78 deg)
- Dutch tilt on lean (4 deg)
- Landing punch on ground contact after air

### Audio
- **Chiptune music**: 32-bar E minor composition (4 sections, 4 drum patterns, ~51s loop)
- **SFX**: wind (speed-reactive), carving (turn/speed-reactive), jump, landing, stumble, wipeout, finish fanfare
- **Title jingle**: ascending arpeggio + sustained chord
- **Settings menu**: gear button, music/sound toggles + volume sliders, localStorage persistence
- **Pause system**: ESC toggles settings, suspends AudioContext + physics + race timer

### Rendering
- PixelRenderer: 480p effective resolution with nearest-neighbor upscale
- Directional sun light (warm) + cascaded shadow maps (4 cascades, 200m range)
- Hemispheric ambient (cool shadows)
- Linear fog (80-300m, blue-grey)

### HUD & UI
- Speed readout (km/h), race timer, coin counter, collision flash overlay
- Finish panel with time + coins collected
- Splash screen with controls guide (Press Start 2P font)
- Settings menu (gear button, ESC toggle, pause)

### Build & Deploy
- `npm run dev` — Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `make deploy` — Build and deploy to GitHub Pages

---

## Core Skiing Physics (Design)

This is the game. If the skiing doesn't feel right, nothing else matters.

### Movement Model

`PlayerController.ts` responsibilities:
- Reads terrain normal beneath skier via Havok raycast
- Gravity handled by Havok; custom forces for steering/drag
- Steering rotates heading on slope plane; velocity slerps toward heading (edge grip)
- Speed governed by: slope angle + drag + carve friction + tuck modifier
- Jump: vertical impulse on Space release; magnitude scales with crouch duration

### Speed Model

```
aeroDrag     = (CdA * airDensity * speed²) / (2 * mass)
snowFriction = mu * g * cos(theta)         — constant, speed-independent
brakeDrag    = 6.0 m/s²                    — constant deceleration (hockey stop)
edgeGrip     = lateral friction decay (12/s base, speed-dependent falloff)
```

- CdA: Normal 0.50, Tuck 0.15 (70% less drag), Brake 0.70
- Snow friction mu = 0.04 (groomed snow)
- **Tuck** reduces drag significantly
- **Carving** trades speed for control via lateral friction
- **Powder** (off-trail snow) — planned: extra drag vs packed trail

### Crash / Failure Model

**No lives. No health bar. Crash and recover.**

| Event | Result |
|-------|--------|
| Hit obstacle < 8 m/s | Stumble: 0.5s stun, 70% speed kept |
| Hit obstacle ≥ 8 m/s | Wipeout: 1.5s stun, 20% speed kept, 1s recovery |

---

## Camera

```
SkierCamera.ts:
  Follow offset: (0, +4, +8)
  Damping: smooth lerp
  FOV: 65 base, 78 at max speed
  Dutch tilt: 4 deg max, keyed to lean angle
  Landing punch: +3 deg FOV kick, decay over 0.2s
```

---

## Game Juice / Feel

| Effect | When | Status |
|--------|------|--------|
| FOV widening | Speed increases | Done |
| Dutch tilt | Leaning into turns | Done |
| Landing punch | Touching down after air | Done |
| Snow spray | Carving / braking | Done |
| Powder burst | Landing from jump | Done |
| Snow trails | Skiing (dual tracks) | Done |
| Wind audio | Speed-reactive | Done |
| Carve audio | Turn-reactive hiss | Done |
| Collision flash | Hit obstacle | Done |
| Camera shake | Crash | Planned |
| Speed lines | High speed | Planned |
| Slow-motion | Perfect trick landing | Planned |
| Trick score popup | Trick scored | Planned |
| Near-miss whoosh | Pass close to tree | Planned |

---

## Procedural Slope Generation

### Implemented: Spline-Driven Streaming Chunks
- **SlopeSpline**: Random-walk control points (15-20 over 1200m), Catmull-Rom tangent interpolation
- **SlopeFunction**: O(1) height lookup via spline centerline + bowl shape + multi-scale noise
- **ChunkManager**: 8 × 150m chunks, 5-chunk active window (2 behind + 3 ahead), dynamic spawn/despawn
- **Noise layers**: rolling FBM, mogul fields (zone-masked), gully ridges, Worley cellular dips, fine surface texture
- **JumpBuilder**: 3 tabletop jumps (realistic profile, blue dye lip marking, physics mesh colliders)
- Finish gate spawned when final chunk loads

### Obstacle Placement
- Deterministic hash-based positioning along spline
- Safe zones: 40m start, 60m end
- 80 obstacles (60% rocks, 40% stumps) with physics proxies

### Planned
- Y-split branching for path choice
- GPU instancing for trees at distance

---

## Scoring & Economy

### Implemented
| Source | Status |
|--------|--------|
| Course completion time | Done — race timer + finish panel display |
| Collectible coins | Done — 25 per course, gold spinning coins, HUD counter |

### Planned
| Source | Credits |
|--------|---------|
| 360 spin | 100 |
| 720 spin | 250 |
| Backflip | 300 |
| Flow multiplier | x1.0 to x5.0 (builds while carving cleanly) — deferred |
| Time bonus | Based on course completion speed |

### Gear Shop

| Category | Effect |
|----------|--------|
| Skis | Top speed + turn radius |
| Boots | Landing stability |
| Jacket | Crash protection |
| Helmet | Night visibility |
| Poles | Trick combo window |

---

## Controls

| Input | Action |
|-------|--------|
| A / D or Left / Right | Steer / carve |
| W or Up | Tuck (reduce drag) |
| S or Down | Brake |
| Space (hold then release) | Crouch then jump |
| ESC | Pause / settings menu |

---

## Level Structure (Planned: 4 Procedural Levels)

| Level | Difficulty | Time of Day |
|-------|-----------|-------------|
| 1 — Green Glade | Green | Morning |
| 2 — Birch Run | Blue | Midday |
| 3 — Dusk Bowl | Red | Evening to Night |
| 4 — Night Drop | Black | Night |

---

## Build Order

### Phase 1 — Foundation + Movement Prototype [DONE]
- [x] Babylon.js + Havok + Vite project setup
- [x] Procedural test slope mesh
- [x] PlayerController — rigidbody skiing physics
- [x] Steering, tuck, brake, jump
- [x] Follow camera with FOV boost + Dutch tilt
- [x] Basic HUD (speed)

### Phase 2 — Visual Polish [DONE]
- [x] Smooth-shaded terrain with vertex colors
- [x] Natural tree generation (pine + aspen) with snow
- [x] Per-tree variation (rotation, lean, dimensional jitter)
- [x] Skier model with orange-red jacket, round helmet
- [x] Fog + improved lighting
- [x] Snow trail rendering (dual-ski tracks, width-dynamic, fade-out)
- [x] Snow spray particles on carve (brake + carve modes)
- [x] Powder burst on landing (speed-scaled particle burst)

### Phase 3 — Procedural Slope Streaming [DONE]
- [x] Spline-driven slope generation (Catmull-Rom, 15-20 control points over 1200m)
- [x] Chunk streaming (8 × 150m chunks, 5-chunk active window, recycling)
- [x] Noise height layers (5+ noise layers: rolling terrain, mogul fields, gullies, cellular dips, surface texture)
- [x] Tabletop jumps (3 realistic jumps with blue dye lip, physics mesh colliders, terrain-streamed)
- [ ] Y-split branching (deferred)

### Phase 4 — Scoring & Collectibles [DONE]
- [x] Tabletop ski jumps (3 per course, realistic profile, blue dye lip marking, shadow casters, physics colliders)
- [x] Collectible gold coins (25 spinning coins, proximity pickup, coin counter HUD, coin pickup SFX)
- [x] Course completion time (race timer in HUD, displayed on finish panel)
- [x] Airborne trick detection (spins via steer, grabs via tuck, flips via brake — TrickDetector.ts)
- [x] Combo multiplier (1.5x/2x/3x for 2/3/4+ tricks in one air)
- [x] Flow meter (continuous clean skiing builds 0-100, resets on collision, multiplies trick scores up to 2x)
- [x] Trick score popup notifications (DOM-based floating text with CSS animations)
- [x] Grab pose for skier model (tuck while airborne = reach-forward grab pose)
- [x] HUD score display + flow meter bar (below speed panel)
- [x] Trick score shown on finish screen
- [x] Trick controls documented in splash screen, rules overlay, and touch hints

### Phase 5 — Obstacles & Wildlife [DONE]
- [x] Collision response (stumble vs wipeout state machine, speed thresholds, penalties)
- [x] Bunny, deer NPCs (30 animals, flee AI, spawn/despawn window)
- [x] Rock/stump obstacles (80 obstacles, clustered rocks, snow-capped stumps, physics proxies)
- [x] Other skier NPCs (4 NPCs, wobble steering, tuck animation, spline following)

### Phase 6 — Progression & UI [DONE]
- [x] Save system (localStorage: total coins, best time, unlocked/equipped gear)
- [x] Main menu (Play, Shop buttons, stats display, replaces splash after first dismiss)
- [x] Gear shop (5 categories × 3 tiers, coin costs, buy/equip, stat effects on physics)
- [x] Finish screen (DOM overlay: time, coins, new best highlight, Again/Menu buttons)
- [x] Game restart loop (finish → reload → main menu → play)

### Phase 7 — Audio
- [x] Chiptune gameplay music (32-bar E minor composition, 4 sections, varied drums)
- [x] Title jingle
- [x] SFX (carve, wind, jump, landing, crash/stumble/wipeout, finish fanfare)
- [x] Dynamic wind/speed audio (wind + carving noise reactive to speed/turn)
- [x] Settings menu (music/sound toggles + volume sliders, localStorage persistence)
- [x] ESC pauses game + audio, resumes on close
- [ ] Chiptune music per time-of-day (deferred)

### Phase 8 — Snow Color Temperature [DONE]
Reference: warm cream/peach snow in sunlight, cool blue-violet (#9090C0) in shadow. Ours is flat white.
- [x] Tint hemispheric ground color toward blue-violet for shadow areas
- [x] Warm directional light toward golden-peach
- [x] Add vertex color tinting on snow: warm where lit, cool in shadow

### Phase 9 — Snow Particle Explosion [DONE]
Reference throws 30-50 large, faceted, low-poly ice chunk meshes during carving with white glow/bloom behind them. Ours is modest.
- [x] Use SolidParticleSystem for 3D mesh chunks (SnowChunks.ts — 200 icosahedron particles, typed arrays, zero-alloc update loop)
- [x] Scale particle count dramatically with speed (gentle = few, hard carve = screen-filling)
- [x] Add soft white bloom/glow behind the chunk cloud (GlowLayer on SPS mesh + enhanced SnowSpray sprite cloud)
- [x] Make chunks slightly translucent with blue-white tint (emissive blue-white material, vertex alpha fade)

### Phase 10 — Depth of Field [DONE]
Reference uses aggressive cinematic bokeh blur. Babylon.js has built-in DOF post-process.
- [x] Restructure post-processing: DefaultRenderingPipeline (DOF + grain) renders at full res, then PassPostProcess pixel downscale as final step
- [x] Focus distance follows skier, aperture widens at speed (fStop 2.8 → 1.4)
- [x] Foreground trees blur as they pass camera (near-field DOF with 60mm focal length)

### Phase 11 — Dynamic Camera [DONE]
Reference camera swoops, banks, changes distance/angle fluidly based on speed, turns, and terrain. Ours is a fixed follow-cam.
- [x] Camera pulls back further at high speed (distance 8 → 12)
- [x] Camera drops lower to snow at extreme speed (height 4 → 2.5)
- [x] Camera banks/orbits slightly in the direction of turns (orbit + look offset based on lean)
- [x] Smooth lerp transitions between all states (exponential smoothing)

### Phase 12 — Falling Snow / Ambient Particles [DONE]
Reference has gentle snowflakes drifting through the air. We have none.
- [x] Add large particle system attached to camera position (FallingSnow.ts, 100 particles)
- [x] Small white dots, slow downward drift + slight lateral sway
- [x] Low count (~50-100), visible mainly against sky and dark objects

### Phase 13 — Crash SFX Upgrade [DONE]
Reference (`snocrash.wav`): deep bass impact (20-300Hz) + snow-crunch upper mids (2-8kHz). Our synthesized crashes lack this weight.
- [x] Add deep bass thud layer (low-passed noise burst, 200-300Hz cutoff)
- [x] Layer in crunch/scrape texture (bandpass noise, 3.5kHz center)
- [x] Sub-bass sine impact (50-80Hz → 20Hz sweep)
- [x] Longer tail/decay for wipeout (0.85s slide) vs stumble

### Phase 14 — Terrain Groove Trails [DONE]
Reference shows visible carved grooves in the snow — indented lines with shadow inside. Our mesh trails are flat ribbons.
- [x] 3-vertex-per-point trail mesh: left, center groove, right
- [x] Center vertex darker (0.50, 0.53, 0.68) simulating groove shadow
- [x] 4 triangles per segment (2 quads: left-center, center-right)

### Phase 15 — Saturated Sky [DONE]
Reference sky is deep saturated royal cobalt (#1040A0). Ours is lighter blue (#87C0ED).
- [x] Default sky: saturated cobalt (0.25, 0.42, 0.78)
- [x] Fog color shifted bluer (0.55, 0.62, 0.78)
- [x] Level presets override sky/fog per time-of-day

### Phase 16 — Snow Surface Sparkles [DONE]
Reference has tiny specular sparkle dots on snow, simulating sun reflecting off ice crystals.
- [x] SnowSparkles.ts: 80 additive-blend billboard particles on snow surface
- [x] Short lifetime (0.15-0.5s) for twinkle effect
- [x] Emitter follows camera XZ, Y from terrain height function
- [x] Bright white radial gradient texture (16px)

### Phase 17 — HUD Minimalism [DONE]
Reference has zero HUD. Ours is functional but takes visual real estate.
- [x] Auto-fade HUD panels after 3 seconds of inactivity
- [x] Fade to 15% alpha, reappear on speed change, coin pickup, or collision
- [x] All 6 HUD panels tracked (speed, score, flow, flow label, coins, timer)

### Phase 18 — Day/Night + Levels [DONE]
- [x] LevelPresets.ts: 4 levels with full lighting/atmosphere configs
- [x] Green Glade (Morning), Birch Run (Midday), Dusk Bowl (Sunset), Night Drop (Night)
- [x] Each preset: sun direction/color/intensity, ambient, sky color, fog range/color, snow rate
- [x] Game.ts setupLighting() driven by preset (no hardcoded values)
- [x] FallingSnow accepts configurable emit rate per level
- [x] MainMenu level select grid (2×2 buttons, replaces single PLAY)
- [x] main.ts passes selected level preset to Game constructor

### Phase 19 — Chairlift System [DONE]
- [x] ChairliftManager.ts: 12 towers from z=-40 to z=-1160, right side of slope
- [x] Dual cable strands (uphill far, downhill near) with catenary sag
- [x] Animated chairs (InstancedMesh) with riders on uphill, empty on downhill
- [x] Terminal station buildings at top and bottom
- [x] Distance-based visibility culling (250m from player)
- [x] Settings menu toggle (LIFTS on/off, persisted to localStorage)
- [x] Integrated into Game.ts frame loop

### Phase 20 — Camera Fix + Night Sky [DONE]
- [x] Fixed camera starting under skier: first-frame snap to target position (no lerp delay)
- [x] NightSky.ts: 200 stars on sky dome (vertex-colored quads, emissive material)
- [x] Moon disc with billboard + glow halo for Night Drop level
- [x] Sky dome follows camera XZ position
- [x] Chairlift pole lights: warm point lights + emissive bulbs on every other tower
- [x] Night features activated based on level preset name

### Phase 21 — Game Course Types [DONE]
Advance to next level after achieving a target score. Notify the player if their score was high enough to advance or if they need to try again.
- [x] Slalom course — gates to weave through, time penalty for misses, direction HUD arrow
- [x] Terrain park — 8 jumps (up from 3), trick-focused scoring
- [x] Super G — high-speed course with wide gates, fewer turns, direction HUD
- [x] Parallel racing — AI opponent races alongside player, position delta HUD
- [x] Moguls — dense bumps (mogulIntensity=0.85), 1.3x trick bonus, MOGUL AIR bonus
- [x] Half-pipe — U-shaped channel (22m wide, 6m deep), altitude-based trick multiplier (up to 2.5x)
- [x] Score-based level progression with unlock notifications (7 levels, score thresholds 500-3000)
- [x] Player shouldnt be able to get stuck, e.g. at the far left and right edges it gets stuck

### Phase 22 - Course Designer
- [ ] Create a list of ideas

### Phase 23 — Polish & Ship
- [ ] Gamepad support (deferred)
apply another 10% cut: JUMP_FORCE 6.4→5.76, terrain restitution 0.08→0.072, trees 0.4→0.36, obstacles 0.24→0.216, walls 0.24→0.216, jump ramps 0.08→0.072
- [x] Mobile touch controls (zone-based steering, BRK/TUK/JUMP buttons, touch-aware splash)
- [ ] Performance optimization
- [ ] Playtesting + balance
- [ ] Mesh instancing for repeated geometry (deferred) — every tree, rock, stump, and coin is currently a unique Mesh, causing hundreds of draw calls per frame. Switching to InstancedMesh for these would cut draw calls dramatically, especially important for mobile. Moderate effort, concentrated in TerrainChunk.ts and ObstacleBuilder.ts.
- [ ] Replace Havok with Rapier.js (deferred) — Havok WASM is 2.09 MB (662KB gzipped), 62% of our total bundle. We only use it for: 1 dynamic sphere, static mesh/box/cylinder colliders, 1 raycast per frame, and velocity get/set. Rapier.js provides the same features at ~300KB WASM, saving ~1.7 MB. Physics code is concentrated in ~8 files (PlayerController, TerrainChunk, ObstacleBuilder, JumpBuilder, SlopeBuilder, Game, main). Cannon-es (~150KB, pure JS, zero WASM) is another option if we want to eliminate WASM entirely.
