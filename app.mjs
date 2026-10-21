import { createGame, startGame, togglePause, counts, tick, playerAction, actionTarget, movePlayer, hazeLevel, monsterSpeed, SETTINGS } from './engine.mjs';
import { readPad, joystickVector, cameraFrame } from './controls.mjs';

const $ = id => document.getElementById(id);
let game = createGame();
let sound = true;
let audio;
const monsterClips = [
  './assets/audio/monster-1.mp3',
  './assets/audio/monster-2.mp3',
  './assets/audio/monster-3.mp3',
  './assets/audio/monster-4.mp3',
  './assets/audio/monster-5.mp3',
];
const heroClips = [
  './assets/audio/hero-1.mp3',
  './assets/audio/hero-2.mp3',
  './assets/audio/hero-3.mp3',
  './assets/audio/hero-4.mp3',
  './assets/audio/hero-5.mp3',
];
const voiceBanks = {
  monster: { clips: monsterClips, buffers: [], index: 0 },
  hero: { clips: heroClips, buffers: [], index: 0 },
};
let voicesLoading;
let activeVoice;
let nextVoiceAt = 0;
let lastMonsterAction = '';
let lastFrame;
let lastStatus;
let lastCounts = '';
let lastTime = '';
let expressionReaction = null;
let playerAvatar = { action: null, until: 0 };
let joystickPointer = null;
let joystickInput = {x:0,y:0};
let viewport = {width:900,height:700};
const minimapTrees = [];
const actionPointers = new Map();
const keys = new Set();
const actionRepeat = { A: -Infinity, B: -Infinity };
let padStartWasDown = false;
let padNeedsRelease = false;
const tileStamps = [];
const transientEffects = [];
const grid = $('forest-grid');
const speciesColors = [['#467b43','#63934e','#80ac5b'],['#3b7755','#548f61','#78aa70'],['#628245','#7e9b52','#9db467'],['#48794b','#649256','#81a362']];

