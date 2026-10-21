export const SETTINGS = Object.freeze({ duration: 90, columns: 9, cells: 30, burnDuration: 6, palmHits: 2, hazeFullCoverage: 0.7, playerSpeed: 3.8, actionRange: 1.3, monsterStartSpeed: 2.2, monsterMaxSpeed: 3.5 });

// T = forest, . = trail, R = rock, W = pond, L = fallen log, S = spawn.
export const MAP_LAYOUT = Object.freeze([
  'TT.TTT.TT',
  'T.RT.T.TT',
  '..R.T.WWT',
  'TTT.T.WW.',
  'T.LL..TTT',
  'TT..R.T.T',
  'S.TT..TT.',
]);
const TERRAIN_KIND = { T: 'ground', '.': 'path', R: 'rock', W: 'pond', L: 'log', S: 'path' };


function random(game) {
  game.seed = (Math.imul(1664525, game.seed) + 1013904223) >>> 0;
  return game.seed / 4294967296;
}

export function createGame({ seed = Date.now(), duration = SETTINGS.duration, cells = SETTINGS.cells, mode = 'normal' } = {}) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(cells) || cells < 1 || cells > SETTINGS.cells) throw new RangeError('Invalid game settings');
  if (!['normal','ganas'].includes(mode)) throw new RangeError('Invalid game mode');
  const game = {
    mode, seed: seed >>> 0, duration, elapsed: 0, status: 'ready', outcome: null,
    columns: SETTINGS.columns, rows: MAP_LAYOUT.length, terrain: [], trees: [],
    player: { x: 0, y: 6, facingX: 0, facingY: -1, moving: false, nextActionAt: 0 }, extinguished: 0, cleared: 0, burnedTiles: 0,
    monster: { id: 'monster', x: 8, y: 0, phase: 'idle', task: 'burn', remaining: 0.4, target: null },
  };
  for (let y = 0; y < game.rows; y++) {
    for (let x = 0; x < game.columns; x++) {
      const symbol = MAP_LAYOUT[y][x];
      game.terrain.push({ x, y, kind: TERRAIN_KIND[symbol] });
      if (symbol === 'T' && game.trees.length < cells) {
        game.trees.push({ id: game.trees.length, x, y, kind: 'forest', species: Math.floor(random(game) * 4), fireLeft: 0, spread: false, hp: 0, protectedUntil: 0, hasBurned: false });
      }
    }
  }
  return game;
}

export function isWalkable(game, x, y) {
  const col = Math.round(x), row = Math.round(y);
  if (col < 0 || row < 0 || col >= game.columns || row >= game.rows) return false;
  return !['rock', 'pond', 'log'].includes(game.terrain[row * game.columns + col].kind);
}

function canStand(game, x, y) {
  const radius = 0.22;
  if (x < -0.25 || y < -0.25 || x > game.columns - 0.75 || y > game.rows - 0.75) return false;
  return [[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]].every(([dx,dy]) => isWalkable(game,x+dx,y+dy));
}

