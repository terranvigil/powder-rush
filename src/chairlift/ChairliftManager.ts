import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateLines } from "@babylonjs/core/Meshes/Builders/linesBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";
import { hash } from "../terrain/Noise";

const CABLE_SPEED = 2.3; // m/s — typical fixed-grip lift
const LATERAL_OFFSET = 8; // meters right of slope edge
const TOWER_HEIGHT = 10; // meters above terrain
const CROSSARM_WIDTH = 5; // meters
const CHAIR_SPACING = 14; // meters between chairs
const CABLE_SAG = 1.8; // meters sag at midpoint between towers
const STRAND_SEP = 4; // lateral separation between up/down cable strands
const VISIBILITY = 250; // meters from player to render chairs

// Lift line endpoints
const TOP_Z = -40;
const BOTTOM_Z = -1160;
const TOWER_COUNT = 12;

export class ChairliftManager {
  private scene: Scene;
  private slopeFunction: SlopeFunction;
  private spline: SlopeSpline;

  private root: TransformNode;

  // Cable paths (dense polylines)
  private uphillPath: Vector3[] = [];
  private uphillDist: number[] = [];
  private downhillPath: Vector3[] = [];
  private downhillDist: number[] = [];
  private totalLength = 0;

  // Chair instances
  private uphillChairs: { pos: InstancedMesh; riders: InstancedMesh[] }[] = [];
  private downhillChairs: { pos: InstancedMesh; riders: InstancedMesh[] }[] = [];
  private totalChairs = 0;

  // Tower positions for pole lights
  private towerPositions: Vector3[] = [];

  // Animation
  private animTime = 0;

  constructor(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    shadowGen: ShadowGenerator,
  ) {
    this.scene = scene;
    this.slopeFunction = slopeFunction;
    this.spline = spline;

    this.root = new TransformNode("chairlift", scene);

    // Materials
    const steelMat = this.makeMat("steel", new Color3(0.35, 0.35, 0.38));
    const chairMat = this.makeMat("chair", new Color3(0.75, 0.18, 0.12));
    const riderMat = this.makeMat("rider", new Color3(0.15, 0.2, 0.35));

    // Build infrastructure
    const towerTops = this.buildTowers(steelMat, shadowGen);
    this.buildCablePaths(towerTops);
    this.buildCableLines();
    this.buildChairs(chairMat, riderMat);
  }

  private makeMat(name: string, color: Color3): StandardMaterial {
    const mat = new StandardMaterial(`lift_${name}`, this.scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.12, 0.12, 0.12);
    return mat;
  }

  /** X position for the lift line at a given Z */
  private liftXAt(z: number): number {
    return this.spline.centerXAt(z) - this.spline.halfWidthAt(z) - LATERAL_OFFSET;
  }

  // ── Towers ──────────────────────────────────────────────

  private buildTowers(mat: StandardMaterial, shadowGen: ShadowGenerator): Vector3[] {
    const towerTops: Vector3[] = [];

    for (let i = 0; i < TOWER_COUNT; i++) {
      const t = i / (TOWER_COUNT - 1);
      const z = TOP_Z + (BOTTOM_Z - TOP_Z) * t;
      const x = this.liftXAt(z);
      const groundY = this.slopeFunction.heightAt(x, z);
      const topY = groundY + TOWER_HEIGHT;

      // Pole
      const pole = CreateCylinder(`liftPole_${i}`, {
        height: TOWER_HEIGHT, diameter: 0.35, tessellation: 8,
      }, this.scene);
      pole.material = mat;
      pole.position.set(x, groundY + TOWER_HEIGHT / 2, z);
      pole.parent = this.root;
      shadowGen.addShadowCaster(pole);

      // Crossarm
      const arm = CreateBox(`liftArm_${i}`, {
        width: CROSSARM_WIDTH + STRAND_SEP, height: 0.25, depth: 0.25,
      }, this.scene);
      arm.material = mat;
      arm.position.set(x, topY, z);
      arm.parent = this.root;
      shadowGen.addShadowCaster(arm);

      towerTops.push(new Vector3(x, topY, z));
      this.towerPositions.push(new Vector3(x, topY, z));
    }

    // Terminal buildings (simple box structures)
    this.buildStation(mat, TOP_Z);
    this.buildStation(mat, BOTTOM_Z);

    return towerTops;
  }

  private buildStation(mat: StandardMaterial, z: number): void {
    const x = this.liftXAt(z);
    const groundY = this.slopeFunction.heightAt(x, z);
    const station = CreateBox("liftStation", {
      width: 5, height: 3.5, depth: 3.5,
    }, this.scene);
    station.material = mat;
    station.position.set(x, groundY + 1.75, z);
    station.parent = this.root;
  }

  // ── Cable paths ─────────────────────────────────────────

