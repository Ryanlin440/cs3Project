// ================= Field / units =================
// All internal math is in CSS px; displayed values are field inches.
const PX_PER_IN = 6;
const FIELD_MIN = 20.5;
const FIELD_MAX = 863.5; // 20.5 + 843
const FIELD_CENTER = 442;

const ROBOT_WIDTH = 75;  // 12.5 in
const ROBOT_HEIGHT = 90; // 15 in

// ================= Physics constants =================
const MAX_SPEED = 10;
const ACCELERATION = 0.3;
const FRICTION = 0.95;
const TURN_SPEED = 4.5;
const TURN_ACCEL = 0.6;
const TURN_FRICTION = 0.92;

// ================= Sensor / noise constants =================
const MAX_SENSOR_RANGE = 473.04;    // 78.84 in * 6
const SENSOR_NOISE_SIGMA_IN = 0.5;  // distance sensor std dev (inches), applied every frame
const ODOM_TRANS_NOISE = 0.03;      // translation std dev as a fraction of distance moved
const ODOM_ROT_NOISE = 0.03;        // rotation std dev as a fraction of rotation
const ODOM_ROT_PER_IN = 0.02;       // extra heading std dev (deg) per inch driven

// Each sensor sits `offset` px from robot center, pointing `angle` deg from the robot's heading
const SENSORS = [
  { name: 'front', angle: 0,   offset: ROBOT_HEIGHT / 2 },
  { name: 'right', angle: 90,  offset: ROBOT_WIDTH / 2 },
  { name: 'left',  angle: -90, offset: ROBOT_WIDTH / 2 },
];

// ================= Math helpers =================
function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

function wrap360(deg) {
  return (deg % 360 + 360) % 360;
}

function wrap180(deg) {
  return wrap360(deg + 180) - 180;
}

// Standard normal sample (Box-Muller)
function gaussian() {//grab a sample from mu 0, std dev 1
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function cssToFieldX(px) {
  return (px - FIELD_CENTER) / PX_PER_IN;
}

function cssToFieldY(px) {
  return -(px - FIELD_CENTER) / PX_PER_IN;
}

// ================= Input =================
const keysPressed = {};

window.addEventListener('keydown', (e) => {
  keysPressed[e.key.toLowerCase()] = true;
  if (e.key.startsWith('Arrow')) e.preventDefault(); // stop the page from scrolling
});

window.addEventListener('keyup', (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});

// ================= Robot =================
class Robot {
  constructor(el, controls, x, y, heading) {
    this.el = el;
    this.controls = controls; // { forward, back, left, right, reset? }
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.forwardSpeed = 0;
    this.angularVelocity = 0;
    this.visible = true;

    el.style.width = ROBOT_WIDTH + 'px';
    el.style.height = ROBOT_HEIGHT + 'px';
  }

  update() {
    const c = this.controls;

    let throttle = 0;
    if (keysPressed[c.forward]) throttle = 1;
    if (keysPressed[c.back]) throttle = -1;

    let turn = 0;
    if (keysPressed[c.right]) turn = 1;
    if (keysPressed[c.left]) turn = -1;

    if (throttle !== 0) this.forwardSpeed += throttle * ACCELERATION;
    else this.forwardSpeed *= FRICTION;

    if (turn !== 0) this.angularVelocity += turn * TURN_ACCEL;
    else this.angularVelocity *= TURN_FRICTION;

    this.forwardSpeed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.forwardSpeed));
    this.angularVelocity = Math.max(-TURN_SPEED, Math.min(TURN_SPEED, this.angularVelocity));

    if (Math.abs(this.forwardSpeed) < 0.05) this.forwardSpeed = 0;
    if (Math.abs(this.angularVelocity) < 0.05) this.angularVelocity = 0;

    this.heading = wrap360(this.heading + this.angularVelocity);

    const rad = degToRad(this.heading);
    this.x += this.forwardSpeed * Math.sin(rad);
    this.y += -this.forwardSpeed * Math.cos(rad);

    // Keep the rotated bounding box inside the field walls
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const halfWidth = (ROBOT_WIDTH * absCos + ROBOT_HEIGHT * absSin) / 2;
    const halfHeight = (ROBOT_WIDTH * absSin + ROBOT_HEIGHT * absCos) / 2;

    if (this.x - halfWidth < FIELD_MIN) {
      this.x = FIELD_MIN + halfWidth;
      this.forwardSpeed = 0;
    } else if (this.x + halfWidth > FIELD_MAX) {
      this.x = FIELD_MAX - halfWidth;
      this.forwardSpeed = 0;
    }

    if (this.y - halfHeight < FIELD_MIN) {
      this.y = FIELD_MIN + halfHeight;
      this.forwardSpeed = 0;
    } else if (this.y + halfHeight > FIELD_MAX) {
      this.y = FIELD_MAX - halfHeight;
      this.forwardSpeed = 0;
    }

    if (c.reset && keysPressed[c.reset]) {
      this.x = 200;
      this.y = 200;
      this.forwardSpeed = 0;
      this.angularVelocity = 0;
    }
  }

  render() {
    this.el.style.display = this.visible ? '' : 'none';
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.transform = `translate(-50%, -50%) rotate(${this.heading}deg)`;
  }

  get pose() {
    return { x: this.x, y: this.y, heading: this.heading };
  }
}

