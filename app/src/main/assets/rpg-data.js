/* Nerakar exploration data. These are original gameplay adaptations, not book text. */
(function (root, factory) {
  'use strict';
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.NerakarData = data;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var width = 56;
  var height = 48;
  var spawn = { x: 24, y: 20 };
  var biomes = {
    city: { name: 'Cidade de Nerakar', color: '#807563', detailColor: '#b6a489' },
    forest: { name: 'Floresta', color: '#234c3c', detailColor: '#4c7950' },
    plains: { name: 'Planície de cultivo', color: '#70824b', detailColor: '#b4a975' },
    mountain: { name: 'Montanhas e minas', color: '#5c6671', detailColor: '#abb0b4' },
    swamp: { name: 'Pântano', color: '#3b5a4d', detailColor: '#82a278' },
    ruins: { name: 'Ruínas', color: '#655662', detailColor: '#aa9294' },
    lake: { name: 'Lago e travessias', color: '#27597a', detailColor: '#69a4bd' }
  };

  var items = {
    wood: { name: 'Madeira', icon: '🪵', kind: 'material' },
    stone: { name: 'Pedra', icon: '🪨', kind: 'material' },
    copper_ore: { name: 'Minério de cobre', icon: '🟠', kind: 'material' },
    iron_ore: { name: 'Minério de ferro', icon: '⛏️', kind: 'material' },
    crystal: { name: 'Cristal', icon: '💎', kind: 'material' },
    fiber: { name: 'Fibra vegetal', icon: '🌿', kind: 'material' },
    plank: { name: 'Tábuas', icon: '🪵', kind: 'material' },
    copper_bar: { name: 'Barra de cobre', icon: '🟠', kind: 'material' },
    iron_bar: { name: 'Barra de ferro', icon: '⚙️', kind: 'material' },
    wheat_seed: { name: 'Sementes de trigo', icon: '🌰', kind: 'seed' },
    herb_seed: { name: 'Sementes de ervas', icon: '🌱', kind: 'seed' },
    carrot_seed: { name: 'Sementes de cenoura', icon: '🌱', kind: 'seed' },
    pumpkin_seed: { name: 'Sementes de abóbora', icon: '🌰', kind: 'seed' },
    wheat: { name: 'Trigo', icon: '🌾', kind: 'material' },
    herb: { name: 'Ervas medicinais', icon: '🌿', kind: 'material' },
    carrot: { name: 'Cenoura', icon: '🥕', kind: 'material' },
    pumpkin: { name: 'Abóbora', icon: '🎃', kind: 'material' },
    food: { name: 'Provisões', icon: '🍞', kind: 'food', heal: 18 },
    healing_potion: { name: 'Poção de cura', icon: '🧪', kind: 'food', heal: 50 },
    axe: { name: 'Machado de coleta', icon: '🪓', kind: 'tool', attack: 5 },
    pickaxe: { name: 'Picareta', icon: '⛏️', kind: 'tool', attack: 4 },
    hoe: { name: 'Enxada', icon: '🌱', kind: 'tool', attack: 3 },
    watering_can: { name: 'Regador', icon: '💧', kind: 'tool' },
    sword: { name: 'Espada simples', icon: '🗡️', kind: 'weapon', attack: 12 },
    iron_sword: { name: 'Espada de ferro', icon: '⚔️', kind: 'weapon', attack: 23 },
    armor: { name: 'Armadura de ferro', icon: '🛡️', kind: 'armor', defense: 8 },
    leather_armor: { name: 'Proteção de fibras', icon: '🦺', kind: 'armor', defense: 3 },
    torch: { name: 'Tocha', icon: '🔥', kind: 'equipment' },
    coin: { name: 'Moedas', icon: '🪙', kind: 'currency' }
  };

  var recipes = [
    { id: 'plank', name: 'Serrar tábuas', output: { plank: 3 }, cost: { wood: 2 }, station: 'workbench' },
    { id: 'axe', name: 'Machado de coleta', output: { axe: 1 }, cost: { wood: 3, stone: 2 }, station: 'workbench' },
    { id: 'pickaxe', name: 'Picareta', output: { pickaxe: 1 }, cost: { wood: 3, stone: 3 }, station: 'workbench' },
    { id: 'hoe', name: 'Enxada', output: { hoe: 1 }, cost: { wood: 3, stone: 1 }, station: 'workbench' },
    { id: 'watering_can', name: 'Regador', output: { watering_can: 1 }, cost: { wood: 3, copper_bar: 1 }, station: 'workbench' },
    { id: 'sword', name: 'Espada simples', output: { sword: 1 }, cost: { wood: 4, stone: 5 }, station: 'workbench' },
    { id: 'leather_armor', name: 'Proteção de fibras', output: { leather_armor: 1 }, cost: { fiber: 8, plank: 2 }, station: 'workbench' },
    { id: 'copper_bar', name: 'Fundir cobre', output: { copper_bar: 1 }, cost: { copper_ore: 3, wood: 1 }, station: 'forge' },
    { id: 'iron_bar', name: 'Fundir ferro', output: { iron_bar: 1 }, cost: { iron_ore: 3, wood: 1 }, station: 'forge' },
    { id: 'iron_sword', name: 'Espada de ferro', output: { iron_sword: 1 }, cost: { iron_bar: 4, plank: 2, copper_bar: 1 }, station: 'forge' },
    { id: 'armor', name: 'Armadura de ferro', output: { armor: 1 }, cost: { iron_bar: 6, fiber: 6 }, station: 'forge' },
    { id: 'food', name: 'Preparar provisões', output: { food: 3 }, cost: { wheat: 2 }, station: 'camp' },
    { id: 'healing_potion', name: 'Preparar poção de cura', output: { healing_potion: 1 }, cost: { herb: 2, crystal: 1 }, station: 'workbench' },
    { id: 'torch', name: 'Montar uma tocha', output: { torch: 2 }, cost: { wood: 1, fiber: 2 } },
    { id: 'wheat_seed', name: 'Separar sementes de trigo', output: { wheat_seed: 3 }, cost: { wheat: 1 } },
    { id: 'herb_seed', name: 'Separar sementes de ervas', output: { herb_seed: 3 }, cost: { herb: 1 } },
    { id: 'carrot_seed', name: 'Separar sementes de cenoura', output: { carrot_seed: 3 }, cost: { carrot: 1 } },
    { id: 'pumpkin_seed', name: 'Separar sementes de abóbora', output: { pumpkin_seed: 3 }, cost: { pumpkin: 1 } }
  ];

  var buildings = {
    camp: { name: 'Acampamento', icon: '⛺', description: 'Permite descansar, recuperar vida e preparar provisões. A área próxima evita encontros automáticos.', cost: { wood: 6, stone: 4 }, maxLevel: 3, upgradeCost: { wood: 8, stone: 6 } },
    workbench: { name: 'Bancada de criação', icon: '🛠️', description: 'Permite fabricar ferramentas, tábuas e poções. Melhorias reduzem o gasto de vigor ao criar.', cost: { wood: 10, stone: 6 }, maxLevel: 3, upgradeCost: { plank: 6, stone: 8 } },
    forge: { name: 'Forja', icon: '🔥', description: 'Funde minérios e produz equipamento de ferro. Melhorias reduzem o gasto de vigor ao criar.', cost: { stone: 12, wood: 8, copper_ore: 4 }, maxLevel: 3, upgradeCost: { stone: 12, iron_bar: 3 } },
    house: { name: 'Casa', icon: '🏠', description: 'Permite descansar e aumenta a vida máxima em 10 pontos por nível.', cost: { wood: 24, stone: 16, plank: 4 }, maxLevel: 3, upgradeCost: { plank: 12, stone: 14 } },
    well: { name: 'Poço', icon: '🪣', description: 'Cultivos a até cinco terrenos crescem 20% mais rápido por nível do poço.', cost: { stone: 14, wood: 6 }, maxLevel: 2, upgradeCost: { stone: 12, copper_bar: 2 } },
    warehouse: { name: 'Armazém', icon: '🏚️', description: 'Aumenta a capacidade de armazenamento em 80 itens por nível.', cost: { plank: 12, stone: 8 }, maxLevel: 3, upgradeCost: { plank: 14, iron_bar: 2 } }
  };

  var seasons = [
    { id: 'spring', name: 'Primavera', growthRate: 1 },
    { id: 'summer', name: 'Verão', growthRate: 0.9 },
    { id: 'autumn', name: 'Outono', growthRate: 1.1 },
    { id: 'winter', name: 'Inverno', growthRate: 0.7 }
  ];

  var weather = [
    { id: 'sun', name: 'Ensolarado', growthRate: 1, rain: false },
    { id: 'rain', name: 'Chuva', growthRate: 1.15, rain: true },
    { id: 'cloudy', name: 'Nublado', growthRate: 1, rain: false },
    { id: 'storm', name: 'Tempestade', growthRate: 0.9, rain: true }
  ];

  var shops = {
    farmer: { npc: 'farmer', name: 'Sementes e colheitas', stock: {
      wheat_seed: { buy: 3, sell: 1 }, herb_seed: { buy: 5, sell: 2 },
      carrot_seed: { buy: 4, sell: 1 }, pumpkin_seed: { buy: 7, sell: 2 },
      wheat: { buy: 0, sell: 7 }, herb: { buy: 0, sell: 10 },
      carrot: { buy: 0, sell: 9 }, pumpkin: { buy: 0, sell: 18 },
      food: { buy: 8, sell: 3 }
    } },
    artisan: { npc: 'artisan', name: 'Materiais da oficina', stock: {
      wood: { buy: 3, sell: 1 }, stone: { buy: 4, sell: 2 }, fiber: { buy: 3, sell: 1 },
      copper_ore: { buy: 7, sell: 3 }, iron_ore: { buy: 9, sell: 4 },
      copper_bar: { buy: 14, sell: 6 }, iron_bar: { buy: 20, sell: 9 },
      axe: { buy: 17, sell: 6 }, pickaxe: { buy: 18, sell: 7 }, hoe: { buy: 12, sell: 4 },
      watering_can: { buy: 22, sell: 8 }, healing_potion: { buy: 30, sell: 12 }
    } }
  };

  var gifts = {
    farmer: ['wheat', 'herb', 'carrot'],
    artisan: ['copper_bar', 'iron_bar', 'plank'],
    guide: ['food', 'herb'],
    scout: ['food', 'healing_potion', 'crystal']
  };

  var crops = {
    wheat: { name: 'Trigo', seed: 'wheat_seed', item: 'wheat', growMs: 90000, yield: 3, seasons: ['spring', 'autumn'], description: 'Cereal para preparar provisões ou vender. Prefere primavera e outono.' },
    herb: { name: 'Ervas medicinais', seed: 'herb_seed', item: 'herb', growMs: 60000, yield: 2, seasons: ['spring', 'summer'], description: 'Cultivo rápido para poções e presentes. Prefere primavera e verão.' },
    carrot: { name: 'Cenoura', seed: 'carrot_seed', item: 'carrot', growMs: 120000, yield: 3, seasons: ['spring', 'autumn'], description: 'Raiz de crescimento médio, vendida por 9 moedas cada. Prefere primavera e outono.' },
    pumpkin: { name: 'Abóbora', seed: 'pumpkin_seed', item: 'pumpkin', growMs: 180000, yield: 2, seasons: ['summer', 'autumn'], description: 'Colheita demorada de maior valor: 18 moedas cada. Prefere verão e outono.' }
  };

  var npcs = [
    { id: 'guide', name: 'Guia de exploração', role: 'Introdução e caminhos', x: 23, y: 18, dialogues: [
      'Siga para as árvores e rochas nas bordas da cidade. Uma picareta e um machado já estão na sua bolsa.',
      'A praça é um ponto seguro. Colete madeira e pedra nas bordas da cidade para montar sua primeira bancada.',
      'A floresta fica a oeste e ao norte. A planície está ao sul; as montanhas e os minérios, a nordeste.',
      'Você pode alternar exploração e rotina de cultivo. Volte à cidade para conversar, descansar e planejar o próximo dia.',
      'Provisões e ervas são presentes que aprecio. As amizades crescem com conversas e pequenos gestos.'
    ] },
    { id: 'artisan', name: 'Artesã da bancada', role: 'Ferramentas e construções', x: 21, y: 20, dialogues: [
      'Uma bancada transforma madeira e pedra em ferramentas. Comece pelas tábuas e por uma proteção de fibras.',
      'A forja usa minério e madeira. Barras de ferro permitem fabricar uma espada e uma armadura mais resistentes.',
      'Construa perto da cidade ou na planície. Os edifícios podem receber melhorias quando houver material.',
      'Na oficina você pode comprar materiais e vender o que sobrou. Confira o preço antes de negociar.',
      'Barras de metal e tábuas são presentes úteis para minha oficina. Um regador também ajuda a cuidar da horta.'
    ] },
    { id: 'farmer', name: 'Agricultora', role: 'Sementes e colheita', x: 25, y: 24, dialogues: [
      'Use a enxada na planície ou na floresta, plante as sementes e volte após o crescimento.',
      'O trigo vira provisões; as ervas servem para preparar poções. Separe parte da colheita para criar novas sementes.',
      'As plantações continuam crescendo quando você fecha o aplicativo. A leitura e a exploração têm salvamentos próprios.',
      'Tenho sementes de trigo, ervas, cenoura e abóbora. Também compro suas colheitas: venda uma parte e guarde sementes para replantar.',
      'Regue os cultivos nos dias secos. A chuva ajuda, e cada cultura tem estações preferidas para crescer melhor.',
      'Um poço perto da horta acelera o crescimento. Trigo, ervas e cenouras são presentes que aprecio.'
    ] },
    { id: 'scout', name: 'Batedora', role: 'Biomas e criaturas', x: 28, y: 21, dialogues: [
      'Consulte o bestiário para encontrar os habitats, ataques e recursos de cada criatura.',
      'Não entre nas montanhas sem provisões. Uma armadura reduz os danos; as poções ajudam a voltar em segurança.',
      'As pontes cruzam o lago nas rotas leste da praça e da planície. O pântano e as ruínas pedem mais preparo.',
      'Depois de explorar, gosto de voltar para uma conversa tranquila. Provisões, poções e cristais são bons presentes.',
      'Você pode cuidar de uma fazenda e explorar no seu ritmo. Os acampamentos oferecem pausas seguras entre as viagens.'
    ] }
  ];

  var quests = [
    { id: 'first_wood', title: 'Madeira para começar', npc: 'guide', description: 'Colete 12 unidades de madeira nas árvores da cidade ou da floresta.', target: { kind: 'gather', id: 'wood', amount: 12 }, reward: { xp: 25, items: { stone: 6, food: 3 } } },
    { id: 'first_stone', title: 'Base de pedra', npc: 'guide', description: 'Colete 10 pedras usando a picareta.', target: { kind: 'gather', id: 'stone', amount: 10 }, reward: { xp: 25, items: { wood: 8, wheat_seed: 4 } }, requires: 'first_wood' },
    { id: 'bench', title: 'A primeira bancada', npc: 'artisan', description: 'Construa uma bancada de criação na cidade ou na planície.', target: { kind: 'build', id: 'workbench', amount: 1 }, reward: { xp: 40, items: { fiber: 8, food: 4 } }, requires: 'first_stone' },
    { id: 'boards', title: 'Tábuas para construir', npc: 'artisan', description: 'Fabrique pelo menos 6 tábuas na bancada.', target: { kind: 'craft', id: 'plank', amount: 6 }, reward: { xp: 30, items: { copper_ore: 4, stone: 8 } }, requires: 'bench' },
    { id: 'forest_route', title: 'Caminho da floresta', npc: 'scout', description: 'Explore uma área da floresta fora dos muros da cidade.', target: { kind: 'explore', id: 'forest', amount: 1 }, reward: { xp: 30, items: { food: 5, herb_seed: 4 } } },
    { id: 'wheat_harvest', title: 'Primeira colheita', npc: 'farmer', description: 'Plante trigo com a enxada e colha 6 unidades após o crescimento.', target: { kind: 'harvest', id: 'wheat', amount: 6 }, reward: { xp: 45, items: { wheat_seed: 6, wood: 8 } } },
    { id: 'herb_harvest', title: 'Ervas para a viagem', npc: 'farmer', description: 'Cultive e colha 4 ervas medicinais.', target: { kind: 'harvest', id: 'herb', amount: 4 }, reward: { xp: 40, items: { crystal: 2, herb_seed: 4 } }, requires: 'wheat_harvest' },
    { id: 'forge', title: 'Fogo de forja', npc: 'artisan', description: 'Construa uma forja para transformar minérios em barras.', target: { kind: 'build', id: 'forge', amount: 1 }, reward: { xp: 60, items: { copper_ore: 6, wood: 6 } }, requires: 'boards' },
    { id: 'copper', title: 'Cobre das montanhas', npc: 'artisan', description: 'Colete 12 unidades de minério de cobre nas montanhas.', target: { kind: 'gather', id: 'copper_ore', amount: 12 }, reward: { xp: 45, items: { iron_ore: 6, food: 5 } }, requires: 'forge' },
    { id: 'iron_blade', title: 'Uma lâmina resistente', npc: 'artisan', description: 'Fabrique uma espada de ferro na forja.', target: { kind: 'craft', id: 'iron_sword', amount: 1 }, reward: { xp: 90, items: { healing_potion: 3, coin: 20 } }, requires: 'copper' },
    { id: 'wolf_patrol', title: 'Patrulha de treinamento', npc: 'scout', description: 'Derrote 3 lobos da floresta. Use a espada e recupere o vigor com proteção.', target: { kind: 'kill', id: 'forest_wolf', amount: 3 }, reward: { xp: 60, items: { food: 6, fiber: 8 } }, requires: 'forest_route' },
    { id: 'swamp_route', title: 'Passagem do pântano', npc: 'scout', description: 'Alcance o bioma de pântano pela travessia do lago ou pela planície.', target: { kind: 'explore', id: 'swamp', amount: 1 }, reward: { xp: 55, items: { healing_potion: 2, herb: 4 } }, requires: 'wolf_patrol' },
    { id: 'ruins_route', title: 'Exploração das ruínas', npc: 'scout', description: 'Visite as ruínas a sudoeste e registre sua descoberta.', target: { kind: 'explore', id: 'ruins', amount: 1 }, reward: { xp: 60, items: { crystal: 4, coin: 25 } }, requires: 'swamp_route' },
    { id: 'home', title: 'Um lugar para retornar', npc: 'guide', description: 'Construa uma casa para completar a etapa inicial de exploração.', target: { kind: 'build', id: 'house', amount: 1 }, reward: { xp: 100, items: { food: 10, coin: 40 } }, requires: 'boards' },
    { id: 'sentinel', title: 'Desafio das ruínas', npc: 'scout', description: 'Derrote uma sentinela das ruínas com equipamento aprimorado.', target: { kind: 'kill', id: 'ruin_sentinel', amount: 1 }, reward: { xp: 110, items: { iron_bar: 4, crystal: 3 } }, requires: 'ruins_route' }
  ];

  var creatures = [
    { id: 'forest_wolf', name: 'Lobo da floresta', habitat: ['forest'], hp: 34, attack: 7, defense: 1, xp: 18, drops: { food: 2, fiber: 1 }, description: 'Caçador ágil que se move entre árvores; bom primeiro desafio de combate.' },
    { id: 'thorn_boar', name: 'Javali de espinhos', habitat: ['forest', 'plains'], hp: 45, attack: 9, defense: 3, xp: 24, drops: { food: 3, fiber: 2 }, description: 'Animal robusto com espinhos dorsais e uma investida forte.' },
    { id: 'bark_golem', name: 'Golem de casca', habitat: ['forest'], hp: 68, attack: 10, defense: 6, xp: 40, drops: { wood: 6, fiber: 3 }, description: 'Criatura de madeira viva protegida por placas de casca.' },
    { id: 'dusk_owl', name: 'Coruja do crepúsculo', habitat: ['forest', 'ruins'], hp: 26, attack: 7, defense: 0, xp: 15, drops: { fiber: 2, food: 1 }, description: 'Ave de olhos luminosos que patrulha a borda da mata.' },
    { id: 'moss_slime', name: 'Gosma de musgo', habitat: ['forest', 'swamp'], hp: 22, attack: 4, defense: 0, xp: 12, drops: { herb: 1, fiber: 2 }, description: 'Massa verde lenta, coberta de folhas e pequenas raízes.' },
    { id: 'ember_fox', name: 'Raposa de brasa', habitat: ['forest', 'mountain'], hp: 38, attack: 10, defense: 1, xp: 26, drops: { food: 2, crystal: 1 }, description: 'Raposa de cauda incandescente que exige atenção aos ataques.' },
    { id: 'meadow_hare', name: 'Lebre da campina', habitat: ['plains'], hp: 18, attack: 3, defense: 0, xp: 8, drops: { food: 1, wheat_seed: 2 }, description: 'Pequena criatura veloz das áreas abertas da planície.' },
    { id: 'horn_stag', name: 'Cervo de grandes chifres', habitat: ['plains', 'forest'], hp: 44, attack: 8, defense: 2, xp: 22, drops: { food: 3, fiber: 2 }, description: 'Cervo de galhadas largas que defende seu território.' },
    { id: 'reed_serpent', name: 'Serpente dos juncos', habitat: ['swamp', 'lake'], hp: 35, attack: 9, defense: 1, xp: 24, drops: { herb: 2, fiber: 2 }, description: 'Serpente comprida encontrada junto à água e nas travessias.' },
    { id: 'field_beetle', name: 'Besouro do campo', habitat: ['plains'], hp: 28, attack: 5, defense: 4, xp: 16, drops: { wheat_seed: 2, fiber: 2 }, description: 'Inseto de carapaça arredondada que vive entre gramíneas.' },
    { id: 'stone_lizard', name: 'Lagarto de pedra', habitat: ['mountain'], hp: 48, attack: 10, defense: 5, xp: 30, drops: { stone: 5, copper_ore: 1 }, description: 'Réptil de pele rochosa adaptado às encostas.' },
    { id: 'copper_scarab', name: 'Escaravelho de cobre', habitat: ['mountain', 'ruins'], hp: 40, attack: 8, defense: 6, xp: 28, drops: { copper_ore: 4, stone: 2 }, description: 'Escaravelho metálico de reflexos cor de cobre.' },
    { id: 'iron_golem', name: 'Golem de ferro', habitat: ['mountain'], hp: 100, attack: 16, defense: 10, xp: 70, drops: { iron_ore: 6, iron_bar: 1 }, description: 'Guardião pesado de metal; recomenda-se espada e armadura de ferro.' },
    { id: 'crystal_spider', name: 'Aranha de cristal', habitat: ['mountain', 'ruins'], hp: 52, attack: 13, defense: 4, xp: 38, drops: { crystal: 3, fiber: 2 }, description: 'Aranha de patas translúcidas que vive perto de cristais.' },
    { id: 'cave_bat', name: 'Morcego das cavernas', habitat: ['mountain', 'ruins'], hp: 27, attack: 8, defense: 0, xp: 18, drops: { food: 1, crystal: 1 }, description: 'Pequeno morcego de asas largas e ataques rápidos.' },
    { id: 'frost_ram', name: 'Carneiro da geada', habitat: ['mountain'], hp: 62, attack: 12, defense: 5, xp: 40, drops: { food: 4, fiber: 4 }, description: 'Animal de pelagem clara e chifres curvos das regiões altas.' },
    { id: 'swamp_toad', name: 'Sapo do pântano', habitat: ['swamp'], hp: 32, attack: 7, defense: 2, xp: 20, drops: { herb: 2, herb_seed: 1 }, description: 'Anfíbio largo de olhos amarelos, comum entre poças e raízes.' },
    { id: 'mire_leech', name: 'Sanguessuga do lodo', habitat: ['swamp'], hp: 24, attack: 8, defense: 0, xp: 18, drops: { herb: 1, fiber: 2 }, description: 'Criatura do lodo que se contrai antes de atacar.' },
    { id: 'bog_wisp', name: 'Luz errante do brejo', habitat: ['swamp', 'ruins'], hp: 36, attack: 11, defense: 2, xp: 30, drops: { crystal: 2, herb: 1 }, description: 'Pequena forma luminosa suspensa sobre o terreno úmido.' },
    { id: 'marsh_crocodile', name: 'Crocodilo do brejo', habitat: ['swamp', 'lake'], hp: 78, attack: 15, defense: 6, xp: 55, drops: { food: 5, fiber: 4 }, description: 'Predador de mandíbula larga e placas duras nas costas.' },
    { id: 'ruin_sentinel', name: 'Sentinela das ruínas', habitat: ['ruins'], hp: 90, attack: 15, defense: 8, xp: 65, drops: { stone: 8, iron_ore: 4, crystal: 1 }, description: 'Autômato de pedra e metal que vigia os caminhos quebrados.' },
    { id: 'ash_wraith', name: 'Espectro de cinzas', habitat: ['ruins'], hp: 58, attack: 14, defense: 3, xp: 42, drops: { crystal: 3, coin: 5 }, description: 'Figura flutuante de cinza escura, com um núcleo luminoso.' },
    { id: 'blood_hawk', name: 'Falcão rubro', habitat: ['ruins', 'mountain'], hp: 42, attack: 12, defense: 2, xp: 32, drops: { fiber: 3, food: 2 }, description: 'Ave de plumagem vermelha e asas pontudas.' },
    { id: 'steel_chimera', name: 'Quimera de aço', habitat: ['ruins'], hp: 125, attack: 20, defense: 10, xp: 100, drops: { iron_bar: 3, crystal: 4, coin: 15 }, description: 'Desafio avançado: fera de placas metálicas com cauda articulada.' }
  ].map(function (creature) {
    creature.image = 'creatures/' + creature.id + '.svg';
    return creature;
  });

  function hash(x, y, salt) {
    var n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul((salt || 0) + 317, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  }

  function biomeAt(x, y) {
    if (x >= 18 && x <= 31 && y >= 14 && y <= 26) return 'city';
    var lakeX = (x - 44) / 5;
    var lakeY = (y - 26) / 13;
    if (lakeX * lakeX + lakeY * lakeY <= 1) return 'lake';
    if (x < 15 && y >= 31) return 'ruins';
    if (x >= 34 && y >= 28) return 'swamp';
    if (x >= 31 && y <= 18) return 'mountain';
    if (y >= 27 || (x >= 31 && y > 18 && y < 28)) return 'plains';
    return 'forest';
  }

  var landmarks = {
    '24,20': 'Praça de Nerakar',
    '21,20': 'Bancada da artesã',
    '23,18': 'Ponto do guia',
    '25,24': 'Ponto de agricultura',
    '28,21': 'Posto de exploração',
    '14,20': 'Trilha da floresta',
    '24,30': 'Campos de cultivo',
    '36,11': 'Entrada das minas',
    '8,37': 'Pátio das ruínas',
    '38,36': 'Caminho do pântano'
  };

  var fixedResources = {
    '19,17': 'wood', '20,17': 'wood', '19,23': 'wood', '30,16': 'stone', '30,24': 'stone', '20,25': 'fiber',
    '17,19': 'wood', '17,21': 'wood', '32,16': 'copper_ore', '33,16': 'iron_ore', '34,15': 'crystal',
    '24,28': 'fiber', '26,28': 'stone', '16,28': 'wood'
  };

  var resourceDetails = {
    wood: { label: 'Árvore', amount: 4, tool: 'axe' },
    stone: { label: 'Rocha', amount: 3, tool: 'pickaxe' },
    copper_ore: { label: 'Veio de cobre', amount: 3, tool: 'pickaxe' },
    iron_ore: { label: 'Veio de ferro', amount: 3, tool: 'pickaxe' },
    crystal: { label: 'Cristais', amount: 2, tool: 'pickaxe' },
    fiber: { label: 'Planta fibrosa', amount: 3 }
  };

  var resourcePools = {
    city: ['wood', 'stone', 'fiber'],
    forest: ['wood', 'wood', 'wood', 'fiber', 'stone'],
    plains: ['fiber', 'fiber', 'stone', 'wood'],
    mountain: ['stone', 'copper_ore', 'copper_ore', 'iron_ore', 'iron_ore', 'crystal'],
    swamp: ['fiber', 'wood', 'fiber', 'herb', 'stone'],
    ruins: ['stone', 'iron_ore', 'crystal', 'copper_ore', 'fiber']
  };
  resourceDetails.herb = { label: 'Ervas silvestres', amount: 2 };

  function getTile(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
      return { x: x, y: y, biome: 'mountain', walkable: false };
    }
    var biome = biomeAt(x, y);
    var bridge = biome === 'lake' && (y === 20 || y === 32);
    var key = x + ',' + y;
    var tile = { x: x, y: y, biome: biome, walkable: biome !== 'lake' || bridge, texture: hash(x, y, 1) % 4 };
    if (bridge) { tile.landmark = 'Ponte do lago'; tile.bridge = true; }
    else if (landmarks[key]) tile.landmark = landmarks[key];
    if (!tile.walkable || bridge || landmarks[key]) return tile;
    // City paths and NPC access remain free of resource nodes.
    var cityPath = biome === 'city' && (x === spawn.x || y === spawn.y || y === 18 || x === 28);
    tile.road = cityPath;
    if (cityPath) return tile;
    var item = fixedResources[key];
    var roll = hash(x, y, 2) % 100;
    var threshold = biome === 'city' ? 13 : biome === 'forest' ? 45 : biome === 'mountain' ? 42 : 29;
    if (!item && resourcePools[biome] && roll < threshold) {
      var pool = resourcePools[biome];
      item = pool[hash(x, y, 3) % pool.length];
    }
    if (item) {
      var detail = resourceDetails[item];
      tile.resource = { id: item + ':' + x + ':' + y, item: item, amount: detail.amount, label: detail.label };
      if (detail.tool) tile.resource.tool = detail.tool;
    }
    return tile;
  }

  return {
    version: 2,
    modeLabel: 'Exploração — adaptação de jogabilidade',
    loreNotice: 'Mapa, criaturas e missões deste modo são adaptações de jogabilidade; não substituem nem completam os capítulos originais.',
    width: width, height: height, spawn: spawn, biomes: biomes,
    items: items, recipes: recipes, buildings: buildings, npcs: npcs,
    quests: quests, crops: crops, creatures: creatures,
    seasons: seasons, weather: weather, dayDurationMs: 600000, seasonLength: 7,
    shops: shops, gifts: gifts,
    hash: hash, getTile: getTile
  };
}));
