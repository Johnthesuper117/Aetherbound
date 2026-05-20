const screen = document.getElementById("screen");

const races = {
  Human: { movement: 1, crit: 0, maxHp: 0, melee: 0 },
  Elf: { movement: 0, crit: 0.1, maxHp: 0, melee: 0 },
  Dwarf: { movement: 0, crit: 0, maxHp: 20, melee: 0 },
  Orc: { movement: 0, crit: 0, maxHp: 0, melee: 5 },
};

const classDefs = {
  Vanguard: {
    attack: { name: "Sword Strike", type: "melee", damage: 22, range: 1 },
    abilities: [
      { key: "shieldWall", name: "Shield Wall", cooldown: 2 },
      { key: "earthshatter", name: "Earthshatter", cooldown: 3 },
    ],
  },
  Spellweaver: {
    attack: { name: "Arcane Bolt", type: "ranged", damage: 20, range: 4, ignoreHalfCover: true },
    abilities: [
      { key: "chainLightning", name: "Chain Lightning", cooldown: 3 },
      { key: "warp", name: "Warp", cooldown: 4 },
    ],
  },
  Ranger: {
    attack: { name: "Longbow Shot", type: "ranged", damage: 28, range: 6 },
    abilities: [
      { key: "overwatch", name: "Overwatch", cooldown: 2 },
      { key: "grapple", name: "Grappling Hook", cooldown: 3 },
    ],
  },
};

const upgrades = [
  { id: "vitality", text: "Vitality Elixir: +15 Max HP to all party members." },
  { id: "boots", text: "Boots of Haste: +1 Movement Range to all party members." },
  { id: "sharpened", text: "Sharpened Weapons: +10% Base Damage to all party members." },
  { id: "vanguardDashRoot", text: "Vanguard Upgrade: Dash Attacks root for 1 turn." },
  { id: "spellweaverChain", text: "Spellweaver Upgrade: Chain Lightning chains to 4 targets." },
  { id: "rangerOverwatch", text: "Ranger Upgrade: Overwatch can trigger twice per turn." },
];

const levels = [
  {
    name: "Level 1: The Outskirts",
    size: 10,
    enemies: [
      { type: "Goblin Scrapper", x: 7, y: 1 },
      { type: "Goblin Scrapper", x: 8, y: 4 },
      { type: "Goblin Scrapper", x: 6, y: 7 },
    ],
    cover: Array.from({ length: 8 }, (_, i) => ({ x: 2 + (i % 4), y: 2 + Math.floor(i / 2), kind: "half" })),
    barrels: [],
  },
  {
    name: "Level 2: The Ambush",
    size: 12,
    enemies: [
      { type: "Goblin Scrapper", x: 9, y: 2 },
      { type: "Goblin Scrapper", x: 10, y: 8 },
      { type: "Goblin Archer", x: 7, y: 5 },
      { type: "Goblin Archer", x: 8, y: 6 },
    ],
    cover: [
      { x: 5, y: 4, kind: "full" },
      { x: 6, y: 4, kind: "full" },
      { x: 5, y: 5, kind: "full" },
      { x: 6, y: 5, kind: "full" },
      { x: 5, y: 6, kind: "full" },
      { x: 6, y: 6, kind: "full" },
    ],
    barrels: [],
  },
  {
    name: "Level 3: The War Camp",
    size: 15,
    enemies: [
      { type: "Goblin Archer", x: 10, y: 2 },
      { type: "Goblin Archer", x: 12, y: 11 },
      { type: "Goblin Shaman", x: 11, y: 7 },
      { type: "Hobgoblin Warlord", x: 13, y: 7 },
    ],
    cover: [
      { x: 6, y: 5, kind: "half" },
      { x: 6, y: 6, kind: "full" },
      { x: 6, y: 7, kind: "full" },
      { x: 6, y: 8, kind: "half" },
      { x: 8, y: 5, kind: "half" },
      { x: 8, y: 6, kind: "full" },
      { x: 8, y: 7, kind: "full" },
      { x: 8, y: 8, kind: "half" },
      { x: 10, y: 5, kind: "half" },
      { x: 10, y: 8, kind: "half" },
    ],
    barrels: [
      { x: 7, y: 7 },
      { x: 9, y: 7 },
      { x: 11, y: 6 },
    ],
  },
];