const robot1 = new Robot(
  document.getElementById('robot'),
  { forward: 'w', back: 's', left: 'a', right: 'd', reset: 'x' },
  442, 442, 0
);

const robot2 = new Robot(
  document.getElementById('robot2'),
  { forward: 'arrowup', back: 'arrowdown', left: 'arrowleft', right: 'arrowright' },
  650, 250, 0
);

const toggleBtn = document.getElementById('toggle-robot2');
toggleBtn.addEventListener('click', () => {
  robot2.visible = !robot2.visible;
  toggleBtn.textContent = robot2.visible ? 'Hide robot 2' : 'Show robot 2';
  toggleBtn.blur(); // so arrow keys / space don't re-trigger the button
});

// ================= Ray casting =================
// Distance along a ray (unit dir dx, dy) to a robot's rotated rectangle, or Infinity.
// Works in the robot's local frame with a slab test. Returns 0 if the origin is inside.
function rayRobotDistance(px, py, dx, dy, robot) {
  const rad = degToRad(robot.heading);
  const fx = Math.sin(rad), fy = -Math.cos(rad); // robot forward
  const rx = Math.cos(rad), ry = Math.sin(rad);  // robot right

  const ox = px - robot.x, oy = py - robot.y;
  const origin = [ox * rx + oy * ry, ox * fx + oy * fy]; // [along right, along forward]
  const dir = [dx * rx + dy * ry, dx * fx + dy * fy];
  const half = [ROBOT_WIDTH / 2, ROBOT_HEIGHT / 2];

  let tMin = -Infinity, tMax = Infinity;
  for (let i = 0; i < 2; i++) {
    if (Math.abs(dir[i]) < 1e-12) {
      if (Math.abs(origin[i]) > half[i]) return Infinity;
    } else {
      let t1 = (-half[i] - origin[i]) / dir[i];
      let t2 = (half[i] - origin[i]) / dir[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
    }
  }
  if (tMax < Math.max(tMin, 0)) return Infinity;
  return Math.max(tMin, 0);
}

// Cast a ray from (px, py) at a world angle against the walls and any obstacles.
// Returns { dist, hit } where hit is 'wall-x', 'wall-y' or 'robot', plus `wall`
// (the wall's x or y coordinate) for wall hits.
function castRay(px, py, angleDeg, obstacles = []) {
  const rad = degToRad(angleDeg);
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  let best = { dist: Infinity, hit: null, wall: null };

  if (Math.abs(dx) > 1e-12) {
    const wall = dx > 0 ? FIELD_MAX : FIELD_MIN;
    const t = (wall - px) / dx;
    if (t >= 0 && t < best.dist) best = { dist: t, hit: 'wall-x', wall };
  }
  if (Math.abs(dy) > 1e-12) {
    const wall = dy > 0 ? FIELD_MAX : FIELD_MIN;
    const t = (wall - py) / dy;
    if (t >= 0 && t < best.dist) best = { dist: t, hit: 'wall-y', wall };
  }
  for (const ob of obstacles) {
    const t = rayRobotDistance(px, py, dx, dy, ob);
    if (t < best.dist) best = { dist: t, hit: 'robot', wall: null };
  }
  return best;
}

function sensorOrigin(pose, sensor) {
  const rad = degToRad(pose.heading + sensor.angle);
  return {
    x: pose.x + sensor.offset * Math.sin(rad),
    y: pose.y - sensor.offset * Math.cos(rad),
  };
}

// Exact reading for one sensor at `pose`: { dist (px) or null if out of range, hit }
function perfectSensorReading(pose, sensor, obstacles) {
  const o = sensorOrigin(pose, sensor);
  const r = castRay(o.x, o.y, pose.heading + sensor.angle, obstacles);
  return r.dist <= MAX_SENSOR_RANGE ? { dist: r.dist, hit: r.hit } : { dist: null, hit: null };
}

// ================= Noisy odometry =================
// Integrates robot 1's true motion each frame with noise proportional to how far it
// moved, so it drifts while driving but stays perfectly still when the robot is still.
const odom = robot1.pose;
const prevTrue = robot1.pose;

// Returns the noisy increments it applied: { reset, u: [fwd px, lat px, dTheta rad] }
function updateOdometry() {
  const r = robot1;
  let result = { reset: false, u: [0, 0, 0] };
  if (keysPressed.x) {
    result.reset = true;
    // Reset teleports the robot; snap odometry to truth instead of counting it as motion
    odom.x = r.x; odom.y = r.y; odom.heading = r.heading;
  } else {
    const dxW = r.x - prevTrue.x;
    const dyW = r.y - prevTrue.y;
    const dTh = wrap180(r.heading - prevTrue.heading);

    // True motion in the robot frame (forward / right), using the mid-step heading
    const mid = degToRad(prevTrue.heading + dTh / 2);
    const fwd = dxW * Math.sin(mid) - dyW * Math.cos(mid);
    const lat = dxW * Math.cos(mid) + dyW * Math.sin(mid);
    const distIn = Math.hypot(fwd, lat) / PX_PER_IN;

    const nFwd = fwd + gaussian() * ODOM_TRANS_NOISE * Math.abs(fwd);
    const nLat = lat + gaussian() * ODOM_TRANS_NOISE * Math.abs(lat);
    const nTh = dTh + gaussian() * (ODOM_ROT_NOISE * Math.abs(dTh) + ODOM_ROT_PER_IN * distIn);

    // Apply the noisy body-frame motion to the odometry's own heading
    const oMid = degToRad(odom.heading + nTh / 2);
    odom.x += nFwd * Math.sin(oMid) + nLat * Math.cos(oMid);
    odom.y += -nFwd * Math.cos(oMid) + nLat * Math.sin(oMid);
    odom.heading = wrap360(odom.heading + nTh);
    result.u = [nFwd, nLat, degToRad(nTh)];
  }
  prevTrue.x = r.x; prevTrue.y = r.y; prevTrue.heading = r.heading;
  return result;
}

// ================= Pose from noisy distance sensors =================
// Heading comes from odometry (distance sensors alone can't give it). Each sensor that
// sees a wall pins down one axis: a hit on a left/right wall gives X, top/bottom gives Y.
// The estimator only knows about the walls, so it uses the odometry pose to decide which
// wall each beam is hitting. If a beam is actually hitting robot 2, the estimate is wrong,
// just like it would be on a real robot.
function estimatePoseFromSensors(noisy) {
  const h = odom.heading;
  const xs = [];
  const ys = [];

  SENSORS.forEach((s, i) => {
    const d = noisy[i];
    if (d === null) return;
    const phi = h + s.angle;
    const o = sensorOrigin(odom, s);
    const r = castRay(o.x, o.y, phi); // walls only
    if (r.hit === null) return;

    const reach = s.offset + d; // robot center to wall, along the beam
    const rad = degToRad(phi);
    if (r.hit === 'wall-x') xs.push(r.wall - reach * Math.sin(rad));
    else ys.push(r.wall + reach * Math.cos(rad));
  });

  const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
  return {
    x: xs.length ? avg(xs) : odom.x,
    y: ys.length ? avg(ys) : odom.y,
    heading: h,
    xFromSensors: xs.length > 0,
    yFromSensors: ys.length > 0,
  };
}

// ================= UKF prediction (covariance + sigma points) =================
// State s = [x px, y px, theta rad] (theta: 0 = up, clockwise positive, same as heading).
// Control u = noisy odometry increment [forward px, lateral px, dTheta rad].
// Only the PREDICT step is implemented: uncertainty grows as the robot drives and
// stays constant when it's still. Sensor correction comes later.
const UKF_N = 3;
const UKF_ALPHA = 1;   // spread of sigma points (1 = visible spread, good for visualization)
const UKF_BETA = 2;    // optimal for Gaussian
const UKF_KAPPA = 0;
const UKF_LAMBDA = UKF_ALPHA * UKF_ALPHA * (UKF_N + UKF_KAPPA) - UKF_N;
const UKF_GAMMA = Math.sqrt(UKF_N + UKF_LAMBDA);

// Weights for the 2n+1 sigma points
const UKF_WM = [UKF_LAMBDA / (UKF_N + UKF_LAMBDA)];
const UKF_WC = [UKF_LAMBDA / (UKF_N + UKF_LAMBDA) + (1 - UKF_ALPHA * UKF_ALPHA + UKF_BETA)];
for (let i = 0; i < 2 * UKF_N; i++) {
  UKF_WM.push(1 / (2 * (UKF_N + UKF_LAMBDA)));
  UKF_WC.push(1 / (2 * (UKF_N + UKF_LAMBDA)));
}

const ukf = {
  mean: [robot1.x, robot1.y, degToRad(robot1.heading)],
  P: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], // start perfectly known
  sigma: [],                            // latest propagated sigma points
};

