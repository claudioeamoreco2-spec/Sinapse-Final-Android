'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../app/src/main/assets/rpg-data.js');
const Engine = require('../app/src/main/assets/rpg-engine.js');
const make = () => {let time = 1000000; const game = Engine.createGame({clock:() => time}); return {game,advance:ms => {time += ms;game.tick();},now:() => time};};
const moveFixture = (game,x,y) => {game.state.player.x=x;game.state.player.y=y;};
const findTile = predicate => {for(let y=0;y<Data.height;y++)for(let x=0;x<Data.width;x++){const t=Data.getTile(x,y);if(predicate(t))return t;}throw new Error('Fixture not found');};
const plain = () => findTile(t=>t.biome==='plains'&&t.walkable&&!t.resource&&!t.landmark);
const memory = () => {const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),values};};

test('deterministic world has connected seven biomes and all resource types',()=>{
  const queue=[Data.spawn], seen=new Set(),biomes=new Set(),resources=new Set();
  while(queue.length){const p=queue.pop(),k=p.x+','+p.y;if(seen.has(k))continue;seen.add(k);const t=Data.getTile(p.x,p.y);if(!t.walkable)continue;biomes.add(t.biome);if(t.resource)resources.add(t.resource.item);assert.deepEqual(t,Data.getTile(p.x,p.y));for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(x>=0&&y>=0&&x<Data.width&&y<Data.height)queue.push({x,y});}}
  assert.equal(biomes.size,7);for(const id of ['wood','stone','copper_ore','iron_ore','crystal','fiber'])assert(resources.has(id));
  Data.npcs.forEach(n=>{assert(seen.has(n.x+','+n.y));assert(Data.getTile(n.x,n.y).walkable);assert(!Data.getTile(n.x,n.y).resource);});
});
test('twenty-four unique self-contained creature illustrations and valid data references',()=>{
  assert.equal(Data.creatures.length,24);const content=new Set();
  Data.creatures.forEach(c=>{const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets',c.image),'utf8');assert(source.includes('<svg'));assert(!/(?:xlink:)?href=["'](?:https?:|\/\/)|<script|<foreignObject/.test(source));content.add(source);Object.keys(c.drops).forEach(id=>assert(Data.items[id]));c.habitat.forEach(id=>assert(Data.biomes[id]));});assert.equal(content.size,24);
  Data.recipes.forEach(r=>{Object.keys({...r.cost,...r.output}).forEach(id=>assert(Data.items[id]));if(r.station)assert(Data.buildings[r.station]);});
});
test('movement rejects teleporting, world boundaries, and deep water without spending stamina',()=>{
  const {game}=make(),snapshot=JSON.stringify(game.state.player);assert(!game.move(2,0).ok);assert.equal(JSON.stringify(game.state.player),snapshot);
  moveFixture(game,0,0);assert(!game.move(-1,0).ok);const water=findTile(t=>t.biome==='lake'&&!t.walkable&&Data.getTile(t.x-1,t.y).walkable);moveFixture(game,water.x-1,water.y);const stamina=game.state.player.stamina;assert(!game.move(1,0).ok);assert.equal(game.state.player.stamina,stamina);
});
test('resource harvesting has range/tool checks, exhaustion, no duplicate drops and timed respawn',()=>{
  const {game,advance}=make(),node=findTile(t=>t.resource&&t.resource.item==='wood');const initial=game.count('wood');assert(!game.gather(node.x,node.y).ok);assert.equal(game.count('wood'),initial);moveFixture(game,node.x,node.y);delete game.state.inventory.axe;assert(!game.gather(node.x,node.y).ok);game.state.inventory.axe=1;assert(game.gather(node.x,node.y).ok);assert(game.gather(node.x,node.y).ok);assert.equal(game.count('wood'),initial+4);assert(!game.gather(node.x,node.y).ok);assert.equal(game.state.metrics.gather.wood,4);advance(299999);assert.equal(game.resourceAt(node.x,node.y).remaining,0);advance(1);assert.equal(game.resourceAt(node.x,node.y).remaining,4);
});
test('full inventory does not deplete gathering nodes or spend vigor',()=>{
  const {game}=make(),node=findTile(t=>t.resource&&t.resource.item==='wood');moveFixture(game,node.x,node.y);game.state.inventory={wood:game.capacity(),axe:1};const before=JSON.stringify(game.state);assert(!game.gather(node.x,node.y).ok);assert.equal(JSON.stringify(game.state),before);
});
test('crafting is atomic when station, ingredients or output capacity are missing',()=>{
  const {game}=make();game.state.inventory={wood:10,stone:10};let snapshot=JSON.stringify(game.state);assert(!game.craft('plank').ok);assert.equal(JSON.stringify(game.state),snapshot);game.state.buildings[positionKey(game)]={type:'workbench',level:1};game.state.inventory={wood:1};snapshot=JSON.stringify(game.state);assert(!game.craft('plank').ok);assert.equal(JSON.stringify(game.state),snapshot);game.state.inventory={wood:game.capacity()};snapshot=JSON.stringify(game.state);assert(!game.craft('plank').ok);assert.equal(JSON.stringify(game.state),snapshot);game.state.inventory={wood:2};assert(game.craft('plank').ok);assert.equal(game.count('wood'),0);assert.equal(game.count('plank'),3);assert.equal(game.state.metrics.craft.plank,3);
});
function positionKey(game){return game.state.player.x+','+game.state.player.y;}
test('station range applies and upgraded stations spend less vigor',()=>{
  const {game}=make();game.state.inventory.wood=20;game.state.buildings['24,20']={type:'workbench',level:3};const stamina=game.state.player.stamina;assert(game.craft('plank').ok);assert.equal(game.state.player.stamina,stamina-2);moveFixture(game,28,20);assert(!game.craft('plank').ok);
});
test('farming consumes one seed, prevents overlapping crops, enforces growth and gives renewable seeds',()=>{
  const {game,advance}=make(),tile=plain();moveFixture(game,tile.x,tile.y);const seeds=game.count('wheat_seed');assert(game.plant('wheat').ok);assert.equal(game.count('wheat_seed'),seeds-1);assert(!game.plant('wheat').ok);assert(!game.harvest().ok);const grow=Math.ceil(game.cropStatus(tile.x,tile.y).remaining);advance(grow-1);assert(!game.harvest().ok);advance(1);assert(game.harvest().ok);assert.equal(game.count('wheat'),3);assert.equal(game.count('wheat_seed'),seeds+1);assert.equal(game.state.metrics.harvest.wheat,3);assert(!game.harvest().ok);
});
test('mature crops survive save/import and progress while app is closed',()=>{
  const {game,now}=make(),tile=plain();moveFixture(game,tile.x,tile.y);assert(game.plant('herb').ok);const serialized=game.serialize();const loaded=Engine.importSave(serialized,{clock:()=>now()+Data.crops.herb.growMs+10});assert(loaded.cropStatus(tile.x,tile.y).ready);assert(loaded.harvest().ok);assert.equal(loaded.count('herb'),2);
});
test('well grows crops by plot location independently of player location',()=>{
  const {game,advance}=make(),tile=plain();moveFixture(game,tile.x,tile.y);assert(game.plant('wheat').ok);game.state.buildings[(tile.x+1)+','+tile.y]={type:'well',level:2};moveFixture(game,Data.spawn.x,Data.spawn.y);advance(Data.crops.wheat.growMs*.6);assert(game.cropStatus(tile.x,tile.y).ready);
});
test('construction validates land, occupied tiles, costs and upgrade caps',()=>{
  const {game}=make();game.state.inventory={wood:70,stone:50};assert(!game.build('camp').ok);moveFixture(game,22,20);assert(game.build('camp').ok);assert.equal(game.count('wood'),64);assert(!game.build('camp').ok);assert(game.upgradeBuilding().ok);assert.equal(game.state.buildings['22,20'].level,2);assert(game.upgradeBuilding().ok);const bag=JSON.stringify(game.state.inventory);assert(!game.upgradeBuilding().ok);assert.equal(JSON.stringify(game.state.inventory),bag);assert.equal(game.state.buildings['22,20'].level,3);
});
test('warehouse capacity and house health increase with construction upgrades',()=>{
  const {game}=make(),capacity=game.capacity(),hp=game.maxHp();game.state.buildings['22,20']={type:'warehouse',level:2};game.state.buildings['23,20']={type:'house',level:3};assert.equal(game.capacity(),capacity+160);assert.equal(game.maxHp(),hp+30);game.state.player.hp=130;const imported=Engine.importSave(game.serialize(),{clock:game.clock});assert.equal(imported.state.player.hp,130);
});
test('NPCs and quests require proximity, prerequisites and single reward delivery',()=>{
  const {game}=make();assert(!game.acceptQuest('first_wood').ok);moveFixture(game,23,19);assert(game.acceptQuest('first_wood').ok);assert(!game.acceptQuest('first_stone').ok);assert(!game.claimQuest('first_wood').ok);game.state.metrics.gather.wood=12;assert(game.claimQuest('first_wood').ok);assert(game.state.completed.first_wood);const xp=game.state.player.xp,bag=JSON.stringify(game.state.inventory);assert(!game.claimQuest('first_wood').ok);assert.equal(game.state.player.xp,xp);assert.equal(JSON.stringify(game.state.inventory),bag);assert(game.acceptQuest('first_stone').ok);
});
test('quest rewards are atomic when bag cannot accept them',()=>{
  const {game}=make();moveFixture(game,23,19);assert(game.acceptQuest('first_wood').ok);game.state.metrics.gather.wood=12;game.state.inventory={wood:game.capacity()};const xp=game.state.player.xp,bag=JSON.stringify(game.state.inventory);assert(!game.claimQuest('first_wood').ok);assert(!game.state.completed.first_wood);assert.equal(game.state.player.xp,xp);assert.equal(JSON.stringify(game.state.inventory),bag);
});
test('combat validates habitat, locks noncombat actions, enforces cooldown and dodge/guard behavior',()=>{
  const {game,advance}=make();assert(!game.startEncounter('forest_wolf').ok);const tile=findTile(t=>t.biome==='forest');moveFixture(game,tile.x,tile.y);assert(game.startEncounter('forest_wolf').ok);assert(game.state.discovered.forest_wolf);assert(!game.move(1,0).ok);assert(!game.craft('torch').ok);const hp=game.state.player.hp;assert(game.battle('dodge').ok);assert.equal(game.state.player.hp,hp);assert(!game.battle('attack').ok);advance(650);const stamina=game.state.player.stamina;assert(game.battle('guard').ok);assert(game.state.player.stamina>stamina);assert(game.state.player.hp<hp);
});
test('victory gives loot and XP once; fleeing restores a safe playable state',()=>{
  const {game,advance}=make(),tile=findTile(t=>t.biome==='forest');moveFixture(game,tile.x,tile.y);assert(game.startEncounter('forest_wolf').ok);let victory=false;while(game.state.combat){const result=game.battle('attack');victory=!!result.victory;advance(700);}assert(victory);assert.equal(game.state.metrics.kill.forest_wolf,1);assert.equal(game.count('food'),7);const xp=game.state.player.xp;assert(!game.battle('attack').ok);assert.equal(game.state.player.xp,xp);assert(game.startEncounter('forest_wolf').ok);assert(game.battle('flee').ok);assert.equal(game.state.player.x,Data.spawn.x);assert.equal(game.state.player.y,Data.spawn.y);assert(!game.state.combat);
});
test('defeat preserves inventory, exits combat and returns to city',()=>{
  const {game}=make(),tile=findTile(t=>t.biome==='ruins');moveFixture(game,tile.x,tile.y);game.state.player.hp=1;assert(game.startEncounter('steel_chimera').ok);const bag=JSON.stringify(game.state.inventory);const result=game.battle('guard');assert(result.defeat);assert.equal(JSON.stringify(game.state.inventory),bag);assert.equal(game.state.defeats,1);assert(game.state.player.hp>0);assert.equal(game.tile().biome,'city');assert(!game.state.combat);
});
test('save persistence restores player, inventory, farm, building and encounter state',()=>{
  const {game,now}=make(),storage=memory(),tile=findTile(t=>t.biome==='forest');moveFixture(game,tile.x,tile.y);game.state.buildings['22,20']={type:'workbench',level:2};assert(game.startEncounter('forest_wolf').ok);assert(game.save(storage).ok);const restored=Engine.restore(storage,{clock:now});assert.equal(restored.source,Engine.SAVE_KEY);assert.deepEqual(restored.game.state.player,game.state.player);assert.deepEqual(restored.game.state.inventory,game.state.inventory);assert.deepEqual(restored.game.state.buildings,game.state.buildings);assert.deepEqual(restored.game.state.combat,game.state.combat);
});
test('corrupt primary restores backup and retains raw broken data',()=>{
  const {game,now}=make(),storage=memory();assert(game.save(storage).ok);game.state.inventory.wood=42;assert(game.save(storage).ok);storage.setItem(Engine.SAVE_KEY,'broken {');const restored=Engine.restore(storage,{clock:now});assert.equal(restored.source,Engine.BACKUP_KEY);assert.equal(restored.game.count('wood'),6);assert.equal(storage.getItem(Engine.CORRUPT_KEY),'broken {');assert(restored.warning);
});
test('unsupported or wholly corrupt saves recover without crashing and preserve raw data',()=>{
  const storage=memory();storage.setItem(Engine.SAVE_KEY,JSON.stringify({version:99,player:{x:24,y:20},inventory:{wood:500}}));const restored=Engine.restore(storage,{clock:()=>1000000});assert.equal(restored.source,'new');assert.equal(restored.game.count('wood'),6);assert(storage.getItem(Engine.CORRUPT_KEY).includes('99'));assert(restored.warning);
});
test('version one saves migrate and invalid quantities/coordinates/equipment are sanitized',()=>{
  const {game,now}=make(),state=JSON.parse(game.serialize()).state;state.version=1;state.player.x=-100;state.player.y=99999;state.inventory.wood=-6;state.inventory.iron_ore=Infinity;state.inventory.unknown=50;state.equipment.weapon='unknown';const migrated=Engine.createGame({state,clock:now});assert.equal(migrated.state.version,3);assert.equal(migrated.state.player.x,24);assert.equal(migrated.state.player.y,20);assert.equal(migrated.count('wood'),0);assert.equal(migrated.count('iron_ore'),0);assert(!migrated.state.inventory.unknown);assert.equal(migrated.state.equipment.weapon,null);
});
test('storage failures return actionable errors without destroying game state',()=>{
  const {game}=make(),bad={getItem(){throw new Error('disabled');},setItem(){throw new Error('full');}},bag=JSON.stringify(game.state.inventory);assert(!game.save(bad).ok);assert.equal(JSON.stringify(game.state.inventory),bag);const recovered=Engine.restore(bad);assert.equal(recovered.source,'new');assert(recovered.warning);
});
test('oversized recovered inventories can consume and spend resources but cannot grow',()=>{
  const {game}=make();game.state.inventory={wood:500,food:5};game.state.player.hp=50;
  assert(game.useItem('food').ok);assert.equal(game.count('food'),4);assert.equal(game.state.player.hp,62);
  const bag=JSON.stringify(game.state.inventory);assert(!game.transaction({},{stone:1}).ok);assert.equal(JSON.stringify(game.state.inventory),bag);
  assert(game.transaction({wood:3},{}).ok);assert.equal(game.count('wood'),497);
});
test('new player can gather, deliver a quest, build, craft and reload through real actions without fixtures',()=>{
  const {game,now}=make(),storage=memory();
  const walk=(dx,dy,count)=>{for(let n=0;n<count;n++){const result=game.move(dx,dy);assert(result.ok,result.message);}};
  walk(0,-1,1);assert(game.acceptQuest('first_wood').ok);walk(0,-1,2);walk(-1,0,5);
  assert(game.gather().ok);assert(game.gather().ok);walk(1,0,1);assert(game.gather().ok);assert(game.gather().ok);
  walk(-1,0,1);walk(0,1,6);assert(game.gather().ok);assert(game.gather().ok);assert.equal(game.state.metrics.gather.wood,12);
  walk(1,0,4);walk(0,-1,4);assert(game.claimQuest('first_wood').ok);walk(-1,0,1);walk(0,1,1);
  assert(game.build('workbench').ok);assert(game.craft('plank').ok);assert.equal(game.count('plank'),3);assert.equal(game.count('wood'),6);assert(game.save(storage).ok);
  const restored=Engine.restore(storage,{clock:now}).game;assert(restored.state.completed.first_wood);assert.equal(restored.state.buildings['22,20'].type,'workbench');assert.equal(restored.count('plank'),3);assert.equal(restored.count('wood'),6);
});
test('prototype-named IDs from saves are dropped and never crash farming or building actions',()=>{
  for(const id of ['constructor','__proto__','toString','valueOf','hasOwnProperty',null,{},['camp']]) {
    const {game,now}=make(),save=JSON.parse(game.serialize());
    save.state.inventory=JSON.parse('{"wood":6,"constructor":99,"__proto__":{"polluted":true}}');
    save.state.equipment={weapon:id,armor:id};save.state.buildings={'24,20':{type:id,level:1},'22,20':['house']};save.state.crops={'25,28':{type:id,plantedAt:now()},'26,28':['wheat']};
    const loaded=Engine.importSave(JSON.stringify(save),{clock:now});assert.deepEqual(loaded.state.buildings,{});assert.deepEqual(loaded.state.crops,{});assert.equal(loaded.state.equipment.weapon,null);assert.equal(loaded.count('constructor'),0);assert.equal(loaded.count('__proto__'),0);assert.equal(loaded.count('wood'),6);assert(!loaded.upgradeBuilding().ok);assert.equal(loaded.cropStatus(25,28),null);
    assert(!loaded.build(id).ok);assert(!loaded.plant(id).ok);assert(!loaded.equip(id).ok);assert.equal(loaded.shopStatus(id),null);assert.equal(loaded.friendship(id),null);assert.doesNotThrow(()=>loaded.tick());assert.equal({}.polluted,undefined);
  }
});
test('transaction costs and outputs reject inherited IDs, malformed records and invalid quantities atomically',()=>{
  const {game}=make();for(const bad of [JSON.parse('{"constructor":1}'),JSON.parse('{"__proto__":0}'),{wood:-1},{wood:1.5},{wood:Infinity},{wood:10000},['wood'],'wood']) {
    const bag=JSON.stringify(game.state.inventory);assert(!game.has(bad));assert(!game.transaction(bad,{}).ok);assert.equal(JSON.stringify(game.state.inventory),bag);assert(!game.transaction({},bad).ok);assert.equal(JSON.stringify(game.state.inventory),bag);
  }
});
test('invalid drop IDs cannot enter the bag or crash a victory',()=>{
  const {game}=make(),tile=findTile(t=>t.biome==='forest'),enemy=Data.creatures.find(c=>c.id==='forest_wolf'),original=enemy.drops;moveFixture(game,tile.x,tile.y);assert(game.startEncounter(enemy.id).ok);game.state.combat.hp=1;const bag=JSON.stringify(game.state.inventory);
  try{enemy.drops=JSON.parse('{"constructor":1,"__proto__":1}');const result=game.battle('attack');assert(result.victory);assert.deepEqual(result.drops,{});assert.equal(JSON.stringify(game.state.inventory),bag);}finally{enemy.drops=original;}
});
test('watering accelerates growth once per day and validates range, tool and crop state',()=>{
  const {game}=make(),tile=plain();moveFixture(game,tile.x,tile.y);assert(game.plant('carrot').ok);const initial=game.cropStatus(tile.x,tile.y).remaining,stamina=game.state.player.stamina;
  assert(!game.water(tile.x+3,tile.y).ok);delete game.state.inventory.watering_can;assert(!game.water().ok);game.state.inventory.watering_can=1;assert(game.water().ok);const status=game.cropStatus(tile.x,tile.y);assert(status.wateredToday);assert(status.remaining<initial);assert.equal(game.state.player.stamina,stamina-3);const second=JSON.stringify(game.state.crops);assert(!game.water().ok);assert.equal(JSON.stringify(game.state.crops),second);
});
test('calendar cycles seasons, deterministic weather and natural time',()=>{
  const {game,advance}=make();assert.equal(game.calendar().day,1);assert.equal(game.calendar().season.id,'spring');assert.equal(game.calendar().weather.id,'sun');assert.equal(game.calendar().hour,8);advance(Data.dayDurationMs);assert.equal(game.calendar().day,2);assert(game.calendar().weather.rain);advance(Data.dayDurationMs*6);assert.equal(game.calendar().day,8);assert.equal(game.calendar().season.id,'summer');advance(Data.dayDurationMs*7*3);assert.equal(game.calendar().season.id,'spring');
});
test('weather and preferred seasons affect newly planted crops without disabling winter farming',()=>{
  const spring=make(),rain=make(),winter=make(),tile=plain();moveFixture(spring.game,tile.x,tile.y);assert(spring.game.plant('wheat').ok);const normal=spring.game.cropStatus(tile.x,tile.y).remaining;
  rain.advance(Data.dayDurationMs);moveFixture(rain.game,tile.x,tile.y);assert(rain.game.plant('wheat').ok);assert(rain.game.cropStatus(tile.x,tile.y).remaining<normal);assert(rain.game.cropStatus(tile.x,tile.y).wateredToday);assert(!rain.game.water().ok);
  winter.advance(Data.dayDurationMs*21);moveFixture(winter.game,tile.x,tile.y);assert.equal(winter.game.calendar().season.id,'winter');assert(winter.game.plant('wheat').ok);assert(winter.game.cropStatus(tile.x,tile.y).remaining>normal);
});
test('rest requires shelter, advances to next morning, restores stats and grows planted crops',()=>{
  const {game}=make(),tile=plain();assert(!game.rest().ok);assert(game.move(0,1).ok);assert(game.build('camp').ok);const camp={x:game.state.player.x,y:game.state.player.y};moveFixture(game,tile.x,tile.y);assert(game.plant('wheat').ok);moveFixture(game,camp.x,camp.y);game.state.player.hp=20;game.state.player.stamina=0;assert(game.rest().ok);assert.equal(game.calendar().day,2);assert.equal(game.calendar().hour,8);assert.equal(game.state.player.hp,game.maxHp());assert.equal(game.state.player.stamina,100);assert(game.cropStatus(tile.x,tile.y).ready);
});
test('shops enforce distance, prices, currency and valid quantities; buying and selling are atomic',()=>{
  const {game}=make(),npc=Data.npcs.find(n=>n.id==='farmer');assert(!game.buy('farmer','wheat_seed',1).ok);moveFixture(game,npc.x,npc.y-1);const initial=game.count('wheat_seed');assert(game.buy('farmer','wheat_seed',2).ok);assert.equal(game.count('coin'),34);assert.equal(game.count('wheat_seed'),initial+2);assert(game.sell('farmer','wheat_seed',2).ok);assert.equal(game.count('coin'),36);assert.equal(game.count('wheat_seed'),initial);
  for(const quantity of [0,-1,100,1.5,'2',Infinity]){const bag=JSON.stringify(game.state.inventory);assert(!game.buy('farmer','wheat_seed',quantity).ok);assert(!game.sell('farmer','wheat_seed',quantity).ok);assert.equal(JSON.stringify(game.state.inventory),bag);}
  for(const id of ['constructor','__proto__','unknown']){assert(!game.buy(id,'wheat_seed',1).ok);assert(!game.buy('farmer',id,1).ok);assert(!game.sell('farmer',id,1).ok);}
  let bag=JSON.stringify(game.state.inventory);assert(!game.buy('farmer','wheat',1).ok);assert(!game.buy('farmer','pumpkin_seed',99).ok);assert.equal(JSON.stringify(game.state.inventory),bag);game.state.inventory={coin:40,wheat_seed:game.capacity()};bag=JSON.stringify(game.state.inventory);assert(!game.buy('farmer','wheat_seed',1).ok);assert.equal(JSON.stringify(game.state.inventory),bag);
});
test('NPC conversations and gifts grant friendship once per day, consume one item and survive saves',()=>{
  const {game,now}=make();assert(!game.talkNpc('guide').ok);moveFixture(game,23,19);assert(game.talkNpc('guide').ok);assert.equal(game.friendship('guide').points,3);assert(game.talkNpc('guide').ok);assert.equal(game.friendship('guide').points,3);const food=game.count('food');assert(game.giftNpc('guide','food').ok);assert.equal(game.count('food'),food-1);assert.equal(game.friendship('guide').points,15);assert(!game.giftNpc('guide','food').ok);assert.equal(game.count('food'),food-1);assert(!game.giftNpc('guide','coin').ok);
  const loaded=Engine.importSave(game.serialize(),{clock:now});assert(loaded.friendship('guide').talkedToday);assert(loaded.friendship('guide').giftedToday);assert.equal(loaded.friendship('guide').points,15);loaded.state.buildings['23,19']={type:'camp',level:1};assert(loaded.rest().ok);assert(loaded.talkNpc('guide').ok);assert.equal(loaded.friendship('guide').points,18);assert(loaded.giftNpc('guide','food').ok);assert.equal(loaded.friendship('guide').points,30);assert.equal(loaded.friendship('guide').level,1);
});
test('version two saves migrate without resetting nodes, crops, inventory, progress or equipment',()=>{
  const {game,now}=make(),tile=plain(),node=findTile(t=>t.resource&&t.resource.item==='wood');moveFixture(game,tile.x,tile.y);const state=JSON.parse(game.serialize()).state;state.version=2;delete state.world;delete state.friendships;delete state.inventory.watering_can;delete state.inventory.coin;state.crops[tile.x+','+tile.y]={type:'wheat',plantedAt:now()-30000};state.nodes[node.x+','+node.y]={remaining:0,respawnAt:now()+50000};state.completed.first_wood=true;state.accepted.first_wood=true;state.metrics.gather.wood=12;
  const restored=Engine.createGame({state,clock:now});assert.equal(restored.state.version,3);assert.equal(restored.count('watering_can'),1);assert.equal(restored.count('coin'),0);assert.equal(restored.state.player.x,tile.x);assert.equal(restored.state.equipment.weapon,'sword');assert.equal(restored.state.crops[tile.x+','+tile.y].plantedAt,now()-30000);assert.equal(restored.cropStatus(tile.x,tile.y).remaining,60000);assert.equal(restored.resourceAt(node.x,node.y).remaining,0);assert(restored.state.completed.first_wood);assert.equal(restored.state.metrics.gather.wood,12);
});
test('farming calendar, watered crops, commerce and friendships survive a complete save roundtrip',()=>{
  const {game,now}=make(),tile=plain(),storage=memory();moveFixture(game,tile.x,tile.y);assert(game.plant('pumpkin').ok);assert(game.water().ok);game.state.buildings['24,21']={type:'camp',level:1};moveFixture(game,24,21);assert(game.rest().ok);moveFixture(game,25,23);assert(game.talkNpc('farmer').ok);assert(game.buy('farmer','herb_seed',2).ok);const snapshot={world:game.state.world,friendships:game.state.friendships,crops:game.state.crops,inventory:game.state.inventory};assert(game.save(storage).ok);const restored=Engine.restore(storage,{clock:now}).game;for(const field of Object.keys(snapshot))assert.deepEqual(restored.state[field],snapshot[field]);assert.equal(restored.calendar().day,2);assert(restored.cropStatus(tile.x,tile.y).ready);
});
test('forest and farm plains remain peaceful unless the player chooses to seek a creature',()=>{
  for(const position of [{x:5,y:5},{x:32,y:20}]) {const {game}=make();moveFixture(game,position.x,position.y);for(let n=0;n<20;n++){assert(game.move(n%2? -1:1,0).ok);assert(!game.state.combat);}const inhabitant=Data.creatures.find(c=>c.habitat.includes(game.tile().biome));assert(game.startEncounter(inhabitant.id).ok);assert(game.state.combat);}
});