export function movePlayer(game, x, y, delta) {
  const p = game.player;
  if (game.status !== 'running') return;
  p.moving = false;
  if (!Number.isFinite(delta) || delta <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const length = Math.hypot(x,y);
  if (!length) return;
  x /= Math.max(1,length); y /= Math.max(1,length);
  p.facingX = x; p.facingY = y;
  // Small collision steps prevent tunneling; separate axes allow sliding along walls.
  let remaining = Math.min(delta,0.15);
  while (remaining > 0.000001) {
    const step = Math.min(remaining,0.02) * SETTINGS.playerSpeed;
    const nx = p.x + x * step;
    const ny = p.y + y * step;
    if (canStand(game,nx,p.y)) { p.moving ||= Math.abs(nx-p.x)>0.00001; p.x=nx; }
    if (canStand(game,p.x,ny)) { p.moving ||= Math.abs(ny-p.y)>0.00001; p.y=ny; }
    remaining -= step / SETTINGS.playerSpeed;
  }
}

function clearReach(game, target) {
  const dx = target.x-game.player.x, dy = target.y-game.player.y;
  const steps = Math.ceil(Math.hypot(dx,dy)/0.1);
  for(let i=1;i<=steps;i++) if(!isWalkable(game,game.player.x+dx*i/steps,game.player.y+dy*i/steps)) return false;
  return true;
}

export function actionTarget(game, button) {
  const kind = button === 'A' ? 'burning' : button === 'B' ? 'palm' : null;
  if (!kind) return null;
  let best = null, distance = SETTINGS.actionRange + 0.000001;
  for (const tree of game.trees) {
    const d = Math.hypot(tree.x-game.player.x,tree.y-game.player.y);
    if (tree.kind === kind && d < distance && clearReach(game,tree)) { best=tree; distance=d; }
  }
  return best;
}

export function playerAction(game, button) {
  if (game.status !== 'running' || game.elapsed < game.player.nextActionAt) return null;
  const target = actionTarget(game,button);
  if (!target) return null;
  const result = interact(game,target.id);
  if (result) game.player.nextActionAt = game.elapsed + 0.22;
  return result;
}

export function findRoute(game, fromX, fromY, toX, toY) {
  const start = Math.round(fromY)*game.columns+Math.round(fromX);
  const end = toY*game.columns+toX;
  const queue=[start], previous=new Map([[start,null]]);
  for(let i=0;i<queue.length&&!previous.has(end);i++) {
    const id=queue[i], x=id%game.columns, y=Math.floor(id/game.columns);
    for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if(!isWalkable(game,nx,ny)) continue;
      const next=ny*game.columns+nx;
      if(!previous.has(next)){previous.set(next,id);queue.push(next);}
    }
  }
  if(!previous.has(end)) return [];
  const path=[];
  for(let id=end;id!==start;id=previous.get(id)) path.push({x:id%game.columns,y:Math.floor(id/game.columns)});
  return path.reverse();
}

export function startGame(game) {
  if (game.status === 'ready') game.status = 'running';
}

export function togglePause(game) {
  if (game.status === 'running') game.status = 'paused';
  else if (game.status === 'paused') game.status = 'running';
}

export function counts(game) {
  const result = { forest: 0, burning: 0, charred: 0, palms: 0, seedlings: 0 };
  for (const tree of game.trees) {
    const key = tree.kind === 'palm' ? 'palms' : tree.kind === 'seedling' ? 'seedlings' : tree.kind;
    result[key]++;
  }
  return result;
}

export function hazeLevel(game) {
  return Math.min(1, game.burnedTiles / Math.max(1, Math.ceil(game.trees.length * SETTINGS.hazeFullCoverage)));
}

function ignite(game, tree) {
  if (!tree || !['forest', 'seedling'].includes(tree.kind) || tree.protectedUntil > game.elapsed) return;
  if (!tree.hasBurned) {
    tree.hasBurned = true;
    game.burnedTiles++;
  }
  tree.wasSeedling = tree.kind === 'seedling';
  tree.kind = 'burning';
  tree.fireLeft = SETTINGS.burnDuration;
  tree.spread = false;
}

function chooseTarget(game) {
  const charred = game.trees.filter(tree => tree.kind === 'charred');
  const candidates = charred.length ? charred : game.trees.filter(tree =>
    ['forest', 'seedling'].includes(tree.kind) && tree.protectedUntil <= game.elapsed);
  if (!candidates.length) return null;
  return candidates[Math.floor(random(game) * candidates.length)].id;
}

function targetValid(game, monster) {
  const tree = game.trees[monster.target];
  return tree && (monster.task === 'burn'
    ? ['forest', 'seedling'].includes(tree.kind) && tree.protectedUntil <= game.elapsed
    : tree.kind === 'charred');
}

export function monsterSpeed(game) {
  const progress = Math.max(0,Math.min(1,game.elapsed/game.duration));
  const start = game.mode === 'ganas' ? 3 : SETTINGS.monsterStartSpeed;
  const maximum = game.mode === 'ganas' ? 4.2 : SETTINGS.monsterMaxSpeed;
  return start + (maximum-start)*progress**1.25;
}

function monsterActionTime(game, base) {
  return base * (1 - 0.25 * Math.max(0,Math.min(1,game.elapsed/game.duration))) * (game.mode === 'ganas' ? 0.8 : 1);
}