function wrapPi(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Motion model: apply body-frame increment u to state s (mid-step heading)
function motionModel(s, u) {
  const phi = s[2] + u[2] / 2;
  return [
    s[0] + u[0] * Math.sin(phi) + u[1] * Math.cos(phi),
    s[1] - u[0] * Math.cos(phi) + u[1] * Math.sin(phi),
    s[2] + u[2],
  ];
}

// Lower-triangular Cholesky of a 3x3 symmetric PSD matrix (safe for zero/singular P)
function cholesky3(A) {
  const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(sum, 0));
      else L[i][j] = L[j][j] > 1e-12 ? sum / L[j][j] : 0;
    }
  }
  return L;
}

function makeSigmaPoints(mean, P) {
  const L = cholesky3(P);
  const pts = [mean.slice()];
  for (let j = 0; j < UKF_N; j++) {
    const col = [L[0][j], L[1][j], L[2][j]].map((v) => v * UKF_GAMMA);
    pts.push(mean.map((m, k) => m + col[k]));
    pts.push(mean.map((m, k) => m - col[k]));
  }
  return pts;
}

// Process noise in state space: Q_state = G * Q_u * G^T, where Q_u uses the same
// noise model as the simulated odometry and G = d(motionModel)/du at the mean.
function processNoise(mean, u) {
  const distIn = Math.hypot(u[0], u[1]) / PX_PER_IN;
  const sf = ODOM_TRANS_NOISE * Math.abs(u[0]);
  const sl = ODOM_TRANS_NOISE * Math.abs(u[1]);
  const st = degToRad(ODOM_ROT_NOISE * Math.abs(radToDeg(u[2])) + ODOM_ROT_PER_IN * distIn);
  const Qu = [sf * sf, sl * sl, st * st];

  const phi = mean[2] + u[2] / 2;
  const s = Math.sin(phi), c = Math.cos(phi);
  const G = [
    [s,  c, 0.5 * (u[0] * c - u[1] * s)],
    [-c, s, 0.5 * (u[0] * s + u[1] * c)],
    [0,  0, 1],
  ];

  const Q = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) Q[i][j] += G[i][k] * Qu[k] * G[j][k];
  return Q;
}

