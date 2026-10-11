(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rpg-data.js'));
  else root.NerakarEngine = factory(root.NerakarData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Data) {
  'use strict';
  const VERSION = 3, SAVE_KEY = 'sf_nerakar_rpg_v2', BACKUP_KEY = SAVE_KEY + '_backup', CORRUPT_KEY = SAVE_KEY + '_corrupt';
  const DAY_MS = Data.dayDurationMs || 600000, MAX_WORLD_MS = DAY_MS * 10000;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const own = (table, id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(table, id);
  const lookup = (table, id) => own(table,id) && record(table[id]) ? table[id] : null;
  const quantities = value => record(value) && Object.keys(value).every(id => lookup(Data.items,id) && Number.isSafeInteger(value[id]) && value[id] >= 0 && value[id] <= 9999);
  const key = (x, y) => x + ',' + y;
  const integer = (value, min, max, fallback) => Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
  const timestamp = (value, fallback, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(max,value)) : fallback;
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const ok = (message, extra) => Object.assign({ok: true, message}, extra || {});
  const fail = message => ({ok: false, message});
  const fresh = now => ({version: VERSION, savedAt: now, lastTick: now, steps: 0,
    player: {x: Data.spawn.x, y: Data.spawn.y, hp: 100, stamina: 100, xp: 0, level: 1},
    inventory: {wood: 6, stone: 4, wheat_seed: 8, herb_seed: 4, carrot_seed: 4, pumpkin_seed: 2, axe: 1, pickaxe: 1, hoe: 1, watering_can: 1, sword: 1, food: 5, coin: 40},
    equipment: {weapon: 'sword', armor: null}, nodes: {}, crops: {}, buildings: {},
    discovered: {}, explored: {city: true}, visited: {}, accepted: {}, completed: {},
    metrics: {gather: {}, craft: {}, harvest: {}, build: {}, kill: {}, explore: {city: 1}},
    world: {elapsedMs:0,offsetMs:0}, friendships: {},
    combat: null, lastAction: 0, defeats: 0, log: ['Você chegou ao centro de Nerakar. Cuide da sua terra, conheça os moradores e explore no seu ritmo.']});

  // Saves contain only validated gameplay data. Unknown fields and out-of-range values never enter the engine.
  function normalize(raw, now) {
    if (!record(raw)) throw new Error('Salvamento inválido.');
    const original = record(raw.state) ? raw.state : raw;
    if (![1,2,VERSION].includes(original.version)) throw new Error('Versão de salvamento incompatível.');
    if (!record(original.player) || !record(original.inventory) || !Number.isFinite(original.player.x) || !Number.isFinite(original.player.y)) throw new Error('Dados de jogador ausentes.');
    const s = fresh(now), p = original.player;
    s.player.x = integer(p.x, 0, Data.width - 1, Data.spawn.x);
    s.player.y = integer(p.y, 0, Data.height - 1, Data.spawn.y);
    if (!Data.getTile(s.player.x, s.player.y).walkable) Object.assign(s.player, Data.spawn);
    s.player.xp = integer(p.xp, 0, 10000000, 0); s.player.level = Math.min(100, 1 + Math.floor(s.player.xp / 100));
    s.player.hp = integer(p.hp, 1, 100 + (s.player.level - 1) * 5, 100);
    s.player.stamina = integer(p.stamina, 0, 100, 100);
    s.inventory = {};
    Object.keys(Data.items).forEach(id => {const count = integer(original.inventory[id], 0, 9999, 0); if (count) s.inventory[id] = count;});
    if (original.version < 3 && !s.inventory.watering_can) s.inventory.watering_can=1;
    const equipment = record(original.equipment) ? original.equipment : {};
    ['weapon', 'armor'].forEach(slot => {
      const id = equipment[slot], item = lookup(Data.items,id); s.equipment[slot] = item && item.kind === slot && s.inventory[id] ? id : null;
    });
    s.steps = integer(original.steps, 0, 100000000, 0); s.defeats = integer(original.defeats, 0, 99999, 0);
    s.savedAt = timestamp(original.savedAt,now,now);
    s.lastTick = timestamp(original.lastTick,s.savedAt,now);
    s.lastAction = 0;
    if (record(original.world)) {s.world.elapsedMs=integer(original.world.elapsedMs,0,MAX_WORLD_MS,0);s.world.offsetMs=integer(original.world.offsetMs,0,MAX_WORLD_MS,0);}
    const validPosition = k => {const parts = k.split(','); if (parts.length !== 2) return null; const x = Number(parts[0]), y = Number(parts[1]); return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < Data.width && y < Data.height ? {x, y} : null;};
    Object.keys(original.nodes || {}).slice(0, Data.width * Data.height).forEach(k => {
      const pos = validPosition(k); if (!pos) return; const node = Data.getTile(pos.x, pos.y).resource, n = original.nodes[k];
      if (node && record(n)) s.nodes[k] = {remaining: integer(n.remaining, 0, node.amount, node.amount), respawnAt: timestamp(n.respawnAt,0,now+300000)};
    });
    Object.keys(original.buildings || {}).slice(0, Data.width * Data.height).forEach(k => {
      const pos = validPosition(k), b = original.buildings[k], definition = record(b) && lookup(Data.buildings,b.type); if (!pos || !definition || !Data.getTile(pos.x, pos.y).walkable) return;
      s.buildings[k] = {type: b.type, level: integer(b.level, 1, definition.maxLevel || 3, 1)};
    });
    Object.keys(original.crops || {}).slice(0, Data.width * Data.height).forEach(k => {
      const pos = validPosition(k), c = original.crops[k]; if (!pos || !record(c) || !lookup(Data.crops,c.type) || !Data.getTile(pos.x, pos.y).walkable || s.buildings[k]) return;
      s.crops[k] = {type: c.type, plantedAt: timestamp(c.plantedAt,now,now), plantedOffset:integer(c.plantedOffset,0,s.world.offsetMs,0), wateredDay:integer(c.wateredDay,0,1+Math.floor(s.world.elapsedMs/DAY_MS),0), waterBonusMs:integer(c.waterBonusMs,0,86400000,0), growthRate:typeof c.growthRate==='number'&&Number.isFinite(c.growthRate)&&c.growthRate>=.2&&c.growthRate<=3?c.growthRate:1};
    });
    Data.creatures.forEach(c => {if (original.discovered && original.discovered[c.id]) s.discovered[c.id] = true;});
    Object.keys(Data.biomes).forEach(id => {if (original.explored && original.explored[id]) s.explored[id] = true;});
    Object.keys(original.visited || {}).slice(0, Data.width * Data.height).forEach(k => {if (validPosition(k)) s.visited[k] = true;});
    Data.quests.forEach(q => {
      if (original.accepted && original.accepted[q.id]) s.accepted[q.id] = true;
      if (original.completed && original.completed[q.id]) {s.completed[q.id] = true; s.accepted[q.id] = true;}
    });
    Data.npcs.forEach(npc=>{const friendship=original.friendships&&original.friendships[npc.id];if(!record(friendship))return;const day=1+Math.floor(s.world.elapsedMs/DAY_MS);s.friendships[npc.id]={points:integer(friendship.points,0,500,0),lastTalkDay:integer(friendship.lastTalkDay,0,day,0),lastGiftDay:integer(friendship.lastGiftDay,0,day,0)};});
    Object.keys(s.metrics).forEach(kind => {
      const entries = original.metrics && original.metrics[kind] || {};
      const validIds = kind === 'kill' ? Data.creatures.map(c => c.id) : kind === 'build' ? Object.keys(Data.buildings) : kind === 'explore' ? Object.keys(Data.biomes) : kind === 'harvest' ? Object.keys(Data.crops) : Object.keys(Data.items);
      validIds.forEach(id => {s.metrics[kind][id] = integer(entries[id], 0, 100000000, 0);});
    });
    if (original.combat) {
      const enemy = Data.creatures.find(c => c.id === original.combat.id);
      if (enemy && enemy.habitat.includes(Data.getTile(s.player.x, s.player.y).biome)) s.combat = {id: enemy.id, hp: integer(original.combat.hp, 1, enemy.hp, enemy.hp), turn: integer(original.combat.turn, 0, 99999, 0)};
    }
    s.log = Array.isArray(original.log) ? original.log.filter(v => typeof v === 'string').map(v => v.slice(0, 220)).slice(-8) : s.log;
    s.player.hp = integer(p.hp, 1, 100 + (s.player.level - 1) * 5 + Object.values(s.buildings).filter(b => b.type === 'house').reduce((n,b) => n+b.level*10,0), 100);
    return s;
  }

  class Game {
    constructor(options) {
      const config = options || {}; this.clock = config.clock || (() => Date.now()); this.state = config.state ? normalize(config.state, this.clock()) : fresh(this.clock());
      this.tick();
    }
    now(value) {return Number.isFinite(value) ? Math.max(0, value) : this.clock();}
    calendar() {
      const elapsed=this.state.world.elapsedMs,day=1+Math.floor(elapsed/DAY_MS),seasons=Data.seasons,weather=Data.weather;
      const minutes=(480+Math.floor(elapsed%DAY_MS/DAY_MS*1440))%1440;
      return {day,season:seasons[Math.floor((day-1)/(Data.seasonLength||7))%seasons.length],weather:weather[((day-1)*17)%weather.length],hour:Math.floor(minutes/60),minute:minutes%60};
    }
    maxHp() {return 100 + (this.state.player.level - 1) * 5 + Object.values(this.state.buildings).filter(b => b.type === 'house').reduce((n,b) => n+b.level*10,0);}
    capacity() {const warehouse = Object.values(this.state.buildings).filter(b => b.type === 'warehouse').reduce((n, b) => n + b.level, 0); return 120 + warehouse * 80 + this.state.player.level * 10;}
    loadCount(bag) {const inventory = bag || this.state.inventory; return Object.keys(inventory).reduce((n,id) => {const item = lookup(Data.items,id); return n+(item && !['tool','weapon','armor','currency'].includes(item.kind) ? integer(inventory[id],0,9999,0) : 0);},0);}
    count(id) {return lookup(Data.items,id) && own(this.state.inventory,id) ? integer(this.state.inventory[id],0,9999,0) : 0;}
    has(cost) {const requested = cost === undefined || cost === null ? {} : cost; return quantities(requested) && Object.keys(requested).every(id => this.count(id) >= requested[id]);}
    transaction(cost, output) {
      cost = cost === undefined || cost === null ? {} : cost; output = output === undefined || output === null ? {} : output;
      if (!quantities(cost) || !quantities(output)) return fail('Item ou quantidade inválida.');
      if (!this.has(cost)) return fail('Recursos insuficientes.');
      const bag = Object.assign({}, this.state.inventory);
      Object.keys(cost || {}).forEach(id => bag[id] = (bag[id] || 0) - cost[id]);
      for (const id of Object.keys(output || {})) {
        bag[id] = (bag[id] || 0) + output[id]; if (bag[id] > 9999) return fail('Limite de itens atingido.');
      }
      if (this.loadCount(bag) > this.capacity() && this.loadCount(bag) > this.loadCount()) return fail('Inventário cheio. Construa ou melhore um armazém.');
      Object.keys(bag).forEach(id => {if (!bag[id]) delete bag[id];}); this.state.inventory = bag; return ok('');
    }
    note(message) {this.state.log.push(message); this.state.log = this.state.log.slice(-8); return message;}
    metric(kind, id, n) {this.state.metrics[kind][id] = (this.state.metrics[kind][id] || 0) + (n || 1);}
    gainXp(amount) {
      const p = this.state.player, previous = p.level; p.xp += amount; p.level = Math.min(100, 1 + Math.floor(p.xp / 100));
      if (previous !== p.level) {p.hp = this.maxHp(); p.stamina = 100; this.note('Nível ' + p.level + ': vida e vigor restaurados.');}
    }
    tick(value) {
      const now = this.now(value), s = this.state, elapsed = Math.max(0, Math.min(now - s.lastTick, 86400000));
      if (elapsed >= 1000) {
        const seconds = Math.floor(elapsed / 1000); s.player.stamina = Math.min(100, s.player.stamina + seconds * 2);
        s.world.elapsedMs=Math.min(MAX_WORLD_MS,s.world.elapsedMs+seconds*1000);
        const shelter = Math.max(this.nearbyLevel('camp', 2),this.nearbyLevel('house', 2));
        if (!s.combat && (this.tile().biome === 'city' || shelter)) s.player.hp = Math.min(this.maxHp(), s.player.hp + seconds * Math.max(1,shelter));
        s.lastTick = now - elapsed % 1000;
      }
      for (const k of Object.keys(s.nodes)) if (s.nodes[k].remaining === 0 && now >= s.nodes[k].respawnAt) delete s.nodes[k];
      return this.state;
    }
    tile(x, y) {return Data.getTile(x === undefined ? this.state.player.x : x, y === undefined ? this.state.player.y : y);}
    resourceAt(x, y) {
      const tile = this.tile(x, y); if (!tile.resource) return null;
      const saved = this.state.nodes[key(x, y)]; return Object.assign({}, tile.resource, {remaining: saved ? saved.remaining : tile.resource.amount});
    }
    nearbyResources() {
      const p = this.state.player, nodes = [];
      for (const offset of [[0,0],[0,-1],[-1,0],[1,0],[0,1]]) {const x = p.x + offset[0], y = p.y + offset[1]; if (x < 0 || y < 0 || x >= Data.width || y >= Data.height) continue; const r = this.resourceAt(x, y); if (r) nodes.push(Object.assign({x,y}, r));}
      return nodes;
    }
    nearbyLevel(type, range, point) {return Object.keys(this.state.buildings).reduce((level,k) => {const [x,y] = k.split(',').map(Number), b = this.state.buildings[k]; return b.type === type && distance(point || this.state.player, {x,y}) <= (range === undefined ? 3 : range) ? Math.max(level,b.level) : level;},0);}
    nearBuilding(type, range, point) {return this.nearbyLevel(type,range,point) > 0;}
    ready(value, cost) {
      const now = this.now(value); this.tick(now);
      if (this.state.combat) return fail('Resolva o combate antes desta ação.');
      if (this.state.player.stamina < (cost || 0)) return fail('Vigor insuficiente. Descanse alguns segundos.');
      return ok('', {now});
    }
    move(dx, dy, value) {
      if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return fail('Movimento inválido.');
      const ready = this.ready(value, 1); if (!ready.ok) return ready;
      const p = this.state.player, x = p.x + dx, y = p.y + dy;
      if (x < 0 || y < 0 || x >= Data.width || y >= Data.height || !this.tile(x,y).walkable) return fail('O caminho está bloqueado.');
      p.x = x; p.y = y; p.stamina--; this.state.steps++; const tile = this.tile(); this.state.visited[key(x,y)] = true;
      if (!this.state.explored[tile.biome]) {this.state.explored[tile.biome] = true; this.metric('explore', tile.biome); this.gainXp(15); this.note('Bioma descoberto: ' + Data.biomes[tile.biome].name + '.');}
      const candidates = Data.creatures.filter(c => c.habitat.includes(tile.biome));
      if (['mountain','swamp','ruins'].includes(tile.biome) && candidates.length && this.state.steps % 9 === 0 && !this.nearBuilding('camp', 2)) this.startEncounter(candidates[Math.floor(this.state.steps / 9) % candidates.length].id);
      return ok('Explorando ' + Data.biomes[tile.biome].name + '.', {moved: true, combat: !!this.state.combat});
    }
    gather(x, y, value) {
      x = x === undefined ? this.state.player.x : x; y = y === undefined ? this.state.player.y : y;
      const ready = this.ready(value, 5); if (!ready.ok) return ready;
      if (!Number.isInteger(x) || !Number.isInteger(y) || distance(this.state.player,{x,y}) > 1) return fail('Aproxime-se do recurso.');
      const node = this.resourceAt(x,y); if (!node || !node.remaining) return fail('Recurso esgotado. Ele se recupera em cinco minutos.');
      if (node.tool && !this.count(node.tool)) return fail('Ferramenta necessária: ' + (Data.items[node.tool] || {}).name + '.');
      const quantity = Math.min(node.remaining, node.item === 'wood' || node.item === 'stone' ? 2 : 1);
      const tx = this.transaction({}, {[node.item]: quantity}); if (!tx.ok) return tx;
      this.state.nodes[key(x,y)] = {remaining: node.remaining - quantity, respawnAt: node.remaining - quantity ? 0 : ready.now + 300000};
      this.state.player.stamina -= 5; this.metric('gather',node.item,quantity); this.gainXp(2);
      return ok(this.note('Coletou ' + quantity + ' × ' + Data.items[node.item].name + '.'));
    }
    craft(id, value) {
      const ready = this.ready(value, 4); if (!ready.ok) return ready;
      const recipe = Data.recipes.find(r => r.id === id); if (!recipe) return fail('Receita desconhecida.');
      if (recipe.station && !this.nearBuilding(recipe.station)) return fail('Aproxime-se de uma ' + Data.buildings[recipe.station].name + '.');
      const tx = this.transaction(recipe.cost, recipe.output); if (!tx.ok) return tx;
      this.state.player.stamina -= Math.max(1,5-(recipe.station ? this.nearbyLevel(recipe.station) : 1)); Object.keys(recipe.output).forEach(item => this.metric('craft', item, recipe.output[item])); this.gainXp(5);
      return ok(this.note('Fabricou: ' + recipe.name + '.'));
    }
    equip(id) {
      const item = lookup(Data.items,id); if (!item || !['weapon','armor'].includes(item.kind) || !this.count(id)) return fail('Equipamento indisponível.');
      this.state.equipment[item.kind] = id; return ok(this.note(item.name + ' equipado.'));
    }
    plant(id, value) {
      const ready = this.ready(value, 5); if (!ready.ok) return ready;
      const crop = lookup(Data.crops,id), tile = this.tile(), k = key(tile.x,tile.y);
      if (!crop) return fail('Cultivo desconhecido.');
      if (!this.count('hoe')) return fail('Fabrique uma enxada para plantar.');
      if (!['plains','forest'].includes(tile.biome) || !tile.walkable) return fail('Plante na planície ou na floresta.');
      if (this.state.crops[k] || this.state.buildings[k] || (this.resourceAt(tile.x,tile.y) || {}).remaining) return fail('O terreno está ocupado.');
      const tx = this.transaction({[crop.seed]:1},{}); if (!tx.ok) return tx;
      const calendar=this.calendar(),seasonBonus=Array.isArray(crop.seasons)?(crop.seasons.includes(calendar.season.id)?1.1:.85):1;
      this.state.crops[k] = {type:id,plantedAt:ready.now,plantedOffset:this.state.world.offsetMs,wateredDay:calendar.weather.rain?calendar.day:0,waterBonusMs:0,growthRate:Math.max(.2,Math.min(3,calendar.season.growthRate*calendar.weather.growthRate*seasonBonus))}; this.state.player.stamina -= 5;
      return ok(this.note('Plantou ' + crop.name + '. Cresce mesmo com o aplicativo fechado.'));
    }
    nearbyCrops(value) {
      const p=this.state.player,result=[];
      for(const [dx,dy] of [[0,0],[0,-1],[-1,0],[1,0],[0,1]]) {const x=p.x+dx,y=p.y+dy,status=this.cropStatus(x,y,value);if(status)result.push(Object.assign({x,y},status));}
      return result;
    }
    water(x,y,value) {
      x=x===undefined?this.state.player.x:x;y=y===undefined?this.state.player.y:y;
      const ready=this.ready(value,3);if(!ready.ok)return ready;
      if(!this.count('watering_can'))return fail('Você precisa de um regador. Fabrique um na bancada.');
      if(!Number.isInteger(x)||!Number.isInteger(y)||distance(this.state.player,{x,y})>1)return fail('Aproxime-se da plantação para regar.');
      const crop=this.state.crops[key(x,y)],status=this.cropStatus(x,y,ready.now);if(!status)return fail('Não há plantação neste terreno.');
      if(status.ready)return fail('Esta plantação já está pronta. Colha os frutos.');
      if(status.wateredToday)return fail(this.calendar().weather.rain?'A chuva já cuidou desta plantação hoje.':'Você já regou esta plantação hoje.');
      crop.wateredDay=this.calendar().day;crop.waterBonusMs=(crop.waterBonusMs||0)+Math.floor(Data.crops[crop.type].growMs*.25);this.state.player.stamina-=3;
      return ok(this.note('Regou '+status.name+'. A colheita ficará pronta mais cedo.'));
    }
    rest(value) {
      const ready=this.ready(value,0);if(!ready.ok)return ready;
      if(!this.nearBuilding('camp',2)&&!this.nearBuilding('house',2))return fail('Descanse perto de uma casa ou de um acampamento.');
      const skip=DAY_MS-this.state.world.elapsedMs%DAY_MS;
      if(this.state.world.offsetMs+skip>MAX_WORLD_MS||this.state.world.elapsedMs+skip>MAX_WORLD_MS)return fail('O calendário chegou ao limite deste salvamento.');
      this.state.world.elapsedMs+=skip;this.state.world.offsetMs+=skip;this.state.player.hp=this.maxHp();this.state.player.stamina=100;
      return ok(this.note('Uma nova manhã em Nerakar. Dia '+this.calendar().day+', '+this.calendar().season.name.toLocaleLowerCase('pt-BR')+'.'),{rested:true,calendar:this.calendar()});
    }
    cropStatus(x, y, value) {
      const crop = this.state.crops[key(x,y)]; if (!record(crop)) return null; const definition = lookup(Data.crops,crop.type); if (!definition) return null;
      const duration = definition.growMs * (1-this.nearbyLevel('well',5,{x,y})*.2);
      const growthRate=crop.growthRate||1, elapsed=Math.max(0,this.now(value)-crop.plantedAt+this.state.world.offsetMs-(crop.plantedOffset||0)), grown=elapsed*growthRate+(crop.waterBonusMs||0),remaining=Math.max(0,(duration-grown)/growthRate),calendar=this.calendar();
      return {type:crop.type,name:definition.name,ready:remaining===0,remaining,progress:Math.min(1,Math.max(0,grown/duration)),watered:!!crop.wateredDay||!!calendar.weather.rain,wateredToday:crop.wateredDay===calendar.day||!!calendar.weather.rain,waterBonusMs:crop.waterBonusMs||0,growthRate};
    }
    harvest(value) {
      const ready = this.ready(value, 3); if (!ready.ok) return ready;
      const p = this.state.player, k = key(p.x,p.y), status = this.cropStatus(p.x,p.y,ready.now); if (!status) return fail('Não há plantação neste terreno.');
      if (!status.ready) return fail('A plantação ainda está crescendo.');
      const crop = Data.crops[status.type], tx = this.transaction({}, {[crop.item]:crop.yield,[crop.seed]:2}); if (!tx.ok) return tx;
      delete this.state.crops[k]; this.state.player.stamina -= 3; this.metric('harvest', status.type,crop.yield); this.gainXp(10);
      return ok(this.note('Colheu ' + crop.yield + ' × ' + Data.items[crop.item].name + ' e duas sementes.'));
    }
    build(type, value) {
      const ready = this.ready(value, 8); if (!ready.ok) return ready;
      const definition = lookup(Data.buildings,type), tile = this.tile(), k = key(tile.x,tile.y); if (!definition) return fail('Construção desconhecida.');
      if (!tile.walkable || (type !== 'camp' && !['city','plains'].includes(tile.biome))) return fail('Construa na cidade ou na planície.');
      if (Data.npcs.some(n => n.x === tile.x && n.y === tile.y) || tile.landmark || this.state.buildings[k] || this.state.crops[k] || (this.resourceAt(tile.x,tile.y) || {}).remaining) return fail('Este terreno está ocupado.');
      const tx = this.transaction(definition.cost, {}); if (!tx.ok) return tx;
      this.state.buildings[k] = {type,level:1}; this.state.player.stamina -= 8; this.metric('build',type); this.gainXp(15);
      return ok(this.note('Construiu ' + definition.name + '.'));
    }
    upgradeBuilding(value) {
      const ready = this.ready(value, 8); if (!ready.ok) return ready;
      const b = this.state.buildings[key(this.state.player.x,this.state.player.y)]; if (!b) return fail('Fique no terreno da construção.');
      const definition = record(b) && lookup(Data.buildings,b.type); if (!definition) return fail('Construção inválida.');
      if (b.level >= (definition.maxLevel || 3)) return fail('A construção já está no nível máximo.');
      const cost = {}; Object.keys(definition.upgradeCost || definition.cost).forEach(id => cost[id] = (definition.upgradeCost || definition.cost)[id] * b.level);
      const tx = this.transaction(cost, {}); if (!tx.ok) return tx;
      b.level++; this.state.player.stamina -= 8; this.gainXp(20);
      return ok(this.note(definition.name + ' chegou ao nível ' + b.level + '.'));
    }
    interactNpc(id) {
      const npc = Data.npcs.find(n => n.id === id); if (!npc || distance(this.state.player,npc) > 2) return fail('Aproxime-se deste morador.');
      if (this.state.combat) return fail('Resolva o combate primeiro.');
      return ok(npc.dialogues[this.state.steps % npc.dialogues.length], {npc, quests:Data.quests.filter(q => q.npc === id)});
    }
    friendship(id) {
      const npc=Data.npcs.find(n=>n.id===id);if(!npc)return null;
      const f=this.state.friendships[id]||{points:0,lastTalkDay:0,lastGiftDay:0},day=this.calendar().day;
      return {id,npc,name:npc.name,points:f.points,level:Math.min(10,Math.floor(f.points/25)),talkedToday:f.lastTalkDay===day,giftedToday:f.lastGiftDay===day};
    }
    talkNpc(id,value) {
      this.tick(value);const result=this.interactNpc(id);if(!result.ok)return result;
      const friendship=this.friendship(id),f=this.state.friendships[id]||(this.state.friendships[id]={points:0,lastTalkDay:0,lastGiftDay:0});
      const gain=friendship.talkedToday?0:3;if(gain){f.points=Math.min(500,f.points+gain);f.lastTalkDay=this.calendar().day;}
      return Object.assign(result,{friendship:this.friendship(id),friendshipGained:gain});
    }
    giftNpc(id,itemId,value) {
      this.tick(value);const result=this.interactNpc(id);if(!result.ok)return result;
      const item=lookup(Data.items,itemId);if(!item||!['food','material','seed'].includes(item.kind)||!this.count(itemId))return fail('Escolha um presente disponível na sua bolsa.');
      const friendship=this.friendship(id);if(friendship.giftedToday)return fail('Este morador já recebeu um presente hoje. Volte amanhã.');
      const tx=this.transaction({[itemId]:1},{});if(!tx.ok)return tx;
      const preferred=own(Data.gifts,id)&&Array.isArray(Data.gifts[id])&&Data.gifts[id].includes(itemId),gain=preferred?12:5;
      const f=this.state.friendships[id]||(this.state.friendships[id]={points:0,lastTalkDay:0,lastGiftDay:0});f.points=Math.min(500,f.points+gain);f.lastGiftDay=this.calendar().day;
      return ok(this.note(result.npc.name+(preferred?' gostou muito de ':' agradeceu por ')+item.name+'.'),{friendship:this.friendship(id),friendshipGained:gain});
    }
    shopStatus(id) {
      const shop=lookup(Data.shops,id);if(!shop)return null;const npc=Data.npcs.find(n=>n.id===shop.npc);if(!npc)return null;
      const stock={};Object.keys(shop.stock||{}).forEach(itemId=>{const price=shop.stock[itemId];if(lookup(Data.items,itemId)&&record(price)&&Number.isSafeInteger(price.buy)&&price.buy>=0&&Number.isSafeInteger(price.sell)&&price.sell>=0)stock[itemId]={buy:price.buy,sell:price.sell};});
      return {id,name:shop.name,npc,stock,available:!this.state.combat&&distance(this.state.player,npc)<=2};
    }
    trade(kind,shopId,itemId,quantity,value) {
      this.tick(value);const shop=this.shopStatus(shopId);if(!shop||!shop.available)return fail('Aproxime-se do morador da loja para negociar.');
      if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99)return fail('Escolha uma quantidade de 1 a 99.');
      if(!own(shop.stock,itemId)||!lookup(Data.items,itemId))return fail('Este item não faz parte desta loja.');
      const price=shop.stock[itemId][kind];if(!Number.isSafeInteger(price)||price<=0)return fail(kind==='buy'?'Este item só pode ser vendido aqui.':'A loja não compra este item.');
      const tx=kind==='buy'?this.transaction({coin:price*quantity},{[itemId]:quantity}):this.transaction({[itemId]:quantity},{coin:price*quantity});if(!tx.ok)return tx;
      return ok(this.note((kind==='buy'?'Comprou ':'Vendeu ')+quantity+' × '+Data.items[itemId].name+' por '+price*quantity+' moedas.'));
    }
    buy(shopId,itemId,quantity,value) {return this.trade('buy',shopId,itemId,quantity===undefined?1:quantity,value);}
    sell(shopId,itemId,quantity,value) {return this.trade('sell',shopId,itemId,quantity===undefined?1:quantity,value);}
    questStatus(id) {
      const q = Data.quests.find(q => q.id === id); if (!q) return null;
      const current = this.state.metrics[q.target.kind][q.target.id] || 0;
      return {id, accepted:!!this.state.accepted[id], completed:!!this.state.completed[id], available:!q.requires || !!this.state.completed[q.requires], current, amount:q.target.amount, ready:current >= q.target.amount};
    }
    acceptQuest(id) {
      const q = Data.quests.find(q => q.id === id), status = this.questStatus(id); if (!q) return fail('Missão desconhecida.');
      const talk = this.interactNpc(q.npc); if (!talk.ok) return talk;
      if (!status.available) return fail('Complete a missão anterior para continuar.'); if (status.completed) return fail('Esta missão já foi concluída.');
      this.state.accepted[id] = true; return ok(this.note('Missão aceita: ' + q.title + '.'));
    }
    claimQuest(id) {
      const q = Data.quests.find(q => q.id === id), status = this.questStatus(id); if (!q || !status.accepted || status.completed || !status.available) return fail('Missão indisponível.');
      const talk = this.interactNpc(q.npc); if (!talk.ok) return talk; if (!status.ready) return fail('O objetivo ainda não foi cumprido.');
      const tx = this.transaction({},q.reward.items || {}); if (!tx.ok) return tx;
      this.state.completed[id] = true; this.gainXp(q.reward.xp || 0); return ok(this.note('Missão concluída: ' + q.title + '.'), {reward:q.reward});
    }
    startEncounter(id) {
      const enemy = Data.creatures.find(c => c.id === id); if (this.state.combat || !enemy || !enemy.habitat.includes(this.tile().biome)) return fail('Encontro indisponível neste bioma.');
      this.state.discovered[id] = true; this.state.combat = {id,hp:enemy.hp,turn:0}; this.state.lastAction = 0;
      return ok(this.note('Encontrou ' + enemy.name + '. Ataque, proteja-se ou recue.'));
    }
    battle(action, value) {
      const now = this.now(value); this.tick(now); const combat = this.state.combat; if (!combat) return fail('Nenhum combate em andamento.');
      if (!['attack','dodge','guard','flee'].includes(action)) return fail('Ação de combate inválida.');
      if (this.state.lastAction && now - this.state.lastAction < 650) return fail('Espere o próximo movimento.');
      const enemy = Data.creatures.find(c => c.id === combat.id), p = this.state.player;
      const cost = action === 'dodge' ? 8 : action === 'attack' ? 4 : action === 'flee' ? 5 : 0;
      if (p.stamina < cost) return fail('Vigor insuficiente. Use Proteger para recuperar.');
      p.stamina -= cost; this.state.lastAction = now; combat.turn++;
      if (action === 'flee') {this.state.combat = null; this.note('Recuou para o centro de Nerakar.'); Object.assign(p,Data.spawn); return ok('Recuou em segurança.',{escaped:true});}
      if (action === 'attack') {
        const weapon = lookup(Data.items,this.state.equipment.weapon) || {}; const damage = Math.max(2,8 + (weapon.attack || 0) + p.level * 2 - enemy.defense);
        combat.hp = Math.max(0,combat.hp - damage);
        if (!combat.hp) {
          const loot = this.transaction({},enemy.drops); this.state.combat = null; this.metric('kill',enemy.id); this.gainXp(enemy.xp);
          const message = 'Venceu ' + enemy.name + ': +' + enemy.xp + ' XP.' + (loot.ok ? ' Itens recolhidos.' : ' Inventário cheio: itens perdidos.');
          return ok(this.note(message),{victory:true,damage,drops:loot.ok ? enemy.drops : {}});
        }
      }
      if (action === 'guard') p.stamina = Math.min(100,p.stamina + 12);
      const armor = lookup(Data.items,this.state.equipment.armor) || {}, retaliation = action === 'dodge' ? 0 : Math.max(1,enemy.attack - (armor.defense || 0) - p.level);
      const taken = action === 'guard' ? Math.max(1,Math.floor(retaliation / 3)) : retaliation; p.hp -= taken;
      if (p.hp <= 0) {
        this.state.defeats++; this.state.combat = null; Object.assign(p,Data.spawn); p.hp = Math.max(1,Math.floor(this.maxHp() * .65)); p.stamina = 55;
        return ok(this.note('Você foi resgatado e retornou a Nerakar. Seu inventário foi preservado.'),{defeat:true,taken});
      }
      return ok(action === 'dodge' ? 'Esquiva: nenhum dano recebido.' : action === 'guard' ? 'Proteção: vigor recuperado; recebeu ' + taken + ' de dano.' : 'Ataque realizado; recebeu ' + taken + ' de dano.',{taken,damage:action === 'attack' ? Math.max(2,8+((lookup(Data.items,this.state.equipment.weapon) || {}).attack || 0)+p.level*2-enemy.defense) : 0});
    }
    useItem(id, value) {
      this.tick(value); if (!['food','healing_potion'].includes(id) || !this.count(id)) return fail('Consumível indisponível.');
      const p = this.state.player; if (p.hp === this.maxHp() && p.stamina === 100) return fail('Vida e vigor já estão completos.');
      const tx = this.transaction({[id]:1},{}); if (!tx.ok) return tx;
      p.hp = Math.min(this.maxHp(),p.hp+(id === 'healing_potion' ? 55 : 12)); p.stamina = Math.min(100,p.stamina+(id === 'food' ? 30 : 10));
      return ok(this.note('Usou ' + Data.items[id].name + '.'));
    }
    serialize(value) {const now = this.now(value); this.tick(now); this.state.savedAt = now; return JSON.stringify({format:'sinapse-nerakar',version:VERSION,state:this.state});}
    save(storage, value) {
      try {
        const existing = storage.getItem(SAVE_KEY); if (existing) {try {normalize(JSON.parse(existing),this.now(value)); storage.setItem(BACKUP_KEY,existing);} catch (_) {}}
        storage.setItem(SAVE_KEY,this.serialize(value)); return ok('Progresso salvo neste dispositivo.');
      } catch (error) {return fail('Não foi possível salvar: armazenamento indisponível ou cheio. Exporte seu progresso.');}
    }
  }
  function restore(storage, options) {
    const config = options || {}, now = config.clock ? config.clock() : Date.now(); let issue = null;
    for (const saveKey of [SAVE_KEY,BACKUP_KEY,'sf_nerakar_rpg_v1']) {
      let raw; try {raw = storage.getItem(saveKey);} catch (_) {return {game:new Game(config),source:'new',warning:'Armazenamento indisponível. Exporte seu progresso.'};}
      if (!raw) continue;
      try {const state = normalize(JSON.parse(raw),now); return {game:new Game(Object.assign({},config,{state})),source:saveKey,warning:saveKey === BACKUP_KEY ? 'O salvamento principal estava danificado. Recuperamos a cópia anterior.' : issue};}
      catch (error) {issue = 'Salvamento ilegível preservado. Um novo progresso foi iniciado.'; try {storage.setItem(CORRUPT_KEY,raw);} catch (_) {issue = 'Salvamento ilegível; não foi possível criar cópia de recuperação. Exporte seu progresso.';}}
    }
    return {game:new Game(config),source:'new',warning:issue};
  }
  function importSave(text, options) {return new Game(Object.assign({},options || {},{state:JSON.parse(text)}));}
  return {Game,createGame:options => new Game(options),restore,importSave,normalize,VERSION,SAVE_KEY,BACKUP_KEY,CORRUPT_KEY};
});