function advanceMonster(game, step) {
  const monster = game.monster;
  if (monster.phase === 'waiting') {
    const tree = game.trees[monster.target];
    if (tree?.kind === 'burning') return;
    if (tree?.kind === 'charred') {
      monster.task = 'plant';
      monster.phase = 'acting';
      monster.remaining = monsterActionTime(game,0.58);
    } else {
      monster.phase = 'idle'; monster.remaining = 0.3; monster.target = null;
    }
    return;
  }
  monster.remaining -= step * (monster.phase === 'moving' ? monsterSpeed(game)/SETTINGS.monsterStartSpeed : 1);
  if (monster.phase === 'moving') {
    const progress = Math.min(1, 1 - monster.remaining / monster.travelTime);
    const path = monster.route;
    const position = progress * (path.length - 1);
    const index = Math.min(Math.floor(position),path.length-2);
    const fraction = position-index;
    monster.x = path[index].x + (path[index+1].x-path[index].x)*fraction;
    monster.y = path[index].y + (path[index+1].y-path[index].y)*fraction;
  }
  if (monster.remaining > 0) return;
  if (monster.phase === 'moving') {
    monster.phase = 'acting';
    monster.remaining = monsterActionTime(game,monster.task === 'burn' ? 0.42 : 0.58);
    return;
  }
  if (monster.phase === 'acting') {
    if (targetValid(game, monster)) {
      const tree = game.trees[monster.target];
      if (monster.task === 'burn') {
        ignite(game, tree);
        monster.phase = 'waiting';
        return;
      }
      tree.kind = 'palm'; tree.hp = SETTINGS.palmHits;
    }
    monster.phase = 'idle';
    monster.remaining = (0.85 - 0.4 * game.elapsed / game.duration) * (game.mode === 'ganas' ? 0.7 : 1);
    monster.target = null;
    return;
  }
  const target = chooseTarget(game);
  if (target === null) { monster.remaining = 0.35; return; }
  monster.target = target;
  monster.task = game.trees[target].kind === 'charred' ? 'plant' : 'burn';
  monster.phase = 'moving';
  monster.fromX = monster.x;
  monster.fromY = monster.y;
  const tree = game.trees[target];
  const route = findRoute(game,monster.x,monster.y,tree.x,tree.y);
  monster.route = [{x:monster.x,y:monster.y}, ...route];
  if(monster.route.length === 1) monster.route.push({x:tree.x,y:tree.y});
  monster.travelTime = Math.max(0.35,route.length / SETTINGS.monsterStartSpeed);
  monster.remaining = monster.travelTime;
}

export function interact(game, id) {
  if (game.status !== 'running') return null;
  const tree = game.trees[id];
  if (!tree) return null;
  if (tree.kind === 'burning') {
    tree.kind = 'charred';
    tree.fireLeft = 0;
    game.extinguished++;
    return { action: 'extinguish', id };
  }
  if (tree.kind === 'palm') {
    tree.hp--;
    if (tree.hp > 0) return { action: 'chop', id };
    tree.kind = 'seedling';
    tree.species = Math.floor(random(game) * 4);
    tree.protectedUntil = game.elapsed + 3;
    game.cleared++;
    return { action: 'restore', id };
  }
  return null;
}

export function tick(game, delta) {
  if (game.status !== 'running' || !Number.isFinite(delta) || delta <= 0) return;
  let remaining = Math.min(delta, game.duration - game.elapsed);
  while (remaining > 0.00000001 && game.status === 'running') {
    const step = Math.min(0.1, remaining);
    game.elapsed = Math.min(game.duration, game.elapsed + step);
    remaining -= step;
    for (const tree of game.trees) {
      if (tree.kind !== 'burning') continue;
      tree.fireLeft -= step;
      if (tree.fireLeft <= 0.00000001) { tree.kind = 'charred'; tree.fireLeft = 0; continue; }
      if (!tree.spread && tree.fireLeft < SETTINGS.burnDuration / 2) {
        tree.spread = true;
        const eligible = game.trees.filter(t => Math.abs(t.x-tree.x)+Math.abs(t.y-tree.y) === 1 && ['forest','seedling'].includes(t.kind) && t.protectedUntil <= game.elapsed);
        if (eligible.length) ignite(game, eligible[Math.floor(random(game) * eligible.length)]);
      }
    }
    advanceMonster(game, step);
    if (game.elapsed >= game.duration - 0.00000001) {
      game.elapsed = game.duration;
      game.status = 'finished';
      const current = counts(game);
      game.outcome = current.seedlings > current.palms ? 'win' : 'lose';
    }
  }
}