function treeSvg(tree) {
  const [dark,mid,light] = speciesColors[tree.species];
  const trunk = '<path d="M48 49v39h8V48" fill="#916644"/><path d="m51 69-10-9m12 4 10-11" stroke="#79553b" stroke-width="3" stroke-linecap="round"/>';
  let shape;
  if (tree.kind === 'charred') shape = '<ellipse cx="52" cy="87" rx="24" ry="6" fill="#5b5b42" opacity=".45"/><path d="m47 88 2-25 8 1 2 24Z" fill="#4b4b3d"/><path d="m49 73-9-8m14 6 8-10" fill="none" stroke="#4b4b3d" stroke-width="4" stroke-linecap="round"/><path d="m43 89-8 2m28-5 7 2" stroke="#6d6b4c" stroke-width="3" stroke-linecap="round"/>';
  else if (tree.kind === 'palm') shape = '<path d="M48 88c4-14 5-26 3-40l8-1c5 16 2 30 0 41" fill="#a17645" stroke="#79573c" stroke-width="2"/><path d="m53 60 6 2m-6 6 7 2m-7 6 6 2" stroke="#79573c" stroke-width="2"/><path d="M54 49C30 34 15 40 9 52c0-22 28-27 45-3Z" fill="#527541"/><path d="M54 49C38 20 21 23 13 29c10-24 33-12 41 20Z" fill="#66884a"/><path d="M54 49c-7-30 3-39 16-40-10 12-9 25-16 40Z" fill="#76954e"/><path d="M54 49c19-28 38-22 43-12-17-4-24 4-43 12Z" fill="#527a42"/><path d="M54 49c26-9 40 5 42 23-16-17-27-15-42-23Z" fill="#43683b"/><circle cx="52" cy="51" r="5" fill="#80603f"/><circle cx="59" cy="51" r="4" fill="#947047"/>';
  else if (tree.kind === 'seedling') shape = `<ellipse cx="52" cy="88" rx="16" ry="5" fill="#91a865"/><path d="M52 88V62" stroke="#738c42" stroke-width="4" stroke-linecap="round"/><path d="M52 77C29 78 31 58 31 58s24-1 21 19Z" fill="${mid}"/><path d="M52 70C48 50 71 48 71 48s3 21-19 22Z" fill="${light}"/><path d="m52 77-12-9m13 2 10-12" stroke="${dark}" stroke-width="1.5" stroke-linecap="round"/>`;
  else if (tree.species === 0) shape = `${trunk}<path d="M53 10C37 7 25 19 27 31 7 37 15 60 29 62c6 15 30 16 39 5 22 0 27-25 11-35C79 18 68 10 53 10Z" fill="${dark}"/><path d="M52 11C38 8 27 19 28 31c-13 5-15 15-7 25 8 2 13-2 16-7 8 14 27 11 31-1 13-1 16-15 7-22-1-10-12-15-23-15Z" fill="${mid}"/><path d="M45 16c-10-1-15 10-10 16 8 7 19 2 20-6 12 3 14-2 10-6-4-5-12-6-20-4Z" fill="${light}" opacity=".7"/>`;
  else if (tree.species === 1) shape = `${trunk}<path d="M52 3 29 33h9L20 55h12L17 71h69L71 55h13L66 33h10Z" fill="${dark}"/><path d="M52 3 29 33h9L20 55h12l-6 7h43L59 49h13L56 29h8Z" fill="${mid}"/><path d="M52 3 35 27h13l-9 13h16l-4-11h8Z" fill="${light}"/>`;
  else if (tree.species === 2) shape = `${trunk}<ellipse cx="51" cy="43" rx="31" ry="34" fill="${dark}"/><ellipse cx="46" cy="35" rx="26" ry="28" fill="${mid}"/><ellipse cx="42" cy="24" rx="16" ry="13" fill="${light}" opacity=".75"/><path d="m27 45 4 7m33-21 2 6" stroke="${light}" opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
  else shape = `${trunk}<path d="M28 68C5 60 16 35 30 32c-6-19 9-28 23-22 13-9 33 6 26 23 23 10 15 35-4 36-9 15-39 13-47-1Z" fill="${dark}"/><path d="M28 58c-19-7-11-23 3-26-6-18 10-27 22-21 14-6 29 4 25 18 19 10 8 31-8 31-13 12-30 9-42-2Z" fill="${mid}"/><path d="M33 25c1-10 13-14 20-8 7-4 19 0 19 10-11-1-15 1-20 6-7-3-13-3-19-8Z" fill="${light}" opacity=".7"/>`;
  return `<svg class="tree-graphic" viewBox="0 0 104 100" aria-hidden="true">${shape}</svg>`;
}

const fireEffects = '<span class="smoke-graphic fx-sprite" aria-hidden="true"></span><span class="fire-graphic fx-sprite" aria-hidden="true"></span><span class="burn-track" aria-hidden="true"></span>';

const labels = { forest:'Pohon hutan', burning:'Api — dekati lalu tekan A', charred:'Tanah gosong', palm:'Sawit — dekati lalu tekan B', seedling:'Bibit pohon hutan baru' };
const obstacleArt = {
  rock: '<svg viewBox="0 0 100 100"><ellipse cx="51" cy="80" rx="40" ry="12" fill="#36513533"/><path d="m12 67 12-34 29-13 29 19 7 35-26 13-39-5Z" fill="#858e78" stroke="#5c6e58" stroke-width="3"/><path d="m24 33 29-13 13 31-25 13-29 3Z" fill="#acb29c"/><path d="m41 64 25-13 16-12-4 32-15 16Z" fill="#6d7c66"/><path d="m24 34 17 9m23-12 9 8" stroke="#c4cab1" stroke-width="3"/></svg>',
  pond: '<svg viewBox="0 0 100 100"><path d="M3 17Q50 2 97 12V91Q50 99 3 87Z" fill="#7ca488"/><path d="M6 21Q50 8 94 16V86Q50 93 6 82Z" fill="#6db5bd"/><path d="M14 35q20-8 37-2m-19 28q22 6 40-2M57 43l26-3" fill="none" stroke="#b8e0d2" stroke-width="3" stroke-linecap="round"/></svg>',
  log: '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="77" rx="44" ry="11" fill="#36513533"/><path d="m13 40 69-16 13 43-68 18Z" fill="#825835" stroke="#543e28" stroke-width="3"/><path d="m23 46 58-13M29 61l52-14" stroke="#b58a53" stroke-width="5"/><ellipse cx="22" cy="63" rx="15" ry="23" transform="rotate(-16 22 63)" fill="#d4b079" stroke="#6c492d" stroke-width="3"/><ellipse cx="22" cy="63" rx="7" ry="13" transform="rotate(-16 22 63)" fill="none" stroke="#9a7448" stroke-width="2"/></svg>',
};
for (const cell of game.terrain) {
  const item = document.createElement('div');
  item.className = `map-cell cell-${cell.kind}`;
  item.innerHTML = obstacleArt[cell.kind] || '';
  $('map-terrain').append(item);
  if (obstacleArt[cell.kind]) {
    const dot=document.createElement('span');dot.className=`mini-obstacle mini-${cell.kind}`;
    dot.style.left=`${cell.x/game.columns*100}%`;dot.style.top=`${cell.y/game.rows*100}%`;
    $('minimap').append(dot);
  }
}
const tiles = game.trees.map(tree => {
  const tile = document.createElement('div');
  tile.className = 'tree-cell';
  tile.setAttribute('role','img');
  tile.style.setProperty('--delay', `${-tree.id * 0.31}s`);
  tile.style.left = `${tree.x / game.columns * 100}%`;
  tile.style.top = `${tree.y / game.rows * 100}%`;
  grid.append(tile);
  const dot=document.createElement('span');dot.className='mini-tree';
  dot.style.left=`${(tree.x+.5)/game.columns*100}%`;dot.style.top=`${(tree.y+.5)/game.rows*100}%`;
  $('minimap').append(dot);minimapTrees.push(dot);
  return tile;
});

function beep(action) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.type = action === 'chop' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(action === 'restore' ? 560 : action === 'extinguish' ? 310 : 180, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(action === 'restore' ? 900 : 100, audio.currentTime + 0.13);
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.2);
  } catch { /* Sound is optional. */ }
}

function updateAudioStatus() {
  const loaded = Object.values(voiceBanks).reduce((sum,bank)=>sum+bank.buffers.filter(Boolean).length,0);
  const message = !sound ? 'Suara mati — tekan tombol Suara untuk mengaktifkan.'
    : !audio || audio.state !== 'running' ? 'Ketuk Mulai atau tombol Suara untuk mengaktifkan audio.'
    : voicesLoading ? `Memuat suara ${loaded}/10…`
    : loaded === 10 ? 'Suara aktif · 10 rekaman siap'
    : loaded ? `Suara aktif · ${loaded}/10 rekaman siap. Ketuk Suara untuk mencoba memuat ulang.`
    : 'Rekaman belum termuat. Ketuk Suara untuk mencoba lagi.';
  $('audio-status').textContent = message;
  $('sound-button').setAttribute('aria-pressed',String(sound));
  $('sound-button').setAttribute('aria-label',sound ? 'Suara aktif: ketuk untuk mematikan' : 'Aktifkan suara');
  $('sound-button').innerHTML = `<svg><use href="#i-${sound ? 'sound' : 'muted'}"/></svg><span>Suara ${sound ? 'ON' : 'OFF'}</span>`;
}

function unlockAudio() {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.onstatechange = updateAudioStatus;
    // Must run directly inside a touch/click/key handler on mobile browsers.
    if (audio.state !== 'running' && audio.state !== 'closed') audio.resume().then(updateAudioStatus).catch(updateAudioStatus);
    loadVoices();
    updateAudioStatus();
  } catch {
    $('audio-status').textContent = 'Browser ini belum bisa mengaktifkan audio. Coba buka di Chrome atau Safari.';
  }
}

function act(button) {
  const result = playerAction(game, button);
  if (!result) return;
  const id = result.id;
  const target = game.trees[id];
  playerAvatar = { action: result.action, until: game.elapsed + (result.action === 'extinguish' ? 2 : 1.2) };
  expressionReaction = {
    name: result.action === 'extinguish' ? 'surprised' : 'frustrated',
    until: game.elapsed + (result.action === 'restore' ? 1.3 : 0.9),
  };
  beep(result.action);
  playVoice('hero');
  const tile = tiles[id];
  if (result.action === 'chop') {
    tile.classList.remove('chopped');
    void tile.offsetWidth;
    tile.classList.add('chopped');
  }
  const text = result.action === 'restore' ? '+1 bibit' : result.action === 'extinguish' ? 'Padam!' : 'Tahan B lagi';
  $('announcer').textContent = text;
  const effect = document.createElement('span');
  effect.className = `tap-effect ${result.action}`;
  effect.textContent = text;
  effect.style.left = `${(target.x + 0.5) / game.columns * 100}%`;
  effect.style.top = `${(target.y + 0.5) / game.rows * 100}%`;
  $('effect-layer').append(effect);
  transientEffects.push({ element: effect, until: game.elapsed + 0.85 });
  if (result.action === 'extinguish') {
    const splash = document.createElement('span');
    splash.className = 'water-splash fx-sprite';
    splash.style.left = effect.style.left;
    splash.style.top = effect.style.top;
    $('effect-layer').append(splash);
    transientEffects.push({ element: splash, until: game.elapsed + 0.7 });
  }
  render();
}

function loadVoices() {
  if (!audio || voicesLoading || Object.values(voiceBanks).every(bank=>bank.buffers.filter(Boolean).length===bank.clips.length)) return voicesLoading;
  voicesLoading = Promise.allSettled(Object.values(voiceBanks).flatMap(bank => bank.clips.map(async (url, index) => {
    if (bank.buffers[index]) return;
    let bytes;
    if (url.startsWith('data:audio/')) {
      // Decode embedded bytes directly; opening the standalone file needs no fetch.
      bytes = Uint8Array.from(atob(url.slice(url.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Audio unavailable');
      bytes = await response.arrayBuffer();
    }
    bank.buffers[index] = await audio.decodeAudioData(bytes);
  }))).finally(() => { voicesLoading = null; updateAudioStatus(); });
  return voicesLoading;
}

function stopVoice() {
  const active = activeVoice;
  activeVoice = null;
  if (active) {
    active.source.onended = null;
    active.source.stop();
    active.source.disconnect();
    active.gain.disconnect();
    nextVoiceAt = game.elapsed + 2;
  }
}

function resetVoices() {
  stopVoice();
  nextVoiceAt = 0;
  lastMonsterAction = '';
  for (const bank of Object.values(voiceBanks)) bank.index = 0;
}

function playVoice(owner) {
  if (!sound || game.status !== 'running' || audio?.state !== 'running') return;
  // The hero can interrupt a monster; rapid taps never restart the hero's line.
  if (activeVoice && (owner === 'monster' || activeVoice.owner === 'hero')) return;
  if (!activeVoice && game.elapsed < nextVoiceAt) return;
  const bank = voiceBanks[owner];
  let index = bank.index;
  for (let attempt = 0; attempt < bank.clips.length && !bank.buffers[index]; attempt++) index = (index + 1) % bank.clips.length;
  if (!bank.buffers[index]) return;
  stopVoice();
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = bank.buffers[index];
  gain.gain.value = 0.65;
  source.connect(gain); gain.connect(audio.destination);
  activeVoice = { owner, source, gain };
  source.onended = () => {
    source.disconnect(); gain.disconnect();
    if (activeVoice?.source === source) {
      activeVoice = null;
      nextVoiceAt = game.elapsed + 2;
    }
  };
  source.start();
  bank.index = (index + 1) % bank.clips.length;
}

function updateMonsterVoice() {
  const monster = game.monster;
  const action = `${monster.phase}:${monster.task}:${monster.target}`;
  const changed = action !== lastMonsterAction;
  lastMonsterAction = action;
  if (!sound || game.status !== 'running') {
    stopVoice();
    return;
  }
  if (changed && monster.phase === 'acting') playVoice('monster');
}

function renderTiles() {
  for (const tree of game.trees) {
    const stamp = `${tree.kind}:${tree.species}:${tree.hp}`;
    const tile = tiles[tree.id];
    if (tileStamps[tree.id] !== stamp) {
      tileStamps[tree.id] = stamp;
      minimapTrees[tree.id].className = `mini-tree mini-${tree.kind}`;
      tile.className = `tree-cell ${tree.kind}`;
      tile.innerHTML = treeSvg(tree) + (tree.kind === 'burning' ? fireEffects : '') + (tree.kind === 'palm' ? `<span class="palm-damage" aria-hidden="true"><i${tree.hp < 2 ? ' class="empty"' : ''}></i><i></i></span>` : '');
      tile.setAttribute('aria-label', `${labels[tree.kind]}, petak ${tree.id + 1}${tree.kind === 'palm' ? `, ${tree.hp} aksi B tersisa` : ''}`);
    }
    if (tree.kind === 'burning') tile.style.setProperty('--life', Math.max(0, tree.fireLeft / SETTINGS.burnDuration));
  }
}

function monsterExpression() {
  if (game.status === 'finished') return game.outcome === 'win' ? 'frustrated' : 'taunting';
  if (game.status !== 'running') return 'neutral';
  if (expressionReaction && game.elapsed < expressionReaction.until) return expressionReaction.name;
  if (game.monster.phase === 'waiting') return 'smug';
  if (game.monster.task === 'plant') return game.monster.phase === 'idle' ? 'taunting' : 'smug';
  return game.monster.phase === 'idle' ? 'neutral' : 'focused';
}

function renderPlayer(current) {
  const player = $('player');
  const working = game.elapsed < playerAvatar.until;
  let expression = 'neutral';
  if (game.status === 'finished') expression = game.outcome === 'win' ? 'happy' : 'frustrated';
  else if (game.status === 'paused') expression = 'skeptical';
  else if (working) expression = playerAvatar.action === 'extinguish' ? 'plenger' : playerAvatar.action === 'restore' ? 'happy' : 'focused';
  else if (current.burning >= 3) expression = 'surprised';
  else if (current.palms > current.seedlings) expression = 'skeptical';
  player.style.left = `${(game.player.x + 0.5) / game.columns * 100}%`;
  player.style.top = `${(game.player.y + 0.75) / game.rows * 100}%`;
  player.classList.toggle('walking', game.player.moving && game.status === 'running');
  player.dataset.expression = expression;
  player.classList.toggle('visible', game.status !== 'ready');
  player.classList.toggle('working', working && playerAvatar.action !== 'extinguish' && game.status === 'running');
}

function measureViewport() {
  viewport = {width:$('arena').clientWidth || 900,height:$('arena').clientHeight || 700};
}

function render() {
  const camera=cameraFrame(viewport.width,viewport.height,game.player,game.columns,game.rows);
  $('world').style.width=`${camera.worldWidth}px`;
  $('world').style.height=`${camera.worldHeight}px`;
  $('world').style.transform=`translate(${-camera.x}px,${-camera.y}px)`;
  $('world').style.setProperty('--actor-size',`${Math.max(54,Math.min(110,camera.cellSize*1.05))}px`);
  $('mini-player').style.left=`${(game.player.x+.5)/game.columns*100}%`;
  $('mini-player').style.top=`${(game.player.y+.5)/game.rows*100}%`;
  $('mode-toggle').textContent=game.mode==='ganas'?'Mode: GANAS 🔥':'Mode: Normal';
  $('mode-toggle').setAttribute('aria-pressed',String(game.mode==='ganas'));
  $('play-shell').classList.toggle('mode-ganas',game.mode==='ganas');
  const haze = hazeLevel(game);
  const hazePercent = Math.round(haze * 100);
  $('haze-layer').style.opacity = haze;
  $('minimap').style.opacity = 1-haze;
  $('haze-meter').value = hazePercent;
  const hazeLabel = haze >= 1 ? 'Tertutup total' : haze >= 0.7 ? 'Sangat pekat' : haze >= 0.4 ? 'Pekat' : haze > 0 ? 'Tipis' : 'Jernih';
  $('haze-label').textContent = `${hazePercent}% · ${hazeLabel}`;
  for (let i = transientEffects.length - 1; i >= 0; i--) {
    if (game.elapsed >= transientEffects[i].until || game.status === 'finished') {
      transientEffects[i].element.remove();
      transientEffects.splice(i, 1);
    }
  }
  updateMonsterVoice();
  renderTiles();
  const current = counts(game);
  const countStamp = JSON.stringify(current) + game.extinguished;
  if (lastCounts !== countStamp) {
    lastCounts = countStamp;
    $('seedlings-count').textContent = current.seedlings;
    $('palms-count').textContent = current.palms;
    $('fire-count').textContent = current.burning;
    $('saved-count').textContent = game.extinguished;
    const total = current.seedlings + current.palms;
    $('seedling-bar').style.width = `${total ? current.seedlings / total * 100 : 0}%`;
    $('palm-bar').style.width = `${total ? current.palms / total * 100 : 0}%`;
    $('balance-track').setAttribute('aria-label', `${current.seedlings} bibit baru dan ${current.palms} sawit tersisa`);
    $('balance-label').textContent = total === 0 ? 'Tumbuhkan bibit pertamamu.' : current.seedlings > current.palms ? 'Bibit unggul. Pertahankan!' : current.seedlings === current.palms ? 'Masih imbang. Tambah bibit!' : 'Sawit unggul. Terus tebang!';
  }
  const seconds = Math.max(0, Math.ceil(game.duration - game.elapsed));
  const time = `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${(seconds % 60).toString().padStart(2,'0')}`;
  if (time !== lastTime) {
    lastTime = time; $('timer').textContent = time;
    $('timer').parentElement.classList.toggle('urgent', seconds <= 15);
  }
  const monster = game.monster;
  const monsterElement = $('monster');
  monsterElement.style.left = `${(monster.x + 0.5) / game.columns * 100}%`;
  monsterElement.style.top = `${(monster.y + 0.5) / game.rows * 100}%`;
  monsterElement.classList.toggle('visible', game.status !== 'ready');
  monsterElement.classList.toggle('acting', monster.phase === 'acting' && game.status === 'running');
  monsterElement.classList.toggle('moving', monster.phase === 'moving' && game.status === 'running');
  monsterElement.style.setProperty('--walk-duration',`${0.22 * SETTINGS.monsterStartSpeed / monsterSpeed(game)}s`);
  $('monster-pace').textContent = game.status === 'finished' ? 'Ronde selesai' : game.mode === 'ganas' ? 'MODE GANAS · Owuh lebih cepat!' : game.elapsed >= game.duration * 0.75 ? 'Mas Owuh makin ganas!' : game.elapsed >= game.duration * 0.4 ? 'Mas Owuh mempercepat langkah' : 'Waspadai Mas Owuh';
  $('monster-pace').classList.toggle('danger',game.mode === 'ganas' || game.elapsed >= game.duration * 0.75);
  monsterElement.querySelector('small span').textContent = monster.phase === 'waiting' ? 'MENUNGGU' : monster.task === 'plant' ? 'MENANAM' : 'MEMBAKAR';
  const expression = monsterExpression();
  if (monsterElement.dataset.expression !== expression) monsterElement.dataset.expression = expression;
  renderPlayer(current);
  const waterTarget = actionTarget(game,'A');
  const palmTarget = actionTarget(game,'B');
  for (const tree of game.trees) {
    tiles[tree.id].classList.toggle('target-water',game.status === 'running' && tree === waterTarget);
    tiles[tree.id].classList.toggle('target-palm',game.status === 'running' && tree === palmTarget);
  }
  $('action-a').classList.toggle('in-range',!!waterTarget);
  $('action-b').classList.toggle('in-range',!!palmTarget);
  $('action-hint').textContent = game.status !== 'running' ? 'Geser joystick bulat untuk bergerak.' : waterTarget && palmTarget ? 'A: siram api · B: cabut sawit' : waterTarget ? 'Api terjangkau — tekan A' : palmTarget ? 'Sawit terjangkau — tahan B' : 'Dekati api atau sawit untuk bertindak.';
  if (lastStatus === game.status) return;
  lastStatus = game.status;
  $('arena').dataset.status = game.status;
  for (const button of document.querySelectorAll('.pad-button')) button.disabled = game.status !== 'running';
  $('start-overlay').hidden = game.status !== 'ready';
  $('pause-overlay').hidden = game.status !== 'paused';
  $('result-overlay').hidden = game.status !== 'finished';
  const victory = game.status === 'finished' && game.outcome === 'win';
  $('result-overlay').classList.toggle('victory',victory);
  $('result-overlay').classList.toggle('defeat',game.status === 'finished' && !victory);
  $('victory-photo').hidden = !victory;
  $('defeat-photo').hidden = game.status !== 'finished' || victory;
  $('pause-button').disabled = !['running','paused'].includes(game.status);
  $('status-light').classList.toggle('live', game.status === 'running');
  $('game-status').textContent = ({ready:'Hutan siap dijaga',running:'Ronde berlangsung',paused:'Permainan dijeda',finished:'Ronde selesai'})[game.status];
  $('pause-button').setAttribute('aria-label', game.status === 'paused' ? 'Lanjutkan permainan' : 'Jeda permainan');
  $('pause-button').innerHTML = `<svg><use href="#i-${game.status === 'paused' ? 'play' : 'pause'}"/></svg>`;
  if (game.status === 'paused') $('resume-button').focus({preventScroll:true});
  if (game.status === 'running') grid.setAttribute('aria-label','Hutan — gerakkan Mas Gabran, A siram, B cabut sawit');
  if (game.status === 'finished') {
    const won = game.outcome === 'win';
    $('result-overlay').querySelector('.overlay-card').classList.toggle('lose',!won);
    $('result-title').textContent = won ? '# SAVE INDONESIA' : 'Coba pulihkan lagi.';
    $('result-eyebrow').textContent = won ? 'KAMU MENANG' : 'WAKTU HABIS';
    $('replay-button').innerHTML = `${won ? 'Mulai kembali' : 'Main lagi'} <svg><use href="#i-play"/></svg>`;
    $('result-description').textContent = won ? 'Bibit pohon hutanmu lebih banyak dari sawit yang tersisa. Kamu menang!' : current.seedlings === current.palms ? 'Jumlah bibit dan sawit masih sama. Kamu perlu lebih banyak bibit untuk menang.' : 'Sawit masih lebih banyak. Tebang sawit untuk menambah bibit di ronde berikutnya.';
    $('result-seedlings').textContent = current.seedlings;
    $('result-palms').textContent = current.palms;
    $('result-comparison').textContent = current.seedlings > current.palms ? '>' : current.seedlings === current.palms ? '=' : '<';
    $('result-detail').textContent = `${game.extinguished} api dipadamkan · ${game.cleared} sawit ditebang`;
    $('announcer').textContent = `${won ? 'Kamu menang' : 'Kamu kalah'}. ${current.seedlings} bibit, ${current.palms} sawit.`;
    $('replay-button').focus({preventScroll:true});
  }
}

function begin() { unlockAudio(); clearInput(); startGame(game); lastFrame = undefined; render(); $('arena').focus({preventScroll:true}); }
function replay() {
  resetVoices();
  game = createGame({mode:game.mode}); lastCounts = ''; lastTime = ''; lastStatus = undefined; tileStamps.length = 0;
  expressionReaction = null;
  playerAvatar = { action: null, until: 0 };
  transientEffects.length = 0;
  $('effect-layer').replaceChildren(); begin();
}
function pause() { clearInput(); togglePause(game); if(game.status==='running')unlockAudio(); lastFrame = undefined; render(); }
$('start-button').addEventListener('click',begin);
$('pause-button').addEventListener('click',pause);
$('resume-button').addEventListener('click',pause);
$('restart-button').addEventListener('click',replay);
$('replay-button').addEventListener('click',replay);
$('sound-button').addEventListener('click',() => {
  if(sound && audio?.state !== 'running') { unlockAudio(); return; }
  sound = !sound;
  if (sound) { unlockAudio(); beep('restore'); }
  else stopVoice();
  updateAudioStatus();
});
function clearInput() {
  resetJoystick(); actionPointers.clear(); keys.clear();
  actionRepeat.A = actionRepeat.B = -Infinity;
  game.player.moving = false;
  padNeedsRelease = true;
  for(const button of document.querySelectorAll('.pad-button')) button.classList.remove('held');
}

const directionKeys = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1], KeyW:[0,-1], KeyA:[-1,0], KeyS:[0,1], KeyD:[1,0] };
const actionKeys = { KeyZ:'A', Space:'A', KeyX:'B', KeyB:'B' };
const joystick=$('joystick');
function resetJoystick() {
  joystickPointer=null;joystickInput={x:0,y:0};
  $('joystick-knob').style.transform='translate(-50%,-50%)';
  joystick.classList.remove('held');
}
function trackJoystick(event) {
  const vector=joystickVector(event.clientX,event.clientY,joystick.getBoundingClientRect());
  joystickInput={x:vector.x,y:vector.y};
  $('joystick-knob').style.transform=`translate(calc(-50% + ${vector.offsetX}px),calc(-50% + ${vector.offsetY}px))`;
}
joystick.addEventListener('pointerdown',event=>{
  if(game.status!=='running'||joystickPointer!==null) return;
  event.preventDefault();unlockAudio();joystickPointer=event.pointerId;
  joystick.setPointerCapture(event.pointerId);joystick.classList.add('held');trackJoystick(event);
});
joystick.addEventListener('pointermove',event=>{
  if(event.pointerId!==joystickPointer) return;
  event.preventDefault();trackJoystick(event);
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(name,event=>{if(event.pointerId===joystickPointer)resetJoystick();});
$('mode-toggle').addEventListener('click',()=>{
  clearInput();game.mode=game.mode==='ganas'?'normal':'ganas';
  $('announcer').textContent=game.mode==='ganas'?'Mode Ganas aktif. Mas Owuh bergerak dan beraksi lebih cepat.':'Mode Normal aktif.';
  render();
});
$('fullscreen-button').addEventListener('click',async()=>{
  clearInput();
  try {
    if(document.fullscreenElement||document.webkitFullscreenElement) {
      const exit=document.exitFullscreen||document.webkitExitFullscreen;
      if(exit)await exit.call(document);
    } else {
      const root=document.documentElement;
      const enter=root?.requestFullscreen||root?.webkitRequestFullscreen;
      if(enter)await enter.call(root);
      else $('fullscreen-button').setAttribute('title','Tampilan sudah memenuhi viewport; fullscreen browser tidak didukung di perangkat ini.');
    }
  } catch { $('fullscreen-button').setAttribute('title','Fullscreen tidak tersedia. Game tetap memenuhi area browser.'); }
  measureViewport();render();
});
function fullscreenChanged(){
  const active=!!(document.fullscreenElement||document.webkitFullscreenElement);
  $('fullscreen-button').setAttribute('aria-pressed',String(active));
  $('fullscreen-button').setAttribute('aria-label',active?'Keluar layar penuh':'Aktifkan layar penuh');
  measureViewport();
}
document.addEventListener('fullscreenchange',fullscreenChanged);
document.addEventListener('webkitfullscreenchange',fullscreenChanged);
window.addEventListener('resize',measureViewport);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(measureViewport).observe($('arena'));
for(const [id,action] of [['action-a','A'],['action-b','B']]) {
  const button=$(id);
  button.addEventListener('pointerdown',event=>{
    if(game.status !== 'running') return;
    unlockAudio();
    event.preventDefault();button.setPointerCapture(event.pointerId);
    actionPointers.set(event.pointerId,action);button.classList.add('held');
    act(action);actionRepeat[action]=game.elapsed+0.32;
  });
  const release=event=>{actionPointers.delete(event.pointerId);button.classList.remove('held');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('click',event=>{if(event.detail===0) {unlockAudio();act(action);}});
}
document.addEventListener('keydown',event=>{
  if((event.code === 'KeyP'||event.code === 'Escape') && ['running','paused'].includes(game.status) && !event.repeat) {event.preventDefault();pause();return;}
  if(game.status !== 'running' || !(event.code in directionKeys || event.code in actionKeys)) return;
  unlockAudio();
  // Let keyboard users activate focused buttons with Space normally.
  if(event.code === 'Space' && event.target.tagName === 'BUTTON') return;
  event.preventDefault(); keys.add(event.code);
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{if(game.status==='running') pause();else clearInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(game.status==='running')pause();else clearInput();}});

function handleInput(delta) {
  let pads=[];
  try { pads=Array.from(navigator.getGamepads?.() || []); } catch { /* Screen controls remain available. */ }
  const pad=readPad(pads.find(p=>p?.connected && p.mapping==='standard'));
  $('controller-status').textContent = pad.connected ? 'Controller tersambung · Start: jeda' : 'Joystick · WASD / arah, Z / X';
  if(pad.start && !padStartWasDown) {
    if(game.status==='ready') begin();
    else if(game.status==='finished') replay();
    else pause();
  }
  padStartWasDown=pad.start;
  if(padNeedsRelease && !pad.x && !pad.y && !pad.a && !pad.b) padNeedsRelease=false;
  if(game.status!=='running') return;
  let x=joystickInput.x,y=joystickInput.y;
  for(const key of keys) if(directionKeys[key]) {x+=directionKeys[key][0];y+=directionKeys[key][1];}
  if(!padNeedsRelease) {x+=pad.x;y+=pad.y;}
  movePlayer(game,x,y,delta);
  const actions=new Set(actionPointers.values());
  for(const key of keys) if(actionKeys[key]) actions.add(actionKeys[key]);
  if(!padNeedsRelease) {if(pad.a)actions.add('A');if(pad.b)actions.add('B');}
  for(const action of ['A','B']) {
    if(actions.has(action)) {
      if(game.elapsed>=actionRepeat[action]) {act(action);actionRepeat[action]=game.elapsed+0.32;}
    } else actionRepeat[action]=-Infinity;
  }
}

function frame(now) {
  const delta=lastFrame === undefined ? 0 : Math.min((now-lastFrame)/1000,0.1);
  lastFrame=now;
  handleInput(delta);
  if(game.status==='running') tick(game,delta);
  render();
  requestAnimationFrame(frame);
}
measureViewport();
render();
updateAudioStatus();
requestAnimationFrame(frame);
