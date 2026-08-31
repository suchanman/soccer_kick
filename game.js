/**
 * 3D Soccer Kick Game (Three.js WebGL Engine)
 * Features:
 * - Fixed Ground Stop & Result Popup Modal trigger
 * - Coin Currency System (Coins = Total Distance * 1)
 * - Kick Power Upgrade System (Base 100m, +10m per level, 1.4x cost scale)
 * - Power Charging (0~100%) scales Kick Power
 * - 6-Stage Special Boost Event Pipeline
 * - 1-second delay before result modal popup
 */

(function () {
  'use strict';

  // --- UI Elements ---
  const currentDistanceEl = document.getElementById('current-distance');
  const bestDistanceEl = document.getElementById('best-distance');
  const hudCoinsEl = document.getElementById('hud-coins');
  const hudKickPowerEl = document.getElementById('hud-kick-power');

  const powerNumberEl = document.getElementById('power-number');
  const powerBarEl = document.getElementById('power-bar');
  const startInstructionEl = document.getElementById('start-instruction');

  const resultModalEl = document.getElementById('result-modal');
  const resultBadgeEl = document.getElementById('result-badge');
  const resultTitleEl = document.getElementById('result-title');
  const finalDistanceEl = document.getElementById('final-distance');
  const earnedCoinsEl = document.getElementById('earned-coins');
  const modalCoinsEl = document.getElementById('modal-coins');
  const modalKickPowerEl = document.getElementById('modal-kick-power');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const upgradeCostEl = document.getElementById('upgrade-cost');
  const restartBtn = document.getElementById('restart-btn');

  // Event Banner Popup UI
  const eventBannerEl = document.getElementById('event-banner');
  const eventIconEl = document.getElementById('event-icon');
  const eventTextEl = document.getElementById('event-text');

  function showEventBanner(icon, text) {
    eventIconEl.textContent = icon;
    eventTextEl.textContent = text;
    eventBannerEl.classList.remove('hidden');
    setTimeout(() => {
      eventBannerEl.classList.add('hidden');
    }, 2500);
  }

  // --- Web Audio API Synth ---
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playKickSound(powerFactor) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const pitch = 100 + powerFactor * 120;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.9, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) { console.error(e); }
  }

  function playBounceSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) { console.error(e); }
  }

  function playWhistleSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, audioCtx.currentTime);
      osc.frequency.setValueAtTime(2400, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(2200, audioCtx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) { console.error(e); }
  }

  // --- Currency & Upgrade System Variables ---
  let coins = parseInt(localStorage.getItem('soccer_coins') || '0', 10);
  let kickPowerLevel = parseInt(localStorage.getItem('soccer_kick_power_level') || '0', 10);

  function getBaseKickPower() {
    return 100 + (kickPowerLevel * 10);
  }

  function getUpgradeCost() {
    return Math.floor(100 * Math.pow(1.4, kickPowerLevel));
  }

  function updateCurrencyUI() {
    hudCoinsEl.textContent = coins.toLocaleString();
    hudKickPowerEl.textContent = getBaseKickPower() + 'm';
    modalCoinsEl.textContent = coins.toLocaleString();
    modalKickPowerEl.textContent = getBaseKickPower() + 'm';

    const cost = getUpgradeCost();
    upgradeCostEl.textContent = cost.toLocaleString();

    if (coins >= cost) {
      upgradeBtn.disabled = false;
    } else {
      upgradeBtn.disabled = true;
    }
  }

  upgradeBtn.addEventListener('click', () => {
    const cost = getUpgradeCost();
    if (coins >= cost) {
      coins -= cost;
      kickPowerLevel++;
      localStorage.setItem('soccer_coins', coins.toString());
      localStorage.setItem('soccer_kick_power_level', kickPowerLevel.toString());
      updateCurrencyUI();
    }
  });

  // --- Three.js Setup ---
  const canvas = document.getElementById('gameCanvas');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb');
  scene.fog = new THREE.FogExp2('#87ceeb', 0.0025);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight('#ffffff', 0.6);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight('#87ceeb', '#15803d', 0.4);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight('#ffffff', 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 150;
  dirLight.shadow.camera.left = -30;
  dirLight.shadow.camera.right = 30;
  dirLight.shadow.camera.top = 30;
  dirLight.shadow.camera.bottom = -30;
  scene.add(dirLight);

  // --- Procedural Textures ---
  function createGrassTexture() {
    const canvasTex = document.createElement('canvas');
    canvasTex.width = 512;
    canvasTex.height = 512;
    const ctx = canvasTex.getContext('2d');

    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#16a34a';
    for (let y = 0; y < 512; y += 64) {
      ctx.fillRect(0, y, 512, 32);
    }

    ctx.fillStyle = '#22c55e';
    for (let i = 0; i < 2000; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillRect(rx, ry, 2, 4);
    }

    const texture = new THREE.CanvasTexture(canvasTex);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 500);
    return texture;
  }

  function createSoccerBallTexture() {
    const canvasTex = document.createElement('canvas');
    canvasTex.width = 512;
    canvasTex.height = 256;
    const ctx = canvasTex.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = '#0f172a';
    const points = [
      [64, 64], [192, 64], [320, 64], [448, 64],
      [128, 192], [256, 192], [384, 192]
    ];
    points.forEach(([cx, cy]) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const x = cx + Math.cos(a) * 28;
        const y = cy + Math.sin(a) * 28;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvasTex);
    return texture;
  }

  function createJerseyTexture() {
    const canvasTex = document.createElement('canvas');
    canvasTex.width = 256;
    canvasTex.height = 256;
    const ctx = canvasTex.getContext('2d');

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 110px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('10', 128, 160);

    const texture = new THREE.CanvasTexture(canvasTex);
    return texture;
  }

  // --- 3D Scene Elements ---
  const grassTexture = createGrassTexture();
  const pitchMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 3000),
    new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.8, metalness: 0.1 })
  );
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.position.set(0, 0, -1450);
  pitchMesh.receiveShadow = true;
  scene.add(pitchMesh);

  const BALL_RADIUS = 0.35;
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ map: createSoccerBallTexture(), roughness: 0.3, metalness: 0.1 })
  );
  ballMesh.position.set(0, BALL_RADIUS, 0);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);

  // Player Model (Left Leg Kicking Motion)
  const playerGroup = new THREE.Group();
  playerGroup.position.set(0.65, 0, 0.45);
  playerGroup.rotation.y = -Math.PI * 0.15;

  const jerseyMat = new THREE.MeshStandardMaterial({ map: createJerseyTexture(), roughness: 0.6 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fca5a5', roughness: 0.7 });
  const sockMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.4 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.8 });

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), jerseyMat);
  torsoMesh.position.set(0, 1.25, 0);
  torsoMesh.castShadow = true;
  playerGroup.add(torsoMesh);

  const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.35, 0.32), shortsMat);
  shortsMesh.position.set(0, 0.82, 0);
  shortsMesh.castShadow = true;
  playerGroup.add(shortsMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), skinMat);
  headMesh.position.set(0, 1.8, 0);
  headMesh.castShadow = true;
  playerGroup.add(headMesh);

  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
  hairMesh.position.set(0, 1.83, 0);
  hairMesh.castShadow = true;
  playerGroup.add(hairMesh);

  const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 12);
  const shoeGeo = new THREE.BoxGeometry(0.14, 0.12, 0.3);

  const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
  rightLegMesh.position.set(0.16, 0.4, 0);
  rightLegMesh.castShadow = true;
  playerGroup.add(rightLegMesh);

  const rightSockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), sockMat);
  rightSockMesh.position.set(0.16, 0.22, 0);
  rightSockMesh.castShadow = true;
  playerGroup.add(rightSockMesh);

  const rightShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoeMesh.position.set(0.16, 0.06, -0.06);
  rightShoeMesh.castShadow = true;
  playerGroup.add(rightShoeMesh);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.16, 0.7, 0);

  const leftThighMesh = new THREE.Mesh(legGeo, skinMat);
  leftThighMesh.position.set(0, -0.3, 0);
  leftThighMesh.castShadow = true;
  leftLegPivot.add(leftThighMesh);

  const leftSockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), sockMat);
  leftSockMesh.position.set(0, -0.45, 0);
  leftSockMesh.castShadow = true;
  leftLegPivot.add(leftSockMesh);

  const leftShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoeMesh.position.set(0, -0.58, -0.06);
  leftShoeMesh.castShadow = true;
  leftLegPivot.add(leftShoeMesh);

  playerGroup.add(leftLegPivot);

  const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 12);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.35, 1.25, 0);
  leftArm.rotation.z = 0.2;
  leftArm.castShadow = true;
  playerGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0.35, 1.25, 0);
  rightArm.rotation.z = -0.2;
  rightArm.castShadow = true;
  playerGroup.add(rightArm);

  scene.add(playerGroup);

  // Distance Flags
  function createDistanceMarkers() {
    for (let dist = 50; dist <= 2000; dist += 50) {
      const zPos = -dist;

      const poleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8),
        new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.5, roughness: 0.3 })
      );
      poleMesh.position.set(-8.0, 2.0, zPos);
      poleMesh.castShadow = true;
      scene.add(poleMesh);

      const bannerCanvas = document.createElement('canvas');
      bannerCanvas.width = 256;
      bannerCanvas.height = 128;
      const bCtx = bannerCanvas.getContext('2d');
      bCtx.fillStyle = '#ef4444';
      bCtx.fillRect(0, 0, 256, 128);
      bCtx.strokeStyle = '#fde047';
      bCtx.lineWidth = 10;
      bCtx.strokeRect(0, 0, 256, 128);
      bCtx.fillStyle = '#ffffff';
      bCtx.font = '900 52px Pretendard, sans-serif';
      bCtx.textAlign = 'center';
      bCtx.fillText(dist + 'm', 128, 80);

      const bannerTex = new THREE.CanvasTexture(bannerCanvas);
      const bannerMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 1.25),
        new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide })
      );
      bannerMesh.position.set(-6.7, 3.2, zPos);
      bannerMesh.castShadow = true;
      scene.add(bannerMesh);
    }
  }
  createDistanceMarkers();

  // --- 3D SPECIAL BOOST EVENT MESHES ---

  // 1. Jetpack Booster Mesh 🚀
  const jetpackGroup = new THREE.Group();
  const packBody1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.8, roughness: 0.2 })
  );
  packBody1.position.set(-0.2, 0, 0);
  jetpackGroup.add(packBody1);

  const packBody2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.8, roughness: 0.2 })
  );
  packBody2.position.set(0.2, 0, 0);
  jetpackGroup.add(packBody2);

  const packFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: '#334155' })
  );
  packFrame.position.set(0, 0.1, 0);
  jetpackGroup.add(packFrame);
  jetpackGroup.visible = false;
  scene.add(jetpackGroup);

  // 2. Airplane Mesh ✈️
  const airplaneGroup = new THREE.Group();
  const planeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.2, 3.5, 12),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.8, roughness: 0.2 })
  );
  planeBody.rotation.z = Math.PI / 2;
  airplaneGroup.add(planeBody);

  const planeWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.08, 4.0),
    new THREE.MeshStandardMaterial({ color: '#2563eb', metalness: 0.6, roughness: 0.3 })
  );
  planeWing.position.set(0, 0.1, 0);
  airplaneGroup.add(planeWing);

  const planeTail = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.8, 0.08),
    new THREE.MeshStandardMaterial({ color: '#ef4444' })
  );
  planeTail.position.set(-1.4, 0.5, 0);
  airplaneGroup.add(planeTail);
  airplaneGroup.visible = false;
  scene.add(airplaneGroup);

  // 3. Eagle Mesh 🦅
  const eagleGroup = new THREE.Group();
  const eagleBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 })
  );
  eagleBody.rotation.x = Math.PI / 2;
  eagleGroup.add(eagleBody);

  const eagleWingLeft = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.06, 0.6),
    new THREE.MeshStandardMaterial({ color: '#451a03' })
  );
  eagleWingLeft.position.set(-1.1, 0.1, 0);
  eagleGroup.add(eagleWingLeft);

  const eagleWingRight = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.06, 0.6),
    new THREE.MeshStandardMaterial({ color: '#451a03' })
  );
  eagleWingRight.position.set(1.1, 0.1, 0);
  eagleGroup.add(eagleWingRight);

  const eagleBeak = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: '#f59e0b' })
  );
  eagleBeak.rotation.x = Math.PI / 2;
  eagleBeak.position.set(0, 0, -0.75);
  eagleGroup.add(eagleBeak);
  eagleGroup.visible = false;
  scene.add(eagleGroup);

  // 4. Wind Particles 🌬️
  const windParticlesGroup = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const streak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 3.0, 6),
      new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 })
    );
    streak.rotation.x = Math.PI / 2;
    streak.position.set(
      (Math.random() - 0.5) * 4,
      Math.random() * 3 + 0.5,
      (Math.random() - 0.5) * 6
    );
    windParticlesGroup.add(streak);
  }
  windParticlesGroup.visible = false;
  scene.add(windParticlesGroup);

  // 5. Rocket Mesh 🚀
  const rocketGroup = new THREE.Group();
  const rocketCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.8, 16),
    new THREE.MeshStandardMaterial({ color: '#ef4444' })
  );
  rocketCone.position.set(0, 1.2, 0);
  rocketGroup.add(rocketCone);

  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.6, roughness: 0.3 })
  );
  rocketBody.position.set(0, 0, 0);
  rocketGroup.add(rocketBody);

  const fin1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ color: '#2563eb' })
  );
  fin1.position.set(0, -0.6, 0);
  rocketGroup.add(fin1);
  rocketGroup.visible = false;
  scene.add(rocketGroup);

  // 6. Mole Mesh 🦔
  const moleGroup = new THREE.Group();
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 })
  );
  mound.position.set(0, 0.15, 0);
  moleGroup.add(mound);

  const moleHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.8 })
  );
  moleHead.position.set(0, 0.45, 0);
  moleGroup.add(moleHead);

  const moleNose = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#f472b6' })
  );
  moleNose.position.set(0, 0.5, 0.35);
  moleGroup.add(moleNose);
  moleGroup.visible = false;
  scene.add(moleGroup);

  // 80%+ Fireball Trail System
  const fireParticles = [];
  const fireGroup = new THREE.Group();
  scene.add(fireGroup);

  function createFireParticle(pos) {
    const fireMesh = new THREE.Mesh(
      new THREE.SphereGeometry(Math.random() * 0.18 + 0.08, 8, 8),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? '#ff4500' : '#ffcc00',
        transparent: true,
        opacity: 0.9
      })
    );
    fireMesh.position.copy(pos);
    fireMesh.position.x += (Math.random() - 0.5) * 0.2;
    fireMesh.position.y += (Math.random() - 0.5) * 0.2;
    fireMesh.position.z += (Math.random() - 0.5) * 0.2;

    fireGroup.add(fireMesh);
    fireParticles.push({ mesh: fireMesh, life: 1.0, decay: Math.random() * 0.06 + 0.04 });
  }

  function updateFireParticles() {
    for (let i = fireParticles.length - 1; i >= 0; i--) {
      const fp = fireParticles[i];
      fp.life -= fp.decay;
      fp.mesh.scale.multiplyScalar(0.92);
      fp.mesh.material.opacity = fp.life;

      if (fp.life <= 0) {
        fireGroup.remove(fp.mesh);
        fireParticles.splice(i, 1);
      }
    }
  }

  function clearAllFireParticles() {
    for (let i = 0; i < fireParticles.length; i++) {
      fireGroup.remove(fireParticles[i].mesh);
    }
    fireParticles.length = 0;
  }

  // --- Game State & Event Controllers ---
  const STATES = {
    IDLE: 'IDLE',
    CHARGING: 'CHARGING',
    KICKING: 'KICKING',
    FLYING: 'FLYING',
    STOPPED: 'STOPPED'
  };
  let gameState = STATES.IDLE;

  let power = 0;
  const POWER_SPEED = 140;

  let ballVel = { x: 0, y: 0, z: 0 };
  let ballRot = { x: 0, y: 0, z: 0 };
  let isGrounded = true;
  let kickAnimProgress = 0;

  let isFireballMode = false;
  let hasTouchedGround = false;

  // Pre-Determined 6-Stage Event Flags
  let baseTargetDistance = 0;
  let totalTargetDistance = 0;

  let hasJetpackEvent = false;
  let hasAirplaneEvent = false;
  let hasEagleEvent = false;
  let hasWindEvent = false;
  let hasRocketEvent = false;
  let hasMoleEvent = false;

  let cpJetpackTriggered = false;
  let cpAirplaneTriggered = false;
  let cpEagleTriggered = false;
  let cpWindTriggered = false;
  let cpRocketTriggered = false;
  let cpMoleTriggered = false;

  let checkPointJetpackZ = 0;
  let checkPointAirplaneZ = 0;
  let checkPointEagleZ = 0;
  let checkPointWindZ = 0;
  let checkPointRocketZ = 0;

  let isJetpackAttached = false;
  let isJetpackDetached = false;
  let jetpackVelY = 0;

  let airplaneActive = false;
  let airplaneProgress = 0;

  let isEagleCarrying = false;
  let eagleTimer = 0;

  let isRocketPushing = false;
  let rocketTimer = 0;

  let bestDistance = parseFloat(localStorage.getItem('soccer_3d_best_distance') || '0');
  bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m';
  updateCurrencyUI();

  const defaultCamPos = new THREE.Vector3(0.4, 2.1, 3.8);
  const defaultCamTarget = new THREE.Vector3(0.0, 0.6, -2.5);

  camera.position.copy(defaultCamPos);
  camera.lookAt(defaultCamTarget);

  function resetGame() {
    gameState = STATES.IDLE;
    power = 0;
    updatePowerUI();

    ballMesh.position.set(0, BALL_RADIUS, 0);
    ballMesh.rotation.set(0, 0, 0);
    ballVel = { x: 0, y: 0, z: 0 };
    ballRot = { x: 0, y: 0, z: 0 };
    isGrounded = true;

    leftLegPivot.rotation.x = 0;
    kickAnimProgress = 0;

    isFireballMode = false;
    hasTouchedGround = false;
    clearAllFireParticles();

    hasJetpackEvent = false;
    hasAirplaneEvent = false;
    hasEagleEvent = false;
    hasWindEvent = false;
    hasRocketEvent = false;
    hasMoleEvent = false;

    cpJetpackTriggered = false;
    cpAirplaneTriggered = false;
    cpEagleTriggered = false;
    cpWindTriggered = false;
    cpRocketTriggered = false;
    cpMoleTriggered = false;

    isJetpackAttached = false;
    isJetpackDetached = false;
    airplaneActive = false;
    isEagleCarrying = false;
    isRocketPushing = false;

    jetpackGroup.visible = false;
    airplaneGroup.visible = false;
    eagleGroup.visible = false;
    windParticlesGroup.visible = false;
    rocketGroup.visible = false;
    moleGroup.visible = false;

    dirLight.position.set(20, 40, 20);
    dirLight.target = ballMesh;

    currentDistanceEl.textContent = '0.0 m';
    startInstructionEl.classList.remove('fade-out');
    resultModalEl.classList.add('hidden');
    eventBannerEl.classList.add('hidden');
  }

  // --- Input Listeners ---
  function handlePressStart(e) {
    if (gameState === STATES.STOPPED) return;
    initAudio();

    if (gameState === STATES.IDLE) {
      gameState = STATES.CHARGING;
      startInstructionEl.classList.add('fade-out');
    }
  }

  function handlePressEnd(e) {
    if (gameState === STATES.CHARGING) {
      gameState = STATES.KICKING;
      kickAnimProgress = 0;
    }
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#result-modal') || e.target.closest('#restart-btn') || e.target.closest('#upgrade-btn')) return;
    handlePressStart(e);
  });
  window.addEventListener('pointerup', handlePressEnd);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) handlePressStart(e);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') handlePressEnd(e);
  });

  restartBtn.addEventListener('click', resetGame);

  // --- Power Gauge Loop ---
  function updatePower(dt) {
    if (gameState !== STATES.CHARGING) return;

    power += POWER_SPEED * dt;
    if (power >= 100) {
      power = power % 100;
    }

    updatePowerUI();
    leftLegPivot.rotation.x = -(power / 100) * 0.85;
  }

  function updatePowerUI() {
    const clampedPower = Math.min(Math.max(Math.floor(power), 0), 100);
    powerNumberEl.textContent = clampedPower + '%';
    powerBarEl.style.width = clampedPower + '%';

    if (clampedPower > 85) {
      powerBarEl.style.boxShadow = '0 0 20px rgba(255, 0, 85, 0.9)';
    } else if (clampedPower > 60) {
      powerBarEl.style.boxShadow = '0 0 15px rgba(234, 179, 8, 0.7)';
    } else {
      powerBarEl.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.5)';
    }
  }

  // --- Pre-Determined Launch & 6-Stage Event Engine ---
  function triggerBallLaunch() {
    const pFactor = power / 100;

    isFireballMode = (power >= 80);
    hasTouchedGround = false;

    // PRE-DETERMINE ALL 6 EVENTS (40% Probability Each)
    hasJetpackEvent = Math.random() < 0.4;
    hasAirplaneEvent = Math.random() < 0.4;
    hasEagleEvent = Math.random() < 0.4;
    hasWindEvent = Math.random() < 0.4;
    hasRocketEvent = Math.random() < 0.4;
    hasMoleEvent = Math.random() < 0.4;

    const maxKickPower = getBaseKickPower();
    baseTargetDistance = maxKickPower * pFactor;
    totalTargetDistance = baseTargetDistance;

    checkPointJetpackZ = - (baseTargetDistance * 0.25);
    checkPointAirplaneZ = - (baseTargetDistance * (1 / 3));
    checkPointEagleZ = - (baseTargetDistance * 0.50);
    checkPointWindZ = - (baseTargetDistance * (2 / 3));
    checkPointRocketZ = - (baseTargetDistance * 0.75);

    const speedFactor = maxKickPower / 100;
    ballVel.z = -(22 * speedFactor + pFactor * 85 * speedFactor);
    ballVel.y = 8 * Math.sqrt(speedFactor) + pFactor * 30 * Math.sqrt(speedFactor);
    ballVel.x = (Math.random() - 0.5) * 1.5;

    ballRot.x = ballVel.z * 0.1;
    isGrounded = false;

    playKickSound(pFactor);
    gameState = STATES.FLYING;
  }

  function updatePhysics(dt) {
    if (gameState === STATES.KICKING) {
      kickAnimProgress += dt * 8;
      leftLegPivot.rotation.x = -0.85 + kickAnimProgress * 1.7;

      if (kickAnimProgress >= 1.0) {
        triggerBallLaunch();
      }
    }

    if (gameState === STATES.FLYING) {
      const gravity = 25.0;
      const airDrag = 0.997;

      ballVel.y -= gravity * dt;
      ballVel.z *= airDrag;
      ballVel.x *= airDrag;

      ballMesh.position.x += ballVel.x * dt;
      ballMesh.position.y += ballVel.y * dt;
      ballMesh.position.z += ballVel.z * dt;

      ballMesh.rotation.x += ballRot.x * dt;

      if (isFireballMode && !hasTouchedGround) {
        createFireParticle(ballMesh.position);
      }

      const currentZ = ballMesh.position.z;

      // -------------------------------------------------------------
      // STAGE 1: Jetpack Booster Event (1/4 Point, 40% Chance, +50m)
      // -------------------------------------------------------------
      if (hasJetpackEvent && !cpJetpackTriggered && currentZ <= checkPointJetpackZ) {
        cpJetpackTriggered = true;
        showEventBanner('🚀', 'JETPACK BOOST! +50m');

        totalTargetDistance += 50;

        ballVel.z -= 32.0;
        ballVel.y += 18.0;

        isJetpackAttached = true;
        jetpackGroup.visible = true;
      }

      if (isJetpackAttached) {
        jetpackGroup.position.copy(ballMesh.position);
        jetpackGroup.position.z += 0.2;
        createFireParticle(jetpackGroup.position);

        if (ballVel.y < 0 && !isJetpackDetached) {
          isJetpackAttached = false;
          isJetpackDetached = true;
          jetpackVelY = -2.0;
        }
      }

      if (isJetpackDetached && jetpackGroup.visible) {
        jetpackVelY -= 15.0 * dt;
        jetpackGroup.position.y += jetpackVelY * dt;
        jetpackGroup.rotation.z += dt * 3;
        if (jetpackGroup.position.y <= 0) {
          jetpackGroup.visible = false;
        }
      }

      // -------------------------------------------------------------
      // STAGE 2: Airplane Event (1/3 Point, 40% Chance, +50m, Seamless Horizontal Hit)
      // -------------------------------------------------------------
      if (hasAirplaneEvent && !cpAirplaneTriggered) {
        if (currentZ <= checkPointAirplaneZ + 25.0 && !airplaneActive) {
          airplaneActive = true;
          airplaneProgress = 0;
          airplaneGroup.position.set(-30, Math.max(ballMesh.position.y, 2.0), checkPointAirplaneZ);
          airplaneGroup.visible = true;
          showEventBanner('✈️', 'AIRPLANE BOOST! +50m');
        }

        if (airplaneActive) {
          airplaneProgress += dt * 2.2;
          const planeX = -30 + airplaneProgress * 30;
          airplaneGroup.position.x = planeX;
          airplaneGroup.position.y = ballMesh.position.y;
          airplaneGroup.position.z = ballMesh.position.z;

          if (planeX >= ballMesh.position.x - 0.2) {
            playBounceSound();
            cpAirplaneTriggered = true;
            airplaneActive = false;
            airplaneGroup.visible = false;

            totalTargetDistance += 50;

            ballVel.z -= 40.0;
            ballVel.y += 14.0;
          }
        }
      }

      // -------------------------------------------------------------
      // STAGE 3: Eagle Event (2/4 Point, 40% Chance, +50m)
      // -------------------------------------------------------------
      if (hasEagleEvent && !cpEagleTriggered && currentZ <= checkPointEagleZ) {
        cpEagleTriggered = true;
        showEventBanner('🦅', 'EAGLE SNATCH! +50m');

        totalTargetDistance += 50;

        isEagleCarrying = true;
        eagleTimer = 0;
        eagleGroup.visible = true;

        ballVel.z -= 30.0;
        ballVel.y += 8.0;
      }

      if (isEagleCarrying) {
        eagleTimer += dt * 1.5;
        eagleGroup.position.copy(ballMesh.position);
        eagleGroup.position.y += 0.4;
        eagleGroup.rotation.z = Math.sin(eagleTimer * 10) * 0.1;

        if (eagleTimer >= 1.2) {
          isEagleCarrying = false;
          eagleGroup.position.y += dt * 20;
          setTimeout(() => { eagleGroup.visible = false; }, 800);
        }
      }

      // -------------------------------------------------------------
      // STAGE 4: Wind Event (2/3 Point, 40% Chance, +50m)
      // -------------------------------------------------------------
      if (hasWindEvent && !cpWindTriggered && currentZ <= checkPointWindZ) {
        cpWindTriggered = true;
        showEventBanner('🌬️', 'WIND GUST BOOST! +50m');

        ballVel.z -= 35.0;
        ballVel.y += 12.0;

        totalTargetDistance += 50;

        windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);
        windParticlesGroup.visible = true;
        setTimeout(() => { windParticlesGroup.visible = false; }, 2000);
      }

      // -------------------------------------------------------------
      // STAGE 5: Rocket Event (3/4 Point, 40% Chance, +50m, Rocket Carries Ball Upward Together!)
      // -------------------------------------------------------------
      if (hasRocketEvent && !cpRocketTriggered && currentZ <= checkPointRocketZ) {
        cpRocketTriggered = true;
        showEventBanner('🚀', 'ROCKET THRUST! +50m');

        totalTargetDistance += 50;

        isRocketPushing = true;
        rocketTimer = 0;
        rocketGroup.visible = true;

        ballVel.z -= 34.0;
        ballVel.y += 18.0;
      }

      if (isRocketPushing) {
        rocketTimer += dt * 1.5;
        rocketGroup.position.set(ballMesh.position.x, ballMesh.position.y - 0.9, ballMesh.position.z);
        createFireParticle(rocketGroup.position);

        if (rocketTimer >= 1.2) {
          isRocketPushing = false;
          setTimeout(() => { rocketGroup.visible = false; }, 800);
        }
      }

      // Ground Bounces
      if (ballMesh.position.y <= BALL_RADIUS) {
        ballMesh.position.y = BALL_RADIUS;

        if (isFireballMode && !hasTouchedGround) {
          hasTouchedGround = true;
          clearAllFireParticles();
        }

        if (Math.abs(ballVel.y) > 2.0) {
          ballVel.y = -ballVel.y * 0.55;
          ballVel.z *= 0.78;
          playBounceSound();
        } else {
          ballVel.y = 0;
          isGrounded = true;
          ballVel.z *= 0.965;
          ballRot.x = ballVel.z * 0.1;
        }
      }

      // -------------------------------------------------------------
      // STAGE 6: Mole Event & Ground Stop Detection (Result Modal Trigger!)
      // -------------------------------------------------------------
      if (isGrounded && Math.abs(ballVel.z) < 0.3) {
        if (!cpMoleTriggered) {
          cpMoleTriggered = true;

          if (hasMoleEvent) {
            showEventBanner('🦔', 'MOLE BOUNCE! +20m');

            moleGroup.position.set(ballMesh.position.x, 0, ballMesh.position.z);
            moleGroup.visible = true;

            ballVel.z = -20.0;
            ballVel.y = 14.0;
            isGrounded = false;
            return; // Continue flying after mole bounce
          }
        }

        // When ball is completely stopped on the ground (After Mole Event OR if no Mole Event)
        ballVel.z = 0;
        ballVel.x = 0;
        ballVel.y = 0;
        gameState = STATES.STOPPED;

        // User requested: 1 second (1000ms) delay before result popup appears!
        setTimeout(() => {
          handleGameOver(Math.abs(ballMesh.position.z));
        }, 1000);
      }
    }

    // Update Fire Particles
    updateFireParticles();

    // Update HUD Distance
    const distanceMeters = Math.abs(ballMesh.position.z);
    currentDistanceEl.textContent = distanceMeters.toFixed(1) + ' m';

    if (windParticlesGroup.visible) {
      windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);
    }

    // Camera Follow
    if (gameState === STATES.FLYING || gameState === STATES.STOPPED) {
      const targetCamPos = new THREE.Vector3(
        ballMesh.position.x * 0.5 + 0.3,
        Math.max(ballMesh.position.y + 2.4, 2.5),
        ballMesh.position.z + 5.5
      );
      const targetLook = new THREE.Vector3(
        ballMesh.position.x,
        ballMesh.position.y + 0.5,
        ballMesh.position.z - 4.0
      );

      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(targetLook);

      dirLight.position.set(ballMesh.position.x + 20, 40, ballMesh.position.z + 20);
    } else {
      camera.position.lerp(defaultCamPos, 0.1);
      camera.lookAt(defaultCamTarget);
    }
  }

  function handleGameOver(finalDistance) {
    playWhistleSound();

    const earned = Math.floor(finalDistance);
    coins += earned;
    localStorage.setItem('soccer_coins', coins.toString());

    let isNewBest = false;
    if (finalDistance > bestDistance) {
      bestDistance = finalDistance;
      localStorage.setItem('soccer_3d_best_distance', bestDistance.toString());
      bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m';
      isNewBest = true;
    }

    finalDistanceEl.textContent = finalDistance.toFixed(1) + ' m';
    earnedCoinsEl.textContent = '+' + earned.toLocaleString();

    updateCurrencyUI();

    if (isNewBest) {
      resultBadgeEl.style.display = 'inline-block';
      resultBadgeEl.textContent = 'NEW BEST RECORD! 🏆';
      resultTitleEl.textContent = 'WORLD CLASS!';
    } else if (finalDistance > 300) {
      resultBadgeEl.style.display = 'inline-block';
      resultBadgeEl.textContent = 'SUPER KICK! ⭐';
      resultTitleEl.textContent = 'INCREDIBLE!';
    } else {
      resultBadgeEl.style.display = 'none';
      resultTitleEl.textContent = 'GREAT KICK!';
    }

    resultModalEl.classList.remove('hidden');
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    updatePower(dt);
    updatePhysics(dt);

    renderer.render(scene, camera);
  }

  resetGame();
  requestAnimationFrame(animate);

})();
