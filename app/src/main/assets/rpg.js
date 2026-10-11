(function () {
  'use strict';
  const Data = window.NerakarData, Engine = window.NerakarEngine;
  let game, section, bestiary, canvas, ctx, storage, initialized = false, active = false, timer = null, repeat = null, pendingSave = null, lastSave = 0, storageWarning = false, panel = 'explore', selectedNpc = null, atlasSignature = null, displayedDay = null;
  const tradeQuantities = {};
  const images = {}, q = selector => section.querySelector(selector), format = (cost) => Object.keys(cost || {}).map(id => (Data.items[id] || {}).name + ' ×' + cost[id]).join(' · ');
  const el = (tag, className, text) => {const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;};
  const button = (text, handler, disabled) => {const b = el('button','rpg-button',text); b.type = 'button'; b.disabled = !!disabled; b.addEventListener('click',handler); return b;};
  const api = () => window.SinapseApp || {};
  const tell = message => {if (api().toast) api().toast(message); else if (section) q('#rpg-feedback').textContent = message;};
  const positionKey = () => game.state.player.x + ',' + game.state.player.y;
  const distance = point => Math.abs(point.x-game.state.player.x)+Math.abs(point.y-game.state.player.y);
  const itemName = id => (Data.items[id] || {}).name || id;
  const timeRemaining = ms => ms < 60000 ? Math.max(1,Math.ceil(ms/1000)) + ' s' : Math.ceil(ms/60000) + ' min';
  const shelterAvailable = () => !game.state.combat && (game.nearBuilding('camp',2) || game.nearBuilding('house',2));
  const calendar = () => typeof game.calendar === 'function' ? game.calendar() : null;
  const nearbyCrops = () => typeof game.nearbyCrops === 'function' ? game.nearbyCrops() : Object.keys(game.state.crops).map(k => {const [x,y] = k.split(',').map(Number);return Object.assign({x,y},game.cropStatus(x,y));}).filter(c => distance(c) <= 1);
  const waterTarget = () => nearbyCrops().sort((a,b) => distance(a)-distance(b)).find(c => !c.ready && !c.wateredToday);
  function water(x,y) {
    if (typeof game.water !== 'function') return tell('O cultivo está sendo preparado.');
    const target = x === undefined ? waterTarget() : {x,y};
    if (!target) return tell('Aproxime-se de um canteiro em crescimento que ainda precisa de água.');
    action(() => game.water(target.x,target.y));
  }
  function cropCard(crop,x,y,compact) {
    const row = el('article',compact ? 'rpg-context-crop' : 'rpg-plot'), heading = el('div','rpg-crop-heading');
    const definition = Data.crops[crop.type] || {}, item = Data.items[definition.item] || {};
    heading.append(el('strong','',(item.icon || '🌱') + ' ' + crop.name),el('span','rpg-hint','Canteiro ' + x + ', ' + y)); row.append(heading);
    const progress = el('progress'); progress.max = 1; progress.value = crop.progress; progress.setAttribute('aria-label','Crescimento de ' + crop.name + ' em ' + x + ',' + y);
    row.append(progress,el('p','rpg-plot-status',crop.ready ? 'Colheita pronta · ' + (definition.yield || 1) + ' unidades' : Math.round(crop.progress*100) + '% · ' + timeRemaining(crop.remaining) + ' para colher'));
    const day = calendar(), rain = !!(day && day.weather.rain), watered = !!crop.wateredToday;
    row.append(el('p','rpg-hint',crop.ready ? 'Volte ao canteiro para guardar sua colheita.' : (rain ? 'A chuva cuida deste canteiro hoje.' : watered ? 'Regado hoje · raízes bem cuidadas.' : 'Ainda precisa de água hoje · regar acelera o crescimento.')));
    const actions = el('div','rpg-plot-actions');
    actions.append(button(watered || rain ? 'Regado hoje' : 'Regar · 3 vigor',() => water(x,y),!game.water || crop.ready || watered || rain || distance({x,y}) > 1 || !game.count('watering_can') || game.state.player.stamina < 3 || !!game.state.combat));
    actions.append(button('Colher',() => action(() => game.harvest()),!crop.ready || distance({x,y}) !== 0 || game.state.player.stamina < 3 || !!game.state.combat));
    row.append(actions); return row;
  }

  function persist() {
    if (!game || window.SinapseRestoring) return; const result = game.save(storage); lastSave = Date.now();
    if (!result.ok) {q('#rpg-save-status').textContent = result.message; if (!storageWarning) {tell(result.message); storageWarning = true;}}
    else q('#rpg-save-status').textContent = 'Salvo às ' + new Date(lastSave).toLocaleTimeString('pt-BR');
  }
  function scheduleSave() {clearTimeout(pendingSave); pendingSave = setTimeout(persist,250);}
  function action(run, effects) {
    const result = run(); tell(result.message);
    if (result.ok) {
      scheduleSave();
      if (result.victory && api().reward) api().reward(8,'Vitória em Nerakar');
      if (effects) {canvas.classList.remove('rpg-hit','rpg-dodge'); void canvas.offsetWidth; canvas.classList.add(effects);}
    }
    render(); return result;
  }
  function stopRepeat() {clearInterval(repeat); repeat = null;}
  function pause() {active = false; clearInterval(timer); timer = null; stopRepeat(); clearTimeout(pendingSave); persist();}
  function start() {
    if (document.hidden || !section || section.classList.contains('hidden')) return;
    active = true; game.tick(); render(); clearInterval(timer);
    timer = setInterval(() => {if (!active || document.hidden) return; game.tick(); renderStatus(); draw(); renderContext(); const day=calendar(); if(day && day.day !== displayedDay){displayedDay=day.day;renderPanels();} else if(panel === 'build')renderCropPlots(); if (Date.now()-lastSave >= 15000) persist();},1000);
  }
  function control(direction) {
    const offsets = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}, pair = offsets[direction];
    if (pair) action(() => game.move(pair[0],pair[1]));
  }
  function collect() {
    const node = game.nearbyResources().find(r => r.remaining > 0);
    if (!node) return tell('Aproxime-se de uma árvore, rocha, minério ou fibra.');
    action(() => game.gather(node.x,node.y));
  }
  function talk(id) {
    const npc = Data.npcs.find(n => (!id || n.id === id) && distance(n) <= 2);
    if (!npc) return tell('Aproxime-se do morador com quem deseja conversar.');
    selectedNpc = npc.id;
    const result = action(() => typeof game.talkNpc === 'function' ? game.talkNpc(npc.id) : game.interactNpc(npc.id));
    if (!result.ok) return;
    showPanel('people');
    q('#rpg-dialogue').replaceChildren(el('strong','',npc.name + ' — ' + npc.role),el('p','',result.message));
  }
  function showPanel(id) {
    panel = id; section.querySelectorAll('[data-rpg-panel]').forEach(b => {b.setAttribute('aria-selected',String(b.dataset.rpgPanel === id));});
    section.querySelectorAll('.rpg-tabpanel').forEach(node => {node.hidden = node.dataset.panel !== id;});
    renderPanels();
  }
  function renderStatus() {
    const p = game.state.player, tile = game.tile();
    q('#rpg-location').textContent = Data.biomes[tile.biome].name + ' · ' + p.x + ', ' + p.y + (tile.landmark ? ' · ' + tile.landmark : '');
    q('#rpg-hp').max = game.maxHp(); q('#rpg-hp').value = p.hp; q('#rpg-hp-text').textContent = 'Vida ' + p.hp + '/' + game.maxHp();
    q('#rpg-stamina').value = p.stamina; q('#rpg-stamina-text').textContent = 'Vigor ' + p.stamina + '/100';
    q('#rpg-level').textContent = 'Nível ' + p.level + ' · ' + p.xp + ' XP · Bolsa ' + game.loadCount() + '/' + game.capacity();
    q('#rpg-coins').textContent = game.count('coin') + ' moedas';
    const day = calendar();
    q('#rpg-day').textContent = day ? 'Dia ' + day.day : 'Seu primeiro dia';
    q('#rpg-season').textContent = day ? day.season.name : 'Nerakar';
    q('#rpg-weather').textContent = day ? day.weather.name : 'Observe o céu';
    q('#rpg-clock').textContent = day ? String(day.hour).padStart(2,'0') + ':' + String(day.minute).padStart(2,'0') : '08:00';
    q('#rpg-water').disabled = !game.water || !!game.state.combat || !game.count('watering_can') || p.stamina < 3 || !waterTarget();
    q('#rpg-rest').disabled = !game.rest || !shelterAvailable();
    q('#rpg-rest').title = shelterAvailable() ? 'Recupera vida e vigor e começa o próximo dia às 08:00.' : 'Aproxime-se de uma casa ou acampamento, a até 2 terrenos.';
    q('#rpg-talk').disabled = !!game.state.combat || !Data.npcs.some(n => distance(n) <= 2);
    q('#rpg-quick-heal').disabled = !game.count('food');
    q('#rpg-map-description').textContent = 'Posição ' + p.x + ',' + p.y + ', ' + Data.biomes[tile.biome].name + '. Recursos próximos: ' + game.nearbyResources().map(r => r.label + ' (' + r.remaining + ')').join(',');
  }
  function renderContext() {
    const target = q('#rpg-context'), combat = game.state.combat; target.replaceChildren();
    if (combat) {
      const enemy = Data.creatures.find(c => c.id === combat.id), wrap = el('div','rpg-combat'), portrait = el('img'); portrait.src = enemy.image; portrait.alt = enemy.name; portrait.width = 80; portrait.height = 80;
      const details = el('div'); details.append(el('strong','',enemy.name),el('p','', 'Vida ' + combat.hp + '/' + enemy.hp + ' · ataque ' + enemy.attack));
      const health = el('progress'); health.max = enemy.hp; health.value = combat.hp; health.setAttribute('aria-label','Vida de ' + enemy.name); details.append(health); wrap.append(portrait,details); target.append(wrap);
      const actions = el('div','rpg-actions');
      for (const [id,name] of [['attack','⚔ Atacar'],['dodge','↝ Esquivar'],['guard','▣ Proteger'],['flee','↩ Recuar']]) actions.append(button(name,() => action(() => game.battle(id),id === 'dodge' ? 'rpg-dodge' : 'rpg-hit')));
      target.append(actions,el('p','rpg-hint','Atacar causa dano e recebe contra-ataque. Esquivar evita dano e gasta vigor. Proteger recupera vigor. Recuar retorna à cidade.'));
      return;
    }
    const resources = game.nearbyResources();
    resources.forEach(node => target.append(button(node.label + ' · ' + node.remaining + ' restante(s)',() => action(() => game.gather(node.x,node.y)),!node.remaining)));
    const construction = game.state.buildings[positionKey()], crops = nearbyCrops();
    crops.forEach(crop => target.append(cropCard(crop,crop.x,crop.y,true)));
    if (construction) target.append(el('p','',Data.buildings[construction.type].name + ' · nível ' + construction.level),button('Melhorar construção',() => action(() => game.upgradeBuilding()),construction.level >= Data.buildings[construction.type].maxLevel));
    Data.npcs.filter(n => distance(n) <= 2).forEach(n => target.append(button('Conversar: ' + n.name,()=>talk(n.id))));
    if (!resources.some(r => r.remaining) && !crops.length && !construction) target.append(el('p','rpg-hint','Um novo lar começa com pequenos cuidados. Colete recursos, encontre a planície ao sul e prepare seu primeiro canteiro.'));
  }
  function renderInventory() {
    const target = q('#rpg-inventory'); target.replaceChildren();
    Object.keys(game.state.inventory).filter(id => Data.items[id] && game.count(id) > 0).sort((a,b) => itemName(a).localeCompare(itemName(b),'pt-BR')).forEach(id => {
      const item = Data.items[id], row = el('div','rpg-item'); row.append(el('span','',(item.icon || '◆') + ' ' + item.name + ' × ' + game.count(id)));
      if (['weapon','armor'].includes(item.kind)) row.append(button(game.state.equipment[item.kind] === id ? 'Equipado' : 'Equipar',() => action(() => game.equip(id)),game.state.equipment[item.kind] === id));
      if (item.kind === 'food') row.append(button('Usar',() => action(() => game.useItem(id)))); target.append(row);
    });
    const weapon = Data.items[game.state.equipment.weapon], armor = Data.items[game.state.equipment.armor];
    q('#rpg-equipment').textContent = 'Arma: ' + (weapon ? weapon.name : 'mãos livres') + ' · Armadura: ' + (armor ? armor.name : 'nenhuma');
  }
  function renderCraft() {
    const target = q('#rpg-recipes'); target.replaceChildren();
    Data.recipes.forEach(recipe => {
      const row = el('article','rpg-option'); row.append(el('strong','',recipe.name),el('p','',format(recipe.cost)));
      if (recipe.station) row.append(el('span','rpg-hint','Requer ' + Data.buildings[recipe.station].name + ' a até 3 terrenos.'));
      row.append(button('Fabricar',() => action(() => game.craft(recipe.id)),!game.has(recipe.cost) || !!game.state.combat || (recipe.station && !game.nearBuilding(recipe.station)))); target.append(row);
    });
  }
  function renderBuildings() {
    const target = q('#rpg-buildings'); target.replaceChildren();
    Object.keys(Data.buildings).forEach(id => {
      const b = Data.buildings[id], row = el('article','rpg-option'); row.append(el('strong','',b.name),el('p','',format(b.cost)),el('p','rpg-hint',b.description || 'Construção aprimorável até o nível ' + b.maxLevel + '.'));
      row.append(button('Construir aqui',() => action(() => game.build(id)),!game.has(b.cost) || !!game.state.combat)); target.append(row);
    });
    renderFarming();
  }
  function renderFarming() {
    const farms = q('#rpg-farming'); farms.replaceChildren();
    const p = game.state.player, tile = game.tile(), node = game.resourceAt(p.x,p.y), free = ['plains','forest'].includes(tile.biome) && tile.walkable && !game.state.crops[positionKey()] && !game.state.buildings[positionKey()] && !(node && node.remaining);
    Object.keys(Data.crops).forEach(id => {
      const crop = Data.crops[id], row = el('article','rpg-option'), cropItem = Data.items[crop.item] || {};
      row.append(el('strong','',(cropItem.icon || '🌱') + ' ' + crop.name),el('p','', '1 ' + itemName(crop.seed) + ' · ' + timeRemaining(crop.growMs) + ' de crescimento base'));
      row.append(el('p','rpg-hint','Colheita: ' + crop.yield + ' ' + itemName(crop.item) + '. Sementes na bolsa: ' + game.count(crop.seed) + '.'));
      const shop = (Data.shops || {}).farmer, price = shop && shop.stock[crop.item];
      if (price && price.sell) row.append(el('p','rpg-hint','Venda: ' + price.sell + ' moedas por unidade · ' + price.sell*crop.yield + ' moedas por colheita.'));
      row.append(button('Plantar aqui',() => action(() => game.plant(id)),!free || !game.count(crop.seed) || !game.count('hoe') || p.stamina < 5 || !!game.state.combat)); farms.append(row);
    });
    q('#rpg-farming-help').textContent = game.state.combat ? 'Resolva o encontro para voltar aos seus cuidados.' : !game.count('hoe') ? 'Você precisa de uma enxada. Fabrique na bancada ou compre na loja da artesã.' : !free ? 'Plante em um terreno livre da planície ou floresta. Colete o recurso do terreno antes e evite construções e canteiros ocupados.' : 'Terreno livre para plantar. Regue o canteiro uma vez por dia para acelerar sua colheita.';
    renderCropPlots();
  }
  function renderCropPlots() {
    const plots = q('#rpg-plots'); plots.replaceChildren();
    Object.keys(game.state.crops).map(k => {const [x,y] = k.split(',').map(Number);return {x,y,crop:game.cropStatus(x,y)};}).filter(plot => plot.crop).sort((a,b) => distance(a)-distance(b)).forEach(plot => plots.append(cropCard(plot.crop,plot.x,plot.y,false)));
    if (!plots.childElementCount) plots.append(el('p','rpg-hint','Seus canteiros aparecerão aqui. As plantações continuam crescendo com o aplicativo fechado.'));
  }
  function renderPeople() {
    const people = q('#rpg-people'); people.replaceChildren();
    Data.npcs.forEach((npc,index) => {
      const nearby = distance(npc) <= 2, friendship = typeof game.friendship === 'function' ? game.friendship(npc.id) : {points:0,level:0}, card = el('article','rpg-person'), head = el('div','rpg-person-head');
      if (npc.id === selectedNpc) card.classList.add('rpg-person-selected');
      const avatar = el('div','rpg-person-avatar'); avatar.setAttribute('aria-hidden','true');
      avatar.innerHTML = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="18" fill="' + ['#dce8c6','#e9d2ba','#d2e4c2','#d9d8eb'][index%4] + '"/><path d="M10 64V49c0-12 44-12 44 0v15" fill="' + ['#778159','#987659','#8b995f','#8581a1'][index%4] + '"/><path d="M22 29h20v17H22z" fill="#d9aa81"/><circle cx="32" cy="24" r="14" fill="#efc49c"/><path d="M17 25V16C18 3 46 5 47 19l-2 8-6-12-16 5-3 10z" fill="' + ['#6b583f','#695044','#a7774c','#4d4c5c'][index%4] + '"/><circle cx="27" cy="25" r="1.4" fill="#493c32"/><circle cx="37" cy="25" r="1.4" fill="#493c32"/><path d="M28 33q4 3 8 0" fill="none" stroke="#9d7053" stroke-width="1.5"/></svg>';
      const title = el('div');title.append(el('strong','',npc.name),el('p','rpg-hint',npc.role));head.append(avatar,title);card.append(head);
      card.append(el('p','rpg-hint',npc.x + ', ' + npc.y + ' · ' + distance(npc) + ' terrenos de distância' + (nearby ? ' · por perto' : '')));
      const hearts = el('div','rpg-friendship'), meter = el('progress');meter.max = 250;meter.value = Math.min(250,friendship.points || 0);meter.setAttribute('aria-label','Amizade com ' + npc.name);
      hearts.append(el('span','', 'Amizade nível ' + friendship.level + '/10 · ' + friendship.points + ' pontos'),meter);card.append(hearts);
      card.append(button(friendship.talkedToday ? 'Conversar novamente' : 'Conversar',()=>talk(npc.id),!nearby || !!game.state.combat));
      const form = el('div','rpg-gift-form'), label = el('label','rpg-hint','Escolha um presente'), select = el('select');select.setAttribute('aria-label','Presente para ' + npc.name);
      const items = Object.keys(game.state.inventory).filter(id => Data.items[id] && ['food','material','seed'].includes(Data.items[id].kind) && game.count(id) > 0);
      if (!items.length) {const option=el('option','','Sem produtos para presentear');option.value='';select.append(option);}
      items.sort((a,b) => itemName(a).localeCompare(itemName(b),'pt-BR')).forEach(id => {const option=el('option','',itemName(id) + ' × ' + game.count(id));option.value=id;select.append(option);});
      select.disabled = !nearby || !!game.state.combat || !!friendship.giftedToday || !items.length || !game.giftNpc;label.append(select);
      const give = button(friendship.giftedToday ? 'Presente entregue hoje' : 'Dar presente',() => {selectedNpc=npc.id;action(()=>game.giftNpc(npc.id,select.value));},select.disabled);form.append(label,give);card.append(form);
      card.append(el('p','rpg-hint',friendship.giftedToday ? 'Volte em outro dia para dar mais um presente.' : 'Uma conversa e um presente por dia fortalecem seus vínculos.'));people.append(card);
    });
    renderShops();
  }
  function renderShops() {
    const target = q('#rpg-shops'); target.replaceChildren();
    const shops = Data.shops || {};
    Object.keys(shops).forEach(id => {
      const shop = shops[id], status = typeof game.shopStatus === 'function' ? game.shopStatus(id) : {available:false,stock:shop.stock}, stock = status.stock || shop.stock, npc = Data.npcs.find(n => n.id === shop.npc), card = el('article','rpg-shop'), head = el('div','rpg-shop-head');
      head.append(el('h3','',shop.name),el('span','rpg-hint',status.available ? 'Loja aberta · você está por perto' : 'Aproxime-se de ' + (npc ? npc.name + ' em ' + npc.x + ', ' + npc.y : 'um morador') + ' (até 2 terrenos).'));card.append(head);
      const columns = el('div','rpg-trade-columns');
      for (const mode of ['buy','sell']) {
        const list = el('div','rpg-shop-list');list.append(el('h4','',mode === 'buy' ? 'Comprar' : 'Vender da bolsa'));
        const ids = Object.keys(stock).filter(item => Data.items[item] && stock[item][mode] > 0 && (mode === 'buy' || game.count(item) > 0));
        ids.forEach(item => {
          const price = stock[item][mode], row = el('div','rpg-shop-item'), controls = el('div','rpg-shop-controls'), key = id + ':' + mode + ':' + item;
          row.append(el('strong','',(Data.items[item].icon || '◆') + ' ' + itemName(item)),el('p','rpg-hint',price + ' moedas por unidade · bolsa: ' + game.count(item)));
          const label = el('label','rpg-shop-quantity','Quantidade'), input = el('input');input.type='number';input.min='1';input.max='99';input.step='1';input.inputMode='numeric';input.value=String(tradeQuantities[key] || 1);input.setAttribute('aria-label','Quantidade de ' + itemName(item) + ' para ' + (mode === 'buy' ? 'comprar' : 'vender'));input.disabled=!status.available;
          label.append(input);const total=el('span','rpg-shop-total');
          const trade = button(mode === 'buy' ? 'Comprar' : 'Vender',()=>{const quantity=Number(input.value);tradeQuantities[key]=quantity;action(()=>game[mode](id,item,quantity));});
          const update = () => {const quantity=Number(input.value),valid=Number.isInteger(quantity)&&quantity>=1&&quantity<=99;tradeQuantities[key]=valid ? quantity : 0;total.textContent=valid ? (mode==='buy' ? 'Custo: ' : 'Recebe: ') + price*quantity + ' moedas' : 'Quantidade: 1 a 99';trade.disabled=!status.available || !valid || typeof game[mode] !== 'function' || (mode==='buy' ? game.count('coin') < price*quantity : game.count(item) < quantity);};
          input.addEventListener('input',update);update();controls.append(label,total,trade);row.append(controls);list.append(row);
        });
        if (!ids.length) list.append(el('p','rpg-hint',mode === 'sell' ? 'Não há produtos aceitos por esta loja na sua bolsa.' : 'Sem produtos à venda.'));columns.append(list);
      }
      card.append(columns);target.append(card);
    });
    if (!Object.keys(shops).length) target.append(el('p','rpg-hint','As lojas estarão disponíveis na próxima visita aos moradores.'));
  }
  function renderQuests() {
    const target = q('#rpg-quests'); target.replaceChildren();
    Data.quests.forEach(quest => {
      const status = game.questStatus(quest.id), npc = Data.npcs.find(n => n.id === quest.npc), row = el('article','rpg-option');
      row.append(el('strong','',quest.title + (status.completed ? ' ✓' : '')),el('p','',quest.description),el('p','rpg-hint',npc.name + ' · ' + npc.x + ',' + npc.y + ' · ' + Math.min(status.current,status.amount) + '/' + status.amount + ' · +' + quest.reward.xp + ' XP'));
      const nearby = Math.abs(npc.x-game.state.player.x)+Math.abs(npc.y-game.state.player.y) <= 2;
      if (!status.available) row.append(el('span','rpg-hint','Continue a missão anterior.'));
      else if (!status.completed) row.append(button(status.accepted ? 'Entregar missão' : 'Aceitar missão',() => action(() => status.accepted ? game.claimQuest(quest.id) : game.acceptQuest(quest.id)),!nearby || (status.accepted && !status.ready) || !!game.state.combat));
      target.append(row);
    });
    q('#rpg-story-progress').textContent = Object.keys(game.state.completed).length + '/' + Data.quests.length + ' missões concluídas · ' + Object.keys(game.state.explored).length + '/' + Object.keys(Data.biomes).length + ' biomas descobertos';
  }
  function renderExplore() {
    q('#rpg-log').replaceChildren(...game.state.log.slice().reverse().map(text => el('li','',text)));
    const targets = q('#rpg-hunts'); targets.replaceChildren();
    const biome = game.tile().biome, inhabitants = Data.creatures.filter(c => c.habitat.includes(biome));
    if (inhabitants.length) {
      targets.append(el('p','rpg-hint','A floresta e a planície permitem cultivar em paz. Encontros durante a caminhada ficam nas montanhas, pântano e ruínas. Procurar inicia um combate no bioma atual.'));
      inhabitants.forEach(c => targets.append(button('Procurar ' + c.name,() => action(() => game.startEncounter(c.id)),!!game.state.combat)));
    } else targets.append(el('p','rpg-hint','A cidade é uma área segura. As criaturas vivem nos outros biomas.'));
  }
  function renderPanels() {
    if (panel === 'explore') renderExplore(); if (panel === 'inventory') renderInventory(); if (panel === 'craft') renderCraft(); if (panel === 'build') renderBuildings(); if (panel === 'people') renderPeople(); if (panel === 'quests') renderQuests();
  }
  function render() {renderStatus(); renderContext(); renderPanels(); draw(); const day=calendar();displayedDay=day ? day.day : null;}

  function draw() {
    if (!ctx) return;
    const columns = 13, rows = 11, size = 36, p = game.state.player, left = p.x-Math.floor(columns/2), top = p.y-Math.floor(rows/2);
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.scale(2,2);
    for (let row=0;row<rows;row++) for (let col=0;col<columns;col++) {
      const x = left+col, y = top+row, px=col*size, py=row*size;
      if (x<0 || y<0 || x>=Data.width || y>=Data.height) {ctx.fillStyle='#080b13'; ctx.fillRect(px,py,size,size); continue;}
      const tile = Data.getTile(x,y), biome = Data.biomes[tile.biome], seed = (x*31+y*17)%7;
      ctx.fillStyle = biome.color; ctx.fillRect(px,py,size,size); ctx.strokeStyle = 'rgba(8,12,22,.16)'; ctx.strokeRect(px+.5,py+.5,size,size);
      ctx.fillStyle=biome.detailColor || '#ffffff22';
      for(let t=0;t<3;t++) {const tx=px+4+(seed*7+t*11)%28,ty=py+4+(seed*11+t*7)%28; if(tile.biome==='lake') ctx.fillRect(tx,ty,8,2); else ctx.fillRect(tx,ty,2,tile.biome==='forest'?5:2);}
      if (tile.biome==='lake' && tile.walkable) {ctx.fillStyle='#9a7350';ctx.fillRect(px,py+8,size,20);ctx.strokeStyle='#4c3328';for(let t=0;t<4;t++){ctx.beginPath();ctx.moveTo(px+t*9,py+8);ctx.lineTo(px+t*9,py+28);ctx.stroke();}}
      const node = game.resourceAt(x,y); if(node && node.remaining) {
        if(node.item==='wood'){ctx.fillStyle='#65402c';ctx.fillRect(px+15,py+17,6,16);ctx.fillStyle='#65a781';ctx.beginPath();ctx.moveTo(px+18,py+3);ctx.lineTo(px+5,py+24);ctx.lineTo(px+31,py+24);ctx.closePath();ctx.fill();}
        else if(['stone','copper_ore','iron_ore','crystal'].includes(node.item)){ctx.fillStyle=node.item==='crystal'?'#ce9bff':node.item==='copper_ore'?'#cc915d':node.item==='iron_ore'?'#d1d8e2':'#8b97a6';ctx.beginPath();ctx.moveTo(px+6,py+28);ctx.lineTo(px+8,py+15);ctx.lineTo(px+21,py+8);ctx.lineTo(px+31,py+23);ctx.lineTo(px+27,py+30);ctx.closePath();ctx.fill();ctx.fillStyle='#ffffff44';ctx.fillRect(px+13,py+15,7,3);}
        else {ctx.fillStyle='#b6ce72';ctx.fillRect(px+12,py+13,3,16);ctx.fillRect(px+20,py+8,3,21);ctx.fillRect(px+26,py+15,3,14);}
      }
      const crop = game.cropStatus(x,y), b=game.state.buildings[x+','+y];
      if(crop) {ctx.fillStyle='#705137';ctx.fillRect(px+4,py+9,28,22);ctx.fillStyle=crop.ready?'#f5d077':'#76c08a';for(let t=0;t<3;t++){ctx.fillRect(px+9+t*8,py+24-crop.progress*12,3,8+crop.progress*7);}}
      if(b) {ctx.fillStyle='#d8b392';ctx.fillRect(px+8,py+14,20,17);ctx.fillStyle=b.type==='camp'?'#e6a55e':'#ad85da';ctx.beginPath();ctx.moveTo(px+5,py+15);ctx.lineTo(px+18,py+4);ctx.lineTo(px+31,py+15);ctx.closePath();ctx.fill();ctx.fillStyle='#392d47';ctx.fillRect(px+15,py+22,6,9);ctx.fillStyle='#fff';ctx.font='9px system-ui';ctx.fillText(String(b.level),px+24,py+12);}
      if(tile.landmark) {ctx.fillStyle='#ebe3c8';ctx.fillRect(px+14,py+7,8,22);ctx.fillStyle='#b6a7d8';ctx.fillRect(px+9,py+6,18,5);}
      const npc=Data.npcs.find(n=>n.x===x&&n.y===y);if(npc){ctx.fillStyle='#f2d28d';ctx.beginPath();ctx.arc(px+18,py+10,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f3b57f';ctx.fillRect(px+12,py+16,12,14);ctx.fillStyle='#fff';ctx.font='bold 12px system-ui';ctx.fillText('!',px+27,py+9);}
    }
    const cx=6*size,cy=5*size;ctx.fillStyle='#07091488';ctx.beginPath();ctx.ellipse(cx+18,cy+31,12,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ece0ff';ctx.beginPath();ctx.arc(cx+18,cy+10,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ac79ec';ctx.fillRect(cx+11,cy+16,14,13);ctx.fillStyle='#edc7ff';ctx.fillRect(cx+12,cy+28,4,6);ctx.fillRect(cx+21,cy+28,4,6);
    if(game.state.combat){const enemy=Data.creatures.find(c=>c.id===game.state.combat.id),img=images[enemy.id];if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,cx+34,cy-8,48,48);}
    ctx.strokeStyle='#e8ccff';ctx.lineWidth=2;ctx.strokeRect(cx+1,cy+1,size-2,size-2);ctx.restore();
    drawAtlas();
  }
  function drawAtlas() {
    const signature=positionKey() + ':' + Object.keys(game.state.buildings).sort().join('|'); if (signature === atlasSignature) return; atlasSignature=signature;
    const atlas=q('#rpg-atlas'), c=atlas.getContext('2d'), unit=5;
    c.clearRect(0,0,atlas.width,atlas.height);
    for(let y=0;y<Data.height;y++)for(let x=0;x<Data.width;x++){const tile=Data.getTile(x,y);c.fillStyle=Data.biomes[tile.biome].color;c.fillRect(x*unit,y*unit,unit,unit);}
    Object.keys(game.state.buildings).forEach(k=>{const [x,y]=k.split(',').map(Number);c.fillStyle='#fff0b8';c.fillRect(x*unit,y*unit,unit,unit);});
    Data.npcs.forEach(n=>{c.fillStyle='#ffdd7a';c.fillRect(n.x*unit,n.y*unit,unit,unit);});c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(game.state.player.x*unit-2,game.state.player.y*unit-2,unit+4,unit+4);
  }
  function renderBestiary() {
    if (!bestiary || !game) return;
    const filter=bestiary.querySelector('#rpg-beast-filter').value, search=bestiary.querySelector('#rpg-beast-search').value.toLocaleLowerCase('pt-BR').trim(), target=bestiary.querySelector('#rpg-beasts');target.replaceChildren();
    const creatures=Data.creatures.filter(c=>(filter==='all'||(filter==='discovered'?game.state.discovered[c.id]:c.habitat.includes(filter)))&&c.name.toLocaleLowerCase('pt-BR').includes(search));
    bestiary.querySelector('#rpg-beast-count').textContent=Object.keys(game.state.discovered).length+'/'+Data.creatures.length+' criaturas descobertas · '+creatures.length+' nesta lista';
    creatures.forEach(creature=>{const card=el('article','rpg-beast-card'),img=el('img');img.src=creature.image;img.alt=creature.name;img.loading='lazy';img.width=192;img.height=160;card.append(img,el('h2','',creature.name),el('span','rpg-discovery',game.state.discovered[creature.id]?'Descoberta':'Ainda não encontrada'),el('p','',creature.description),el('p','rpg-hint','Habitat: '+creature.habitat.map(id=>Data.biomes[id].name).join(', ')),el('p','rpg-hint','Vida '+creature.hp+' · Ataque '+creature.attack+' · Defesa '+creature.defense+' · '+creature.xp+' XP'),el('p','rpg-hint','Itens: '+format(creature.drops)));target.append(card);});
  }
  function exportProgress() {
    if(window.AndroidContent&&typeof window.AndroidContent.exportBackup==='function'){window.AndroidContent.exportBackup(game.serialize());tell('Escolha onde salvar o progresso de Nerakar.');return;}
    const blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='nerakar-progresso-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);tell('Exportação do progresso preparada.');
  }
  function init() {
    if(initialized||!Data||!Engine)return;section=document.getElementById('rpg');bestiary=document.getElementById('bestiary');if(!section||!bestiary)return;initialized=true;
    try {storage=window.localStorage;}catch(_){storage={getItem(){throw new Error('disabled');},setItem(){throw new Error('disabled');}};}
    const recovered=Engine.restore(storage);game=recovered.game;
    section.innerHTML=`
      <header class="rpg-header">
        <div><div class="eyebrow">Um lar entre biomas e cristais</div><h1>Ecos de Nerakar</h1><p class="muted">Cultive seu cantinho, conheça os moradores e explore os caminhos de Nerakar. Cada dia traz novos cuidados e descobertas.</p></div>
        <div class="rpg-header-art" aria-hidden="true"><svg viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg"><circle cx="237" cy="32" r="20" fill="#f2d78b"/><path d="M0 112Q50 46 124 100T300 75v65H0" fill="#bdcd94"/><path d="M0 130q88-69 177-6t123-16v32H0" fill="#8ea773"/><path d="M151 90h75v43h-75z" fill="#eacb93"/><path d="m143 92 45-37 47 37z" fill="#a57362"/><path d="M177 105h19v28h-19z" fill="#83624e"/><path d="M157 101h12v13h-12zM203 101h12v13h-12z" fill="#faf1ce"/><path d="M34 116h96v20H34z" fill="#9b7952"/><path d="M39 124h83M39 130h83" stroke="#c39c6a" stroke-width="2"/><path d="M48 124v-18m20 18v-18m20 18v-18m20 18v-18" stroke="#5d8051" stroke-width="3"/><path d="m48 109-8-7 8 2 8-6-5 10m17 1-8-7 8 2 8-6-5 10m17 1-8-7 8 2 8-6-5 10m17 1-8-7 8 2 8-6-5 10" fill="#769852"/><path d="m264 85-9 18 9 27 11-27z" fill="#b9a6d7"/><path d="m264 85 1 39 10-21z" fill="#d4c5ea"/><path d="M10 103V85h11v18z" fill="#856345"/><path d="m15 46-21 38h43z" fill="#7d965d"/></svg></div>
      </header>
      <div class="rpg-calendar" aria-label="Calendário de Nerakar">
        <div><span class="rpg-calendar-icon" aria-hidden="true">☀</span><strong id="rpg-day"></strong><span>Seu dia</span></div>
        <div><span class="rpg-calendar-icon" aria-hidden="true">❀</span><strong id="rpg-season"></strong><span>Estação</span></div>
        <div><span class="rpg-calendar-icon" aria-hidden="true">☁</span><strong id="rpg-weather"></strong><span>Clima</span></div>
        <div><span class="rpg-calendar-icon" aria-hidden="true">◷</span><strong id="rpg-clock"></strong><span>Hora em Nerakar</span></div>
      </div>
      <div class="rpg-status"><div><label id="rpg-hp-text" for="rpg-hp">Vida</label><progress id="rpg-hp" max="100" value="100"></progress></div><div><label id="rpg-stamina-text" for="rpg-stamina">Vigor</label><progress id="rpg-stamina" max="100" value="100"></progress></div><p id="rpg-level"></p><strong id="rpg-coins" class="rpg-coins"></strong></div>
      <p id="rpg-location" class="rpg-location"></p>
      <div class="rpg-field"><canvas id="rpg-map" width="936" height="792" role="img" aria-label="Mapa de exploração de Nerakar" aria-describedby="rpg-map-description" tabindex="0"></canvas><p id="rpg-map-description" class="rpg-sr-only"></p>
        <div class="rpg-controls"><div class="rpg-dpad"><button data-direction="up" aria-label="Mover para norte">▲</button><button data-direction="left" aria-label="Mover para oeste">◀</button><button data-direction="down" aria-label="Mover para sul">▼</button><button data-direction="right" aria-label="Mover para leste">▶</button></div><div class="rpg-actions"><button id="rpg-collect" class="rpg-button">Coletar</button><button id="rpg-water" class="rpg-button">Regar</button><button id="rpg-talk" class="rpg-button">Conversar</button><button id="rpg-quick-heal" class="rpg-button">Usar comida</button><button id="rpg-rest" class="rpg-button">Descansar · próximo dia</button></div></div><div id="rpg-context" class="rpg-context"></div>
      </div>
      <p id="rpg-feedback" class="rpg-feedback" role="status" aria-live="polite"></p>
      <div class="rpg-tabs" role="tablist" aria-label="Ações RPG"><button data-rpg-panel="explore" role="tab">Explorar</button><button data-rpg-panel="build" role="tab">Cultivo e base</button><button data-rpg-panel="inventory" role="tab">Inventário</button><button data-rpg-panel="craft" role="tab">Fabricar</button><button data-rpg-panel="people" role="tab">Moradores e lojas</button><button data-rpg-panel="quests" role="tab">Missões</button></div>
      <div class="rpg-tabpanel" data-panel="explore"><details open><summary>Mapa de Nerakar e biomas</summary><canvas id="rpg-atlas" role="img" aria-label="Mapa completo com sua localização"></canvas><p class="rpg-hint">Use ▲ ◀ ▼ ▶ no celular, setas ou WASD no teclado. E: coletar. R: regar. F: conversar. Espaço: atacar. Q: esquivar. Água exige uma ponte. A praça de Nerakar fica em 24,20.</p><div id="rpg-legend" class="rpg-legend"></div></details><h2>Encontros do bioma</h2><div id="rpg-hunts" class="rpg-actions"></div><h2>Diário da exploração</h2><ol id="rpg-log" class="rpg-log"></ol></div>
      <div class="rpg-tabpanel" data-panel="inventory" hidden><h2>Sua bolsa</h2><p id="rpg-equipment" class="rpg-hint"></p><div id="rpg-inventory"></div></div>
      <div class="rpg-tabpanel" data-panel="craft" hidden><h2>Ferramentas para o dia a dia</h2><p class="rpg-hint">Use seus recursos para criar ferramentas, provisões e equipamentos. A bancada e a forja liberam receitas especiais.</p><div id="rpg-recipes" class="rpg-options"></div></div>
      <div class="rpg-tabpanel" data-panel="build" hidden><h2>Seu cultivo</h2><div class="rpg-farm-guide"><strong>Prepare, plante, cuide e colha.</strong><p>Escolha um terreno livre, plante com sua enxada e regue uma vez por dia. O poço ajuda o crescimento e a chuva cuida dos canteiros. Descanse em seu abrigo para começar outro dia.</p></div><p id="rpg-farming-help" class="rpg-hint"></p><div id="rpg-farming" class="rpg-options"></div><h2>Seus canteiros</h2><div id="rpg-plots" class="rpg-crop-list"></div><h2>Um lugar para voltar</h2><p class="rpg-hint">Construa no seu terreno atual. Casa e acampamento dão abrigo para descansar. Poço acelera plantações; armazém amplia sua bolsa. Melhore construções ficando sobre elas.</p><div id="rpg-buildings" class="rpg-options"></div></div>
      <div class="rpg-tabpanel" data-panel="people" hidden><h2>A vida na cidade</h2><p class="rpg-hint">Encontre os moradores nos pontos indicados. Conversar e compartilhar um presente por dia aumentam a amizade. As lojas atendem quando você está a até 2 terrenos do morador.</p><div id="rpg-dialogue" class="rpg-dialogue"></div><div id="rpg-people" class="rpg-people"></div><h2>Pequenas lojas de Nerakar</h2><div id="rpg-shops"></div></div>
      <div class="rpg-tabpanel" data-panel="quests" hidden><h2>Modo história · missões de exploração</h2><p id="rpg-story-progress"></p><div id="rpg-quests" class="rpg-options"></div></div>
      <footer class="rpg-save"><span id="rpg-save-status">Salvamento automático neste dispositivo</span><div class="rpg-actions"><button id="rpg-save-now" class="rpg-button">Salvar agora</button><button id="rpg-export" class="rpg-button">Exportar progresso</button><label class="rpg-button" for="rpg-import">Importar progresso</label><input id="rpg-import" type="file" accept="application/json,.json" hidden></div><p class="rpg-hint">Seu dia fica salvo neste dispositivo. Exporte o progresso antes de trocar de celular ou limpar os dados.</p></footer>`;
    bestiary.innerHTML='<header><div class="eyebrow">Guia de exploração</div><h1>Bestiário de Nerakar</h1><p>24 criaturas de jogo com ilustrações próprias, habitats, atributos e recursos.</p></header><div class="rpg-beast-filters"><label>Pesquisar<input id="rpg-beast-search" type="search" placeholder="Nome da criatura"></label><label>Habitat<select id="rpg-beast-filter"><option value="all">Todos</option><option value="discovered">Descobertas</option></select></label></div><p id="rpg-beast-count" class="muted"></p><div id="rpg-beasts" class="rpg-beasts"></div>';
    canvas=q('#rpg-map');ctx=canvas.getContext('2d');q('#rpg-atlas').width=Data.width*5;q('#rpg-atlas').height=Data.height*5;
    Object.keys(Data.biomes).forEach(id=>{const item=el('span','');const swatch=el('i');swatch.style.background=Data.biomes[id].color;item.append(swatch,document.createTextNode(Data.biomes[id].name));q('#rpg-legend').append(item);const option=el('option','',Data.biomes[id].name);option.value=id;bestiary.querySelector('#rpg-beast-filter').append(option);});
    Data.creatures.forEach(c=>{const img=new Image();img.src=c.image;images[c.id]=img;});
    section.querySelectorAll('[data-rpg-panel]').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.rpgPanel)));
    section.querySelectorAll('[data-direction]').forEach(b=>{
      b.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();stopRepeat();control(b.dataset.direction);b.setPointerCapture(e.pointerId);repeat=setInterval(()=>control(b.dataset.direction),210);});
      ['pointerup','pointercancel','lostpointercapture'].forEach(event=>b.addEventListener(event,stopRepeat));
    });
    q('#rpg-collect').addEventListener('click',collect);q('#rpg-water').addEventListener('click',()=>water());q('#rpg-rest').addEventListener('click',()=>{if(game.rest)action(()=>game.rest());});q('#rpg-talk').addEventListener('click',()=>talk());q('#rpg-quick-heal').addEventListener('click',()=>action(()=>game.useItem('food')));
    q('#rpg-save-now').addEventListener('click',persist);q('#rpg-export').addEventListener('click',exportProgress);
    q('#rpg-import').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2000000)return tell('Arquivo de progresso grande demais.');try{const next=Engine.importSave(await file.text());const backup=game.save(storage);if(!backup.ok)return tell('Não foi possível guardar o progresso atual. Importação cancelada.');game=next;persist();render();renderBestiary();tell('Progresso importado; o anterior está na cópia de segurança.');}catch(_){tell('Arquivo de progresso inválido. Seu progresso atual foi preservado.');}});
    canvas.addEventListener('click',e=>{if(!active)return;const rect=canvas.getBoundingClientRect(),col=Math.floor((e.clientX-rect.left)/rect.width*13)-6,row=Math.floor((e.clientY-rect.top)/rect.height*11)-5;if(Math.abs(col)+Math.abs(row)!==1)return;const p=game.state.player,node=game.resourceAt(p.x+col,p.y+row);if(node&&node.remaining)action(()=>game.gather(p.x+col,p.y+row));else action(()=>game.move(col,row));});
    document.addEventListener('keydown',e=>{if(!active||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const map={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};if(map[e.key]){e.preventDefault();control(map[e.key]);}else if(e.key.toLowerCase()==='e'){e.preventDefault();collect();}else if(e.key.toLowerCase()==='r'){e.preventDefault();water();}else if(e.key.toLowerCase()==='f'){e.preventDefault();talk();}else if(e.key===' '&&game.state.combat){e.preventDefault();action(()=>game.battle('attack'),'rpg-hit');}else if(e.key.toLowerCase()==='q'&&game.state.combat){e.preventDefault();action(()=>game.battle('dodge'),'rpg-dodge');}});
    bestiary.querySelector('#rpg-beast-search').addEventListener('input',renderBestiary);bestiary.querySelector('#rpg-beast-filter').addEventListener('change',renderBestiary);
    document.addEventListener('sinapse:navigate',e=>{if(e.detail&&e.detail.id==='rpg')start();else if(active)pause();if(e.detail&&e.detail.id==='bestiary')renderBestiary();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(!section.classList.contains('hidden'))start();});window.addEventListener('pagehide',pause);window.addEventListener('blur',stopRepeat);
    document.addEventListener('sinapse:pause',pause);document.addEventListener('sinapse:resume',()=>{if(!section.classList.contains('hidden'))start();});
    new MutationObserver(()=>{if(section.classList.contains('hidden')){if(active)pause();}else if(!active)start();}).observe(section,{attributes:true,attributeFilter:['class']});
    showPanel('explore');render();renderBestiary();if(recovered.warning)tell(recovered.warning);if(!section.classList.contains('hidden'))start();
  }
  window.NerakarRPG={init,getGame:()=>game,save:persist};document.addEventListener('sinapse:ready',init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
