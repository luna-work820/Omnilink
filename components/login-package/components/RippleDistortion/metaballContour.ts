/**
 * Zero-allocation Marching Squares contour generator with quadratic Bezier midpoint smoothing,
 * plus shared viewport-space viscous metaball chain & sumi-ink trail physics so Page 2 and Page 3
 * share a single continuous fluid body across their boundary.
 */

const MAX_GRID_CELLS = 6400;
const MAX_EDGES = MAX_GRID_CELLS * 2 + 512;

const sharedNextEdge = new Int32Array(MAX_EDGES);
const sharedEdgeX = new Float32Array(MAX_EDGES);
const sharedEdgeY = new Float32Array(MAX_EDGES);
const sharedVisited = new Uint8Array(MAX_EDGES);
const sharedActiveEdges = new Int32Array(MAX_EDGES);
const sharedPtsX = new Float32Array(2500);
const sharedPtsY = new Float32Array(2500);

export interface SharedDroplet {
  clientX: number;
  clientY: number;
  vx: number;
  vy: number;
  r: number;
  targetR: number;
  life: number;
  maxLife: number;
}

export interface SharedInkTrailNode {
  clientX: number;
  clientY: number;
  vx: number;
  vy: number;
  r: number;
  maxR: number;
  age: number;
  maxAge: number;
  intensity: number;
}

export interface SharedChainNode {
  clientX: number;
  clientY: number;
  vx: number;
  vy: number;
  baseR: number;
}

class SharedFluidChainManager {
  public pointerClientX = 640;
  public pointerClientY = 420;
  public targetClientX = 640;
  public targetClientY = 420;
  public anchorClientX = 640;
  public anchorClientY = 420;
  public vx = 0;
  public vy = 0;
  public lastSpawnClientX = 640;
  public lastSpawnClientY = 420;
  public lastMoveTime = -10000;
  private lastStepFrameTime = -1;
  private initialized = false;

  public readonly chain: SharedChainNode[] = [62, 53, 44, 36, 29, 23, 17].map(
    (baseR, idx) => ({
      clientX: 640 - idx * 14,
      clientY: 420 + idx * 7,
      vx: 0,
      vy: 0,
      baseR,
    })
  );

  public readonly droplets: SharedDroplet[] = [];
  public readonly inkTrail: SharedInkTrailNode[] = [];

  public initIfNeeded() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    const cx = window.innerWidth * 0.52;
    const cy = window.innerHeight * 0.42;
    this.pointerClientX = cx;
    this.pointerClientY = cy;
    this.targetClientX = cx;
    this.targetClientY = cy;
    this.anchorClientX = cx;
    this.anchorClientY = cy;
    this.lastSpawnClientX = cx;
    this.lastSpawnClientY = cy;