  private buildCablePaths(towerTops: Vector3[]): void {
    // Uphill: bottom → top (reversed tower order), far strand (+X)
    const reversed = [...towerTops].reverse();
    this.uphillPath = this.interpolatePath(reversed, STRAND_SEP / 2);
    this.uphillDist = this.cumulativeDistances(this.uphillPath);

    // Downhill: top → bottom (natural tower order), near strand (-X)
    this.downhillPath = this.interpolatePath(towerTops, -STRAND_SEP / 2);
    this.downhillDist = this.cumulativeDistances(this.downhillPath);

    this.totalLength = this.uphillDist[this.uphillDist.length - 1];
    this.totalChairs = Math.floor(this.totalLength / CHAIR_SPACING);
  }

  private interpolatePath(towers: Vector3[], xOffset: number): Vector3[] {
    const path: Vector3[] = [];

    for (let t = 0; t < towers.length - 1; t++) {
      const p0 = towers[t];
      const p1 = towers[t + 1];
      const span = Vector3.Distance(p0, p1);
      const steps = Math.max(5, Math.ceil(span / 12));

      for (let s = 0; s <= steps; s++) {
        if (t > 0 && s === 0) continue; // avoid duplicate point at tower
        const frac = s / steps;
        const sag = CABLE_SAG * 4 * frac * (1 - frac);
        path.push(new Vector3(
          p0.x + (p1.x - p0.x) * frac + xOffset,
          p0.y + (p1.y - p0.y) * frac - sag,
          p0.z + (p1.z - p0.z) * frac,
        ));
      }
    }
    return path;
  }

  private cumulativeDistances(path: Vector3[]): number[] {
    const d: number[] = [0];
    for (let i = 1; i < path.length; i++) {
      d.push(d[i - 1] + Vector3.Distance(path[i - 1], path[i]));
    }
    return d;
  }

  // ── Cable line meshes ───────────────────────────────────

  private buildCableLines(): void {
    const cableColor = new Color3(0.2, 0.2, 0.22);
    const up = CreateLines("uphillCable", { points: this.uphillPath }, this.scene);
    up.color = cableColor;
    up.parent = this.root;

    const down = CreateLines("downhillCable", { points: this.downhillPath }, this.scene);
    down.color = cableColor;
    down.parent = this.root;
  }

  // ── Chair instances ─────────────────────────────────────

  private buildChairs(chairMat: StandardMaterial, riderMat: StandardMaterial): void {
    const steelMat = this.makeMat("chairSteel", new Color3(0.4, 0.4, 0.42));

    // Build a merged chair prototype: hanger + seat + backrest + footrest bar
    const hanger = CreateCylinder("_hanger", { height: 1.2, diameter: 0.08, tessellation: 6 }, this.scene);
    hanger.material = steelMat;
    hanger.position.set(0, -0.6, 0);

    const seat = CreateBox("_seat", { width: 1.8, height: 0.1, depth: 0.5 }, this.scene);
    seat.material = chairMat;
    seat.position.set(0, -1.2, 0);

    const back = CreateBox("_back", { width: 1.8, height: 0.6, depth: 0.08 }, this.scene);
    back.material = chairMat;
    back.position.set(0, -0.95, -0.25);

    const armL = CreateBox("_armL", { width: 0.08, height: 0.08, depth: 0.4 }, this.scene);
    armL.material = steelMat;
    armL.position.set(-0.9, -1.15, 0.0);
    const armR = CreateBox("_armR", { width: 0.08, height: 0.08, depth: 0.4 }, this.scene);
    armR.material = steelMat;
    armR.position.set(0.9, -1.15, 0.0);

    const footrest = CreateCylinder("_foot", { height: 1.6, diameter: 0.06, tessellation: 6 }, this.scene);
    footrest.material = steelMat;
    footrest.rotation.z = Math.PI / 2;
    footrest.position.set(0, -1.7, 0.2);

    const chairProto = Mesh.MergeMeshes(
      [hanger, seat, back, armL, armR, footrest], true, true, undefined, false, true,
    )!;
    chairProto.name = "_chairP";
    chairProto.isVisible = false;
    chairProto.setEnabled(false);

    // Rider prototype — seated figure (torso + head block)
    const rTorso = CreateBox("_rT", { width: 0.4, height: 0.5, depth: 0.3 }, this.scene);
    rTorso.material = riderMat;
    rTorso.position.set(0, 0.25, 0);
    const rHead = CreateSphere("_rH", { diameter: 0.25, segments: 8 }, this.scene);
    rHead.material = riderMat;
    rHead.position.set(0, 0.6, 0);
    const rLegs = CreateBox("_rL", { width: 0.35, height: 0.15, depth: 0.5 }, this.scene);
    rLegs.material = riderMat;
    rLegs.position.set(0, -0.02, 0.15);

    const riderProto = Mesh.MergeMeshes(
      [rTorso, rHead, rLegs], true, true, undefined, false, true,
    )!;
    riderProto.name = "_riderP";
    riderProto.isVisible = false;
    riderProto.setEnabled(false);

    for (let i = 0; i < this.totalChairs; i++) {
      // Decide rider count: 80% occupied, ~40% have 2 riders, ~40% have 1
      const h = hash(i * 7 + 3000);
      const riderCount = h < 0.2 ? 0 : h < 0.6 ? 1 : 2;

      // Uphill chair + riders
      const uc = chairProto.createInstance(`uc${i}`);
      uc.parent = this.root;
      uc.setEnabled(false);

      const uRiders: InstancedMesh[] = [];
      for (let r = 0; r < riderCount; r++) {
        const ur = riderProto.createInstance(`ur${i}_${r}`);
        ur.parent = this.root;
        ur.setEnabled(false);
        uRiders.push(ur);
      }
      this.uphillChairs.push({ pos: uc, riders: uRiders });

      // Downhill chair — same rider count (riding back down)
      const h2 = hash(i * 7 + 3100);
      const downRiderCount = h2 < 0.2 ? 0 : h2 < 0.6 ? 1 : 2;

      const dc = chairProto.createInstance(`dc${i}`);
      dc.parent = this.root;
      dc.setEnabled(false);

      const dRiders: InstancedMesh[] = [];
      for (let r = 0; r < downRiderCount; r++) {
        const dr = riderProto.createInstance(`dr${i}_${r}`);
        dr.parent = this.root;
        dr.setEnabled(false);
        dRiders.push(dr);
      }
      this.downhillChairs.push({ pos: dc, riders: dRiders });
    }
  }