function ukfPredict(u) {
  // 1. Sigma points from current belief, pushed through the motion model
  const pts = makeSigmaPoints(ukf.mean, ukf.P).map((p) => motionModel(p, u));

  // 2. Weighted mean (circular mean for heading)
  let mx = 0, my = 0, ms = 0, mc = 0;
  pts.forEach((p, i) => {
    mx += UKF_WM[i] * p[0];
    my += UKF_WM[i] * p[1];
    ms += UKF_WM[i] * Math.sin(p[2]);
    mc += UKF_WM[i] * Math.cos(p[2]);
  });
  const mean = [mx, my, Math.atan2(ms, mc)];

  // 3. Weighted covariance + process noise
  const P = processNoise(mean, u);
  pts.forEach((p, i) => {
    const d = [p[0] - mean[0], p[1] - mean[1], wrapPi(p[2] - mean[2])];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) P[r][c] += UKF_WC[i] * d[r] * d[c];
  });

  ukf.mean = mean;
  ukf.P = P;
}

function ukfReset(pose) {
  ukf.mean = [pose.x, pose.y, degToRad(pose.heading)];
  ukf.P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  ukf.sigma = makeSigmaPoints(ukf.mean, ukf.P);
}

function radToDeg(r) {
  return r * 180 / Math.PI;
}