    this.chain.forEach((n, idx) => {
      n.clientX = cx - idx * 14;
      n.clientY = cy + idx * 7;
    });

    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
  }

  private handlePointerMove = (e: PointerEvent) => {
    const nx = e.clientX;
    const ny = e.clientY;
    const dx = nx - this.pointerClientX;
    const dy = ny - this.pointerClientY;
    const dist = Math.hypot(dx, dy);

    this.targetClientX = nx;
    this.targetClientY = ny;
    this.anchorClientX = nx;
    this.anchorClientY = ny;
    this.lastMoveTime = performance.now();

    const trailDist = Math.hypot(
      nx - this.lastSpawnClientX,
      ny - this.lastSpawnClientY
    );
    if (trailDist > 12) {
      const moveAngle = Math.atan2(
        ny - this.lastSpawnClientY,
        nx - this.lastSpawnClientX
      );
      const speed = Math.min(trailDist, 45);
      this.inkTrail.push({
        clientX: this.pointerClientX,
        clientY: this.pointerClientY,
        vx: -Math.cos(moveAngle) * speed * 0.03 + (Math.random() - 0.5) * 0.35,
        vy: -Math.sin(moveAngle) * speed * 0.03 + (Math.random() - 0.5) * 0.35,
        r: 48 + Math.min(speed * 0.4, 20),
        maxR: 112 + Math.min(speed * 0.85, 42),
        age: 0,
        maxAge: 52 + Math.random() * 18,
        intensity: Math.min(1, 0.58 + speed * 0.01),
      });
      if (this.inkTrail.length > 28) {
        this.inkTrail.shift();
      }
      this.lastSpawnClientX = nx;
      this.lastSpawnClientY = ny;
    }

    if (dist > 15 && this.droplets.length < 10) {
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.85;
      const speed = Math.min(dist * 0.12, 4.5);
      this.droplets.push({
        clientX: this.chain[0].clientX + (Math.random() - 0.5) * 22,
        clientY: this.chain[0].clientY + (Math.random() - 0.5) * 22,
        vx: -Math.cos(angle) * speed * 0.35,
        vy: -Math.sin(angle) * speed * 0.35,
        r: 8,
        targetR: 18 + Math.random() * 18,
        life: 0,
        maxLife: 34 + Math.random() * 22,
      });
    }
  };

  /**
   * Steps the shared viewport-space fluid chain once per animation frame
   */
  public step(now: number, t: number) {
    this.initIfNeeded();
    if (Math.abs(now - this.lastStepFrameTime) < 4) {
      return;
    }
    this.lastStepFrameTime = now;

    const idleSec = (now - this.lastMoveTime) * 0.001;
    let goalX = this.targetClientX;
    let goalY = this.targetClientY;

    if (idleSec > 1.2) {
      goalX =
        this.anchorClientX + Math.sin(t * 1.1) * 22 + Math.cos(t * 0.65) * 12;
      goalY =
        this.anchorClientY + Math.cos(t * 0.9) * 18 + Math.sin(t * 1.35) * 10;
    }

    this.vx = (goalX - this.pointerClientX) * 0.22;
    this.vy = (goalY - this.pointerClientY) * 0.22;
    this.pointerClientX += this.vx;
    this.pointerClientY += this.vy;

    this.chain.forEach((node, idx) => {
      const targetX =
        idx === 0 ? this.pointerClientX : this.chain[idx - 1].clientX;
      const targetY =
        idx === 0 ? this.pointerClientY : this.chain[idx - 1].clientY;
      const spring = [0.26, 0.19, 0.15, 0.12, 0.095, 0.075, 0.06][idx];
      const damping = 0.72;
      node.vx = (node.vx + (targetX - node.clientX) * spring) * damping;
      node.vy = (node.vy + (targetY - node.clientY) * spring) * damping;
      node.clientX += node.vx;
      node.clientY += node.vy;
    });

    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.life += 1;
      d.clientX += d.vx;
      d.clientY += d.vy;
      d.vx *= 0.94;
      d.vy *= 0.94;

      const progress = d.life / d.maxLife;
      if (progress < 0.25) {
        d.r += (d.targetR - d.r) * 0.25;
      } else {
        d.r = d.targetR * Math.max(0, 1 - (progress - 0.25) / 0.75);
      }

      if (d.life >= d.maxLife || d.r < 2) {
        this.droplets.splice(i, 1);
      }
    }

    for (let i = 0; i < this.inkTrail.length; i++) {
      const node = this.inkTrail[i];
      node.age += 1;
      node.clientX += node.vx;
      node.clientY += node.vy;
      node.vx *= 0.96;
      node.vy *= 0.96;

      if (node.age >= node.maxAge) {
        this.inkTrail.splice(i, 1);
        i--;
      }
    }
  }
}

export const sharedFluidChain = new SharedFluidChainManager();