  // ── Path interpolation ──────────────────────────────────

  private samplePath(path: Vector3[], distances: number[], dist: number): Vector3 {
    const d = ((dist % this.totalLength) + this.totalLength) % this.totalLength;
    // Binary search
    let lo = 0;
    let hi = distances.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (distances[mid] <= d) lo = mid;
      else hi = mid;
    }
    const segLen = distances[hi] - distances[lo];
    const t = segLen > 0 ? (d - distances[lo]) / segLen : 0;
    return Vector3.Lerp(path[lo], path[hi], t);
  }

  // ── Frame update ────────────────────────────────────────

  update(playerZ: number, dt: number): void {
    if (!this.root.isEnabled()) return;

    this.animTime += dt;
    const baseOffset = (this.animTime * CABLE_SPEED) % this.totalLength;

    for (let i = 0; i < this.totalChairs; i++) {
      // Uphill chairs (moving bottom → top)
      const uDist = baseOffset + i * CHAIR_SPACING;
      const uPos = this.samplePath(this.uphillPath, this.uphillDist, uDist);
      const uVisible = Math.abs(uPos.z - playerZ) < VISIBILITY;

      const uc = this.uphillChairs[i];
      uc.pos.setEnabled(uVisible);
      for (let r = 0; r < uc.riders.length; r++) {
        uc.riders[r].setEnabled(uVisible);
        if (uVisible) {
          const xOff = uc.riders.length === 2 ? (r === 0 ? -0.35 : 0.35) : 0;
          uc.riders[r].position.set(uPos.x + xOff, uPos.y - 0.95, uPos.z);
        }
      }
      if (uVisible) {
        uc.pos.position.set(uPos.x, uPos.y, uPos.z);
      }

      // Downhill chairs (moving top → bottom, reverse direction)
      const dDist = this.totalLength - baseOffset + i * CHAIR_SPACING;
      const dPos = this.samplePath(this.downhillPath, this.downhillDist, dDist);
      const dVisible = Math.abs(dPos.z - playerZ) < VISIBILITY;

      const dc = this.downhillChairs[i];
      dc.pos.setEnabled(dVisible);
      for (let r = 0; r < dc.riders.length; r++) {
        dc.riders[r].setEnabled(dVisible);
        if (dVisible) {
          const xOff = dc.riders.length === 2 ? (r === 0 ? -0.35 : 0.35) : 0;
          dc.riders[r].position.set(dPos.x + xOff, dPos.y - 0.95, dPos.z);
        }
      }
      if (dVisible) {
        dc.pos.position.set(dPos.x, dPos.y, dPos.z);
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.root.setEnabled(enabled);
  }

  isEnabled(): boolean {
    return this.root.isEnabled();
  }

  /** Add warm point lights to every other tower pole (for night levels) */
  addPoleLights(): void {
    const lightMat = new StandardMaterial("poleLightMat", this.scene);
    lightMat.emissiveColor = new Color3(1.0, 0.85, 0.5);
    lightMat.diffuseColor = new Color3(0, 0, 0);
    lightMat.disableLighting = true;

    for (let i = 0; i < this.towerPositions.length; i += 2) {
      const tp = this.towerPositions[i];

      // Small glowing sphere on the pole top
      const bulb = CreateSphere(`poleBulb_${i}`, { diameter: 0.6, segments: 6 }, this.scene);
      bulb.material = lightMat;
      bulb.position.set(tp.x, tp.y + 0.3, tp.z);
      bulb.parent = this.root;
      bulb.isPickable = false;

      // Point light casting warm glow downward
      const light = new PointLight(`poleLight_${i}`, new Vector3(tp.x, tp.y + 0.5, tp.z), this.scene);
      light.diffuse = new Color3(1.0, 0.85, 0.5);
      light.intensity = 1.5;
      light.range = 40;
    }
  }
}
