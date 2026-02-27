# Powder Rush — Skiing Physics Reference

## Forces Acting on a Skier

Three forces govern a skier's motion:

### 1. Gravity (drives acceleration)
```
F_gravity_parallel = m * g * sin(slope_angle)
a_gravity = g * sin(slope_angle)
```
When traversing (not pointing straight downhill):
```
a_effective = g * sin(slope_angle) * cos(traverse_angle)
```
- 0° traverse (straight downhill) = full acceleration
- 45° traverse = ~71% acceleration
- 90° traverse (across slope) = 0 forward acceleration

### 2. Snow Friction (constant deceleration)
```
F_friction = mu * m * g * cos(slope_angle)
a_friction = mu * g * cos(slope_angle)
```
| Snow Condition | mu (kinetic) |
|---|---|
| Hard/spring snow | 0.005 |
| Groomed hardpack, warm | 0.02-0.03 |
| Normal groomed | 0.03-0.04 |
| Fresh cold snow | 0.035 |
| Wet snow | 0.05-0.10 |

For the game, **mu = 0.04** is a good default for groomed runs. This gives ~0.38 m/s² constant deceleration on typical slopes.

### 3. Aerodynamic Drag (speed-squared deceleration)
```
F_drag = 0.5 * Cd * rho * A * v²
a_drag = (Cd * rho * A * v²) / (2 * m)
```
Where:
- `Cd × A` = drag area (m²) — the key parameter
- `rho` = air density = 1.2 kg/m³
- `m` = skier mass = 75 kg

| Stance | Cd×A (m²) | Description |
|---|---|---|
| Full tuck | 0.15 | Crouched, poles tucked, minimal frontal area |
| Racing crouch | 0.30 | Low position but actively skiing |
| Normal skiing | 0.50 | Upright recreational stance |
| Upright/wide | 0.70 | Standing tall |
| Max drag (braking) | 0.90 | Arms out, maximum area |

Tuck reduces drag by **~70%** vs normal stance.

### Combined Equation of Motion
```
a = g*sin(θ) - μ*g*cos(θ) - (Cd*ρ*A*v²)/(2*m)
```

### Terminal Velocity
Speed where drag + friction = gravity pull:
```
v_terminal = sqrt( 2*m*g*(sin(θ) - μ*cos(θ)) / (Cd*ρ*A) )
```
| Scenario | v_terminal |
|---|---|
| 10° slope, normal stance (CdA=0.5) | 18 m/s (65 km/h) |
| 15° slope, normal stance | 24 m/s (86 km/h) |
| 20° slope, tuck (CdA=0.15) | 40 m/s (144 km/h) |
| 25° slope, tuck | 57 m/s (205 km/h) |

---

## Turning Physics

### Sidecut Radius & Turn Radius
Skis have a built-in curve (sidecut). When tipped on edge, the sidecut bends the ski into an arc:
```
R_turn = R_sidecut * cos(edge_angle)
```
- Typical all-mountain sidecut: 14-18 m
- Edge angle ≈ lean angle on hard snow
- At 0° edge (flat ski): turn radius = sidecut radius
- At 60° edge: turn radius = half sidecut radius

### Centripetal Force
A turn requires centripetal force provided by edge grip:
```
F_centripetal = m * v² / R
```
If `m * v² / R` exceeds available grip → the ski slides out sideways.

This means:
- **Higher speed + same radius = more centripetal force needed = more likely to slide**
- **Tighter radius + same speed = more likely to slide**

### Lean Angle (Balance in Turns)
The skier leans to balance centripetal and gravitational forces:
```
tan(lean_angle) = v² / (R * g * cos(slope_angle))
```
| Level | Lean Angle Range |
|---|---|
| Recreational | 20-40° |
| Aggressive/expert | 40-60° |
| World Cup racer | 60-70°+ |

### Carved vs Skidded Turns

**Carved turn**: Ski edge cuts a clean arc. Tail follows tip exactly. Minimal speed loss — only from reduced gravity component when turning away from fall line. Requires speed and edge angle.

**Skidded turn**: Ski slides laterally while turning. Displaces snow. Significant braking force. Used for speed control and sharp low-speed direction changes.

Most real turns are a **blend** of carving and skidding.