const enemyDefs = {
  "Goblin Scrapper": { hp: 45, move: 4, attackDamage: 12, range: 1 },
  "Goblin Archer": { hp: 38, move: 2, attackDamage: 15, range: 5, ranged: true },
  "Goblin Shaman": { hp: 50, move: 2, attackDamage: 8, range: 4, ranged: true, healer: true },
  "Hobgoblin Warlord": { hp: 160, move: 3, attackDamage: 24, range: 1, aoe: true, breaksCover: true },
};

const state = {
  phase: "creation",
  levelIndex: 0,
  party: [],
  enemies: [],
  cover: [],
  barrels: [],
  activeId: null,
  message: "",
  upgrades: {
    vanguardDashRoot: false,
    spellweaverChain: false,
    rangerOverwatch: false,
    damageScale: 1,
    movementBonus: 0,
  },
  pendingJump: null,
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function entityAt(x, y, includeDead = false) {
  const all = [...state.party, ...state.enemies];
  return all.find((e) => e.x === x && e.y === y && (includeDead || !e.dead));
}

function inBounds(x, y) {
  const size = levels[state.levelIndex]?.size || 10;
  return x >= 0 && y >= 0 && x < size && y < size;
}

function coverAt(x, y) {
  return state.cover.find((c) => c.x === x && c.y === y);
}

function barrelAt(x, y) {
  return state.barrels.find((b) => b.x === x && b.y === y);
}

function applyDamage(target, amount, type, source) {
  if (target.dead) return;
  let damage = amount;
  if (type === "ranged") {
    const c = coverAt(target.x, target.y);
    if (c?.kind === "full") damage = 0;
    if (c?.kind === "half" && !source?.ignoreHalfCover) damage = Math.floor(damage * 0.5);
  }
  if (target.shieldTurns > 0) damage = Math.floor(damage * 0.5);
  target.hp -= damage;
  if (target.hp <= 0) target.dead = true;
}

function maybeCrit(attacker) {
  return Math.random() < attacker.critChance ? 1.5 : 1;
}

function cleanupDead() {
  state.enemies = state.enemies.filter((e) => !e.dead);
  if (state.party.every((p) => p.dead)) {
    state.phase = "defeat";
  }
  if (!state.enemies.length && state.phase === "playerTurn") {
    if (state.levelIndex === levels.length - 1) state.phase = "victory";
    else state.phase = "upgrade";
  }
}

function startLevel(index) {
  state.levelIndex = index;
  const level = levels[index];
  state.cover = level.cover.map((c) => ({ ...c }));
  state.barrels = level.barrels.map((b) => ({ ...b }));
  state.enemies = level.enemies.map((e) => ({ id: uid(), ...enemyDefs[e.type], ...e }));
  state.party.forEach((p, i) => {
    if (!p.dead) {
      p.x = 1;
      p.y = 2 + i * 2;
      p.moved = false;
      p.acted = false;
      p.overwatchShots = 0;
    }
  });
  state.activeId = state.party.find((p) => !p.dead)?.id || null;
  state.pendingJump = null;
  state.phase = "playerTurn";
  state.message = `${level.name} started`;
}

function randomThreeUpgrades() {
  const pool = [...upgrades];
  const out = [];
  while (out.length < 3 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function applyUpgrade(id) {
  if (id === "vitality") {
    state.party.forEach((p) => {
      p.maxHp += 15;
      p.hp += 15;
    });
  }
  if (id === "boots") {
    state.upgrades.movementBonus += 1;
  }
  if (id === "sharpened") {
    state.upgrades.damageScale += 0.1;
  }
  if (id === "vanguardDashRoot") state.upgrades.vanguardDashRoot = true;
  if (id === "spellweaverChain") state.upgrades.spellweaverChain = true;
  if (id === "rangerOverwatch") state.upgrades.rangerOverwatch = true;
}

function nextRoundStart() {
  state.party.forEach((p) => {
    if (p.dead) return;
    p.moved = false;
    p.acted = false;
    p.shieldTurns = Math.max(0, p.shieldTurns - 1);
    p.rootedTurns = Math.max(0, p.rootedTurns - 1);
    p.overwatchShots = p.overwatch ? (state.upgrades.rangerOverwatch ? 2 : 1) : 0;
    p.overwatch = false;
    Object.keys(p.cooldowns).forEach((k) => {
      p.cooldowns[k] = Math.max(0, p.cooldowns[k] - 1);
    });
  });
  state.enemies.forEach((e) => {
    e.rootedTurns = Math.max(0, (e.rootedTurns || 0) - 1);
  });
  state.activeId = state.party.find((p) => !p.dead)?.id || null;
}

function endPlayerTurnIfDone() {
  const living = state.party.filter((p) => !p.dead);
  if (living.every((p) => p.moved && p.acted)) {
    state.phase = "enemyTurn";
    runEnemyTurn();
  }
}

function useAbility(player, key) {
  if (player.acted) return;
  if (player.cooldowns[key] > 0) return;
  if (key === "shieldWall") {
    state.party.forEach((ally) => {
      if (!ally.dead && dist(player, ally) === 1) ally.shieldTurns = 1;
    });
    player.cooldowns.shieldWall = 2;
    player.acted = true;
    state.message = `${player.name} cast Shield Wall`;
  }
  if (key === "earthshatter") {
    const spots = [
      { x: player.x + 1, y: player.y },
      { x: player.x + 2, y: player.y },
      { x: player.x + 3, y: player.y },
    ];
    spots.forEach((s) => {
      const enemy = state.enemies.find((e) => e.x === s.x && e.y === s.y);
      if (enemy) applyDamage(enemy, Math.floor(24 * state.upgrades.damageScale), "melee", player);
      state.cover = state.cover.filter((c) => !(c.x === s.x && c.y === s.y));
    });
    player.cooldowns.earthshatter = 3;
    player.acted = true;
    state.message = `${player.name} used Earthshatter`;
  }
  if (key === "chainLightning") {
    const primary = state.enemies.find((e) => dist(player, e) <= 5);
    if (!primary) return;
    const maxChains = state.upgrades.spellweaverChain ? 4 : 2;
    const struck = [primary];
    for (let i = 0; i < maxChains; i++) {
      const next = state.enemies.find((e) => !struck.includes(e) && struck.some((s) => dist(e, s) === 1));
      if (next) struck.push(next);
    }
    struck.forEach((e) => applyDamage(e, Math.floor(18 * state.upgrades.damageScale), "ranged", { ignoreHalfCover: true }));
    player.cooldowns.chainLightning = 3;
    player.acted = true;
    state.message = `${player.name} chained lightning to ${struck.length} targets`;
  }
  if (key === "warp") {
    player.cooldowns.warp = 4;
    player.acted = true;
    state.message = "Click an empty tile within 5 to Warp";
    state.pendingWarp = player.id;
  }
  if (key === "overwatch") {
    player.overwatch = true;
    player.cooldowns.overwatch = 2;
    player.acted = true;
    state.message = `${player.name} is on Overwatch`;
  }
  if (key === "grapple") {
    const target = state.enemies.find((e) => dist(player, e) <= 4);
    if (!target) return;
    const adj = [
      { x: player.x + 1, y: player.y },
      { x: player.x - 1, y: player.y },
      { x: player.x, y: player.y + 1 },
      { x: player.x, y: player.y - 1 },
    ].find((t) => inBounds(t.x, t.y) && !entityAt(t.x, t.y));
    if (!adj) return;
    target.x = adj.x;
    target.y = adj.y;
    player.cooldowns.grapple = 3;
    player.acted = true;
    state.message = `${player.name} pulled ${target.type}`;
  }
  cleanupDead();
  endPlayerTurnIfDone();
}

function doBasicAttack(player, target) {
  if (player.acted || player.dead || target.dead) return;
  const def = classDefs[player.className].attack;
  if (dist(player, target) > def.range) return;
  const scaled = Math.floor((def.damage + (def.type === "melee" ? player.meleeBonus : 0)) * state.upgrades.damageScale * maybeCrit(player));
  applyDamage(target, scaled, def.type, def);
  player.acted = true;
  state.message = `${player.name} used ${def.name}`;
  cleanupDead();
  endPlayerTurnIfDone();
}

function dashAttack(player, enemy) {
  if (player.moved || player.dead) return;
  if (dist(player, enemy) > player.moveRange) return;
  const spot = [
    { x: enemy.x + 1, y: enemy.y },
    { x: enemy.x - 1, y: enemy.y },
    { x: enemy.x, y: enemy.y + 1 },
    { x: enemy.x, y: enemy.y - 1 },
  ].find((p) => inBounds(p.x, p.y) && !entityAt(p.x, p.y));
  if (!spot) return;
  player.x = spot.x;
  player.y = spot.y;
  applyDamage(enemy, 10, "melee", player);
  if (state.upgrades.vanguardDashRoot && player.className === "Vanguard") enemy.rootedTurns = 1;
  player.moved = true;
  state.message = `${player.name} dashed through ${enemy.type}`;
  cleanupDead();
  endPlayerTurnIfDone();
}

function movePlayer(player, x, y) {
  if (player.moved || player.dead || !inBounds(x, y)) return;
  if (state.pendingWarp === player.id) {
    if (!entityAt(x, y) && dist(player, { x, y }) <= 5) {
      player.x = x;
      player.y = y;
      player.moved = true;
      state.pendingWarp = null;
      state.message = `${player.name} warped`;
      endPlayerTurnIfDone();
    }
    return;
  }
  if (!entityAt(x, y)) {
    if (state.pendingJump?.playerId === player.id) {
      if (dist(state.pendingJump.from, { x, y }) <= player.moveRange + 2) {
        player.x = x;
        player.y = y;
        player.moved = true;
        state.pendingJump = null;
        state.message = `${player.name} performed Team Jump`;
      }
    } else if (dist(player, { x, y }) <= player.moveRange) {
      player.x = x;
      player.y = y;
      player.moved = true;
      state.message = `${player.name} moved`;
    }
  } else {
    const occupant = entityAt(x, y);
    if (occupant && occupant.id !== player.id && state.party.includes(occupant) && !player.moved) {
      state.pendingJump = { playerId: player.id, from: { x, y } };
      state.message = "Team Jump primed. Click destination.";
      return;
    }
  }
  endPlayerTurnIfDone();
}

function lineOfSight(a, b) {
  if (a.x === b.x) {
    const min = Math.min(a.y, b.y);
    const max = Math.max(a.y, b.y);
    for (let y = min + 1; y < max; y++) if (coverAt(a.x, y)?.kind === "full") return false;
    return true;
  }
  if (a.y === b.y) {
    const min = Math.min(a.x, b.x);
    const max = Math.max(a.x, b.x);
    for (let x = min + 1; x < max; x++) if (coverAt(x, a.y)?.kind === "full") return false;
    return true;
  }
  return true;
}

function maybeTriggerOverwatch(enemy) {
  state.party.forEach((p) => {
    if (p.dead || !p.overwatch || p.overwatchShots <= 0) return;
    if (dist(p, enemy) <= classDefs.Ranger.attack.range && lineOfSight(p, enemy)) {
      applyDamage(enemy, Math.floor(classDefs.Ranger.attack.damage * state.upgrades.damageScale), "ranged");
      p.overwatchShots -= 1;
    }
  });
}

function explodeBarrelAt(x, y) {
  if (!barrelAt(x, y)) return;
  state.barrels = state.barrels.filter((b) => !(b.x === x && b.y === y));
  [...state.party, ...state.enemies].forEach((e) => {
    if (!e.dead && dist(e, { x, y }) <= 1) applyDamage(e, 18, "melee");
  });
}

function runEnemyTurn() {
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const living = state.party.filter((p) => !p.dead);
    if (!living.length) break;
    if (enemy.healer) {
      const ally = state.enemies.filter((e) => !e.dead).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ally && ally.hp < ally.maxHp && dist(enemy, ally) <= enemy.range) {
        ally.hp = Math.min(ally.maxHp, ally.hp + 18);
      }
    }
    const target = living.sort((a, b) => dist(a, enemy) - dist(b, enemy))[0];
    if (!target) continue;
    if (enemy.rootedTurns > 0) continue;
    if (dist(enemy, target) > enemy.range) {
      for (let step = 0; step < enemy.move; step++) {
        const dx = target.x > enemy.x ? 1 : target.x < enemy.x ? -1 : 0;
        const dy = target.y > enemy.y ? 1 : target.y < enemy.y ? -1 : 0;
        const nx = enemy.x + (Math.abs(target.x - enemy.x) > Math.abs(target.y - enemy.y) ? dx : 0);
        const ny = enemy.y + (Math.abs(target.x - enemy.x) > Math.abs(target.y - enemy.y) ? 0 : dy);
        if (!inBounds(nx, ny) || entityAt(nx, ny)) break;
        enemy.x = nx;
        enemy.y = ny;
        if (enemy.breaksCover) {
          state.cover = state.cover.filter((c) => !(c.x === enemy.x && c.y === enemy.y));
        }
        maybeTriggerOverwatch(enemy);
        explodeBarrelAt(enemy.x, enemy.y);
        if (enemy.dead) break;
        if (dist(enemy, target) <= enemy.range) break;
      }
    }
    if (enemy.dead) continue;
    if (dist(enemy, target) <= enemy.range) {
      if (enemy.aoe) {
        living.forEach((p) => {
          if (dist(enemy, p) <= 1) applyDamage(p, enemy.attackDamage, "melee");
        });
      } else {
        applyDamage(target, enemy.attackDamage, enemy.ranged ? "ranged" : "melee");
      }
    }
    cleanupDead();
    if (state.phase === "defeat") break;
  }
  cleanupDead();
  if (state.phase === "enemyTurn") {
    nextRoundStart();
    state.phase = "playerTurn";
  }
  render();
}

function activePlayer() {
  return state.party.find((p) => p.id === state.activeId) || state.party.find((p) => !p.dead) || null;
}

function creationScreen() {
  const classes = Object.keys(classDefs);
  screen.innerHTML = `
    <div class="panel">
      <h2>Character Creation</h2>
      <p>Select race and class for all 3 party members.</p>
      <div id="createRows" class="cards"></div>
      <div style="margin-top:10px"><button id="startBtn">Start Chapter 1</button></div>
    </div>
  `;
  const rows = document.getElementById("createRows");
  const picks = Array.from({ length: 3 }, () => ({ race: "Human", className: "Vanguard" }));
  picks.forEach((_, i) => {
    const card = document.createElement("div");
    card.className = "panel";
    card.innerHTML = `
      <strong>Hero ${i + 1}</strong>
      <div class="row" style="margin-top:8px">
        <label>Race</label>
        <select id="race-${i}">${Object.keys(races).map((r) => `<option>${r}</option>`).join("")}</select>
      </div>
      <div class="row" style="margin-top:8px">
        <label>Class</label>
        <select id="class-${i}">${classes.map((c) => `<option>${c}</option>`).join("")}</select>
      </div>
    `;
    rows.appendChild(card);
  });
  document.getElementById("startBtn").onclick = () => {
    state.party = picks.map((_, i) => {
      const race = document.getElementById(`race-${i}`).value;
      const className = document.getElementById(`class-${i}`).value;
      const raceMod = races[race];
      const baseHp = className === "Vanguard" ? 120 : className === "Spellweaver" ? 90 : 100;
      const move = className === "Vanguard" ? 4 : className === "Spellweaver" ? 4 : 5;
      const hero = {
        id: uid(),
        name: `Hero ${i + 1}`,
        race,
        className,
        x: 1,
        y: 2 + i * 2,
        maxHp: baseHp + raceMod.maxHp,
        hp: baseHp + raceMod.maxHp,
        moveRange: move + raceMod.movement + state.upgrades.movementBonus,
        critChance: 0.1 + raceMod.crit,
        meleeBonus: raceMod.melee,
        moved: false,
        acted: false,
        shieldTurns: 0,
        rootedTurns: 0,
        overwatch: false,
        overwatchShots: 0,
        cooldowns: {
          shieldWall: 0,
          earthshatter: 0,
          chainLightning: 0,
          warp: 0,
          overwatch: 0,
          grapple: 0,
        },
      };
      return hero;
    });
    startLevel(0);
    render();
  };
}

function levelScreen() {
  const level = levels[state.levelIndex];
  const active = activePlayer();
  const size = level.size;
  const abilities = active ? classDefs[active.className].abilities : [];
  screen.innerHTML = `
    <div class="panel">
      <div class="row">
        <strong>${level.name}</strong>
        <span class="small">Turn: ${state.phase}</span>
      </div>
      <div class="row" style="margin-top:8px" id="heroRow"></div>
      <div class="row" style="margin-top:8px">
        <button id="endTurn">End Turn</button>
        ${active ? abilities.map((a) => `<button data-ability="${a.key}" ${active.cooldowns[a.key] > 0 || active.acted ? "disabled" : ""}>${a.name} (${active.cooldowns[a.key]})</button>`).join("") : ""}
      </div>
      <div class="small" style="margin-top:6px">${state.message || "Select a hero, move, then attack."}</div>
      <div class="grid" id="grid"></div>
    </div>
  `;
  const heroRow = document.getElementById("heroRow");
  state.party.forEach((p) => {
    const b = document.createElement("button");
    b.textContent = `${p.name} (${p.className}) HP:${Math.max(0, p.hp)}${p.dead ? " ☠" : ""}`;
    b.disabled = p.dead;
    if (state.activeId === p.id) b.classList.add("selected");
    b.onclick = () => {
      state.activeId = p.id;
      state.pendingJump = null;
      render();
    };
    heroRow.appendChild(b);
  });
  document.querySelectorAll("[data-ability]").forEach((b) => {
    b.onclick = () => {
      const p = activePlayer();
      if (p) useAbility(p, b.dataset.ability);
      render();
    };
  });
  document.getElementById("endTurn").onclick = () => {
    if (state.phase === "playerTurn") {
      state.party.forEach((p) => {
        if (!p.dead) {
          p.moved = true;
          p.acted = true;
        }
      });
      endPlayerTurnIfDone();
      render();
    }
  };
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `repeat(${size}, 34px)`;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      const cover = coverAt(x, y);
      const barrel = barrelAt(x, y);
      const entity = entityAt(x, y);
      if (cover?.kind === "half") tile.classList.add("half-cover");
      if (cover?.kind === "full") tile.classList.add("full-cover");
      if (barrel) tile.classList.add("barrel");
      if (entity && state.party.includes(entity) && !entity.dead) tile.classList.add("player");
      if (entity && state.enemies.includes(entity) && !entity.dead) tile.classList.add("enemy");
      if (entity && !entity.dead) tile.textContent = entity.name ? "🛡" : "👹";
      else if (barrel) tile.textContent = "💥";
      else if (cover?.kind === "half") tile.textContent = "◧";
      else if (cover?.kind === "full") tile.textContent = "◼";
      const ap = activePlayer();
      if (ap && !ap.dead && !ap.moved && dist(ap, { x, y }) <= ap.moveRange && !entityAt(x, y)) {
        tile.classList.add("reachable");
      }
      if (ap && ap.x === x && ap.y === y) tile.classList.add("selected");
      tile.onclick = () => {
        if (state.phase !== "playerTurn") return;
        const player = activePlayer();
        if (!player || player.dead) return;
        const target = entityAt(x, y);
        if (!target) {
          movePlayer(player, x, y);
        } else if (state.enemies.includes(target)) {
          if (!player.moved) dashAttack(player, target);
          else doBasicAttack(player, target);
        } else if (target.id !== player.id) {
          movePlayer(player, x, y);
        }
        render();
      };
      grid.appendChild(tile);
    }
  }
}