export function buildMetaballPath(
  field: Float32Array,
  cols: number,
  rows: number,
  minX: number,
  minY: number,
  cellW: number,
  cellH: number,
  threshold: number
): string {
  const numH = (rows + 1) * (cols + 1);
  const totalEdges = numH * 2;
  if (totalEdges > MAX_EDGES) return "";

  let activeCount = 0;

  const hEdgeId = (gx: number, gy: number) => gy * (cols + 1) + gx;
  const vEdgeId = (gx: number, gy: number) => numH + gy * (cols + 1) + gx;

  const addSegment = (
    fromId: number,
    fx: number,
    fy: number,
    toId: number,
    tx: number,
    ty: number
  ) => {
    sharedEdgeX[fromId] = fx;
    sharedEdgeY[fromId] = fy;
    sharedEdgeX[toId] = tx;
    sharedEdgeY[toId] = ty;
    sharedNextEdge[fromId] = toId;
    sharedVisited[fromId] = 0;
    sharedVisited[toId] = 0;
    sharedActiveEdges[activeCount++] = fromId;
  };

  for (let gy = 0; gy < rows; gy++) {
    const rowOffset = gy * (cols + 1);
    const nextRowOffset = (gy + 1) * (cols + 1);
    const y0 = minY + gy * cellH;
    const y1 = minY + (gy + 1) * cellH;

    for (let gx = 0; gx < cols; gx++) {
      const v0 = field[rowOffset + gx];
      const v1 = field[rowOffset + gx + 1];
      const v2 = field[nextRowOffset + gx + 1];
      const v3 = field[nextRowOffset + gx];

      const mask =
        (v0 >= threshold ? 1 : 0) |
        (v1 >= threshold ? 2 : 0) |
        (v2 >= threshold ? 4 : 0) |
        (v3 >= threshold ? 8 : 0);

      if (mask === 0 || mask === 15) continue;

      const x0 = minX + gx * cellW;
      const x1 = minX + (gx + 1) * cellW;

      const interp = (va: number, vb: number) => {
        const denom = vb - va;
        if (Math.abs(denom) < 1e-5) return 0.5;
        const t = (threshold - va) / denom;
        return t < 0 ? 0 : t > 1 ? 1 : t;
      };

      const topId = hEdgeId(gx, gy);
      const rightId = vEdgeId(gx + 1, gy);
      const bottomId = hEdgeId(gx, gy + 1);
      const leftId = vEdgeId(gx, gy);

      const topX = x0 + interp(v0, v1) * cellW;
      const topY = y0;

      const rightX = x1;
      const rightY = y0 + interp(v1, v2) * cellH;

      const bottomX = x0 + interp(v3, v2) * cellW;
      const bottomY = y1;

      const leftX = x0;
      const leftY = y0 + interp(v0, v3) * cellH;

      switch (mask) {
        case 1:
          addSegment(leftId, leftX, leftY, topId, topX, topY);
          break;
        case 2:
          addSegment(topId, topX, topY, rightId, rightX, rightY);
          break;
        case 3:
          addSegment(leftId, leftX, leftY, rightId, rightX, rightY);
          break;
        case 4:
          addSegment(rightId, rightX, rightY, bottomId, bottomX, bottomY);
          break;
        case 5:
          addSegment(leftId, leftX, leftY, topId, topX, topY);
          addSegment(rightId, rightX, rightY, bottomId, bottomX, bottomY);
          break;
        case 6:
          addSegment(topId, topX, topY, bottomId, bottomX, bottomY);
          break;
        case 7:
          addSegment(leftId, leftX, leftY, bottomId, bottomX, bottomY);
          break;
        case 8:
          addSegment(bottomId, bottomX, bottomY, leftId, leftX, leftY);
          break;
        case 9:
          addSegment(bottomId, bottomX, bottomY, topId, topX, topY);
          break;
        case 10:
          addSegment(topId, topX, topY, rightId, rightX, rightY);
          addSegment(bottomId, bottomX, bottomY, leftId, leftX, leftY);
          break;
        case 11:
          addSegment(bottomId, bottomX, bottomY, rightId, rightX, rightY);
          break;
        case 12:
          addSegment(rightId, rightX, rightY, leftId, leftX, leftY);
          break;
        case 13:
          addSegment(rightId, rightX, rightY, topId, topX, topY);
          break;
        case 14:
          addSegment(topId, topX, topY, leftId, leftX, leftY);
          break;
      }
    }
  }

  if (activeCount === 0) return "";

  let pathStr = "";

  for (let i = 0; i < activeCount; i++) {
    const startEdge = sharedActiveEdges[i];
    if (sharedVisited[startEdge]) continue;

    let ptCount = 0;
    let curr = startEdge;

    while (curr !== -1 && !sharedVisited[curr] && ptCount < 2400) {
      sharedVisited[curr] = 1;
      sharedPtsX[ptCount] = sharedEdgeX[curr];
      sharedPtsY[ptCount] = sharedEdgeY[curr];
      const next = sharedNextEdge[curr];
      sharedNextEdge[curr] = -1;
      curr = next;
      ptCount++;
    }

    if (ptCount < 3) continue;

    const startMidX = (sharedPtsX[ptCount - 1] + sharedPtsX[0]) * 0.5;
    const startMidY = (sharedPtsY[ptCount - 1] + sharedPtsY[0]) * 0.5;
    pathStr += `M ${startMidX.toFixed(1)} ${startMidY.toFixed(1)} `;

    for (let k = 0; k < ptCount; k++) {
      const nextIdx = (k + 1) % ptCount;
      const midX = (sharedPtsX[k] + sharedPtsX[nextIdx]) * 0.5;
      const midY = (sharedPtsY[k] + sharedPtsY[nextIdx]) * 0.5;
      pathStr += `Q ${sharedPtsX[k].toFixed(1)} ${sharedPtsY[k].toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)} `;
    }
    pathStr += "Z ";
  }

  return pathStr.trim();
}
