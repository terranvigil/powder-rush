# Powder Rush — Development Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | JavaScript runtime |
| npm | 10+ | Comes with Node.js |

## Setup

```bash
git clone https://github.com/terranvigil/powder-rush.git
cd powder-rush
npm install
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`).

## Project Structure

```
powder-rush/
├── index.html                   # Entry HTML with fullscreen canvas
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite config (base path for GitHub Pages)
├── Makefile                     # Build + deploy targets
├── src/
│   ├── main.ts                  # Entry: init Havok WASM, create engine, bootstrap game
│   ├── game/
│   │   ├── Game.ts              # Scene, physics, lighting, fog, wires all systems together
│   │   └── PixelRenderer.ts     # 480p PassPostProcess + nearest-neighbor upscale
│   ├── player/
│   │   ├── PlayerController.ts  # Skiing physics (Havok dynamic body + custom forces)
│   │   ├── PlayerInput.ts       # Keyboard state management
│   │   └── SkierModel.ts        # Articulated skier model with pose animations
│   ├── terrain/
│   │   └── SlopeBuilder.ts      # Procedural slope mesh + tree generation
│   ├── camera/
│   │   └── SkierCamera.ts       # Follow camera + FOV boost + Dutch tilt + landing punch
│   └── ui/
│       └── HUD.ts               # Speed display with dark panel background
├── PLAN.md                      # Game design reference + roadmap
└── DEVELOPMENT.md               # This file
```

## Tech Stack

- **Babylon.js 7.x** (`@babylonjs/core`) — 3D engine
- **Havok** (`@babylonjs/havok`) — Physics (WASM-based)
- **Babylon GUI** (`@babylonjs/gui`) — HUD overlay
- **Vite** — Build tool with hot reload
- **TypeScript** — Strict mode
- **Playwright** — E2E testing

## Architecture

### Rendering
- Smooth-shaded terrain and tree meshes (no flat shading)
- Per-vertex height-based color tinting on snow (cool blue-grey in valleys, bright white on peaks)
- PixelRenderer: 480p effective resolution with nearest-neighbor upscale for stylized look
- Linear distance fog (60-200m) for depth perception

### Lighting
- Directional sun light (warm, intensity 1.8)
- Hemispheric ambient fill (intensity 0.25, cool ground color for shadow tint)
- Fog color: blue-grey haze

### Terrain
- 100x200 vertex grid, 50m wide x 250m long
- Height function: base slope (15% grade) + S-curve wander + bowl edges + sine bumps
- Bump amplitude ramps up over first 30m (smooth start zone)
- Havok mesh physics collider

### Trees
- 40 trees, deterministically placed from hash function
- 60% pine (3-tier smooth cones, tessellation 24) / 40% aspen (ellipsoid sphere, 20 segments)
- Per-tree variation: Y rotation, X/Z lean (3 deg), dimensional jitter (15%)
- Snow shelves (pine) and snow caps (aspen) with 3 snow load levels
- Cylinder physics proxies for collision

### Physics
- Havok handles gravity and collision response
- Player is a dynamic sphere (mass 75kg)
- Custom forces applied each physics step: steering, drag, jump impulses
- Terrain detection via Havok raycasts
- Angular damping locked (no tumbling)

### Game Loop
- Physics forces: `scene.onBeforePhysicsObservable` (fixed timestep)
- Camera + visuals: `scene.onBeforeRenderObservable` (frame-rate dependent)
- Input polled each frame

## Controls

| Key | Action |
|-----|--------|
| A/D, Arrow Left/Right | Steer |
| W, Arrow Up | Tuck (reduce drag) |
| S, Arrow Down | Brake |
| Space (hold + release) | Jump (charge by holding) |

## Tuning

Key physics values in `PlayerController.ts`:
- `BASE_DRAG` — base air resistance (0.002)
- `TUCK_DRAG_MULTIPLIER` — drag reduction when tucking (0.3)
- `BRAKE_DRAG` — drag when braking (0.06)
- `STEER_RATE` — radians/sec heading turn rate (0.45)
- `EDGE_GRIP` — how quickly velocity aligns to heading (0.85)
- `JUMP_FORCE` — jump impulse strength (8)
- `MAX_SPEED` — velocity cap in m/s (30)

Terrain values in `SlopeBuilder.ts`:
- `WIDTH` / `LENGTH` — slope dimensions (50 x 250)
- `RES_X` / `RES_Z` — mesh resolution (100 x 200)
- `STEEPNESS` — base slope grade (0.15)
- `BUMP_AMPLITUDE` — terrain undulation (0.8)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `make deploy` | Build and deploy to GitHub Pages |
