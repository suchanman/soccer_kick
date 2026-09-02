/**
 * 3D Soccer Kick Game (Three.js WebGL Engine) - Optimized & Refactored
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ============================================================
  // THREE.JS LOAD CHECK & CANVAS VALIDATION
  // ============================================================
  if (typeof THREE === 'undefined') {
    document.body.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; width:100vw; height:100vh; background-color:#111; color:#ef4444; font-family:sans-serif; text-align:center;">
        <h2>오류: Three.js 라이브러리를 불러오지 못했습니다.</h2>
        <p>인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.</p>
      </div>`;
    return;
  }

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error("오류: #gameCanvas 요소를 찾을 수 없습니다.");
    return;
  }
// ============================================================
  // 동적 UI 요소 주입 (고도계 및 스피드 라인 이펙트)
  // ============================================================
 const style = document.createElement('style');
  style.innerHTML = `
    #hud-altitude { 
      position: absolute; top: 70px; right: 20px; 
      color: #38bdf8; font-size: 1.2rem; font-weight: 900; 
      text-shadow: 2px 2px 0 #000; z-index: 10; transition: color 0.3s; 
    }
    #speed-lines-overlay { 
      position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
      pointer-events: none; z-index: 5; opacity: 0; transition: opacity 0.1s;
      background: repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 5deg, rgba(255,255,255,0.2) 5.1deg, rgba(255,255,255,0.2) 5.4deg, transparent 5.5deg, transparent 10deg);
      mix-blend-mode: overlay;
    }
    /* 🌟 추가된 부분: 이벤트 팝업창을 중앙에서 왼쪽으로 치워줍니다! */
    #event-banner-container {
      position: absolute !important;
      top: 30% !important;        /* 화면 위에서 30% 정도 내려온 위치 */
      left: 20px !important;      /* 화면 왼쪽 끝으로 이동 */
      right: auto !important;
      transform: none !important; /* 기존에 설정된 가운데 정렬 강제 해제 */
      aalign-items: flex-start !important; 
      pointer-events: none !important;
    }
    
    /* 🌟 아이디어 2: 워프 터널 배경 (50배속 전용) */
    #warp-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 4; opacity: 0; transition: opacity 0.5s;
      background: radial-gradient(circle at center, transparent 20%, #000 100%), 
                  repeating-conic-gradient(from 0deg, rgba(56, 189, 248, 0.2) 0deg, rgba(56, 189, 248, 0.8) 2deg, transparent 4deg, transparent 10deg);
      animation: warpSpin 1.5s linear infinite; mix-blend-mode: screen;
    }
    @keyframes warpSpin { 100% { transform: scale(2) rotate(360deg); } }
    
    /* 🌟 아이디어 1: 탭 부스트 (물결 이펙트 및 코인 텍스트) */
    .tap-ripple {
      position: absolute; border: 2px solid #38bdf8; border-radius: 50%;
      pointer-events: none; z-index: 20; transform: translate(-50%, -50%) scale(0);
      animation: rippleAnim 0.4s ease-out forwards;
    }
    .tap-coin {
      position: absolute; color: #fde047; font-weight: 900; font-size: 1.5rem; text-shadow: 1px 1px 0 #000;
      pointer-events: none; z-index: 20; transform: translate(-50%, -50%);
      animation: coinAnim 0.6s ease-out forwards;
    }
    @keyframes rippleAnim { 100% { transform: translate(-50%, -50%) scale(3); opacity: 0; } }
    @keyframes coinAnim { 0% { opacity: 1; margin-top: 0; } 100% { opacity: 0; margin-top: -50px; } }
  `;
  document.head.appendChild(style);

  // 워프 배경 요소를 화면에 주입
  const warpEl = document.createElement('div');
  warpEl.id = 'warp-overlay';
  document.body.appendChild(warpEl);

  const altEl = document.createElement('div');
  altEl.id = 'hud-altitude';
  altEl.textContent = '고도: 0.0 m';
  document.body.appendChild(altEl);

  const speedLinesEl = document.createElement('div');
  speedLinesEl.id = 'speed-lines-overlay';
  document.body.appendChild(speedLinesEl);
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
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseEnabled = true;
    }
  } catch (e) {
    console.warn('[Firebase] 초기화 실패:', e.message);
  }

  let playerNickname = localStorage.getItem('soccer_nickname') || '';

  // ============================================================
  // UI ELEMENT REFS (Optional Chaining applied in usage)
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
    if (!eventBannerContainer) return;
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
      nicknameModalEl?.classList.add('hidden');
    } else {
      nicknameModalEl?.classList.remove('hidden');
    }
  }

  function submitNickname() {
    if (!nicknameInputEl) return;
    const val = nicknameInputEl.value.trim();
    if (val.length > 0) {
      playerNickname = val;
      localStorage.setItem('soccer_nickname', val);
      nicknameModalEl?.classList.add('hidden');
    } else {
      nicknameInputEl.style.borderColor = 'rgba(239,68,68,0.8)';
      setTimeout(() => { nicknameInputEl.style.borderColor = ''; }, 800);
    }
  }

  nicknameSubmitBtn?.addEventListener('click', submitNickname);
  nicknameInputEl?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitNickname(); });

  async function loadRanking() {
    if (!rankingListEl) return;
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

      const rCount = data.rebirth || 0;
      let badge = rCount > 0 ? '⭐'.repeat(Math.min(rCount, 3)) : '';
      if (rCount >= 5) badge = '🌟'; // 환생 5번 이상은 빛나는 별!
      const nickname = (data.nickname || '익명') + ' ' + badge;
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

  rankingBtn?.addEventListener('click', () => { rankingModalEl?.classList.remove('hidden'); loadRanking(); });
  rankingCloseBtn?.addEventListener('click', () => { rankingModalEl?.classList.add('hidden'); });

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
  // ============================================================
  // MULTI-UPGRADE SYSTEM & 🌌 REBIRTH (환생) SYSTEM
  // ============================================================
  let coins = parseInt(localStorage.getItem('soccer_coins') || '0', 10);
  let lvKick  = parseInt(localStorage.getItem('soccer_upg_kick') || '0', 10);
  let lvPower = parseInt(localStorage.getItem('soccer_upg_power') || '0', 10);
  let lvEvent = parseInt(localStorage.getItem('soccer_upg_event') || '0', 10);
  let lvCoin  = parseInt(localStorage.getItem('soccer_upg_coin') || '0', 10);

  // 🌟 환생 변수들 (우주 결정, 슈퍼 업그레이드)
  let rebirthCount = parseInt(localStorage.getItem('soccer_rebirth_count') || '0', 10);
  let crystals = parseInt(localStorage.getItem('soccer_crystals') || '0', 10);
  let lvSuperPower = parseInt(localStorage.getItem('soccer_upg_super_power') || '0', 10);
  let lvSuperCoin = parseInt(localStorage.getItem('soccer_upg_super_coin') || '0', 10);
  let lvStartingWarp = parseInt(localStorage.getItem('soccer_upg_starting_warp') || '0', 10);

  function getBaseKickPower() { return 100 + lvKick * 10; }
  function getCost(lv) { return Math.floor(100 * Math.pow(1.2, lv)); }

  // 🌟 환생 전용 UI 동적 생성 (HTML 수정 불필요)
  const rebirthStyles = document.createElement('style');
  rebirthStyles.innerHTML = `
    .btn-rebirth-hud { position: absolute; top: 120px; left: 20px; background: linear-gradient(135deg, #7e22ce, #c026d3); border: 2px solid #e879f9; color: white; padding: 10px 16px; border-radius: 12px; font-weight: 900; box-shadow: 0 0 15px rgba(192,38,211,0.6); cursor: pointer; z-index: 50; }
    #crystal-display { position: absolute; top: 170px; left: 20px; color: #e879f9; font-weight: 900; font-size: 1.1rem; text-shadow: 1px 1px 0 #000; z-index: 50; }
    .rebirth-modal-content { background: rgba(30,20,50,0.95); border-color: #a855f7; }
    .rb-item { display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 10px; margin-bottom: 8px; font-size:0.85rem; color:#e2e8f0; }
    .btn-rb-buy { background: #9333ea; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    .btn-rb-buy:disabled { background: #475569; color: #94a3b8; }
  `;
  document.head.appendChild(rebirthStyles);

  const rbBtn = document.createElement('button');
  rbBtn.className = 'btn-rebirth-hud';
  rbBtn.textContent = '🌌 환생 스탯';
  rbBtn.onclick = () => { document.getElementById('rebirth-modal').classList.remove('hidden'); updateRebirthUI(); };
  document.body.appendChild(rbBtn);

  const crystalDisp = document.createElement('div');
  crystalDisp.id = 'crystal-display';
  document.body.appendChild(crystalDisp);

  const rbModal = document.createElement('div');
  rbModal.id = 'rebirth-modal';
  rbModal.className = 'modal-overlay hidden';
  rbModal.innerHTML = `
    <div class="modal-content rebirth-modal-content">
      <h2 style="color:#e879f9; margin-bottom: 5px;">🌌 우주 환생 🌌</h2>
      <p style="font-size:0.8rem; color:#cbd5e1; margin-bottom: 15px;">최고 기록 10,000m마다 우주 결정 1개 획득<br>(환생 시 모든 일반 코인과 레벨이 초기화됩니다)</p>
      
      <button id="btn-do-rebirth" class="btn-primary" style="background: linear-gradient(135deg, #be185d, #e11d48); margin-bottom: 20px;">지금 환생하기</button>

      <div style="text-align: left; margin-bottom: 5px; color:#e879f9; font-weight:bold;">보유 결정: <span id="modal-crystals">0</span>개</div>
      
      <div class="rb-item"><div><span>슈퍼 파워 (+100%)</span><br><span id="rb-lvl-power" style="color:#fde047;">Lv.0</span></div><button id="btn-rb-power" class="btn-rb-buy">구매</button></div>
      <div class="rb-item"><div><span>슈퍼 코인 (+500%)</span><br><span id="rb-lvl-coin" style="color:#fde047;">Lv.0</span></div><button id="btn-rb-coin" class="btn-rb-buy">구매</button></div>
      <div class="rb-item"><div><span>스타팅 워프 (+10km)</span><br><span id="rb-lvl-warp" style="color:#fde047;">Lv.0</span></div><button id="btn-rb-warp" class="btn-rb-buy">구매</button></div>
      
      <button onclick="document.getElementById('rebirth-modal').classList.add('hidden')" class="btn-upgrade" style="margin-top: 15px;">닫기</button>
    </div>
  `;
  document.body.appendChild(rbModal);

  function updateRebirthUI() {
    crystalDisp.textContent = `💎 결정: ${crystals}개`;
    document.getElementById('modal-crystals').textContent = crystals;
    
    let expectedCrystals = Math.floor(bestDistance / 10000);
    const rbBtnMain = document.getElementById('btn-do-rebirth');
    rbBtnMain.textContent = expectedCrystals > 0 ? `지금 환생 (결정 +${expectedCrystals}개)` : `환생 불가 (10,000m 필요)`;
    rbBtnMain.disabled = expectedCrystals <= 0;

    document.getElementById('rb-lvl-power').textContent = `Lv.${lvSuperPower} (비용: ${lvSuperPower+1}개)`; document.getElementById('btn-rb-power').disabled = crystals < lvSuperPower+1;
    document.getElementById('rb-lvl-coin').textContent = `Lv.${lvSuperCoin} (비용: ${lvSuperCoin+1}개)`; document.getElementById('btn-rb-coin').disabled = crystals < lvSuperCoin+1;
    document.getElementById('rb-lvl-warp').textContent = `Lv.${lvStartingWarp} (비용: ${(lvStartingWarp+1)*2}개)`; document.getElementById('btn-rb-warp').disabled = crystals < (lvStartingWarp+1)*2;
  }

  document.getElementById('btn-do-rebirth').onclick = () => {
    let expectedCrystals = Math.floor(bestDistance / 10000);
    if(expectedCrystals > 0) {
      crystals += expectedCrystals; rebirthCount++;
      localStorage.setItem('soccer_crystals', crystals); localStorage.setItem('soccer_rebirth_count', rebirthCount);
      
      // 하드 리셋 (환생)
      coins = 0; lvKick = 0; lvPower = 0; lvEvent = 0; lvCoin = 0; bestDistance = 0;
      localStorage.setItem('soccer_coins', 0); localStorage.setItem('soccer_upg_kick', 0); localStorage.setItem('soccer_upg_power', 0);
      localStorage.setItem('soccer_upg_event', 0); localStorage.setItem('soccer_upg_coin', 0); localStorage.setItem('soccer_3d_best_distance', 0);
      
      if(firebaseEnabled && playerNickname) { // 랭킹에 환생 횟수 업데이트
        db.collection('soccer_scores').doc(playerNickname).set({ nickname: playerNickname, distance: 0, rebirth: rebirthCount, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
      }
      alert(`우주 환생 성공!\n우주 결정 ${expectedCrystals}개를 얻었습니다.`);
      location.reload(); // 깔끔하게 새로고침
    }
  };

  document.getElementById('btn-rb-power').onclick = () => { const c = lvSuperPower+1; if(crystals >= c){ crystals-=c; lvSuperPower++; localStorage.setItem('soccer_crystals', crystals); localStorage.setItem('soccer_upg_super_power', lvSuperPower); updateRebirthUI(); }};
  document.getElementById('btn-rb-coin').onclick = () => { const c = lvSuperCoin+1; if(crystals >= c){ crystals-=c; lvSuperCoin++; localStorage.setItem('soccer_crystals', crystals); localStorage.setItem('soccer_upg_super_coin', lvSuperCoin); updateRebirthUI(); }};
  document.getElementById('btn-rb-warp').onclick = () => { const c = (lvStartingWarp+1)*2; if(crystals >= c){ crystals-=c; lvStartingWarp++; localStorage.setItem('soccer_crystals', crystals); localStorage.setItem('soccer_upg_starting_warp', lvStartingWarp); updateRebirthUI(); }};
  updateRebirthUI();

  const upgradeModalEl = document.getElementById('upgrade-modal');
  document.getElementById('upgrade-tab-btn')?.addEventListener('click', () => { upgradeModalEl?.classList.remove('hidden'); updateCurrencyUI(); });
  document.getElementById('upgrade-close-btn')?.addEventListener('click', () => upgradeModalEl?.classList.add('hidden'));

  function updateCurrencyUI() {
    if (hudCoinsEl) hudCoinsEl.textContent = coins.toLocaleString();
    if (hudKickPowerEl) hudKickPowerEl.textContent = getBaseKickPower() + 'm';
    if(!document.getElementById('upg-current-coins')) return; 
    
    document.getElementById('upg-current-coins').textContent = coins.toLocaleString();
    document.getElementById('upg-lvl-kick').textContent = 'Lv.' + lvKick; document.getElementById('upg-val-kick').textContent = getBaseKickPower() + 'm'; document.getElementById('upg-cost-kick').textContent = getCost(lvKick).toLocaleString(); document.getElementById('upg-btn-kick').disabled = coins < getCost(lvKick);
    document.getElementById('upg-lvl-power').textContent = 'Lv.' + lvPower; document.getElementById('upg-val-power').textContent = '+' + (lvPower * 5) + '%'; document.getElementById('upg-cost-power').textContent = getCost(lvPower).toLocaleString(); document.getElementById('upg-btn-power').disabled = coins < getCost(lvPower);
    document.getElementById('upg-lvl-event').textContent = 'Lv.' + lvEvent; document.getElementById('upg-val-event').textContent = '+' + (lvEvent * 5) + '%'; document.getElementById('upg-cost-event').textContent = getCost(lvEvent).toLocaleString(); document.getElementById('upg-btn-event').disabled = coins < getCost(lvEvent);
    document.getElementById('upg-lvl-coin').textContent = 'Lv.' + lvCoin; document.getElementById('upg-val-coin').textContent = '+' + (lvCoin * 10) + '%'; document.getElementById('upg-cost-coin').textContent = getCost(lvCoin).toLocaleString(); document.getElementById('upg-btn-coin').disabled = coins < getCost(lvCoin);
  }

  function buyUpgrade(type) {
    let cost = 0;
    if (type === 'kick')  { cost = getCost(lvKick);  if (coins >= cost) { coins -= cost; lvKick++;  localStorage.setItem('soccer_upg_kick', lvKick); } }
    if (type === 'power') { cost = getCost(lvPower); if (coins >= cost) { coins -= cost; lvPower++; localStorage.setItem('soccer_upg_power', lvPower); } }
    if (type === 'event') { cost = getCost(lvEvent); if (coins >= cost) { coins -= cost; lvEvent++; localStorage.setItem('soccer_upg_event', lvEvent); } }
    if (type === 'coin')  { cost = getCost(lvCoin);  if (coins >= cost) { coins -= cost; lvCoin++;  localStorage.setItem('soccer_upg_coin', lvCoin); } }
    localStorage.setItem('soccer_coins', coins.toString()); updateCurrencyUI();
  }

  document.getElementById('upg-btn-kick')?.addEventListener('click', () => buyUpgrade('kick')); document.getElementById('upg-btn-power')?.addEventListener('click', () => buyUpgrade('power'));
  document.getElementById('upg-btn-event')?.addEventListener('click', () => buyUpgrade('event')); document.getElementById('upg-btn-coin')?.addEventListener('click', () => buyUpgrade('coin'));

  let bestDistance = parseFloat(localStorage.getItem('soccer_3d_best_distance') || '0');
  if (bestDistanceEl) bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m';

  // ============================================================
  // SKIN SHOP SYSTEM
  // ============================================================
  let currentSkin = localStorage.getItem('soccer_skin') || 'basic';
  // ============================================================
  // SKIN SHOP SYSTEM (환생 전용 블랙홀 스킨 추가)
  // ============================================================
  let currentSkin = localStorage.getItem('soccer_skin') || 'basic';
  const SKINS = {
    basic:   { name: '기본 공', req: 0, bonus: 0, desc: '보유 효과: 없음' },
    rainbow: { name: '🌈 무지개 공', req: 100000, bonus: 0.1, desc: '보유 효과: 킥 파워 +10%' },
    bullet:  { name: '🚀 총알 공', req: 1000000, bonus: 0.5, desc: '보유 효과: 킥 파워 +50%' },
    flame:   { name: '🔥 불타는 공', req: 10000000, bonus: 1.0, desc: '보유 효과: 킥 파워 +100%' },
    blackhole:{ name: '🌌 블랙홀 공', req: 999999999, bonus: 5.0, desc: '보유 효과: 킥 파워 +500% (환생 전용)' }
  };

  function getSkinPowerBonus() {
    let bonus = 0;
    if (bestDistance >= SKINS.rainbow.req) bonus += SKINS.rainbow.bonus;
    if (bestDistance >= SKINS.bullet.req) bonus += SKINS.bullet.bonus;
    if (bestDistance >= SKINS.flame.req) bonus += SKINS.flame.bonus;
    if (rebirthCount > 0) bonus += SKINS.blackhole.bonus; // 환생 유저는 무조건 블랙홀 보너스 적용!
    return bonus;
  }

  const skinModalEl = document.getElementById('skin-modal');
  document.getElementById('skin-tab-btn')?.addEventListener('click', () => { skinModalEl?.classList.remove('hidden'); renderSkinList(); });
  document.getElementById('skin-close-btn')?.addEventListener('click', () => skinModalEl?.classList.add('hidden'));

  function renderSkinList() {
    const container = document.getElementById('skin-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    Object.keys(SKINS).forEach(key => {
      const s = SKINS[key];
      // 블랙홀 스킨은 환생 1회 이상이면 무조건 해금!
      const isUnlocked = key === 'blackhole' ? (rebirthCount > 0) : (bestDistance >= s.req);
      const isEquipped = currentSkin === key;
      
      const item = document.createElement('div');
      item.className = 'ranking-item'; item.style.flexDirection = 'column'; item.style.gap = '8px';
      
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; font-weight:bold;">
          <span style="color:${isUnlocked ? 'white' : '#64748b'};">${s.name} ${isUnlocked ? '' : '🔒'}</span>
          <span style="color:#38bdf8; font-size:0.8rem;">${s.desc}</span>
        </div>
        <div style="display:flex; justify-content:space-between; width:100%; font-size:0.75rem; color:#94a3b8; align-items:center;">
          해제: ${key === 'blackhole' ? '환생 1회 이상' : (s.req === 0 ? '기본 제공' : (s.req.toLocaleString() + 'm 이상'))}
          <button class="btn-upgrade" style="width:auto; padding:6px 12px; font-size:0.8rem; background:${isEquipped ? '#22c55e' : (isUnlocked ? '#3b82f6' : '#475569')}" ${isUnlocked ? '' : 'disabled'}>
            ${isEquipped ? '장착 중' : (isUnlocked ? '장착하기' : '잠김')}
          </button>
        </div>
      `;
      if (isUnlocked && !isEquipped) {
        item.querySelector('button').addEventListener('click', () => {
          currentSkin = key; localStorage.setItem('soccer_skin', currentSkin);
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
  speedBtnEl?.addEventListener('click', () => {
    speedMultiplier = speedMultiplier === 1 ? 50 : 1;
    speedBtnEl.textContent = speedMultiplier === 1 ? '▶▶ 1x' : '▶▶▶ 50x';
    speedBtnEl.classList.toggle('active', speedMultiplier === 50);
  });

  // ============================================================
  // THREE.JS SETUP & OPTIMIZATION
  // ============================================================
  const scene  = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb');
  scene.fog        = new THREE.FogExp2('#87ceeb', 0.0025);

  const camera   = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // ✅ Pixel Ratio 제한 (1.5)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  scene.add(new THREE.AmbientLight('#ffffff', 0.6));
  scene.add(new THREE.HemisphereLight('#87ceeb', '#15803d', 0.4));

  const dirLight = new THREE.DirectionalLight('#ffffff', 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 1024; // ✅ 그림자 해상도 최적화 (2048 -> 1024)
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near   = 0.5;
  dirLight.shadow.camera.far    = 150;
  dirLight.shadow.camera.left   = -30;
  dirLight.shadow.camera.right  = 30;
  dirLight.shadow.camera.top    = 30;
  dirLight.shadow.camera.bottom = -30;
  scene.add(dirLight);

  // ✅ 카메라 이동 매 프레임 Vector3 할당 방지를 위한 전역 변수
  const currentCamPos = new THREE.Vector3();
  const targetCamPos = new THREE.Vector3();
  const targetCamLookAt = new THREE.Vector3();

  // ============================================================
  // 🌟 고도 환경 요소 (별, 구름, UFO, 인공위성) 추가
  // ============================================================
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 1500;
  const starsPos = new Float32Array(starsCount * 3);
  for(let i=0; i<starsCount*3; i+=3) {
    starsPos[i] = (Math.random() - 0.5) * 1000;
    starsPos[i+1] = 400 + Math.random() * 2000; // 400m 이상 상공에만 배치
    starsPos[i+2] = (Math.random() - 0.5) * 1000;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
  const starsMat = new THREE.PointsMaterial({ size: 1.5, color: 0xffffff, transparent: true, opacity: 0 });
  const starsMesh = new THREE.Points(starsGeo, starsMat);
  scene.add(starsMesh);

  const cloudsGroup = new THREE.Group();
  const cloudGeo = new THREE.SphereGeometry(4, 8, 8);
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 });
  for(let i=0; i<8; i++) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set((Math.random()-0.5)*40, 80 + Math.random()*40, (Math.random()-0.5)*40);
    cloud.scale.set(1 + Math.random(), 0.3, 1 + Math.random());
    cloudsGroup.add(cloud);
  }
  scene.add(cloudsGroup);

  const ufoGroup = new THREE.Group();
  const ufoDisk = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.5, 16), new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9 }));
  const ufoDome = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshStandardMaterial({ color: '#22d3ee', transparent: true, opacity: 0.7 }));
  ufoDome.position.y = 1;
  ufoGroup.add(ufoDisk, ufoDome);
  ufoGroup.position.set(15, 500, 0); // 500m 위치
  scene.add(ufoGroup);

  const satGroup = new THREE.Group();
  const satBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 8), new THREE.MeshStandardMaterial({ color: '#cbd5e1' }));
  const satPanel = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 2), new THREE.MeshStandardMaterial({ color: '#1d4ed8', metalness: 0.5 }));
  satGroup.add(satBody, satPanel);
  satGroup.position.set(-15, 1000, 0); // 1000m 위치
  scene.add(satGroup);
  
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
  // INFINITE CHUNK SYSTEM & GEOMETRY SHARING
  // ============================================================
  const CHUNK_SIZE = 1000;
  const loadedChunks = new Map();
  const groundMaterial = new THREE.MeshStandardMaterial({ map: createGrassTexture(), roughness: 0.8, metalness: 0.1 });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.5, roughness: 0.3 });

  // ✅ 공용 Geometry 캐싱 (생성 삭제 최적화)
  const sharedGroundGeo = new THREE.PlaneGeometry(60, CHUNK_SIZE);
  const sharedPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8);
  const sharedBannerGeo = new THREE.PlaneGeometry(2.5, 1.25);
  const bannerMatCache = new Map(); // ✅ 텍스처/머테리얼 캐싱

  const startGround = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), groundMaterial);
  startGround.rotation.x = -Math.PI / 2; startGround.position.set(0, 0, 5); startGround.receiveShadow = true;
  scene.add(startGround);

  function getBannerMaterial(dist) {
    if (bannerMatCache.has(dist)) return bannerMatCache.get(dist);
    
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128;
    const bCtx = bc.getContext('2d');
    bCtx.fillStyle = '#ef4444'; bCtx.fillRect(0, 0, 256, 128);
    bCtx.strokeStyle = '#fde047'; bCtx.lineWidth = 10; bCtx.strokeRect(0, 0, 256, 128);
    bCtx.fillStyle = '#ffffff'; bCtx.font = '900 48px Pretendard, sans-serif'; bCtx.textAlign = 'center';
    
    if (dist >= 1000) bCtx.fillText((dist / 1000).toFixed(1) + 'km', 128, 80);
    else bCtx.fillText(dist + 'm', 128, 80);

    const bannerTex = new THREE.CanvasTexture(bc);
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide });
    bannerMatCache.set(dist, bannerMat);
    return bannerMat;
  }

  function createChunk(chunkIndex) {
    if (loadedChunks.has(chunkIndex)) return;
    const meshes = [];
    const startDist = chunkIndex * CHUNK_SIZE; const centerZ = -(startDist + CHUNK_SIZE / 2);

    const groundMesh = new THREE.Mesh(sharedGroundGeo, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2; groundMesh.position.set(0, 0, centerZ); groundMesh.receiveShadow = true;
    scene.add(groundMesh); meshes.push(groundMesh);

    for (let dist = startDist + 500; dist <= startDist + CHUNK_SIZE; dist += 500) {
      const zPos = -dist;
      const poleMesh = new THREE.Mesh(sharedPoleGeo, poleMaterial);
      poleMesh.position.set(-8.0, 2.0, zPos); poleMesh.castShadow = true;
      scene.add(poleMesh); meshes.push(poleMesh);

      const bannerMat = getBannerMaterial(dist);
      const bannerMesh = new THREE.Mesh(sharedBannerGeo, bannerMat);
      bannerMesh.position.set(-6.7, 3.2, zPos);
      bannerMesh.castShadow = false; // ✅ 표지판 그림자 제거 (최적화)
      bannerMesh.receiveShadow = false;
      scene.add(bannerMesh); meshes.push(bannerMesh);
    }
    // Geometries & Materials are shared, no need to track for dispose
    loadedChunks.set(chunkIndex, meshes);
  }

  function removeChunk(chunkIndex) {
    const meshes = loadedChunks.get(chunkIndex);
    if (!meshes) return;
    meshes.forEach(m => scene.remove(m));
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
  // MULTI-TRAIL SYSTEM (객체 풀링 적용, 최대 개수 제한)
  // ============================================================
  const MAX_TRAILS = 100;
  const trailParticles = [];
  const trailPool = { rainbow: [], bullet: [], basic: [], flame: [] };
  const trailGroup = new THREE.Group();
  scene.add(trailGroup);

  function getTrailMesh(type) {
    if (trailPool[type] && trailPool[type].length > 0) {
      return trailPool[type].pop();
    }
    let mesh;
    if (type === 'rainbow') {
      const cols = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'];
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial({ color: cols[0], transparent: true, opacity: 0.8 }));
    } else if (type === 'bullet') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }));
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff4500', transparent: true, opacity: 0.9 }));
    }
    mesh.userData.type = type;
    return mesh;
  }

  function createTrailParticle(pos) {
    if (trailParticles.length >= MAX_TRAILS) return;
    
    const type = currentSkin;
    const mesh = getTrailMesh(type);
    let decay = 0.05;

    if (type === 'rainbow' || type === 'basic' || type === 'flame') {
      const scale = Math.random() * 0.15 + 0.1;
      mesh.scale.set(scale, scale, scale);
      if (type === 'rainbow') {
        const cols = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'];
        mesh.material.color.set(cols[Math.floor(Math.random() * cols.length)]);
      } else {
        mesh.material.color.set(Math.random() > 0.5 ? '#ff4500' : '#ffcc00');
      }
    } else if (type === 'bullet') {
      mesh.scale.set(1, 1, 1);
      mesh.rotation.copy(ballMesh.rotation);
      mesh.position.z += Math.random() * 0.2;
      decay = 0.08;
    }

    mesh.position.copy(pos);
    if(type !== 'bullet') { 
      mesh.position.x += (Math.random()-0.5)*0.2; 
      mesh.position.y += (Math.random()-0.5)*0.2; 
      mesh.position.z += (Math.random()-0.5)*0.2; 
    }
    
    mesh.material.opacity = 0.8;
    trailGroup.add(mesh);
    trailParticles.push({ mesh: mesh, life: 1.0, decay: decay });
  }

  function clearAllTrailParticles() {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const tp = trailParticles[i];
      trailGroup.remove(tp.mesh);
      if (trailPool[tp.mesh.userData.type]) trailPool[tp.mesh.userData.type].push(tp.mesh);
    }
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

  // 고도 돌파 이벤트 플래그
  let alt200Triggered = false;
  let alt500Triggered = false;
  let alt1000Triggered = false;
  
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

    // 환경 효과 리셋
    alt200Triggered = alt500Triggered = alt1000Triggered = false;
    speedLinesEl.style.opacity = 0;
    scene.background = new THREE.Color('#87ceeb');
    scene.fog.color = scene.background;
    scene.fog.density = 0.0025;
    starsMat.opacity = 0;
    camera.fov = 55;
    camera.updateProjectionMatrix();
    if (altEl) altEl.textContent = '고도: 0.0 m';

    
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
    
    if (currentDistanceEl) currentDistanceEl.textContent = '0.0 m';
    
    if (startInstructionEl) {
      if (!localStorage.getItem('soccer_tutorial_seen')) startInstructionEl.classList.remove('fade-out');
      else startInstructionEl.classList.add('fade-out');
    }
    
    resultModalEl?.classList.add('hidden');
    if (eventBannerContainer) eventBannerContainer.innerHTML = '';
    speedMultiplier = 1; 
    if (speedBtnEl) { speedBtnEl.textContent = '▶▶ 1x'; speedBtnEl.classList.remove('active'); }
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
      startInstructionEl?.classList.add('fade-out');
      localStorage.setItem('soccer_tutorial_seen', 'true');
    }
  }

  function handlePressEnd() {
    if (gameState === STATES.CHARGING) {
      gameState = STATES.KICKING;
    }
  }

  kickBtnEl?.addEventListener('pointerdown', handlePressStart);
  kickBtnEl?.addEventListener('pointerup', handlePressEnd);
  kickBtnEl?.addEventListener('pointerleave', () => { if (gameState === STATES.CHARGING) handlePressEnd(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) handlePressStart(); });
  window.addEventListener('keyup',   (e) => { if (e.code === 'Space') handlePressEnd(); });
  restartBtn?.addEventListener('click', resetGame);

  // ============================================================
  // POWER GAUGE & LAUNCH
  // ============================================================
  function updatePowerUI() {
    const p = Math.min(Math.max(Math.floor(power), 0), 100);
    if (powerNumberEl) powerNumberEl.textContent = p + '%';
    if (powerBarEl) {
      powerBarEl.style.width = p + '%';
      powerBarEl.style.boxShadow = p > 85 ? '0 0 20px rgba(255,0,85,0.9)' : p > 60 ? '0 0 15px rgba(234,179,8,0.7)' : '0 0 10px rgba(34,197,94,0.5)';
    }
  }

  let hasBlackholeEvent = false; let cpBlackholeTriggered = false;

  function triggerBallLaunch() {
    let pFactor = power / 100;
    
    // 🌟 슈퍼 파워(lvSuperPower) 보너스 곱연산 (레벨당 파워 +100% 폭풍 증가)
    pFactor = pFactor * (1 + (lvPower * 0.05) + getSkinPowerBonus()) * (1 + (lvSuperPower * 1.0)); 

    if (Math.random() < 0.5) { pFactor *= 2.0; showEventBanner('🔥', `강화킥 발동! 파워 2배!`); }
    
    isFireballMode   = (power >= 80) || (pFactor >= 1.5);
    hasTouchedGround = false;

    hasJetpackEvent  = Math.random() < 0.5; hasAirplaneEvent = Math.random() < 0.5; hasEagleEvent    = Math.random() < 0.5;
    hasWindEvent     = Math.random() < 0.5; hasRocketEvent   = Math.random() < 0.5; hasMoleEvent     = Math.random() < 0.5;
    hasHeadwindEvent = Math.random() < 0.3; hasSecondKickEvent = Math.random() < 0.5;
    
    // 🌟 환생을 한 번이라도 했다면 25% 확률로 우주의 기운 블랙홀 이벤트 발동!
    hasBlackholeEvent = (rebirthCount > 0 && Math.random() < 0.25);
    cpBlackholeTriggered = false;
    
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

    // 🌟 스타팅 워프 발동 (시작하자마자 엄청난 거리를 스킵)
    if (lvStartingWarp > 0) {
      const warpDist = lvStartingWarp * 10000;
      ballMesh.position.z = -warpDist; // 즉시 공간이동
      totalTargetDistance += warpDist;
      showEventBanner('🌠', `스타팅 워프! ${warpDist.toLocaleString()}m 스킵!`);
    }
  }

  function updatePhysics(dt) {
    if (gameState === STATES.CHARGING) {
      power += POWER_SPEED * dt; if (power >= 100) power = power % 100;
      leftLegPivot.rotation.x = -(power / 100) * 0.85;
    }
    
    if (gameState === STATES.KICKING) {
      kickAnimProgress += dt * 8; leftLegPivot.rotation.x = -0.85 + kickAnimProgress * 1.7;
      if (kickAnimProgress >= 1.0) triggerBallLaunch();
    }

    if (gameState === STATES.FLYING) {
      ballVel.y -= 25.0 * dt;
      const altitude = Math.max(0, ballMesh.position.y);
      const airDrag = Math.min(0.9995, 0.996 + (altitude * 0.00002)); 

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

      // 🌟 환생 전용 블랙홀 특수 이벤트 발동!
      if (hasBlackholeEvent && !cpBlackholeTriggered && cZ <= -(totalTargetDistance * 0.60)) {
        cpBlackholeTriggered = true;
        // 슈퍼 파워에 비례해서 미친듯한 웜홀 스킵 발생!
        const jump = 50000 * (1 + lvSuperPower); 
        showEventBanner('🌀', `블랙홀 흡수! ${jump.toLocaleString()}m 워프!`);
        totalTargetDistance += jump;
        
        // 슉! 하고 공간이동
        ballMesh.position.z -= jump;
        ballVel.z -= 50.0; // 워프 후 추진력 리필
        ballVel.y += 20.0;
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
        if (rocketTimer >= 1.2) { isRocketPushing = false; setTimeout(() => { rocketGroup.visible = false; }, 800); }
      }

      if (hasHeadwindEvent && !cpHeadwindTriggered && cZ <= -(totalTargetDistance * 0.8)) {
        cpHeadwindTriggered = true; const penaltyDist = getBaseKickPower() * 0.2; showEventBanner('🌪️', `역풍 발생! 거리 감소!`); totalTargetDistance -= penaltyDist;
        ballVel.z += 25.0 * (penaltyDist / 50.0); ballVel.y -= 10.0;
      }

      if (ballMesh.position.y <= BALL_RADIUS) {
        ballMesh.position.y = BALL_RADIUS;
        if (isFireballMode && !hasTouchedGround) { hasTouchedGround = true; clearAllTrailParticles(); }
        
        // 🌟 수정된 부분: 앞으로 가는 힘(Z축)이 다 죽었는데 위아래로만 튀려고 하면 강제로 착지(멈춤)시킴!
        if (Math.abs(ballVel.z) < 2.0) {
          ballVel.y = 0; 
          ballVel.z = 0;
          isGrounded = true; 
        } 
        else if (Math.abs(ballVel.y) > 2.0) { 
          ballVel.y = -ballVel.y * 0.55; 
          ballVel.z *= 0.78; 
          playBounceSound(); 
        } 
        else { 
          ballVel.y = 0; isGrounded = true; ballVel.z *= 0.965; ballRot.x = ballVel.z * 0.1; 
        }
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
          secondKickTriggered = true; 
          
          // 🌟 처음 찰 때와 완벽히 동일한 풀파워(업그레이드+스킨 보너스)를 다시 계산!
          let pFactor = power / 100;
          pFactor = pFactor * (1 + (lvPower * 0.05) + getSkinPowerBonus());
          // 🌟 추가된 핵심 로직: 
          // 공중 이벤트(제트팩 등)가 없어서 빨리 떨어지는 것을 막기 위해,
          // 세컨드 킥은 발사 파워 자체를 무조건 2.5배로 증폭시켜 하늘 끝까지 날려버립니다!
          pFactor *= 2.5;
          
          const maxKickPower = getBaseKickPower();
          const sf = maxKickPower / 100;
          
          const extraDist = maxKickPower * pFactor; 
          showEventBanner('🏃‍♂️', `세컨드 킥! 풀파워 재발사!`); 
          totalTargetDistance += extraDist;
          
          // 🌟 찔끔 날아가는 대신, 처음 발사 공식을 그대로 가져와서 시원하게 날려버림
          ballVel.z = -(22 * sf + pFactor * 85 * sf);
          ballVel.y = 8 * Math.sqrt(sf) + pFactor * 30 * Math.sqrt(sf);
          ballVel.x = (Math.random()-0.5) * 1.5;
          
          isGrounded = false; 
          playKickSound(pFactor); 
          return; 
        }

        ballVel.z = 0; ballVel.x = 0; ballVel.y = 0; gameState = STATES.STOPPED;
        setTimeout(() => { handleGameOver(Math.abs(ballMesh.position.z)); }, 1000);
      }
    }
  }

  // ============================================================
  // VISUALS & UI UPDATE (프레임당 1회 실행)
  // ============================================================
  // ============================================================
  // VISUALS & UI UPDATE (프레임당 1회 실행)
  // ============================================================
  function updateVisuals() {
    if (gameState === STATES.CHARGING) updatePowerUI();

    if (gameState === STATES.FLYING && !hasTouchedGround) {
      if (currentSkin !== 'basic' || isFireballMode) createTrailParticle(ballMesh.position);
    }
    if (isJetpackAttached) createTrailParticle(jetpackGroup.position);
    if (isRocketPushing) createTrailParticle(rocketGroup.position);
    if (currentSkin === 'flame' && Math.random() < 0.5) createTrailParticle(ballMesh.position);
    
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const tp = trailParticles[i];
      tp.life -= tp.decay;
      if (currentSkin === 'bullet') tp.mesh.scale.set(tp.life, 1, tp.life); else tp.mesh.scale.multiplyScalar(0.92);
      tp.mesh.material.opacity = tp.life;
      
      if (tp.life <= 0) {
        trailGroup.remove(tp.mesh);
        if (trailPool[tp.mesh.userData.type]) trailPool[tp.mesh.userData.type].push(tp.mesh);
        trailParticles.splice(i, 1);
      }
    }

    if (windParticlesGroup.visible) windParticlesGroup.position.set(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z);

    // 🌟 고도(Y축)에 따른 UI 및 랜드마크 갱신
    const alt = Math.max(0, ballMesh.position.y);
    if (altEl) altEl.textContent = '고도: ' + alt.toFixed(1) + ' m';
    if (currentDistanceEl) currentDistanceEl.textContent = Math.abs(ballMesh.position.z).toFixed(1) + ' m';

    cloudsGroup.position.z = ballMesh.position.z; 
    ufoGroup.position.z = ballMesh.position.z - 20; ufoGroup.rotation.y += 0.02;
    satGroup.position.z = ballMesh.position.z - 10; satGroup.rotation.x += 0.01;

    // 🌟 하늘색 -> 우주색 전환
    const skyCol = new THREE.Color('#87ceeb');
    const midCol = new THREE.Color('#1e3a8a');
    const spaceCol = new THREE.Color('#000000');
    
    if (alt < 300) {
      const t = Math.min(alt / 300, 1.0);
      scene.background = skyCol.lerp(midCol, t);
      starsMat.opacity = 0;
      if(altEl) altEl.style.color = '#38bdf8';
    } else {
      const t = Math.min((alt - 300) / 700, 1.0);
      scene.background = midCol.lerp(spaceCol, t);
      starsMat.opacity = t;
      if(altEl) altEl.style.color = '#fde047';
    }
    
    scene.fog.color = scene.background;
    scene.fog.density = 0.0025 * Math.max(0, 1 - (alt/400));

    // 🌟 고도 돌파 배너 띄우기
    if (alt > 200 && !alt200Triggered) { alt200Triggered = true; showEventBanner('🌤️', '성층권 진입!'); }
    if (alt > 500 && !alt500Triggered) { alt500Triggered = true; showEventBanner('🌌', '우주 공간 도달!'); }
    if (alt > 1000 && !alt1000Triggered){ alt1000Triggered = true; showEventBanner('👽', '외계인 조우 구역!'); }

    // 🌟 스피드 라인 이펙트
    const verticalSpeed = Math.abs(ballVel.y);
    if (speedLinesEl && gameState === STATES.FLYING) {
      let spdOp = 0;
      if (verticalSpeed > 15) spdOp = Math.min((verticalSpeed - 15) / 30, 0.7);
      speedLinesEl.style.opacity = spdOp;
    } else if (speedLinesEl) {
      speedLinesEl.style.opacity = 0;
    }

    // 🌟 다이내믹 카메라 (FOV와 내려다보는 앵글)
    if (gameState === STATES.FLYING || gameState === STATES.STOPPED) {
      const tCam = Math.min(alt / 400, 1.0); // 400m 이상이면 1.0
      
      const targetFOV = 55 + (tCam * 25);
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 0.1);
      camera.updateProjectionMatrix();

      targetCamPos.set(ballMesh.position.x * 0.5 + 0.3, Math.max(ballMesh.position.y + 2.4, 2.5), ballMesh.position.z + 5.5);
      const lookYOffset = THREE.MathUtils.lerp(0.5, -15.0, tCam); 
      targetCamLookAt.set(ballMesh.position.x, ballMesh.position.y + lookYOffset, ballMesh.position.z - 4.0);
      
      // 🌟 아이디어 2: 50배속 시 광속 워프 터널 ON & 거친 카메라 진동!
      if (gameState === STATES.FLYING && speedMultiplier === 50 && !hasTouchedGround) {
        warpEl.style.opacity = 0.8;
        targetCamPos.x += (Math.random() - 0.5) * 1.5; // 지진이 난 듯 덜컹거리는 카메라
        targetCamPos.y += (Math.random() - 0.5) * 1.5;
      } else {
        warpEl.style.opacity = 0;
      }

      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(targetCamLookAt);
      dirLight.position.set(ballMesh.position.x + 20, 40, ballMesh.position.z + 20);
    } else {
      camera.fov = THREE.MathUtils.lerp(camera.fov, 55, 0.1);
      camera.updateProjectionMatrix();
      camera.position.lerp(defaultCamPos, 0.1);
      camera.lookAt(defaultCamTarget);
    }
  }
  // ============================================================
  // GAME OVER
  // ============================================================
  function handleGameOver(finalDistance) {
    playWhistleSound();
    const baseEarned = Math.floor(finalDistance); 
    // 🌟 슈퍼 코인(lvSuperCoin) 레벨당 코인 획득량 500% 폭풍 증가!
    const earned = Math.floor(baseEarned * (1 + (lvCoin * 0.1)) * (1 + (lvSuperCoin * 5.0)));
    coins += earned; localStorage.setItem('soccer_coins', coins.toString());

    let isNewBest = false;
    if (finalDistance > bestDistance) {
      bestDistance = finalDistance; localStorage.setItem('soccer_3d_best_distance', bestDistance.toString());
      if (bestDistanceEl) bestDistanceEl.textContent = bestDistance.toFixed(1) + ' m';
      isNewBest = true;
    }

    if (finalDistanceEl) finalDistanceEl.textContent = finalDistance.toFixed(1) + ' m';
    if (earnedCoinsEl) earnedCoinsEl.textContent = '+' + earned.toLocaleString();
    updateCurrencyUI();
    
    if (resultBadgeEl && resultTitleEl) {
      resultBadgeEl.style.display = 'inline-block';
      if (isNewBest) { resultBadgeEl.textContent = 'NEW BEST RECORD! 🏆'; resultTitleEl.textContent = 'WORLD CLASS!'; } 
      else if (finalDistance > 300) { resultBadgeEl.textContent = 'SUPER KICK! ⭐'; resultTitleEl.textContent = 'INCREDIBLE!'; } 
      else { resultBadgeEl.style.display = 'none'; resultTitleEl.textContent = 'GREAT KICK!'; }
    }

    resultModalEl?.classList.remove('hidden');

    if (firebaseEnabled && playerNickname) {
      if (isNewBest) {
        db.collection('soccer_scores').doc(playerNickname).set({
          nickname: playerNickname, distance: parseFloat(finalDistance.toFixed(2)), timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.warn('[Firebase] 기록 저장 실패:', e.message));
      }
    }
  }

  // 🌟 아이디어 1: 비행 중 화면 탭하면 부스트 & 코인 즉시 획득!
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.target.closest('.modal')) return; // UI 클릭 무시
    
    if (gameState === STATES.FLYING && !hasTouchedGround) {
      const bonusCoin = speedMultiplier === 50 ? 50 : 1; // 50배속이면 탭 한 번에 코인 50개씩 팍팍!
      coins += bonusCoin;
      updateCurrencyUI();
      
      // 물리적 부스트 부여 (배속에 비례해서 미친듯이 앞으로 밀어줌)
      ballVel.z -= 1.0 * speedMultiplier;
      ballVel.y += 0.5 * speedMultiplier;
      
      // 마우스(터치) 위치에 이펙트 및 코인 텍스트 생성
      const ripple = document.createElement('div');
      ripple.className = 'tap-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      
      const coinText = document.createElement('div');
      coinText.className = 'tap-coin';
      coinText.textContent = '+' + bonusCoin;
      coinText.style.left = e.clientX + 'px';
      coinText.style.top = (e.clientY - 20) + 'px';
      
      document.body.appendChild(ripple);
      document.body.appendChild(coinText);
      
      setTimeout(() => { ripple.remove(); coinText.remove(); }, 600);
    }
  });

  // ============================================================
  // ANIMATION LOOP
  // ============================================================
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const FIXED_DT = 1 / 60; // 60fps 고정 스텝
  let accumulator = 0;
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    
    // 탭 전환 등 지연 시 100ms로 dt 상한 제한 (과도한 계산 방지)
    let dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = now;

    if (gameState === STATES.FLYING || gameState === STATES.KICKING) {
      dt *= speedMultiplier; // 배속 모드 적용
    }

    accumulator += dt;
    
    // 배속이 너무 클 경우 accumulator 과도 누적 방지 (렉 유발 방지)
    if (accumulator > 2.0) accumulator = 2.0;

    let steps = 0;
    while (accumulator >= FIXED_DT) {
      updatePhysics(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
      // 무한 루프 방지 장치 (한 프레임당 최대 물리 연산 횟수 제한)
      if (steps >= 120) {
        accumulator = 0;
        break;
      }
    }
    
    // 시각 효과는 프레임당 1번만 계산
    updateVisuals();
    updateChunks();
    renderer.render(scene, camera);
  }

  initNickname();
  resetGame();
  requestAnimationFrame(animate);
});