// ---- UKF correction step (distance sensors) ----
// Each sensor is applied as its own scalar update. The filter's measurement model only
// knows about the field walls, so readings that hit robot 2 look like outliers and are
// rejected by the gate below.
const SENSOR_R = (SENSOR_NOISE_SIGMA_IN * PX_PER_IN) ** 2; // measurement variance (px^2)
const GATE_CHI2 = 9; // reject readings more than 3 sigma from what the filter expected
let correctionEnabled = true;

// Expected reading for `sensor` if the robot were at state s (walls only)
function measureFromState(s, sensor) {
  const pose = { x: s[0], y: s[1], heading: radToDeg(s[2]) };
  const o = sensorOrigin(pose, sensor);
  return castRay(o.x, o.y, pose.heading + sensor.angle);
}

// Returns a status string per sensor: 'used' | 'outlier' | 'ambiguous' | 'no reading' | 'off'
function ukfUpdate(noisy) {
  return SENSORS.map((sensor, i) => {
    if (!correctionEnabled) return 'off';
    const z = noisy[i];
    if (z === null) return 'no reading';

    const pts = makeSigmaPoints(ukf.mean, ukf.P);
    const preds = pts.map((p) => measureFromState(p, sensor));

    // Measurement is only smooth if every sigma point sees the same wall, in range
    const key = preds[0].hit + preds[0].wall;
    if (preds.some((r) => r.dist > MAX_SENSOR_RANGE || r.hit + r.wall !== key)) return 'ambiguous';

    const Z = preds.map((r) => r.dist);
    const zBar = Z.reduce((acc, zi, k) => acc + UKF_WM[k] * zi, 0);

    // Innovation variance S and state/measurement cross-covariance Pxz
    let S = SENSOR_R;
    const Pxz = [0, 0, 0];
    pts.forEach((p, k) => {
      const dz = Z[k] - zBar;
      S += UKF_WC[k] * dz * dz;
      const dx = [p[0] - ukf.mean[0], p[1] - ukf.mean[1], wrapPi(p[2] - ukf.mean[2])];
      for (let r = 0; r < 3; r++) Pxz[r] += UKF_WC[k] * dx[r] * dz;
    });

    const innovation = z - zBar;
    if ((innovation * innovation) / S > GATE_CHI2) return 'outlier';

    // Kalman gain, then correct mean and shrink covariance: P -= K S K^T
    const K = Pxz.map((v) => v / S);
    ukf.mean = ukf.mean.map((m, r) => m + K[r] * innovation);
    ukf.mean[2] = wrapPi(ukf.mean[2]);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) ukf.P[r][c] -= K[r] * S * K[c];
    // keep P symmetric against rounding drift
    for (let r = 0; r < 3; r++)
      for (let c = r + 1; c < 3; c++) ukf.P[r][c] = ukf.P[c][r] = (ukf.P[r][c] + ukf.P[c][r]) / 2;

    return 'used';
  });
}

