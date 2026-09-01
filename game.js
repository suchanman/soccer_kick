/**
 * 3D Soccer Kick Game (Three.js WebGL Engine)
 *
 * NEW FEATURES:
 * 1. Infinite Procedural Map (1000m Chunk System)
 * 2. Event Bonus = kickPower * 0.5 * (power / 100)
 * 3. Firebase Firestore Global Ranking System
 * 4. 3x Speed Multiplier Button
 * 5. Stacked Non-Overlapping Event Banners
 */

(function () {
  'use strict';

  // ============================================================
  // FIREBASE CONFIG
  // ★ 본인의 Firebase 프로젝트 config 값으로 교체해주세요!
  // Firebase Console → 프로젝트 설정 → 앱 등록 → firebaseConfig 복사
  // ============================================================
  const firebaseConfig = {
    apiKey: "AIzaSyArOEkBYH6ox1qvuy7Df2JnfYLLwD4TW4s",
    authDomain: "soccer-kick-f25f6.firebaseapp.com",
    projectId: "soccer-kick-f25f6",
    storageBucket: "soccer-kick-f25f6.firebasestorage.app",
    messagingSenderId: "1003934102397",
    appId: "1:1003934102397:web:7550d7f763e3114c4ed214",
    measurementId: "G-7KPEHK9C01"
  };

  let db = null;
  let firebaseEnabled = false;
  try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseEnabled = true;
    }
  } catch (e) {
    console.warn('[Firebase] 초기화 실패:', e.message);
  }

  // ============================================================
  // PLAYER NICKNAME
  // ============================================================
  let playerNickname = localStorage.getItem('soccer_nickname') || '';

  // ============================================================
  // UI ELEMENT REFS
  // ============================================================
  const currentDistanceEl = document.getElementById('current-distance');
  const bestDistanceEl    = document.getElementById('best-distance');
  const hudCoinsEl        = document.getElementById('hud-coins');
  const hudKickPowerEl    = document.getElementById('hud-kick-power');

  const powerNumberEl     = document.getElementById('power-number');
  const powerBarEl        = document.getElementById('power-bar');
  const startInstructionEl= document.getElementById('start-instruction');

  const resultModalEl     = document.getElementById('result-modal');
  const resultBadgeEl     = document.getElementById('result-badge');
  const resultTitleEl     = document.getElementById('result-title');
  const finalDistanceEl   = document.getElementById('final-distance');
  const earnedCoinsEl     = document.getElementById('earned-coins');
  const modalCoinsEl      = document.getElementById('modal-coins');
  const modalKickPowerEl  = document.getElementById('modal-kick-power');
  const upgradeBtn        = document.getElementById('upgrade-btn');
  const upgradeCostEl     = document.getElementById('upgrade-cost');
  const restartBtn        = document.getElementById('restart-btn');

  const nicknameModalEl   = document.getElementById('nickname-modal');
  const nicknameInputEl   = document.getElementById('nickname-input');
  const nicknameSubmitBtn = document.getElementById('nickname-submit-btn');

  const rankingModalEl    = document.getElementById('ranking-modal');
  const rankingListEl     = document.getElementById('ranking-list');
  const rankingBtn        = document.getElementById('ranking-btn');
  const rankingCloseBtn   = document.getElementById('ranking-close-btn');

  const speedBtnEl        = document.getElementById('speed-btn');
  const eventBannerContainer = document.getElementById('event-banner-container');

  // ============================================================
  // STACKED EVENT BANNERS
  // ============================================================
  function showEventBanner(icon, text) {
    const banner = document.createElement('div');
    banner.className = 'event-banner-item';
    banner.innerHTML = `<span class="event-banner-icon">${icon}</span><span>${text}</span>`;
    eventBannerContainer.appendChild(banner);

    // Animate in (double rAF to ensure style is applied before transition)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.classList.add('show');
      });
    });

    setTimeout(() => {
      banner.classList.remove('show');
      banner.classList.add('hide');
      setTimeout(() => {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 400);
    }, 2500);
  }

  // ============================================================
  // NICKNAME SETUP
  // ============================================================
  function initNickname() {
    if (playerNickname) {
      if (nicknameInputEl) nicknameInputEl.value = playerNickname;
      nicknameModalEl.classList.add('hidden');
    } else {
      nicknameModalEl.classList.remove('hidden');
    }
  }

  function submitNickname() {
    const val = nicknameInputEl.value.trim();
    if (val.length > 0) {
      playerNickname = val;
      localStorage.setItem('soccer_nickname', val);
      nicknameModalEl.classList.add('hidden');
    } else {
      nicknameInputEl.style.borderColor = 'rgba(239,68,68,0.8)';
      setTimeout(() => { nicknameInputEl.style.borderColor = ''; }, 800);
    }
  }

  nicknameSubmitBtn.addEventListener('click', submitNickname);
  nicknameInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitNickname();
  });

  // ============================================================
  // RANKING
  // ============================================================
  async function loadRanking() {
    rankingListEl.innerHTML = '<p class="ranking-loading">불러오는 중...</p>';

    if (!firebaseEnabled) {
      rankingListEl.innerHTML = `
        <p class="ranking-error">
          ⚠️ Firebase 설정이 필요합니다.<br>
          game.js 상단의 firebaseConfig에<br>
          본인 프로젝트 정보를 입력해주세요.
        </p>`;
      return;
    }

    try {
      const snapshot = await db.collection('soccer_scores')
        .orderBy('distance', 'desc')
        .limit(10)
        .get();

      if (snapshot.empty) {
        rankingListEl.innerHTML = '<p class="ranking-loading">아직 기록이 없습니다. 첫 번째 도전자가 되세요!</p>';
        return;
      }

      rankingListEl.innerHTML = '';
      const rankClasses = ['gold', 'silver', 'bronze'];
      const rankEmojis  = ['🥇', '🥈', '🥉'];

      snapshot.docs.forEach((doc, idx) => {
        const data = doc.data();
        const isMe = data.nickname === playerNickname;
        const rankDisplay = idx < 3 ? rankEmojis[idx] : `${idx + 1}`;
        const rankClass   = idx < 3 ? rankClasses[idx] : '';

        const item = document.createElement('div');
        item.className = 'ranking-item' + (isMe ? ' ranking-me' : '');
        item.innerHTML = `
          <span class="ranking-rank ${rankClass}">${rankDisplay}</span>
          <span class="ranking-nickname">${data.nickname || '익명'}${isMe ? ' (나)' : ''}</span>
          <span class="ranking-distance">${(data.distance || 0).toFixed(1)} m</span>
        `;
        rankingListEl.appendChild(item);
      });
    } catch (e) {
      console.error('[Firebase] 랭킹 로드 오류:', e);
      rankingListEl.innerHTML = '<p class="ranking-error">⚠️ 랭킹을 불러오지 못했습니다.</p>';
    }
  }

  rankingBtn.addEventListener('click', () => {
    rankingModalEl.classList.remove('hidden');
    loadRanking();
  });

  rankingCloseBtn.addEventListener('click', () => {
    rankingModalEl.classList.add('hidden');
  });

  // ============================================================
  // WEB AUDIO API
  // ============================================================
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playKickSound(pf) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100 + pf * 120, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.9, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
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
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
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
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }

  // ============================================================
  // CURRENCY & UPGRADE SYSTEM
  // ============================================================
  let coins         = parseInt(localStorage.getItem('soccer_coins') || '0', 10);
  let kickPowerLevel= parseInt(localStorage.getItem('soccer_kick_power_level') || '0', 10);

  function getBaseKickPower() { return 100 + kickPowerLevel * 10; }
  function getUpgradeCost()   { return Math.floor(100 * Math.pow(1.4, kickPowerLevel)); }

  function updateCurrencyUI() {
    hudCoinsEl.textContent     = coins.toLocaleString();
    hudKickPowerEl.textContent = getBaseKickPower() + 'm';
    modalCoinsEl.textContent   = coins.toLocaleString();
    modalKickPowerEl.textContent = getBaseKickPower() + 'm';
    const cost = getUpgradeCost();
    upgradeCostEl.textContent  = cost.toLocaleString();
    upgradeBtn.disabled        = coins < cost;
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

  // ============================================================
  // SPEED MULTIPLIER
  // ============================================================
  let speedMultiplier = 1;

  speedBtnEl.addEventListener('click', () => {
    speedMultiplier = speedMultiplier === 1 ? 5 : 1;
    speedBtnEl.textContent = speedMultiplier === 1 ? '▶▶ 1x' : '▶▶▶ 5x';
    speedBtnEl.classList.toggle('active', speedMultiplier === 5);
  });

  // ============================================================
  // THREE.JS SETUP
  // ============================================================
  const canvas   = document.getElementById('gameCanvas');
  const scene    = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb');
  scene.fog        = new THREE.FogExp2('#87ceeb', 0.0025);

  const camera   = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  // Lighting
  scene.add(new THREE.AmbientLight('#ffffff', 0.6));
  scene.add(new THREE.HemisphereLight('#87ceeb', '#15803d', 0.4));

  const dirLight = new THREE.DirectionalLight('#ffffff', 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near   = 0.5;
  dirLight.shadow.camera.far    = 150;
  dirLight.shadow.camera.left   = -30;
  dirLight.shadow.camera.right  = 30;
  dirLight.shadow.camera.top    = 30;
  dirLight.shadow.camera.bottom = -30;
  scene.add(dirLight);

  // ============================================================
  // PROCEDURAL TEXTURES
  // ============================================================
  function createGrassTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#15803d'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#16a34a';
    for (let y = 0; y < 512; y += 64) ctx.fillRect(0, y, 512, 32);
    ctx.fillStyle = '#22c55e';
    for (let i = 0; i < 2000; i++) ctx.fillRect(Math.random()*512, Math.random()*512, 2, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10); // Per-chunk repeat
    return tex;
  }

  function createSoccerBallTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#0f172a';
    [[64,64],[192,64],[320,64],[448,64],[128,192],[256,192],[384,192]].forEach(([cx,cy]) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI*2/5 - Math.PI/2;
        const x = cx + Math.cos(a)*28, y = cy + Math.sin(a)*28;
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.fill();
    });
    return new THREE.CanvasTexture(c);
  }

  function createJerseyTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 110px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('10', 128, 160);
    return new THREE.CanvasTexture(c);
  }

  // ============================================================
  // INFINITE CHUNK SYSTEM
  // ============================================================
  const CHUNK_SIZE = 1000; // metres per chunk
  const loadedChunks = new Map(); // chunkIndex → { meshes: [], disposables: [] }

  // Shared ground material (not disposed per chunk)
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: createGrassTexture(),
    roughness: 0.8,
    metalness: 0.1
  });

  // Small fixed starting ground (covers camera area z=+10 to z=0)
  const startGround = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 20),
    groundMaterial
  );
  startGround.rotation.x = -Math.PI / 2;
  startGround.position.set(0, 0, 5); // z: -5 to +15
  startGround.receiveShadow = true;
  scene.add(startGround);

  // Shared pole material (reused across chunks)
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.5, roughness: 0.3 });

  function createChunk(chunkIndex) {
    if (loadedChunks.has(chunkIndex)) return;

    const meshes = [];
    const disposables = []; // geometries + unique materials + textures

    const startDist = chunkIndex * CHUNK_SIZE;
    const centerZ   = -(startDist + CHUNK_SIZE / 2);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(60, CHUNK_SIZE);
    const groundMesh = new THREE.Mesh(groundGeo, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, 0, centerZ);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    meshes.push(groundMesh);
    disposables.push(groundGeo); // dispose geometry; material is shared

    // Distance markers every 50m
    for (let dist = startDist + 50; dist <= startDist + CHUNK_SIZE; dist += 50) {
      const zPos = -dist;

      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8);
      const poleMesh = new THREE.Mesh(poleGeo, poleMaterial);
      poleMesh.position.set(-8.0, 2.0, zPos);
      poleMesh.castShadow = true;
      scene.add(poleMesh);
      meshes.push(poleMesh);
      disposables.push(poleGeo);

      // Banner canvas texture
      const bc = document.createElement('canvas');
      bc.width = 256; bc.height = 128;
      const bCtx = bc.getContext('2d');
      bCtx.fillStyle = '#ef4444'; bCtx.fillRect(0, 0, 256, 128);
      bCtx.strokeStyle = '#fde047'; bCtx.lineWidth = 10;
      bCtx.strokeRect(0, 0, 256, 128);
      bCtx.fillStyle = '#ffffff';
      bCtx.font = '900 52px Pretendard, sans-serif';
      bCtx.textAlign = 'center';
      bCtx.fillText(dist + 'm', 128, 80);

      const bannerTex = new THREE.CanvasTexture(bc);
      const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide });
      const bannerGeo = new THREE.PlaneGeometry(2.5, 1.25);
      const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
      bannerMesh.position.set(-6.7, 3.2, zPos);
      scene.add(bannerMesh);
      meshes.push(bannerMesh);
      disposables.push(bannerTex, bannerMat, bannerGeo);
    }

    loadedChunks.set(chunkIndex, { meshes, disposables });
  }

  function removeChunk(chunkIndex) {
    const data = loadedChunks.get(chunkIndex);
    if (!data) return;
    data.meshes.forEach(m => scene.remove(m));
    data.disposables.forEach(d => { if (d && d.dispose) d.dispose(); });
    loadedChunks.delete(chunkIndex);
  }

  function updateChunks() {
    const ballDistM  = Math.abs(ballMesh.position.z);
    const curChunk   = Math.floor(ballDistM / CHUNK_SIZE);
    const keepFrom   = Math.max(0, curChunk - 1);
    const keepTo     = curChunk + 2;

    for (let i = keepFrom; i <= keepTo; i++) createChunk(i);
    for (const [idx] of loadedChunks) {
      if (idx < keepFrom) removeChunk(idx);
    }
  }

  function initChunks() {
    for (const [idx] of loadedChunks) removeChunk(idx);
    createChunk(0);
    createChunk(1);
    createChunk(2);
  }

  // ============================================================
  // SOCCER BALL
  // ============================================================
  const BALL_RADIUS = 0.35;
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ map: createSoccerBallTexture(), roughness: 0.3, metalness: 0.1 })
  );
  ballMesh.position.set(0, BALL_RADIUS, 0);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);

  // ============================================================
  // PLAYER MODEL
  // ============================================================
  const playerGroup = new THREE.Group();
  playerGroup.position.set(0.65, 0, 0.45);
  playerGroup.rotation.y = -Math.PI * 0.15;

  const jerseyMat = new THREE.MeshStandardMaterial({ map: createJerseyTexture(), roughness: 0.6 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const skinMat   = new THREE.MeshStandardMaterial({ color: '#fca5a5', roughness: 0.7 });
  const sockMat   = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 });
  const shoeMat   = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.4 });
  const hairMat   = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.8 });

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), jerseyMat);
  torsoMesh.position.set(0, 1.25, 0); torsoMesh.castShadow = true;
  playerGroup.add(torsoMesh);

  const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.35, 0.32), shortsMat);
  shortsMesh.position.set(0, 0.82, 0); shortsMesh.castShadow = true;
  playerGroup.add(shortsMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), skinMat);
  headMesh.position.set(0, 1.8, 0); headMesh.castShadow = true;
  playerGroup.add(headMesh);

  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI*2, 0, Math.PI*0.5), hairMat);
  hairMesh.position.set(0, 1.83, 0); hairMesh.castShadow = true;
  playerGroup.add(hairMesh);

  const legGeo  = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 12);
  const shoeGeo = new THREE.BoxGeometry(0.14, 0.12, 0.3);

  const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
  rightLegMesh.position.set(0.16, 0.4, 0); rightLegMesh.castShadow = true;
  playerGroup.add(rightLegMesh);

  const rightSockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), sockMat);
  rightSockMesh.position.set(0.16, 0.22, 0); rightSockMesh.castShadow = true;
  playerGroup.add(rightSockMesh);

  const rightShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoeMesh.position.set(0.16, 0.06, -0.06); rightShoeMesh.castShadow = true;
  playerGroup.add(rightShoeMesh);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.16, 0.7, 0);

  const leftThighMesh = new THREE.Mesh(legGeo, skinMat);
  leftThighMesh.position.set(0, -0.3, 0); leftThighMesh.castShadow = true;
  leftLegPivot.add(leftThighMesh);

  const leftSockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), sockMat);
  leftSockMesh.position.set(0, -0.45, 0); leftSockMesh.castShadow = true;
  leftLegPivot.add(leftSockMesh);

  const leftShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoeMesh.position.set(0, -0.58, -0.06); leftShoeMesh.castShadow = true;
  leftLegPivot.add(leftShoeMesh);

  playerGroup.add(leftLegPivot);

  const armGeo   = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 12);
  const leftArm  = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.35, 1.25, 0); leftArm.rotation.z = 0.2; leftArm.castShadow = true;
  playerGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0.35, 1.25, 0); rightArm.rotation.z = -0.2; rightArm.castShadow = true;
  playerGroup.add(rightArm);

  scene.add(playerGroup);

  // ============================================================
  // 3D EVENT MESHES
  // ============================================================

  // 1. Jetpack
  const jetpackGroup = new THREE.Group();
  const packMat = new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.8, roughness: 0.2 });
  [[-0.2, 0, 0], [0.2, 0, 0]].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), packMat);
    m.position.set(x, y, z); jetpackGroup.add(m);
  });
  const packFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: '#334155' }));
  packFrame.position.set(0, 0.1, 0); jetpackGroup.add(packFrame);
  jetpackGroup.visible = false;
  scene.add(jetpackGroup);

  // 2. Airplane
  const airplaneGroup = new THREE.Group();
  const planeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 3.5, 12),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.8, roughness: 0.2 }));
  planeBody.rotation.z = Math.PI / 2; airplaneGroup.add(planeBody);
  const planeWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 4.0),
    new THREE.MeshStandardMaterial({ color: '#2563eb', metalness: 0.6, roughness: 0.3 }));
  planeWing.position.set(0, 0.1, 0); airplaneGroup.add(planeWing);
  const planeTail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.08),
    new THREE.MeshStandardMaterial({ color: '#ef4444' }));
  planeTail.position.set(-1.4, 0.5, 0); airplaneGroup.add(planeTail);
  airplaneGroup.visible = false;
  scene.add(airplaneGroup);

  // 3. Eagle
  const eagleGroup = new THREE.Group();
  const eagleBody = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }));
  eagleBody.rotation.x = Math.PI / 2; eagleGroup.add(eagleBody);
  [[-1.1, 0.1, 0], [1.1, 0.1, 0]].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.6),
      new THREE.MeshStandardMaterial({ color: '#451a03' }));
    w.position.set(x, y, z); eagleGroup.add(w);
  });
  const eagleBeak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
  eagleBeak.rotation.x = Math.PI / 2; eagleBeak.position.set(0, 0, -0.75); eagleGroup.add(eagleBeak);
  eagleGroup.visible = false;
  scene.add(eagleGroup);

  // 4. Wind Particles
  const windParticlesGroup = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.0, 6),
      new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 }));
    streak.rotation.x = Math.PI / 2;
    streak.position.set((Math.random()-0.5)*4, Math.random()*3+0.5, (Math.random()-0.5)*6);
    windParticlesGroup.add(streak);
  }
  windParticlesGroup.visible = false;
  scene.add(windParticlesGroup);

  // 5. Rocket
  const rocketGroup = new THREE.Group();
  const rocketCone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 16),
    new THREE.MeshStandardMaterial({ color: '#ef4444' }));
  rocketCone.position.set(0, 1.2, 0); rocketGroup.add(rocketCone);
  const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.6, roughness: 0.3 }));
  rocketBody.position.set(0, 0, 0); rocketGroup.add(rocketBody);
  const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ color: '#2563eb' }));
  fin1.position.set(0, -0.6, 0); rocketGroup.add(fin1);
  rocketGroup.visible = false;
  scene.add(rocketGroup);

  // 6. Mole
  const moleGroup = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 }));
  mound.position.set(0, 0.15, 0); moleGroup.add(mound);
  const moleHead = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.8 }));
  moleHead.position.set(0, 0.45, 0); moleGroup.add(moleHead);
  const moleNose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#f472b6' }));
  moleNose.position.set(0, 0.5, 0.35); moleGroup.add(moleNose);
  moleGroup.visible = false;
  scene.add(moleGroup);
  
  // 7. Wall (거대한 벽)
  const wallGroup = new THREE.Group();
  const wallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(15, 6, 1),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 })
  );
  wallMesh.position.set(0, 3, 0); // 땅 위로 배치
  wallGroup.add(wallMesh);
  wallGroup.visible = false;
  scene.add(wallGroup);

  // ============================================================
  // FIREBALL TRAIL SYSTEM (80%+ power)
  // ============================================================
  const fireParticles = [];
  const fireGroup = new THREE.Group();
  scene.add(fireGroup);

  function createFireParticle(pos) {
    const fm = new THREE.Mesh(
      new THREE.SphereGeometry(Math.random()*0.18+0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: Math.random()>0.5?'#ff4500':'#ffcc00', transparent: true, opacity: 0.9 })
    );
    fm.position.copy(pos);
    fm.position.x += (Math.random()-0.5)*0.2;
    fm.position.y += (Math.random()-0.5)*0.2;
    fm.position.z += (Math.random()-0.5)*0.2;
    fireGroup.add(fm);
    fireParticles.push({ mesh: fm, life: 1.0, decay: Math.random()*0.06+0.04 });
  }

  function updateFireParticles() {
    for (let i = fireParticles.length-1; i >= 0; i--) {
      const fp = fireParticles[i];
      fp.life -= fp.decay;
      fp.mesh.scale.multiplyScalar(0.92);
      fp.mesh.material.opacity = fp.life;
      if (fp.life <= 0) { fireGroup.remove(fp.mesh); fireParticles.splice(i, 1); }
    }
  }

  function clearAllFireParticles() {
    fireParticles.forEach(fp => fireGroup.remove(fp.mesh));
    fireParticles.length = 0;
  }

  // ============================================================
  // GAME STATE
  // ============================================================
  const STATES = { IDLE: 'IDLE', CHARGING: 'CHARGING', KICKING: 'KICKING', FLYING: 'FLYING', STOPPED: 'STOPPED' };
  let gameState = STATES.IDLE;

  let power = 0;
  const POWER_SPEED = 140;

  let ballVel = { x: 0, y: 0, z: 0 };
  let ballRot = { x: 0 };
  let isGrounded = true;
  let kickAnimProgress = 0;

  let isFireballMode = false;
  let hasTouchedGround = false;

  // Per-kick event bonus (formula: kickPower * 0.5 * pFactor)
  let eventBonus = 50;       // calculated metres bonus per event
  let eventBonusVelScale = 1.0; // velocity scale relative to base tuning

  let baseTargetDistance = 0;
  let totalTargetDistance = 0;

  // Pre-determined event flags
  let hasJetpackEvent = false, hasAirplaneEvent = false, hasEagleEvent = false;
  let hasWindEvent = false, hasRocketEvent = false, hasMoleEvent = false;

  let hasHeadwindEvent = false, cpHeadwindTriggered = false, checkPointHeadwindZ = 0;
  let hasSecondKickEvent = false, secondKickTriggered = false;
  let hasWallEvent = false, cpWallTriggered = false, checkPointWallZ = 0;

  let cpJetpackTriggered = false, cpAirplaneTriggered = false, cpEagleTriggered = false;
  let cpWindTriggered = false, cpRocketTriggered = false, cpMoleTriggered = false;

  let checkPointJetpackZ = 0, checkPointAirplaneZ = 0, checkPointEagleZ = 0;
  let checkPointWindZ = 0, checkPointRocketZ = 0;

  let isJetpackAttached = false, isJetpackDetached = false, jetpackVelY = 0;
  let airplaneActive = false, airplaneProgress = 0;
  let isEagleCarrying = false, eagleTimer = 0;
  let isRocketPushing = false, rocketTimer = 0;

  let bestDistance = parseFloat(localStorage.getItem('soccer_3d_best_distance') || '0');
  bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m';
  updateCurrencyUI();

  const defaultCamPos    = new THREE.Vector3(0.4, 2.1, 3.8);
  const defaultCamTarget = new THREE.Vector3(0.0, 0.6, -2.5);
  camera.position.copy(defaultCamPos);
  camera.lookAt(defaultCamTarget);

  // ============================================================
  // RESET GAME
  // ============================================================
  function resetGame() {
    gameState = STATES.IDLE;
    power = 0;
    updatePowerUI();

    ballMesh.position.set(0, BALL_RADIUS, 0);
    ballMesh.rotation.set(0, 0, 0);
    ballVel = { x: 0, y: 0, z: 0 };
    ballRot = { x: 0 };
    isGrounded = true;
    leftLegPivot.rotation.x = 0;
    kickAnimProgress = 0;

    isFireballMode = false;
    hasTouchedGround = false;
    clearAllFireParticles();

    hasJetpackEvent = hasAirplaneEvent = hasEagleEvent = false;
    hasWindEvent = hasRocketEvent = hasMoleEvent = false;
    hasHeadwindEvent = false; cpHeadwindTriggered = false;
    hasSecondKickEvent = false; secondKickTriggered = false;
    hasWallEvent = false; cpWallTriggered = false; wallGroup.visible = false;

    cpJetpackTriggered = cpAirplaneTriggered = cpEagleTriggered = false;
    cpWindTriggered = cpRocketTriggered = cpMoleTriggered = false;
    isJetpackAttached = isJetpackDetached = false;
    airplaneActive = false;
    isEagleCarrying = false;
    isRocketPushing = false;

    jetpackGroup.visible = airplaneGroup.visible = eagleGroup.visible = false;
    windParticlesGroup.visible = rocketGroup.visible = moleGroup.visible = false;

    dirLight.position.set(20, 40, 20);

    currentDistanceEl.textContent = '0.0 m';
    startInstructionEl.classList.remove('fade-out');
    resultModalEl.classList.add('hidden');
    eventBannerContainer.innerHTML = '';

    // Speed reset
    speedMultiplier = 1;
    speedBtnEl.textContent = '▶▶ 1x';
    speedBtnEl.classList.remove('active');

    // Re-initialize infinite chunks
    initChunks();
  }

  // ============================================================
  // INPUT LISTENERS
  // ============================================================
  function handlePressStart() {
    if (gameState === STATES.STOPPED) return;
    initAudio();
    if (gameState === STATES.IDLE) {
      gameState = STATES.CHARGING;
      startInstructionEl.classList.add('fade-out');
    }
  }

  function handlePressEnd() {
    if (gameState === STATES.CHARGING) {
      gameState = STATES.KICKING;
      kickAnimProgress = 0;
    }
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#result-modal') || e.target.closest('#nickname-modal') ||
        e.target.closest('#ranking-modal') || e.target.id === 'speed-btn' ||
        e.target.id === 'ranking-btn') return;
    handlePressStart();
  });
  window.addEventListener('pointerup', handlePressEnd);

  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) handlePressStart(); });
  window.addEventListener('keyup',   (e) => { if (e.code === 'Space') handlePressEnd(); });

  restartBtn.addEventListener('click', resetGame);

  // ============================================================
  // POWER GAUGE
  // ============================================================
  function updatePower(dt) {
    if (gameState !== STATES.CHARGING) return;
    power += POWER_SPEED * dt;
    if (power >= 100) power = power % 100;
    updatePowerUI();
    leftLegPivot.rotation.x = -(power / 100) * 0.85;
  }

  function updatePowerUI() {
    const p = Math.min(Math.max(Math.floor(power), 0), 100);
    powerNumberEl.textContent = p + '%';
    powerBarEl.style.width    = p + '%';
    powerBarEl.style.boxShadow = p > 85
      ? '0 0 20px rgba(255,0,85,0.9)'
      : p > 60
        ? '0 0 15px rgba(234,179,8,0.7)'
        : '0 0 10px rgba(34,197,94,0.5)';
  }

  // ============================================================
  // LAUNCH BALL
  // ============================================================
  function triggerBallLaunch() {
    const pFactor = power / 100;

    isFireballMode   = (power >= 80);
    hasTouchedGround = false;

    // Pre-determine all 6 events (50% probability each)
    hasJetpackEvent  = Math.random() < 0.5;
    hasAirplaneEvent = Math.random() < 0.5;
    hasEagleEvent    = Math.random() < 0.5;
    hasWindEvent     = Math.random() < 0.5;
    hasRocketEvent   = Math.random() < 0.5;
    hasMoleEvent     = Math.random() < 0.5;
    // 1번 추가
    hasHeadwindEvent = Math.random() < 0.3;
    // 2번 추가
    checkPointHeadwindZ = -(baseTargetDistance * 0.8); // 4/5 지점
    hasSecondKickEvent = Math.random() < 0.5;
    
    // triggerBallLaunch 안쪽 이벤트 확률 모여있는 곳에 추가
    hasWallEvent = Math.random() < 0.3;
    
    // triggerBallLaunch 안쪽 체크포인트(checkPointRocketZ 등) 모여있는 곳에 추가
    checkPointWallZ = -(baseTargetDistance * (5 / 6)); // 5/6 지점

    
    // ★ Event bonus formula: kickPower * 0.5 * power%
    eventBonus        = Math.max(1, Math.round(getBaseKickPower() * 0.5 * pFactor));
    eventBonusVelScale = eventBonus / 50.0; // scale relative to base tuning (50m)

    const maxKickPower = getBaseKickPower();
    baseTargetDistance = maxKickPower * pFactor;
    totalTargetDistance = baseTargetDistance;

    checkPointJetpackZ  = -(baseTargetDistance * 0.25);
    checkPointAirplaneZ = -(baseTargetDistance * (1/3));
    checkPointEagleZ    = -(baseTargetDistance * 0.50);
    checkPointWindZ     = -(baseTargetDistance * (2/3));
    checkPointRocketZ   = -(baseTargetDistance * 0.75);

    const sf = maxKickPower / 100;
    ballVel.z = -(22 * sf + pFactor * 85 * sf);
    ballVel.y = 8 * Math.sqrt(sf) + pFactor * 30 * Math.sqrt(sf);
    ballVel.x = (Math.random()-0.5) * 1.5;
    ballRot.x = ballVel.z * 0.1;
    isGrounded = false;

    playKickSound(pFactor);
    gameState = STATES.FLYING;
  }

  // ============================================================
  // PHYSICS UPDATE
  // ============================================================
  function updatePhysics(dt) {
    // --- KICKING ANIMATION ---
    if (gameState === STATES.KICKING) {
      kickAnimProgress += dt * 8;
      leftLegPivot.rotation.x = -0.85 + kickAnimProgress * 1.7;
      if (kickAnimProgress >= 1.0) triggerBallLaunch();
    }

      // --- FLIGHT PHYSICS ---
    if (gameState === STATES.FLYING) {
      ballVel.y -= 25.0 * dt;
      
      // 🚀 고도(y)에 따른 공기 저항 튜닝 (높을수록 저항 감소)
      const altitude = Math.max(0, ballMesh.position.y);
      const baseDrag = 0.996; // 기본 지상 공기 저항
      // 고도가 올라갈수록 저항이 줄어듦 (최대 0.9995까지만 적용)
      const airDrag = Math.min(0.9995, baseDrag + (altitude * 0.00002)); 

      // 기존 0.997 대신 계산된 airDrag 변수를 적용
      ballVel.z *= Math.pow(airDrag, dt * 60);
      ballVel.x *= Math.pow(airDrag, dt * 60);

      // 공의 위치 이동 (기존과 동일)
      ballMesh.position.x += ballVel.x * dt;
      ballMesh.position.y += ballVel.y * dt;
      ballMesh.position.z += ballVel.z * dt;
      
      // 공의 회전 효과 (기존과 완벽하게 동일하게 유지!)
      ballMesh.rotation.x += ballRot.x * dt;

      if (isFireballMode && !hasTouchedGround) createFireParticle(ballMesh.position);

      const cZ = ballMesh.position.z;


      // ---- STAGE 1: Jetpack (1/4 point) ----
      if (hasJetpackEvent && !cpJetpackTriggered && cZ <= -(totalTargetDistance * 0.25)) {
        cpJetpackTriggered = true;
        showEventBanner('🚀', `JETPACK BOOST! +${eventBonus}m`);
        totalTargetDistance += eventBonus;
        ballVel.z -= 32.0 * eventBonusVelScale;
        ballVel.y += 18.0 * eventBonusVelScale;
        isJetpackAttached = true;
        jetpackGroup.visible = true;
      }

      if (isJetpackAttached) {
        jetpackGroup.position.copy(ballMesh.position);
        jetpackGroup.position.z += 0.2;
        createFireParticle(jetpackGroup.position);
        if (ballVel.y < 0 && !isJetpackDetached) {
          isJetpackAttached = false; isJetpackDetached = true; jetpackVelY = -2.0;
        }
      }
      if (isJetpackDetached && jetpackGroup.visible) {
        jetpackVelY -= 15.0 * dt;
        jetpackGroup.position.y += jetpackVelY * dt;
        jetpackGroup.rotation.z += dt * 3;
        if (jetpackGroup.position.y <= 0) jetpackGroup.visible = false;
      }

      // ---- STAGE 2: Airplane (1/3 point) ----
          if (hasAirplaneEvent && !cpAirplaneTriggered) {
           if (cZ <= -(totalTargetDistance * (1/3)) + 25.0 && !airplaneActive) {
          airplaneActive = true; airplaneProgress = 0;
          airplaneGroup.position.set(-30, Math.max(ballMesh.position.y, 2.0), -(totalTargetDistance * (1/3)));
          airplaneGroup.visible = true;
          showEventBanner('✈️', `AIRPLANE BOOST! +${eventBonus}m`);
        }
        if (airplaneActive) {
          airplaneProgress += dt * 2.2;
          const planeX = -30 + airplaneProgress * 30;
          airplaneGroup.position.x = planeX;
          airplaneGroup.position.y = ballMesh.position.y;
          airplaneGroup.position.z = ballMesh.position.z;
          if (planeX >= ballMesh.position.x - 0.2) {
            playBounceSound();
            cpAirplaneTriggered = true; airplaneActive = false; airplaneGroup.visible = false;
            totalTargetDistance += eventBonus;
            ballVel.z -= 40.0 * eventBonusVelScale;
            ballVel.y += 14.0 * eventBonusVelScale;
          }
        }
      }

      // ---- STAGE 3: Eagle (2/4 point) ----
      if (hasEagleEvent && !cpEagleTriggered && cZ <= -(totalTargetDistance * 0.50)) {
        cpEagleTriggered = true;
        showEventBanner('🦅', `EAGLE SNATCH! +${eventBonus}m`);
        totalTargetDistance += eventBonus;
        isEagleCarrying = true; eagleTimer = 0; eagleGroup.visible = true;
        ballVel.z -= 30.0 * eventBonusVelScale;
        ballVel.y += 8.0 * eventBonusVelScale;
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

      // ---- STAGE 4: Wind (2/3 point) ----
      if (hasWindEvent && !cpWindTriggered && cZ <= -(totalTargetDistance * (2/3))) {
        cpWindTriggered = true;
        showEventBanner('🌬️', `WIND GUST! +${eventBonus}m`);
        totalTargetDistance += eventBonus;
        ballVel.z -= 35.0 * eventBonusVelScale;
        ballVel.y += 12.0 * eventBonusVelScale;
        windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);
        windParticlesGroup.visible = true;
        setTimeout(() => { windParticlesGroup.visible = false; }, 2000);
      }

      // ---- STAGE 5: Rocket (3/4 point) ----
      if (hasRocketEvent && !cpRocketTriggered && cZ <= -(totalTargetDistance * 0.75)) {
        cpRocketTriggered = true;
        showEventBanner('🚀', `ROCKET THRUST! +${eventBonus}m`);
        totalTargetDistance += eventBonus;
        isRocketPushing = true; rocketTimer = 0; rocketGroup.visible = true;
        ballVel.z -= 34.0 * eventBonusVelScale;
        ballVel.y += 18.0 * eventBonusVelScale;
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
      // ---- NEW STAGE: 거꾸로 부는 바람 (4/5 지점) ----
      if (hasHeadwindEvent && !cpHeadwindTriggered && cZ <= -(totalTargetDistance * 0.8)) {
        cpHeadwindTriggered = true;
        const penaltyDist = getBaseKickPower() * 0.2; // 킥 파워의 20%
        showEventBanner('🌪️', `역풍 발생! 거리 감소!`);
        totalTargetDistance -= penaltyDist;
        
        // 공을 뒤로(양수 z방향) 밀어내고 고도를 낮춤
        ballVel.z += 25.0 * (penaltyDist / 50.0);
        ballVel.y -= 10.0;
      }
     
      // ---- NEW STAGE: 거대한 벽 생성 (5/6 지점) ----
      if (hasWallEvent && !cpWallTriggered && cZ <= -(totalTargetDistance * (5/6))) {
        cpWallTriggered = true;
        showEventBanner('🧱', `통곡의 벽 등장!`);
        // 벽을 공 앞에 렌더링
        wallGroup.position.set(ballMesh.position.x, 0, -(totalTargetDistance * (5/6)) - 2.0);

        wallGroup.visible = true;
        
        // 공이 뒤로 튕겨 나감 (기존 속도 반전)
        ballVel.z = Math.abs(ballVel.z) * 0.6; // 뒤로 60% 힘으로 튕김
        ballVel.y = 12.0; // 위로 살짝 뜸
        playBounceSound();
      }

      // ---- GROUND BOUNCE / STOP ----
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

      // ---- STAGE 6: Mole & Ground Stop ----
      if (isGrounded && Math.abs(ballVel.z) < 0.3) {
        if (!cpMoleTriggered) {
          cpMoleTriggered = true;
          if (hasMoleEvent) {
            showEventBanner('🦔', `MOLE BOUNCE! +${eventBonus}m`);
            totalTargetDistance += eventBonus;
            moleGroup.position.set(ballMesh.position.x, 0, ballMesh.position.z);
            moleGroup.visible = true;
            ballVel.z = -32.0 * eventBonusVelScale;
            ballVel.y = 16.0 * eventBonusVelScale;
            isGrounded = false;
            return;
          }
        }
        // ---- NEW STAGE: 한 번 더 차기 (공 멈출 때) ----
        if (hasSecondKickEvent && !secondKickTriggered) {
          secondKickTriggered = true;
          const extraDist = getBaseKickPower() * (power / 100); // 킥파워 * 파워 비율
          showEventBanner('🏃‍♂️', `세컨드 킥! 슛!`);
          totalTargetDistance += extraDist;
          
          ballVel.z = -35.0 * (extraDist / 50.0);
          ballVel.y = 15.0;
          isGrounded = false;
          playKickSound(power / 100);
          return; // 게임 종료를 막고 다시 날아가게 함
        }

        // Ball fully stopped → game over
        ballVel.z = 0; ballVel.x = 0; ballVel.y = 0;
        gameState = STATES.STOPPED;
        setTimeout(() => { handleGameOver(Math.abs(ballMesh.position.z)); }, 1000);
      }
    }

    // --- MISC UPDATES ---
    updateFireParticles();

    currentDistanceEl.textContent = Math.abs(ballMesh.position.z).toFixed(1) + ' m';

    if (windParticlesGroup.visible) {
      windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);
    }

    // Camera follow
    if (gameState === STATES.FLYING || gameState === STATES.STOPPED) {
      const targetCamPos = new THREE.Vector3(
        ballMesh.position.x * 0.5 + 0.3,
        Math.max(ballMesh.position.y + 2.4, 2.5),
        ballMesh.position.z + 5.5
      );
      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(new THREE.Vector3(ballMesh.position.x, ballMesh.position.y + 0.5, ballMesh.position.z - 4.0));
      dirLight.position.set(ballMesh.position.x + 20, 40, ballMesh.position.z + 20);
    } else {
      camera.position.lerp(defaultCamPos, 0.1);
      camera.lookAt(defaultCamTarget);
    }
  }

  // ============================================================
  // GAME OVER
  // ============================================================
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
    earnedCoinsEl.textContent   = '+' + earned.toLocaleString();
    updateCurrencyUI();

    resultBadgeEl.style.display = 'inline-block';
    if (isNewBest) {
      resultBadgeEl.textContent = 'NEW BEST RECORD! 🏆';
      resultTitleEl.textContent = 'WORLD CLASS!';
    } else if (finalDistance > 300) {
      resultBadgeEl.textContent = 'SUPER KICK! ⭐';
      resultTitleEl.textContent = 'INCREDIBLE!';
    } else {
      resultBadgeEl.style.display = 'none';
      resultTitleEl.textContent = 'GREAT KICK!';
    }

    resultModalEl.classList.remove('hidden');

      // Save to Firestore
    if (firebaseEnabled && playerNickname) {
      // 🚀 조건 1: 로컬에서 최고 기록(isNewBest)을 경신했을 때만 저장
      if (isNewBest) {
        // 🚀 조건 2: add() 대신 doc(닉네임).set()을 사용하여 기존 랭킹 덮어쓰기
        db.collection('soccer_scores').doc(playerNickname).set({
          nickname: playerNickname,
          distance: parseFloat(finalDistance.toFixed(2)),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.warn('[Firebase] 기록 저장 실패:', e.message));
      }
    }
  }

  // ============================================================
  // RESIZE
  // ============================================================
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ============================================================
  // ANIMATION LOOP
  // ============================================================
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);

    const rawDt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Speed multiplier only applies during KICKING / FLYING states
    const physDt = rawDt * (
      gameState === STATES.FLYING || gameState === STATES.KICKING
        ? speedMultiplier
        : 1
    );

    updatePower(rawDt);   // Power gauge always at normal speed
    updatePhysics(physDt);
    updateChunks();

    renderer.render(scene, camera);
  }

  // ============================================================
  // INIT
  // ============================================================
  initNickname();
  resetGame();
  requestAnimationFrame(animate);

})();
