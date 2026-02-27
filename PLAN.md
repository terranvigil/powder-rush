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

### Phase 4 — Scoring & Collectibles
- [x] Tabletop ski jumps (3 per course, realistic profile, blue dye lip marking, shadow casters, physics colliders)
- [x] Collectible gold coins (25 spinning coins, proximity pickup, coin counter HUD, coin pickup SFX)
- [x] Course completion time (race timer in HUD, displayed on finish panel)
- [ ] Airborne trick detection (spins, grabs, flips)
- [ ] Combo multiplier (deferred)
- [ ] Flow meter (continuous clean skiing)

### Phase 5 — Obstacles & Wildlife [DONE]
- [x] Collision response (stumble vs wipeout state machine, speed thresholds, penalties)
- [x] Bunny, deer NPCs (30 animals, flee AI, spawn/despawn window)
- [x] Rock/stump obstacles (80 obstacles, clustered rocks, snow-capped stumps, physics proxies)
- [x] Other skier NPCs (4 NPCs, wobble steering, tuck animation, spline following)

### Phase 6 — Progression & UI
- [ ] Gear shop
- [ ] Save system
- [ ] Character creation
- [ ] Level select + menus

### Phase 7 — Audio
- [x] Chiptune gameplay music (32-bar E minor composition, 4 sections, varied drums)
- [x] Title jingle
- [x] SFX (carve, wind, jump, landing, crash/stumble/wipeout, finish fanfare)
- [x] Dynamic wind/speed audio (wind + carving noise reactive to speed/turn)
- [x] Settings menu (music/sound toggles + volume sliders, localStorage persistence)
- [x] ESC pauses game + audio, resumes on close
- [ ] Chiptune music per time-of-day (deferred)

### Phase 8 — Day/Night + Levels
- [ ] Day/night lighting cycle
- [ ] 4 level configurations
- [ ] Difficulty tuning

### Phase 9 — Polish & Ship
- [ ] Gamepad support
- [ ] Mobile touch controls
- [ ] Performance optimization
- [ ] Playtesting + balance