const correctionBtn = document.getElementById('toggle-correction');
correctionBtn.addEventListener('click', () => {
  correctionEnabled = !correctionEnabled;
  correctionBtn.textContent = 'Sensor correction: ' + (correctionEnabled ? 'ON' : 'OFF');
  correctionBtn.blur();
});

// ---- Drawing ----
const svg = document.getElementById('uncertainty');
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHI2_95_2DOF = 5.991; // 95% confidence ellipse for 2D (x, y)

function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  svg.appendChild(e);
  return e;
}

const ghostEl = svgEl('polygon', { class: 'ghost' });
const ellipseEl = svgEl('ellipse', { class: 'cov-ellipse' });
const sigmaEls = [];
for (let i = 0; i < 2 * UKF_N + 1; i++) {
  sigmaEls.push({
    tick: svgEl('line', { class: 'sigma-tick' }),
    dot: svgEl('circle', { class: i === 0 ? 'sigma-dot center' : 'sigma-dot', r: i === 0 ? 4 : 3 }),
  });
}

// Visual zoom for the ellipse + sigma points only (panel numbers stay true).
// Once sensors correct the estimate, uncertainty is a fraction of a pixel, so it
// has to be magnified to be visible.
let uncertaintyZoom = 30;
const zoomInput = document.getElementById('zoom');
zoomInput.addEventListener('input', () => {
  uncertaintyZoom = Number(zoomInput.value);
  setText('zoom-label', uncertaintyZoom + '×');
});

function drawUncertainty() {
  const [mx, my, th] = ukf.mean;
  const Z = uncertaintyZoom;

  // Ghost outline of the robot at the filter's estimated pose
  const s = Math.sin(th), c = Math.cos(th);
  const hw = ROBOT_WIDTH / 2, hh = ROBOT_HEIGHT / 2;
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) =>
    // u along robot right (c, s), v along robot back (-s, c) since screen y is down
    `${mx + u * c - v * s},${my + u * s + v * c}`
  );
  ghostEl.setAttribute('points', corners.join(' '));

  // 95% ellipse from the x/y block of P (eigen-decomposition of 2x2)
  const a = ukf.P[0][0], b = ukf.P[0][1], d = ukf.P[1][1];
  const tr = (a + d) / 2;
  const disc = Math.sqrt(((a - d) / 2) ** 2 + b * b);
  const l1 = Math.max(tr + disc, 0), l2 = Math.max(tr - disc, 0);
  const angle = radToDeg(0.5 * Math.atan2(2 * b, a - d));
  const k = Math.sqrt(CHI2_95_2DOF);
  ellipseEl.setAttribute('cx', mx);
  ellipseEl.setAttribute('cy', my);
  ellipseEl.setAttribute('rx', Z * k * Math.sqrt(l1));
  ellipseEl.setAttribute('ry', Z * k * Math.sqrt(l2));
  ellipseEl.setAttribute('transform', `rotate(${angle} ${mx} ${my})`);

  // Sigma points, each with a tick showing its heading. Their offset from the mean
  // (position and heading) is magnified by the same zoom as the ellipse.
  const pts = ukf.sigma.length ? ukf.sigma : makeSigmaPoints(ukf.mean, ukf.P);
  pts.forEach((p, i) => {
    const { tick, dot } = sigmaEls[i];
    const px = mx + Z * (p[0] - mx);
    const py = my + Z * (p[1] - my);
    const pth = th + Z * wrapPi(p[2] - th);
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', py);
    tick.setAttribute('x1', px);
    tick.setAttribute('y1', py);
    tick.setAttribute('x2', px + 22 * Math.sin(pth));
    tick.setAttribute('y2', py - 22 * Math.cos(pth));
  });

  // Panel numbers
  setText('ukf-sx', (Math.sqrt(Math.max(a, 0)) / PX_PER_IN).toFixed(3) + ' in');
  setText('ukf-sy', (Math.sqrt(Math.max(d, 0)) / PX_PER_IN).toFixed(3) + ' in');
  setText('ukf-st', radToDeg(Math.sqrt(Math.max(ukf.P[2][2], 0))).toFixed(3) + '°');
  setText('ukf-axes',
    `${(k * Math.sqrt(l1) / PX_PER_IN).toFixed(2)} × ${(k * Math.sqrt(l2) / PX_PER_IN).toFixed(2)} in`);
}

