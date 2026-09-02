/**
 * 3D Soccer Kick Game (Three.js WebGL Engine) - Final Version
 */
(function () {
  'use strict';

  // ============================================================
  // FIREBASE CONFIG
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
  const kickBtnEl         = document.getElementById('kick-btn');

  // ============================================================
  // EVENT BANNERS
  // ============================================================
  function showEventBanner(icon, text) {
    const banner = document.createElement('div');
    banner.className = 'event-banner-item';
    banner.innerHTML = `<span class="event-banner-icon">${icon}</span><span>${text}</span>`;
    eventBannerContainer.appendChild(banner);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => { banner.classList.add('show'); });
    });

    setTimeout(() => {
      banner.classList.remove('show');
      banner.classList.add('hide');
      setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
    }, 2500);
  }

  // ============================================================
  // NICKNAME & RANKING
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
  nicknameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitNickname(); });

  async function loadRanking() {
    rankingListEl.innerHTML = '<p class="ranking-loading">불러오는 중...</p>';
    if (!firebaseEnabled) return;

    try {
      const snapshot = await db.collection('soccer_scores').orderBy('distance', 'desc').limit(30).get();
      if (snapshot.empty) {
        rankingListEl.innerHTML = '<p class="ranking-loading">아직 기록이 없습니다.</p>';
        return;
      }

      rankingListEl.innerHTML = '';
      const rankClasses = ['gold', 'silver', 'bronze'];
      const rankEmojis  = ['🥇', '🥈', '🥉'];
      
      const seenNicknames = new Set();
      let displayRank = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const nickname = data.nickname || '익명';

        if (seenNicknames.has(nickname) || displayRank >= 10) return;
        seenNicknames.add(nickname);

        const isMe = nickname === playerNickname;
        const rankDisplay = displayRank < 3 ? rankEmojis[displayRank] : `${displayRank + 1}`;
        const rankClass   = displayRank < 3 ? rankClasses[displayRank] : '';

        const item = document.createElement('div');
        item.className = 'ranking-item' + (isMe ? ' ranking-me' : '');
        item.innerHTML = `
          <span class="ranking-rank ${rankClass}">${rankDisplay}</span>
          <span class="ranking-nickname">${nickname}${isMe ? ' (나)' : ''}</span>
          <span class="ranking-distance">${(data.distance || 0).toFixed(1)} m</span>
        `;
        rankingListEl.appendChild(item);
        displayRank++;
      });
    } catch (e) {
      rankingListEl.innerHTML = '<p class="ranking-error">⚠️ 랭킹을 불러오지 못했습니다.</p>';
    }
  }

  rankingBtn.addEventListener('click', () => { rankingModalEl.classList.remove('hidden'); loadRanking(); });
  rankingCloseBtn.addEventListener('click', () => { rankingModalEl.classList.add('hidden'); });

  // ============================================================
  // AUDIO
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
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(100 + pf * 120, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.9, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  }

  function playBounceSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(80, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  function playWhistleSound() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(2200, audioCtx.currentTime);
      osc.frequency.setValueAtTime(2400, audioCtx.currentTime + 0.1); osc.frequency.setValueAtTime(2200, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }

  // ============================================================
  // MULTI-UPGRADE SYSTEM
  // ============================================================
  let coins = parseInt(localStorage.getItem('soccer_coins') || '0', 10);
  let lvKick  = parseInt(localStorage.getItem('soccer_upg_kick') || '0', 10);
  let lvPower = parseInt(localStorage.getItem('soccer_upg_power') || '0', 10);
  let lvEvent = parseInt(localStorage.getItem('soccer_upg_event') || '0', 10);
  let lvCoin  = parseInt(localStorage.getItem('soccer_upg_coin') || '0', 10);

  function getBaseKickPower() { return 100 + lvKick * 10; }
  function getCost(lv) { return Math.floor(100 * Math.pow(1.2, lv)); }

  const upgradeModalEl = document.getElementById('upgrade-modal');
  if(document.getElementById('upgrade-tab-btn')) {
    document.getElementById('upgrade-tab-btn').addEventListener('click', () => {
      upgradeModalEl.classList.remove('hidden'); updateCurrencyUI();
    });
  }
  if(document.getElementById('upgrade-close-btn')) {
    document.getElementById('upgrade-close-btn').addEventListener('click', () => upgradeModalEl.classList.add('hidden'));
  }

  function updateCurrencyUI() {
    hudCoinsEl.textContent = coins.toLocaleString();
    hudKickPowerEl.textContent = getBaseKickPower() + 'm';
    
    if(!document.getElementById('upg-current-coins')) return; 
    
    document.getElementById('upg-current-coins').textContent = coins.toLocaleString();
    document.getElementById('upg-lvl-kick').textContent = 'Lv.' + lvKick;
    document.getElementById('upg-val-kick').textContent = getBaseKickPower() + 'm';
    document.getElementById('upg-cost-kick').textContent = getCost(lvKick).toLocaleString();
    document.getElementById('upg-btn-kick').disabled = coins < getCost(lvKick);
    
    document.getElementById('upg-lvl-power').textContent = 'Lv.' + lvPower;
    document.getElementById('upg-val-power').textContent = '+' + (lvPower * 5) + '%';
    document.getElementById('upg-cost-power').textContent = getCost(lvPower).toLocaleString();
    document.getElementById('upg-btn-power').disabled = coins < getCost(lvPower);

    document.getElementById('upg-lvl-event').textContent = 'Lv.' + lvEvent;
    document.getElementById('upg-val-event').textContent = '+' + (lvEvent * 5) + '%';
    document.getElementById('upg-cost-event').textContent = getCost(lvEvent).toLocaleString();
    document.getElementById('upg-btn-event').disabled = coins < getCost(lvEvent);

    document.getElementById('upg-lvl-coin').textContent = 'Lv.' + lvCoin;
    document.getElementById('upg-val-coin').textContent = '+' + (lvCoin * 10) + '%';
    document.getElementById('upg-cost-coin').textContent = getCost(lvCoin).toLocaleString();
    document.getElementById('upg-btn-coin').disabled = coins < getCost(lvCoin);
  }

  function buyUpgrade(type) {
    let cost = 0;
    if (type === 'kick')  { cost = getCost(lvKick);  if (coins >= cost) { coins -= cost; lvKick++;  localStorage.setItem('soccer_upg_kick', lvKick); } }
    if (type === 'power') { cost = getCost(lvPower); if (coins >= cost) { coins -= cost; lvPower++; localStorage.setItem('soccer_upg_power', lvPower); } }
    if (type === 'event') { cost = getCost(lvEvent); if (coins >= cost) { coins -= cost; lvEvent++; localStorage.setItem('soccer_upg_event', lvEvent); } }
    if (type === 'coin')  { cost = getCost(lvCoin);  if (coins >= cost) { coins -= cost; lvCoin++;  localStorage.setItem('soccer_upg_coin', lvCoin); } }
    localStorage.setItem('soccer_coins', coins.toString());
    updateCurrencyUI();
  }

  if(document.getElementById('upg-btn-kick')) document.getElementById('upg-btn-kick').addEventListener('click', () => buyUpgrade('kick'));
  if(document.getElementById('upg-btn-power')) document.getElementById('upg-btn-power').addEventListener('click', () => buyUpgrade('power'));
  if(document.getElementById('upg-btn-event')) document.getElementById('upg-btn-event').addEventListener('click', () => buyUpgrade('event'));
  if(document.getElementById('upg-btn-coin')) document.getElementById('upg-btn-coin').addEventListener('click', () => buyUpgrade('coin'));

  let bestDistance = parseFloat(localStorage.getItem('soccer_3d_best_distance') || '0');
  bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m';

  // ============================================================
  // SKIN SHOP SYSTEM
  // ============================================================
  let currentSkin = localStorage.getItem('soccer_skin') || 'basic';
  const SKINS = {
    basic:   { name: '기본 공', req: 0, bonus: 0, desc: '보유 효과: 없음' },
    rainbow: { name: '🌈 무지개 공', req: 100000, bonus: 0.1, desc: '보유 효과: 킥 파워 +10%' },
    bullet:  { name: '🚀 총알 공', req: 1000000, bonus: 0.5, desc: '보유 효과: 킥 파워 +50%' },
    flame:   { name: '🔥 불타는 공', req: 10000000, bonus: 1.0, desc: '보유 효과: 킥 파워 +100%' }
  };

  function getSkinPowerBonus() {
    let bonus = 0;
    if (bestDistance >= SKINS.rainbow.req) bonus += SKINS.rainbow.bonus;
    if (bestDistance >= SKINS.bullet.req) bonus += SKINS.bullet.bonus;
    if (bestDistance >= SKINS.flame.req) bonus += SKINS.flame.bonus;
    return bonus;
  }

  const skinModalEl = document.getElementById('skin-modal');
  if(document.getElementById('skin-tab-btn')) {
    document.getElementById('skin-tab-btn').addEventListener('click', () => {
      skinModalEl.classList.remove('hidden'); renderSkinList();
    });
  }
  if(document.getElementById('skin-close-btn')) document.getElementById('skin-close-btn').addEventListener('click', () => skinModalEl.classList.add('hidden'));

  function renderSkinList() {
    const container = document.getElementById('skin-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    Object.keys(SKINS).forEach(key => {
      const s = SKINS[key];
      const isUnlocked = bestDistance >= s.req;
      const isEquipped = currentSkin === key;
      
      const item = document.createElement('div');
      item.className = 'ranking-item';
      item.style.flexDirection = 'column';
      item.style.gap = '8px';
      
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; font-weight:bold;">
          <span style="color:${isUnlocked ? 'white' : '#64748b'};">${s.name} ${isUnlocked ? '' : '🔒'}</span>
          <span style="color:#38bdf8; font-size:0.8rem;">${s.desc}</span>
        </div>
        <div style="display:flex; justify-content:space-between; width:100%; font-size:0.75rem; color:#94a3b8; align-items:center;">
          해제: ${s.req === 0 ? '기본 제공' : (s.req.toLocaleString() + 'm 이상')}
          <button class="btn-upgrade" style="width:auto; padding:6px 12px; font-size:0.8rem; background:${isEquipped ? '#22c55e' : (isUnlocked ? '#3b82f6' : '#475569')}" ${isUnlocked ? '' : 'disabled'}>
            ${isEquipped ? '장착 중' : (isUnlocked ? '장착하기' : '잠김')}
          </button>
        </div>
      `;
      
      if (isUnlocked && !isEquipped) {
        item.querySelector('button').addEventListener('click', () => {
          currentSkin = key;
          localStorage.setItem('soccer_skin', currentSkin);
          applySkin(); renderSkinList();
        });
      }
      container.appendChild(item);
    });
  }

  // ============================================================
  // SPEED MULTIPLIER
  // ============================================================
  let speedMultiplier = 1;
  speedBtnEl.addEventListener('click', () => {
    speedMultiplier = speedMultiplier === 1 ? 50 : 1;
    speedBtnEl.textContent = speedMultiplier === 1 ? '▶▶ 1x' : '▶▶▶ 50x';
    speedBtnEl.classList.toggle('active', speedMultiplier === 50);
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
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#15803d'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#16a34a'; for (let y = 0; y < 512; y += 64) ctx.fillRect(0, y, 512, 32);
    ctx.fillStyle = '#22c55e'; for (let i = 0; i < 2000; i++) ctx.fillRect(Math.random()*512, Math.random()*512, 2, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10);
    return tex;
  }

  function createSoccerBallTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
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
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 110px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('10', 128, 160);
    return new THREE.CanvasTexture(c);
  }

  // ============================================================
  // INFINITE CHUNK SYSTEM
  // ============================================================
  const CHUNK_SIZE = 1000;
  const loadedChunks = new Map();
  const groundMaterial = new THREE.MeshStandardMaterial({ map: createGrassTexture(), roughness: 0.8, metalness: 0.1 });

  const startGround = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), groundMaterial);
  startGround.rotation.x = -Math.PI / 2; startGround.position.set(0, 0, 5); startGround.receiveShadow = true;
  scene.add(startGround);

  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.5, roughness: 0.3 });

  function createChunk(chunkIndex) {
    if (loadedChunks.has(chunkIndex)) return;
    const meshes = []; const disposables = [];
    const startDist = chunkIndex * CHUNK_SIZE; const centerZ = -(startDist + CHUNK_SIZE / 2);

    const groundGeo = new THREE.PlaneGeometry(60, CHUNK_SIZE);
    const groundMesh = new THREE.Mesh(groundGeo, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2; groundMesh.position.set(0, 0, centerZ); groundMesh.receiveShadow = true;
    scene.add(groundMesh); meshes.push(groundMesh); disposables.push(groundGeo);

    // 500m 간격으로 최적화 완료!
    for (let dist = startDist + 500; dist <= startDist + CHUNK_SIZE; dist += 500) {
      const zPos = -dist;
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8);
      const poleMesh = new THREE.Mesh(poleGeo, poleMaterial);
      poleMesh.position.set(-8.0, 2.0, zPos); poleMesh.castShadow = true;
      scene.add(poleMesh); meshes.push(poleMesh); disposables.push(poleGeo);

      const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128;
      const bCtx = bc.getContext('2d');
      bCtx.fillStyle = '#ef4444'; bCtx.fillRect(0, 0, 256, 128);
      bCtx.strokeStyle = '#fde047'; bCtx.lineWidth = 10; bCtx.strokeRect(0, 0, 256, 128);
      bCtx.fillStyle = '#ffffff'; bCtx.font = '900 48px Pretendard, sans-serif'; bCtx.textAlign = 'center';
      
      if (dist >= 1000) bCtx.fillText((dist / 1000).toFixed(1) + 'km', 128, 80);
      else bCtx.fillText(dist + 'm', 128, 80);

      const bannerTex = new THREE.CanvasTexture(bc);
      const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide });
      const bannerGeo = new THREE.PlaneGeometry(2.5, 1.25);
      const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
      bannerMesh.position.set(-6.7, 3.2, zPos);
      scene.add(bannerMesh); meshes.push(bannerMesh); disposables.push(bannerTex, bannerMat, bannerGeo);
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
      if (idx < keepFrom || idx > keepTo) removeChunk(idx);
    }
  }

  function initChunks() {
    for (const [idx] of loadedChunks) removeChunk(idx);
    createChunk(0); createChunk(1); createChunk(2);
  }

  // ============================================================
  // SOCCER BALL & SKINS
  // ============================================================
  const BALL_RADIUS = 0.35;
  const ballMesh = new THREE.Group();
  ballMesh.position.set(0, BALL_RADIUS, 0);
  scene.add(ballMesh);

  const basicBall = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ map: createSoccerBallTexture(), roughness: 0.3, metalness: 0.1 })
  );
  basicBall.castShadow = true; basicBall.receiveShadow = true;

  function createRainbowTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,256,0);
    ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'].forEach((col, i, arr) => grad.addColorStop(i/(arr.length-1), col));
    ctx.fillStyle = grad; ctx.fillRect(0,0,256,256); return new THREE.CanvasTexture(c);
  }
  const rainbowBall = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ map: createRainbowTexture(), roughness: 0.2, metalness: 0.3 })
  );
  rainbowBall.castShadow = true; rainbowBall.receiveShadow = true;

  const bulletGroup = new THREE.Group();
  const bulletBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 16), new THREE.MeshStandardMaterial({color:'#cbd5e1', metalness:0.8, roughness:0.2}));
  bulletBody.rotation.x = Math.PI/2; bulletBody.castShadow = true;
  const bulletTip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 16), new THREE.MeshStandardMaterial({color:'#94a3b8', metalness:0.9, roughness:0.1}));
  bulletTip.position.z = 0.45; bulletTip.rotation.x = Math.PI/2; bulletTip.castShadow = true;
  const bulletBack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.1, 16), new THREE.MeshStandardMaterial({color:'#f59e0b', metalness:0.8}));
  bulletBack.position.z = -0.35; bulletBack.rotation.x = Math.PI/2;
  bulletGroup.add(bulletBody, bulletTip, bulletBack);

  const flameBall = basicBall.clone();

  function applySkin() {
    while(ballMesh.children.length > 0) ballMesh.remove(ballMesh.children[0]);
    if (currentSkin === 'rainbow') ballMesh.add(rainbowBall);
    else if (currentSkin === 'bullet') ballMesh.add(bulletGroup);
    else if (currentSkin === 'flame') ballMesh.add(flameBall);
    else ballMesh.add(basicBall);
  }
  applySkin();

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
  torsoMesh.position.set(0, 1.25, 0); torsoMesh.castShadow = true; playerGroup.add(torsoMesh);
  const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.35, 0.32), shortsMat);
  shortsMesh.position.set(0, 0.82, 0); shortsMesh.castShadow = true; playerGroup.add(shortsMesh);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), skinMat);
  headMesh.position.set(0, 1.8, 0); headMesh.castShadow = true; playerGroup.add(headMesh);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16, 0, Math.PI*2, 0, Math.PI*0.5), hairMat);
  hairMesh.position.set(0, 1.83, 0); hairMesh.castShadow = true; playerGroup.add(hairMesh);

  const legGeo  = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 12);
  const shoeGeo = new THREE.BoxGeometry(0.14, 0.12, 0.3);

  const rightLegMesh = new THREE.Mesh(legGeo, skinMat); rightLegMesh.position.set(0.16, 0.4, 0); rightLegMesh.castShadow = true; playerGroup.add(rightLegMesh);
  const rightSockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), sockMat); rightSockMesh.position.set(0.16, 0.22, 0); rightSockMesh.castShadow = true; playerGroup.add(rightSockMesh);
  const rightShoeMesh = new THREE.Mesh(shoeGeo, shoeMat); rightShoeMesh.position.set(0.16, 0.06, -0.06); rightShoeMesh.castShadow = true; playerGroup.add(rightShoeMesh);

  const leftLegPivot = new THREE.Group(); leftLegPivot.position.set(-0.16, 0.7, 0);
  const leftThighMesh = new THREE.Mesh(legGeo, skinMat); leftThighMesh.position.set(0, -0.3, 0); leftThighMesh.castShadow = true; leftLegPivot.add(leftThighMesh);
  const leftSockMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), sockMat); leftSockMesh.position.set(0, -0.45, 0); leftSockMesh.castShadow = true; leftLegPivot.add(leftSockMesh);
  const leftShoeMesh = new THREE.Mesh(shoeGeo, shoeMat); leftShoeMesh.position.set(0, -0.58, -0.06); leftShoeMesh.castShadow = true; leftLegPivot.add(leftShoeMesh);
  playerGroup.add(leftLegPivot);

  const armGeo   = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 12);
  const leftArm  = new THREE.Mesh(armGeo, skinMat); leftArm.position.set(-0.35, 1.25, 0); leftArm.rotation.z = 0.2; leftArm.castShadow = true; playerGroup.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, skinMat); rightArm.position.set(0.35, 1.25, 0); rightArm.rotation.z = -0.2; rightArm.castShadow = true; playerGroup.add(rightArm);

  scene.add(playerGroup);

  // ============================================================
  // 3D EVENT MESHES
  // ============================================================
  const jetpackGroup = new THREE.Group();
  const packMat = new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.8, roughness: 0.2 });
  [[-0.2, 0, 0], [0.2, 0, 0]].forEach(([x, y, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), packMat); m.position.set(x, y, z); jetpackGroup.add(m); });
  const packFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: '#334155' }));
  packFrame.position.set(0, 0.1, 0); jetpackGroup.add(packFrame); jetpackGroup.visible = false; scene.add(jetpackGroup);

  const airplaneGroup = new THREE.Group();
  const planeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 3.5, 12), new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.8, roughness: 0.2 }));
  planeBody.rotation.z = Math.PI / 2; airplaneGroup.add(planeBody);
  const planeWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 4.0), new THREE.MeshStandardMaterial({ color: '#2563eb', metalness: 0.6, roughness: 0.3 }));
  planeWing.position.set(0, 0.1, 0); airplaneGroup.add(planeWing);
  const planeTail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.08), new THREE.MeshStandardMaterial({ color: '#ef4444' }));
  planeTail.position.set(-1.4, 0.5, 0); airplaneGroup.add(planeTail); airplaneGroup.visible = false; scene.add(airplaneGroup);

  const eagleGroup = new THREE.Group();
  const eagleBody = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }));
  eagleBody.rotation.x = Math.PI / 2; eagleGroup.add(eagleBody);
  [[-1.1, 0.1, 0], [1.1, 0.1, 0]].forEach(([x, y, z]) => { const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.6), new THREE.MeshStandardMaterial({ color: '#451a03' })); w.position.set(x, y, z); eagleGroup.add(w); });
  const eagleBeak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
  eagleBeak.rotation.x = Math.PI / 2; eagleBeak.position.set(0, 0, -0.75); eagleGroup.add(eagleBeak); eagleGroup.visible = false; scene.add(eagleGroup);

  const windParticlesGroup = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.0, 6), new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 }));
    streak.rotation.x = Math.PI / 2; streak.position.set((Math.random()-0.5)*4, Math.random()*3+0.5, (Math.random()-0.5)*6); windParticlesGroup.add(streak);
  }
  windParticlesGroup.visible = false; scene.add(windParticlesGroup);

  const rocketGroup = new THREE.Group();
  const rocketCone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 16), new THREE.MeshStandardMaterial({ color: '#ef4444' }));
  rocketCone.position.set(0, 1.2, 0); rocketGroup.add(rocketCone);
  const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 16), new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.6, roughness: 0.3 }));
  rocketBody.position.set(0, 0, 0); rocketGroup.add(rocketBody);
  const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: '#2563eb' }));
  fin1.position.set(0, -0.6, 0); rocketGroup.add(fin1); rocketGroup.visible = false; scene.add(rocketGroup);

  const moleGroup = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 16), new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 }));
  mound.position.set(0, 0.15, 0); moleGroup.add(mound);
  const moleHead = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.8 }));
  moleHead.position.set(0, 0.45, 0); moleGroup.add(moleHead);
  const moleNose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: '#f472b6' }));
  moleNose.position.set(0, 0.5, 0.35); moleGroup.add(moleNose); moleGroup.visible = false; scene.add(moleGroup);

  // ============================================================
  // MULTI-TRAIL SYSTEM (스킨 잔상 효과)
  // ============================================================
  const trailParticles = [];
  const trailGroup = new THREE.Group();
  scene.add(trailGroup);

  function createTrailParticle(pos) {
    let mesh, decay = 0.05;
    if (currentSkin === 'rainbow') {
      const cols = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'];
      mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.random()*0.15+0.1, 8, 8), new THREE.MeshBasicMaterial({ color: cols[Math.floor(Math.random()*cols.length)], transparent: true, opacity: 0.8 }));
    } else if (currentSkin === 'bullet') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }));
      mesh.rotation.copy(ballMesh.rotation); mesh.position.z += Math.random()*0.2; decay = 0.08;
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.random()*0.18+0.08, 8, 8), new THREE.MeshBasicMaterial({ color: Math.random()>0.5?'#ff4500':'#ffcc00', transparent: true, opacity: 0.9 }));
    }
    mesh.position.copy(pos);
    if(currentSkin !== 'bullet') { mesh.position.x += (Math.random()-0.5)*0.2; mesh.position.y += (Math.random()-0.5)*0.2; mesh.position.z += (Math.random()-0.5)*0.2; }
    trailGroup.add(mesh); trailParticles.push({ mesh: mesh, life: 1.0, decay: decay });
  }

  function updateTrailParticles() {
    for (let i = trailParticles.length-1; i >= 0; i--) {
      const tp = trailParticles[i]; tp.life -= tp.decay;
      if (currentSkin === 'bullet') tp.mesh.scale.set(tp.life, 1, tp.life); else tp.mesh.scale.multiplyScalar(0.92);
      tp.mesh.material.opacity = tp.life;
      if (tp.life <= 0) { 
        trailGroup.remove(tp.mesh); 
        // 🚀 핵심 수정: 안 쓰는 파티클의 메모리를 완전히 박살내서 비워줍니다!
        tp.mesh.geometry.dispose(); 
        tp.mesh.material.dispose(); 
        trailParticles.splice(i, 1); 
      }
    }
  }

  function clearAllTrailParticles() {
    trailParticles.forEach(tp => {
      trailGroup.remove(tp.mesh);
      tp.mesh.geometry.dispose(); 
      tp.mesh.material.dispose();
    });
    trailParticles.length = 0;
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

  let eventBonus = 50; let eventBonusVelScale = 1.0;
  let baseTargetDistance = 0; let totalTargetDistance = 0;

  let hasJetpackEvent = false, hasAirplaneEvent = false, hasEagleEvent = false;
  let hasWindEvent = false, hasRocketEvent = false, hasMoleEvent = false;
  let hasHeadwindEvent = false, hasSecondKickEvent = false;
  
  let cpJetpackTriggered = false, cpAirplaneTriggered = false, cpEagleTriggered = false;
  let cpWindTriggered = false, cpRocketTriggered = false, cpMoleTriggered = false;
  let cpHeadwindTriggered = false, secondKickTriggered = false;

  let isJetpackAttached = false, isJetpackDetached = false, jetpackVelY = 0;
  let airplaneActive = false, airplaneProgress = 0;
  let isEagleCarrying = false, eagleTimer = 0;
  let isRocketPushing = false, rocketTimer = 0;

  updateCurrencyUI();
  const defaultCamPos    = new THREE.Vector3(0.4, 2.1, 3.8);
  const defaultCamTarget = new THREE.Vector3(0.0, 0.6, -2.5);
  camera.position.copy(defaultCamPos); camera.lookAt(defaultCamTarget);

  // ============================================================
  // RESET GAME
  // ============================================================
  function resetGame() {
    gameState = STATES.IDLE; power = 0; updatePowerUI();
    ballMesh.position.set(0, BALL_RADIUS, 0); ballMesh.rotation.set(0, 0, 0);
    ballVel = { x: 0, y: 0, z: 0 }; ballRot = { x: 0 }; isGrounded = true; leftLegPivot.rotation.x = 0; kickAnimProgress = 0;
    isFireballMode = false; hasTouchedGround = false; clearAllTrailParticles();

    hasJetpackEvent = hasAirplaneEvent = hasEagleEvent = false;
    hasWindEvent = hasRocketEvent = hasMoleEvent = false;
    hasHeadwindEvent = false; hasSecondKickEvent = false;
    
    cpJetpackTriggered = cpAirplaneTriggered = cpEagleTriggered = false;
    cpWindTriggered = cpRocketTriggered = cpMoleTriggered = false;
    cpHeadwindTriggered = false; secondKickTriggered = false;
    
    isJetpackAttached = isJetpackDetached = false; airplaneActive = false; isEagleCarrying = false; isRocketPushing = false;
    jetpackGroup.visible = airplaneGroup.visible = eagleGroup.visible = false;
    windParticlesGroup.visible = rocketGroup.visible = moleGroup.visible = false;
    dirLight.position.set(20, 40, 20);
    currentDistanceEl.textContent = '0.0 m'; startInstructionEl.classList.remove('fade-out');
    resultModalEl.classList.add('hidden'); eventBannerContainer.innerHTML = '';
    speedMultiplier = 1; speedBtnEl.textContent = '▶▶ 1x'; speedBtnEl.classList.remove('active');
    initChunks();
  }

  // ============================================================
  // INPUT LISTENERS
  // ============================================================
  function handlePressStart() {
    if (gameState === STATES.STOPPED) return;
    initAudio();
    if (gameState === STATES.IDLE) { gameState = STATES.CHARGING; startInstructionEl.classList.add('fade-out'); }
  }
  function handlePressEnd() {
    if (gameState === STATES.CHARGING) { gameState = STATES.KICKING; kickAnimProgress = 0; }
  }

  if(kickBtnEl) {
    kickBtnEl.addEventListener('pointerdown', handlePressStart);
    kickBtnEl.addEventListener('pointerup', handlePressEnd);
    kickBtnEl.addEventListener('pointerleave', () => { if (gameState === STATES.CHARGING) handlePressEnd(); });
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) handlePressStart(); });
  window.addEventListener('keyup',   (e) => { if (e.code === 'Space') handlePressEnd(); });
  restartBtn.addEventListener('click', resetGame);

  // ============================================================
  // POWER GAUGE & LAUNCH
  // ============================================================
  function updatePower(dt) {
    if (gameState !== STATES.CHARGING) return;
    power += POWER_SPEED * dt; if (power >= 100) power = power % 100;
    updatePowerUI(); leftLegPivot.rotation.x = -(power / 100) * 0.85;
  }

  function updatePowerUI() {
    const p = Math.min(Math.max(Math.floor(power), 0), 100);
    powerNumberEl.textContent = p + '%'; powerBarEl.style.width = p + '%';
    powerBarEl.style.boxShadow = p > 85 ? '0 0 20px rgba(255,0,85,0.9)' : p > 60 ? '0 0 15px rgba(234,179,8,0.7)' : '0 0 10px rgba(34,197,94,0.5)';
  }

  function triggerBallLaunch() {
    let pFactor = power / 100;
    pFactor = pFactor * (1 + (lvPower * 0.05) + getSkinPowerBonus()); 

    if (Math.random() < 0.5) { pFactor *= 2.0; showEventBanner('🔥', `강화킥 발동! 파워 2배!`); }
    
    isFireballMode   = (power >= 80) || (pFactor >= 1.5);
    hasTouchedGround = false;

    hasJetpackEvent  = Math.random() < 0.5; hasAirplaneEvent = Math.random() < 0.5; hasEagleEvent    = Math.random() < 0.5;
    hasWindEvent     = Math.random() < 0.5; hasRocketEvent   = Math.random() < 0.5; hasMoleEvent     = Math.random() < 0.5;
    hasHeadwindEvent = Math.random() < 0.3; hasSecondKickEvent = Math.random() < 0.5;
    
    const baseEventBonus = Math.max(1, Math.round(getBaseKickPower() * 0.5 * pFactor));
    eventBonus = Math.round(baseEventBonus * (1 + (lvEvent * 0.05))); 
    eventBonusVelScale = eventBonus / 50.0; 

    const maxKickPower = getBaseKickPower();
    baseTargetDistance = maxKickPower * pFactor;
    totalTargetDistance = baseTargetDistance;

    const sf = maxKickPower / 100;
    ballVel.z = -(22 * sf + pFactor * 85 * sf);
    ballVel.y = 8 * Math.sqrt(sf) + pFactor * 30 * Math.sqrt(sf);
    ballVel.x = (Math.random()-0.5) * 1.5;
    ballRot.x = ballVel.z * 0.1;
    isGrounded = false;
    playKickSound(pFactor); gameState = STATES.FLYING;
  }

 // ============================================================
  // PHYSICS UPDATE
  // ============================================================
  // 🚀 핵심 수정: isLastLoop 플래그를 추가해 눈에 보이는 그래픽은 딱 1번만 처리하게 막음!
  function updatePhysics(dt, isLastLoop = true) {
    if (gameState === STATES.KICKING) {
      kickAnimProgress += dt * 8; leftLegPivot.rotation.x = -0.85 + kickAnimProgress * 1.7;
      if (kickAnimProgress >= 1.0) triggerBallLaunch();
    }

    if (gameState === STATES.FLYING) {
      ballVel.y -= 25.0 * dt;
      const altitude = Math.max(0, ballMesh.position.y);
      const baseDrag = 0.996; 
      const airDrag = Math.min(0.9995, baseDrag + (altitude * 0.00002)); 

      ballVel.z *= Math.pow(airDrag, dt * 60); ballVel.x *= Math.pow(airDrag, dt * 60);
      ballMesh.position.x += ballVel.x * dt; ballMesh.position.y += ballVel.y * dt; ballMesh.position.z += ballVel.z * dt;

      if (currentSkin === 'bullet') {
        if (ballVel.y !== 0 || ballVel.z !== 0) ballMesh.lookAt(ballMesh.position.x + ballVel.x, ballMesh.position.y + ballVel.y, ballMesh.position.z + ballVel.z);
      } else { ballMesh.rotation.x += ballRot.x * dt; }

      const cZ = ballMesh.position.z;

      if (hasJetpackEvent && !cpJetpackTriggered && cZ <= -(totalTargetDistance * 0.25)) {
        cpJetpackTriggered = true; showEventBanner('🚀', `JETPACK BOOST! +${eventBonus}m`);
        totalTargetDistance += eventBonus; ballVel.z -= 32.0 * eventBonusVelScale; ballVel.y += 18.0 * eventBonusVelScale;
        isJetpackAttached = true; jetpackGroup.visible = true;
      }
      if (isJetpackAttached) {
        jetpackGroup.position.copy(ballMesh.position); jetpackGroup.position.z += 0.2; 
        if (isLastLoop) createTrailParticle(jetpackGroup.position); 
        if (ballVel.y < 0 && !isJetpackDetached) { isJetpackAttached = false; isJetpackDetached = true; jetpackVelY = -2.0; }
      }
      if (isJetpackDetached && jetpackGroup.visible) {
        jetpackVelY -= 15.0 * dt; jetpackGroup.position.y += jetpackVelY * dt; jetpackGroup.rotation.z += dt * 3;
        if (jetpackGroup.position.y <= 0) jetpackGroup.visible = false;
      }

      if (hasAirplaneEvent && !cpAirplaneTriggered) {
        if (cZ <= -(totalTargetDistance * (1/3)) + 25.0 && !airplaneActive) {
          airplaneActive = true; airplaneProgress = 0; airplaneGroup.position.set(-30, Math.max(ballMesh.position.y, 2.0), -(totalTargetDistance * (1/3)));
          airplaneGroup.visible = true; showEventBanner('✈️', `AIRPLANE BOOST! +${eventBonus}m`);
        }
        if (airplaneActive) {
          airplaneProgress += dt * 2.2; const planeX = -30 + airplaneProgress * 30; airplaneGroup.position.x = planeX;
          airplaneGroup.position.y = ballMesh.position.y; airplaneGroup.position.z = ballMesh.position.z;
          if (planeX >= ballMesh.position.x - 0.2) {
            playBounceSound(); cpAirplaneTriggered = true; airplaneActive = false; airplaneGroup.visible = false;
            totalTargetDistance += eventBonus; ballVel.z -= 40.0 * eventBonusVelScale; ballVel.y += 14.0 * eventBonusVelScale;
          }
        }
      }

      if (hasEagleEvent && !cpEagleTriggered && cZ <= -(totalTargetDistance * 0.50)) {
        cpEagleTriggered = true; showEventBanner('🦅', `EAGLE SNATCH! +${eventBonus}m`); totalTargetDistance += eventBonus;
        isEagleCarrying = true; eagleTimer = 0; eagleGroup.visible = true; ballVel.z -= 30.0 * eventBonusVelScale; ballVel.y += 8.0 * eventBonusVelScale;
      }
      if (isEagleCarrying) {
        eagleTimer += dt * 1.5; eagleGroup.position.copy(ballMesh.position); eagleGroup.position.y += 0.4; eagleGroup.rotation.z = Math.sin(eagleTimer * 10) * 0.1;
        if (eagleTimer >= 1.2) { isEagleCarrying = false; eagleGroup.position.y += dt * 20; setTimeout(() => { eagleGroup.visible = false; }, 800); }
      }

      if (hasWindEvent && !cpWindTriggered && cZ <= -(totalTargetDistance * (2/3))) {
        cpWindTriggered = true; showEventBanner('🌬️', `WIND GUST! +${eventBonus}m`); totalTargetDistance += eventBonus;
        ballVel.z -= 35.0 * eventBonusVelScale; ballVel.y += 12.0 * eventBonusVelScale;
        windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z); windParticlesGroup.visible = true;
        setTimeout(() => { windParticlesGroup.visible = false; }, 2000);
      }

      if (hasRocketEvent && !cpRocketTriggered && cZ <= -(totalTargetDistance * 0.75)) {
        cpRocketTriggered = true; showEventBanner('🚀', `ROCKET THRUST! +${eventBonus}m`); totalTargetDistance += eventBonus;
        isRocketPushing = true; rocketTimer = 0; rocketGroup.visible = true; ballVel.z -= 34.0 * eventBonusVelScale; ballVel.y += 18.0 * eventBonusVelScale;
      }
      if (isRocketPushing) {
        rocketTimer += dt * 1.5; rocketGroup.position.set(ballMesh.position.x, ballMesh.position.y - 0.9, ballMesh.position.z); 
        if (isLastLoop) createTrailParticle(rocketGroup.position); 
        if (rocketTimer >= 1.2) { isRocketPushing = false; setTimeout(() => { rocketGroup.visible = false; }, 800); }
      }

      if (hasHeadwindEvent && !cpHeadwindTriggered && cZ <= -(totalTargetDistance * 0.8)) {
        cpHeadwindTriggered = true; const penaltyDist = getBaseKickPower() * 0.2; showEventBanner('🌪️', `역풍 발생! 거리 감소!`); totalTargetDistance -= penaltyDist;
        ballVel.z += 25.0 * (penaltyDist / 50.0); ballVel.y -= 10.0;
      }

      if (ballMesh.position.y <= BALL_RADIUS) {
        ballMesh.position.y = BALL_RADIUS;
        if (isFireballMode && !hasTouchedGround) { hasTouchedGround = true; clearAllTrailParticles(); }
        if (Math.abs(ballVel.y) > 2.0) { ballVel.y = -ballVel.y * 0.55; ballVel.z *= 0.78; playBounceSound(); } 
        else { ballVel.y = 0; isGrounded = true; ballVel.z *= 0.965; ballRot.x = ballVel.z * 0.1; }
      }

      if (isGrounded && Math.abs(ballVel.z) < 0.3) {
        if (!cpMoleTriggered) {
          cpMoleTriggered = true;
          if (hasMoleEvent) {
            showEventBanner('🦔', `MOLE BOUNCE! +${eventBonus}m`); totalTargetDistance += eventBonus;
            moleGroup.position.set(ballMesh.position.x, 0, ballMesh.position.z); moleGroup.visible = true;
            ballVel.z = -32.0 * eventBonusVelScale; ballVel.y = 16.0 * eventBonusVelScale; isGrounded = false; return;
          }
        }
        if (hasSecondKickEvent && !secondKickTriggered) {
          secondKickTriggered = true; const extraDist = getBaseKickPower() * (power / 100); 
          showEventBanner('🏃‍♂️', `세컨드 킥! 슛!`); totalTargetDistance += extraDist;
          ballVel.z = -35.0 * (extraDist / 50.0); ballVel.y = 15.0; isGrounded = false; playKickSound(power / 100); return; 
        }

        ballVel.z = 0; ballVel.x = 0; ballVel.y = 0; gameState = STATES.STOPPED;
        setTimeout(() => { handleGameOver(Math.abs(ballMesh.position.z)); }, 1000);
      }
    }

    // 🚀 눈에 보여지는 시각 효과들은 50번 루프를 다 돌고 딱 마지막(isLastLoop)에만 실행!
    if (isLastLoop) {
      if (gameState === STATES.FLYING && !hasTouchedGround) {
        if (currentSkin !== 'basic' || isFireballMode) createTrailParticle(ballMesh.position);
      }
      
      updateTrailParticles(); 
      if (currentSkin === 'flame' && Math.random() < 0.5) createTrailParticle(ballMesh.position);
      
      currentDistanceEl.textContent = Math.abs(ballMesh.position.z).toFixed(1) + ' m';
      if (windParticlesGroup.visible) windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);

      if (gameState === STATES.FLYING || gameState === STATES.STOPPED) {
        const targetCamPos = new THREE.Vector3(ballMesh.position.x * 0.5 + 0.3, Math.max(ballMesh.position.y + 2.4, 2.5), ballMesh.position.z + 5.5);
        camera.position.lerp(targetCamPos, 0.08); camera.lookAt(new THREE.Vector3(ballMesh.position.x, ballMesh.position.y + 0.5, ballMesh.position.z - 4.0));
        dirLight.position.set(ballMesh.position.x + 20, 40, ballMesh.position.z + 20);
      } else {
        camera.position.lerp(defaultCamPos, 0.1); camera.lookAt(defaultCamTarget);
      }
    }
  }

  // ============================================================
  // GAME OVER
  // ============================================================
  function handleGameOver(finalDistance) {
    playWhistleSound();
    const baseEarned = Math.floor(finalDistance); const earned = Math.floor(baseEarned * (1 + (lvCoin * 0.1)));
    coins += earned; localStorage.setItem('soccer_coins', coins.toString());

    let isNewBest = false;
    if (finalDistance > bestDistance) {
      bestDistance = finalDistance; localStorage.setItem('soccer_3d_best_distance', bestDistance.toString());
      bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m'; isNewBest = true;
    }

    finalDistanceEl.textContent = finalDistance.toFixed(1) + ' m'; earnedCoinsEl.textContent = '+' + earned.toLocaleString(); updateCurrencyUI();
    resultBadgeEl.style.display = 'inline-block';
    if (isNewBest) { resultBadgeEl.textContent = 'NEW BEST RECORD! 🏆'; resultTitleEl.textContent = 'WORLD CLASS!'; } 
    else if (finalDistance > 300) { resultBadgeEl.textContent = 'SUPER KICK! ⭐'; resultTitleEl.textContent = 'INCREDIBLE!'; } 
    else { resultBadgeEl.style.display = 'none'; resultTitleEl.textContent = 'GREAT KICK!'; }

    resultModalEl.classList.remove('hidden');

    if (firebaseEnabled && playerNickname) {
      if (isNewBest) {
        db.collection('soccer_scores').doc(playerNickname).set({
          nickname: playerNickname, distance: parseFloat(finalDistance.toFixed(2)), timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.warn('[Firebase] 기록 저장 실패:', e.message));
      }
    }
  }

  // ============================================================
  // ANIMATION LOOP & INIT
  // ============================================================
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const rawDt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    updatePower(rawDt);  
    const loops = (gameState === STATES.FLYING || gameState === STATES.KICKING) ? speedMultiplier : 1;
    
    // 🚀 루프를 돌릴 때 마지막 바퀴(i === loops - 1)인지 알려줌
    for (let i = 0; i < loops; i++) {
      updatePhysics(rawDt, i === loops - 1);
    }
    
    updateChunks(); renderer.render(scene, camera);
  }

  initNickname();
  resetGame();
  requestAnimationFrame(animate);
})();