### Speed Loss in Turns
- **Carved**: Minimal loss. Speed drops only because heading deviates from fall line (less gravitational acceleration).
- **Skidded**: Lateral friction does negative work. The lateral velocity component is bled off by friction, removing kinetic energy. Sharper skid angle = more speed loss.
- The braking effect of a turn scales with the **lateral velocity component**, not with speed².

### Hockey Stop
Skis turned 90° to velocity. Maximum lateral friction. Can stop from 30 km/h in 3-5 meters. Braking force depends on edge pressure and snow hardness, NOT on speed² (unlike aero drag).

---

## Jump Mechanics

### Pre-jump (Loading)
Skier bends knees, lowering center of mass. Stores elastic energy.

### Takeoff (Extension)
Rapid leg extension at the lip. Force during extension can reach 2-3× body weight. Adds vertical velocity beyond terrain-provided trajectory.

### Airborne
Standard projectile motion:
```
x(t) = v_x * t
y(t) = v_y * t - 0.5 * g * t²
```

### Landing
- Landing on downslope = softer (trajectory matches slope angle)
- Landing on flat = harder impact
- Good technique absorbs 3-4× body weight via knee bend

---

## Speed Ranges (Real World)

| Category | km/h | m/s |
|---|---|---|
| Beginner snowplow | 8-15 | 2-4 |
| Cautious recreational | 15-30 | 4-8 |
| Average recreational | 30-50 | 8-14 |
| Confident recreational | 50-70 | 14-19 |
| Expert/aggressive | 70-100 | 19-28 |
| Racing (non-Olympic) | 80-115 | 22-32 |
| World Cup downhill | 120-155 | 33-43 |

**Average recreational skier: 48 km/h (13.4 m/s).** Skiing at 40 km/h feels much faster than driving at 40 km/h due to exposure, proximity to ground, and wind.

---

## Slope Grades

| Trail Rating | Gradient | Angle | g×sin(θ) |
|---|---|---|---|
| Green (beginner) | 6-25% | 3-14° | 0.5-2.4 m/s² |
| Blue (intermediate) | 25-40% | 14-22° | 2.4-3.7 m/s² |
| Black (expert) | 45-70% | 24-35° | 4.0-5.6 m/s² |
| Double black | 70-100%+ | 35-45°+ | 5.6-6.9 m/s² |

### Game's Current Slopes
- Spline steepness: 0.10-0.22 gradient = **5.7°-12.4°** (green to easy blue)
- `g×sin(θ)` range: 0.97-2.10 m/s²

---

## Game Implementation Notes

### Current Physics Model (`PlayerController.ts`)

**Drag**: `decel = dragCoeff × v² / mass` where `BASE_DRAG=0.002`, `TUCK_DRAG_MULTIPLIER=0.3`, `BRAKE_DRAG=0.06`. These are magic numbers, not physically derived.

**Edge grip**: Velocity is lerped toward heading direction each frame. `gripT = dynamicGrip × dt × 60`. Grip decreases with speed and steepness. This doesn't model centripetal force or lateral sliding correctly.

**Braking**: Applied as `BRAKE_DRAG=0.06` speed-squared drag. Weak at low speed, strong at high speed. Real braking (hockey stop) is effective at all speeds.

**Speed cap**: Hard `MAX_SPEED=30 m/s` instead of natural terminal velocity.

**Snow friction**: Handled only by Havok physics friction (0.05) on the sphere collider. No explicit `μ×g×cos(θ)` deceleration.

### Correct Implementation Approach

**Drag**: Use `a = (CdA × 1.2 × v²) / 150` with CdA values from the table above. This naturally produces correct terminal velocities without a hard speed cap.

**Turning**: Decompose velocity into forward (along heading) and lateral (perpendicular to heading) components. Apply edge friction to decay lateral component. Lateral friction costs speed (energy removal). Edge friction decreases with speed and steepness.

**Braking**: Model as intentional lateral sliding. Braking force from snow plowing, roughly constant with speed (not speed²). Effective at all speeds.

**Snow friction**: Add constant `μ × g × cos(θ)` deceleration. Important at low speeds where aero drag is negligible.

### Key Simulation Constants
```
g = 9.81          // m/s²
rho = 1.2         // kg/m³ (air density)
m = 75            // kg (skier mass)
mu = 0.04         // snow friction coefficient
R_sidecut = 15    // m (ski sidecut radius)

// Drag areas (Cd × A)
CdA_tuck = 0.15
CdA_normal = 0.50
CdA_brake = 0.90
```