// ================= Display =================
const beams = {
  front: { el: document.getElementById('beam-front'), prop: 'height' },
  right: { el: document.getElementById('beam-right'), prop: 'width' },
  left:  { el: document.getElementById('beam-left'),  prop: 'width' },
};

const fmtIn = (px) => (px === null ? 'out of range' : (px / PX_PER_IN).toFixed(3) + ' in');
const fmtX = (px) => cssToFieldX(px).toFixed(3) + ' in';
const fmtY = (px) => cssToFieldY(px).toFixed(3) + ' in';
const fmtDeg = (d) => d.toFixed(3) + '°';

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateDisplay() {
  const truePose = robot1.pose;
  const obstacles = robot2.visible ? [robot2] : [];

  // Ground truth pose + perfect sensor readings
  setText('true-x', fmtX(truePose.x));
  setText('true-y', fmtY(truePose.y));
  setText('true-heading', fmtDeg(truePose.heading));

  const perfect = SENSORS.map((s) => perfectSensorReading(truePose, s, obstacles));
  SENSORS.forEach((s, i) => {
    const r = perfect[i];
    setText('true-' + s.name, fmtIn(r.dist) + (r.hit === 'robot' ? ' (robot)' : ''));

    // Beam drawn at exactly the true reading; hidden when out of range
    const beam = beams[s.name];
    beam.el.style[beam.prop] = (r.dist === null ? 0 : r.dist) + 'px';
    beam.el.classList.toggle('blocked', r.hit === 'robot');
  });

  // Noisy odometry
  const odomStep = updateOdometry();
  setText('odom-x', fmtX(odom.x));
  setText('odom-y', fmtY(odom.y));
  setText('odom-heading', fmtDeg(odom.heading));

  // Noisy sensor readings (fresh noise every frame) + pose predicted from them
  const noisy = perfect.map((r) =>
    r.dist === null ? null : Math.max(0, r.dist + gaussian() * SENSOR_NOISE_SIGMA_IN * PX_PER_IN)
  );
  SENSORS.forEach((s, i) => setText('noisy-' + s.name, fmtIn(noisy[i])));

  const est = estimatePoseFromSensors(noisy);
  setText('sensor-x', fmtX(est.x) + (est.xFromSensors ? '' : ' (odom)'));
  setText('sensor-y', fmtY(est.y) + (est.yFromSensors ? '' : ' (odom)'));
  setText('sensor-heading', fmtDeg(est.heading) + ' (odom)');

  // UKF prediction (covariance + sigma points)
  if (odomStep.reset) ukfReset(robot1.pose);
  else ukfPredict(odomStep.u);
  const status = ukfUpdate(noisy);
  ukf.sigma = makeSigmaPoints(ukf.mean, ukf.P);
  drawUncertainty();

  // Filter estimate vs truth
  const [fx, fy, fth] = ukf.mean;
  setText('ukf-x', fmtX(fx));
  setText('ukf-y', fmtY(fy));
  setText('ukf-heading', fmtDeg(wrap360(radToDeg(fth))));
  setText('ukf-err', (Math.hypot(fx - truePose.x, fy - truePose.y) / PX_PER_IN).toFixed(3) + ' in, ' +
    Math.abs(wrap180(radToDeg(fth) - truePose.heading)).toFixed(2) + '°');
  setText('odom-err', (Math.hypot(odom.x - truePose.x, odom.y - truePose.y) / PX_PER_IN).toFixed(3) + ' in, ' +
    Math.abs(wrap180(odom.heading - truePose.heading)).toFixed(2) + '°');
  SENSORS.forEach((s, i) => {
    const el = document.getElementById('ukf-use-' + s.name);
    if (!el) return;
    el.textContent = status[i];
  });
}

// ================= Main loop =================
function gameLoop() {
  robot1.update();
  if (robot2.visible) robot2.update();

  robot1.render();
  robot2.render();

  updateDisplay();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
