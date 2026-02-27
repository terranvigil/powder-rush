# Powder Rush

A stylized 3D downhill skiing game built with Babylon.js. Thread through snow-covered pine and aspen trees, carve powder, catch air, and chase high scores.

**Engine:** Babylon.js 7.x + TypeScript + Havok Physics

## Play

Hosted at: https://terranvigil.github.io/powder-rush/

## Quick Start (Development)

```bash
npm install
npm run dev
```

Open the browser URL shown by Vite.

## Controls

| Key | Action |
|-----|--------|
| A/D or Arrow Left/Right | Steer |
| W or Arrow Up | Tuck (reduce drag, go faster) |
| S or Arrow Down | Brake |
| Space (hold + release) | Crouch then jump |

## Features

- Rigidbody skiing physics with momentum, edge grip, and carving
- Procedural terrain with smooth shading and height-based snow tinting
- Pine and aspen trees with per-tree variation and snow accumulation
- Follow camera with FOV boost, Dutch tilt, and landing punch
- Havok WASM physics for collision and terrain detection
- Distance fog for depth perception

## Tech Stack

- **Babylon.js 7.x** — 3D engine (WebGL/WebGPU)
- **Havok** — Physics (WASM)
- **Babylon GUI** — HUD overlay
- **Vite** — Build tool with hot reload
- **TypeScript** — Strict mode

## Build & Deploy

```bash
npm run build      # Production build to dist/
make deploy        # Build and deploy to GitHub Pages
```

## Project Structure

```
src/
├── main.ts                  # Entry: init Havok, create engine, bootstrap
├── game/
│   ├── Game.ts              # Scene, physics, lighting, wires systems together
│   └── PixelRenderer.ts     # Post-process downscale + nearest-neighbor upscale
├── player/
│   ├── PlayerController.ts  # Skiing physics (Havok body + custom forces)
│   ├── PlayerInput.ts       # Keyboard state
│   └── SkierModel.ts        # Articulated skier with pose animations
├── terrain/
│   └── SlopeBuilder.ts      # Procedural slope mesh + tree generation
├── camera/
│   └── SkierCamera.ts       # Follow camera + FOV boost + Dutch tilt
└── ui/
    └── HUD.ts               # Speed display
```

See [PLAN.md](PLAN.md) for the full game design plan and roadmap.

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development docs.