function upgradeScreen() {
  const picks = randomThreeUpgrades();
  screen.innerHTML = `
    <div class="panel">
      <h2>Choose an Upgrade</h2>
      <div class="cards" id="upCards"></div>
    </div>
  `;
  const upCards = document.getElementById("upCards");
  picks.forEach((u) => {
    const c = document.createElement("div");
    c.className = "panel";
    c.innerHTML = `<div>${u.text}</div><div style="margin-top:8px"><button>Select</button></div>`;
    c.querySelector("button").onclick = () => {
      applyUpgrade(u.id);
      state.party.forEach((p) => {
        p.moveRange += u.id === "boots" ? 1 : 0;
      });
      startLevel(state.levelIndex + 1);
      render();
    };
    upCards.appendChild(c);
  });
}

function endScreen(victory) {
  screen.innerHTML = `
    <div class="panel">
      <h2>${victory ? "Victory!" : "Defeat"}</h2>
      <p>${victory ? "Chapter 1 complete: The Goblin Incursion is defeated." : "All heroes have fallen. Game Over."}</p>
      <button id="restart">Restart</button>
    </div>
  `;
  document.getElementById("restart").onclick = () => {
    state.phase = "creation";
    state.levelIndex = 0;
    state.party = [];
    state.enemies = [];
    state.cover = [];
    state.barrels = [];
    state.upgrades = {
      vanguardDashRoot: false,
      spellweaverChain: false,
      rangerOverwatch: false,
      damageScale: 1,
      movementBonus: 0,
    };
    render();
  };
}

function render() {
  if (state.phase === "creation") creationScreen();
  if (state.phase === "playerTurn" || state.phase === "enemyTurn") levelScreen();
  if (state.phase === "upgrade") upgradeScreen();
  if (state.phase === "victory") endScreen(true);
  if (state.phase === "defeat") endScreen(false);
}

render();
