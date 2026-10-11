(() => {
  "use strict";
  // Pure reader rules are shared by the browser and the regression tests.
  const compactText = (text) => text.replace(/\s+/gu, "");
  const safeImage = (src) => typeof src === "string" && src.length < 3000000 &&
    (/^scenes\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g|svg)$/i.test(src) && !src.includes("..") ||
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src));
  function paginate(text, target = 1400) {
    target = Math.max(32, Number.isFinite(target) ? Math.floor(target) : 1400);
    const pages = [];
    let offset = 0;
    while (offset < text.length) {
      let end = Math.min(text.length, offset + target);
      if (end < text.length) {
        const breakAt = text.lastIndexOf("\n\n", end);
        const wordAt = text.lastIndexOf(" ", end);
        if (breakAt > offset + target / 2) end = breakAt + 2;
        else if (wordAt > offset + target / 2) end = wordAt + 1;
        // Never divide a surrogate pair in an imported Unicode text.
        if (/^[\uDC00-\uDFFF]$/.test(text[end] || "")) end--;
      }
      pages.push(text.slice(offset, end));
      offset = end;
    }
    return pages;
  }
  function validateBook(book, additionsOnly = false) {
    if (!book || !Array.isArray(book.chapters) || !book.chapters.length || book.chapters.length > 24)
      throw new Error("O JSON deve conter chapters com capítulos integrais.");
    const numbers = new Set();
    return book.chapters.map((chapter) => {
      if (!chapter || !Number.isInteger(chapter.number) || chapter.number < 1 || chapter.number > 24 ||
          additionsOnly && chapter.number < 13 || numbers.has(chapter.number))
        throw new Error("Use números únicos de capítulos entre " + (additionsOnly ? "13" : "1") + " e 24.");
      numbers.add(chapter.number);
      if (typeof chapter.title !== "string" || !chapter.title.trim() || chapter.title.length > 200 ||
          typeof chapter.text !== "string" || !chapter.text.trim() || chapter.text.length > 2000000)
        throw new Error("Cada capítulo precisa de título e texto integral, até 2 MB.");
      const normalizedTitle = chapter.title.trim().replace(/\s+/gu, " ").normalize("NFC");
      if (chapter.number === 24 && normalizedTitle.toLocaleLowerCase("pt-BR") !== "ecos de aço e sangue")
        throw new Error('O capítulo 24 deve se chamar "Ecos de Aço e Sangue".');
      const pages = chapter.pages === undefined ? paginate(chapter.text) : chapter.pages;
      if (!Array.isArray(pages) || !pages.length || pages.length > 2000 ||
          pages.some((page) => typeof page !== "string" || !page.trim()) ||
          compactText(pages.join("")) !== compactText(chapter.text))
        throw new Error("As páginas devem preservar todo o texto, na mesma ordem.");
      const images = (Array.isArray(chapter.images) ? chapter.images : []).slice(0, 24).map((img) => {
        const source = typeof img === "string" ? { src: img } : img;
        if (!source || !safeImage(source.src)) throw new Error("Imagem inválida: use scenes/ ou imagem PNG/JPEG/WebP embutida.");
        return { src: source.src, caption: String(source.caption || "Ilustração fornecida pelo autor").slice(0, 200),
          alt: String(source.alt || source.caption || "Ilustração do capítulo").slice(0, 200),
          page: Number.isInteger(source.page) ? Math.max(0, Math.min(pages.length - 1, source.page)) : 0 };
      });
      return { number: chapter.number, title: chapter.number === 24 ? "Ecos de Aço e Sangue" : chapter.title.trim(), text: chapter.text, pages: [...pages], images };
    }).sort((a, b) => a.number - b.number);
  }
  function mergeBooks(originals, additions) {
    const merged = [...originals];
    for (const chapter of additions) {
      if (chapter.number < 13 || merged.some((item) => item.number === chapter.number))
        throw new Error("O capítulo " + chapter.number + " já existe e foi preservado.");
      merged.push(chapter);
    }
    return merged.sort((a, b) => a.number - b.number);
  }
  function normalizeHighlights(ranges, text) {
    if (!Array.isArray(ranges)) return [];
    const sorted = ranges.slice(0, 500).filter((range) => range && Number.isInteger(range.start) && Number.isInteger(range.end) &&
      range.start >= 0 && range.end > range.start && range.end <= text.length &&
      (!range.quote || text.slice(range.start, range.end) === range.quote)).sort((a, b) => a.start - b.start);
    const result = [];
    for (const range of sorted) {
      const previous = result[result.length - 1];
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else result.push({ start: range.start, end: range.end });
    }
    return result.map((range) => ({ ...range, quote: text.slice(range.start, range.end) }));
  }
  function completeChapter(reading, number, pageCount) {
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 2000) return false;
    const progress = reading[number];
    if (!progress || progress.completed || !Array.isArray(progress.visited) ||
        !Array.from({ length: pageCount }, (_, page) => page).every((page) => progress.visited.includes(page))) return false;
    progress.completed = true;
    progress.completedAt = new Date().toISOString();
    return true;
  }
  function claimChapterReward(player, number) {
    if (!Number.isInteger(number) || number < 1 || number > 24) return false;
    if (!Array.isArray(player.completedRewards)) player.completedRewards = [];
    if (player.completedRewards.includes(number)) return false;
    player.completedRewards.push(number);
    return true;
  }
  const core = { paginate, validateBook, mergeBooks, normalizeHighlights, completeChapter, claimChapterReward, safeImage };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (typeof document === "undefined") return;
  const q = (selector) => document.querySelector(selector);
  const qa = (selector) => [...document.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let storageWarning = false;
  const save = (key, value) => {
    if (window.SinapseRestoring) return true;
    try { localStorage.setItem("sf2_" + key, JSON.stringify(value)); return true; }
    catch { if (!storageWarning) { storageWarning = true; toast("Não foi possível salvar: armazenamento indisponível ou cheio."); } return false; }
  };
  const load = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem("sf2_" + key)); return value ?? fallback; }
    catch { return fallback; }
  };
  const defaults = { name: "Jogador", xp: 0, points: 0, chapter: 1,
    unlocked: ["caleb", "oliver", "kaelum", "cibele"], scenes: 1, bestRace: 0, puzzle: false, quiz: false, completedRewards: [] };
  const loadedState = load("state", {});
  const state = { ...defaults, ...(loadedState && typeof loadedState === "object" ? loadedState : {}) };
  for (const key of ["xp", "points", "chapter", "scenes", "bestRace"]) state[key] = Math.max(key === "chapter" ? 1 : 0, Number.isFinite(state[key]) ? Math.floor(state[key]) : defaults[key]);
  state.xp = Math.min(99, state.xp);
  state.points = Math.min(100000000, state.points);
  state.chapter = Math.min(100000, state.chapter);
  if (!Array.isArray(state.unlocked)) state.unlocked = [...defaults.unlocked];
  state.completedRewards = Array.isArray(state.completedRewards) ? [...new Set(state.completedRewards.filter((number) => Number.isInteger(number) && number >= 1 && number <= 24))] : [];
  state.name = typeof state.name === "string" ? state.name.slice(0, 20) : "Jogador";
  const storedReading = load("reading", {});
  const reading = storedReading && typeof storedReading === "object" && !Array.isArray(storedReading) ? storedReading : {};
  const persist = () => { if (window.SinapseRestoring) return true; const stateSaved = save("state", state); const readingSaved = save("reading", reading); return stateSaved && readingSaved; };
  let readerSize = Math.max(16, Math.min(28, Number(load("readerSize", 19)) || 19));
  const chars = [
    {
      id: "caleb",
      name: "Caleb",
      role: "Protagonista",
      img: "characters/caleb.svg",
      unlock: 1,
      power: "Energia kriptante",
      age: "17 anos",
      bio: "Estratégico, leal e intenso. Sobreviveu ao impacto da tempestade roxa e agora carrega uma força que pode salvar Nerakar ou destruí-lo por dentro.",
      fact: "O poder não está no sangue: o corpo de Caleb é apenas o recipiente.",
    },
    {
      id: "oliver",
      name: "Oliver",
      role: "Rival",
      img: "characters/oliver.svg",
      unlock: 1,
      power: "Tecnologia e artefatos",
      age: "18 anos",
      bio: "Antigo melhor amigo de Caleb. Brilhante, calculista e ferido pelo passado, transforma inteligência e ressentimento em uma campanha para controlar Nerakar.",
      fact: "Ele ainda salva Caleb no passado, revelando que sua humanidade não desapareceu por completo.",
    },
    {
      id: "kaelum",
      name: "Kaelum",
      role: "Deus da tempestade",
      img: "characters/kaelum.svg",
      unlock: 1,
      power: "Tempestade primordial",
      age: "Incalculável",
      bio: "Uma divindade incompreensível: às vezes salvadora, às vezes cruel. Sua fumaça e sua energia mudaram a tecnologia e o destino do mundo.",
      fact: "Kaelum não cabe nas ideias humanas de herói ou vilão.",
    },
    {
      id: "cibele",
      name: "Cibele",
      role: "Sobrevivente",
      img: "characters/eron.svg",
      unlock: 1,
      power: "Coragem e estratégia",
      age: "Desconhecida",
      bio: "Resgatada durante o colapso de Nerakar. Inteligente, prática e capaz de sobreviver quando tudo ao redor desmorona.",
      fact: "É uma das primeiras pessoas que Caleb decide proteger depois de despertar.",
    },
    {
      id: "lira",
      name: "Lira",
      role: "Garota fantasma",
      img: "characters/kaelum.svg",
      unlock: 2,
      power: "Cura e presença espectral",
      age: "13 anos",
      bio: "Uma garota misteriosa que encontra Caleb ferido e acelera sua recuperação. Sabe mais sobre ele do que deveria.",
      fact: "Sua verdadeira natureza será revelada somente depois do encontro com Eron.",
    },
    {
      id: "eron",
      name: "Eron Valemont",
      role: "Sobrevivente da Sinapse",
      img: "characters/eron.svg",
      unlock: 3,
      power: "45 ecos mentais",
      age: "Desconhecida",
      bio: "Único sobrevivente da fusão de quarenta e cinco condenados. Carrega gênios, soldados e assassinos dentro da própria mente.",
      fact: "A própria família Valemont financiou a máquina Sinapse Final.",
    },
    {
      id: "lazhar",
      name: "Lazhar",
      role: "Hacker",
      img: "characters/oliver.svg",
      unlock: 3,
      power: "Tecnologia corporal",
      age: "Desconhecida",
      bio: "O mais inquieto dos cinco fugitivos. Conecta o próprio corpo a sistemas e controla discos defensivos.",
      fact: "É um dos aliados mais próximos de Oliver.",
    },
    {
      id: "miro",
      name: "Miro",
      role: "Infiltrador",
      img: "characters/caleb.svg",
      unlock: 3,
      power: "Pele de obsidiana",
      age: "Desconhecida",
      bio: "Silencioso e preciso. Sabe apagar sua presença até mesmo de sensores térmicos.",
      fact: "Quando endurece o corpo, torna-se um escudo vivo.",
    },
    {
      id: "tharn",
      name: "Tharn",
      role: "Brutamontes",
      img: "characters/eron.svg",
      unlock: 4,
      power: "Armadura orgânica",
      age: "Desconhecida",
      bio: "Seu corpo produz placas vivas extremamente resistentes. A violência parece natural para ele.",
      fact: "O Anel de Tharzul o fez encarar a própria fome por destruição.",
    },
    {
      id: "eko",
      name: "Eko",
      role: "Manipulador gravitacional",
      img: "characters/caleb.svg",
      unlock: 4,
      power: "Gravidade",
      age: "Desconhecida",
      bio: "Pequeno, silencioso e perigoso. Altera o peso e a direção dos objetos ao redor.",
      fact: "A lembrança de Maea é seu ponto de ruptura.",
    },
    {
      id: "mirael",
      name: "Mirael",
      role: "Controladora",
      img: "characters/oliver.svg",
      unlock: 4,
      power: "Armas e mente",
      age: "Desconhecida",
      bio: "Transforma objetos que segura em armas e domina mentes, embora não confie na própria memória.",
      fact: "O Anel revelou que sua mente sempre foi uma mentira.",
    },
    {
      id: "tharzul",
      name: "Tharzul",
      role: "Rei-templário",
      img: "characters/kaelum.svg",
      unlock: 4,
      power: "Julgamento brilhante",
      age: "Lenda antiga",
      bio: "Criador do anel que revela pecados possíveis e transfere a culpa de suas vítimas ao portador.",
      fact: "Seu julgamento perfeito destruiu todos ao redor — inclusive ele mesmo.",
    },
    {
      id: "kael",
      name: "Kael",
      role: "Mercenário",
      img: "characters/oliver.svg",
      unlock: 2,
      power: "Energia vermelha",
      age: "Desconhecida",
      bio: "Líder de campo dos mercenários enviados contra Caleb nas ruas de Nerakar.",
      fact: "Foi o primeiro inimigo nomeado a cercar Caleb.",
    },
    {
      id: "lisandra",
      name: "Lisandra",
      role: "Laço perdido",
      img: "characters/caleb.svg",
      unlock: 5,
      power: "Memórias apagadas",
      age: "Desconhecida",
      bio: "Parte central do passado de Caleb e Oliver. Seu desaparecimento aprofundou a ruptura entre os dois.",
      fact: "Kaelum apaga suas memórias depois da morte de sua família.",
    },
    {
      id: "axel",
      name: "Axel",
      role: "Filho adotivo de Sael",
      img: "characters/eron.svg",
      unlock: 5,
      power: "Fúria berserker",
      age: "Desconhecida",
      bio: "Carrega uma raiva capaz de romper seus próprios limites.",
      fact: "Sua história começa ligada ao herói militar entrevistado antes do apagão.",
    },
    {
      id: "kaien",
      name: "Kaien",
      role: "Dragão Dourado",
      img: "characters/caleb.svg",
      unlock: 5,
      power: "Ouro do dragão",
      age: "Desconhecida",
      bio: "Lutador sem poderes que perdeu a luta da vida, morreu e foi trazido de volta por Harkan.",
      fact: "Só poderá ser livre quando matar Caleb.",
    },
    {
      id: "sael",
      name: "Sael",
      role: "Pai de Caleb",
      img: "characters/eron.svg",
      unlock: 6,
      power: "Segredo corrompido",
      age: "Desconhecida",
      bio: "Uma figura essencial no passado de Caleb e na manipulação que envolve Harkan.",
      fact: "A verdade sobre ele muda a leitura de toda a família de Caleb.",
    },
    {
      id: "harkan",
      name: "Harkan",
      role: "Controlador",
      img: "characters/oliver.svg",
      unlock: 6,
      power: "Domínio do Dragão",
      age: "Desconhecida",
      bio: "Trouxe Kaien de volta à vida e amarrou sua liberdade a uma missão mortal.",
      fact: "Sua ajuda nunca vem sem correntes.",
    },
    {
      id: "baltazar",
      name: "Baltazar",
      role: "Pai de Oliver",
      img: "characters/kaelum.svg",
      unlock: 7,
      power: "Fusão em massa",
      age: "Desconhecida",
      bio: "Inimigo ligado à Sinapse Final, capaz de carregar milhões de presenças em si.",
      fact: "É o pai de Oliver e uma ameaça até para os deuses.",
    },
    {
      id: "nids",
      name: "Nids",
      role: "Divindade",
      img: "characters/kaelum.svg",
      unlock: 8,
      power: "Desconhecido",
      age: "Eterno",
      bio: "Uma das forças divinas do universo de Sinapse Final.",
      fact: "Faz parte da cosmologia ao lado de Thar, Giro e Kaelum.",
    },
    {
      id: "giro",
      name: "Giro",
      role: "Divindade",
      img: "characters/kaelum.svg",
      unlock: 8,
      power: "Desconhecido",
      age: "Eterno",
      bio: "Presença divina ainda envolta em mistério.",
      fact: "Sua influência será revelada em capítulos futuros.",
    },
    {
      id: "thar",
      name: "Thar",
      role: "Olho do Julgamento",
      img: "characters/kaelum.svg",
      unlock: 4,
      power: "Verdade absoluta",
      age: "Eterno",
      bio: "Divindade esquecida venerada por Tharzul. Não exige preces, apenas verdades.",
      fact: "Sua essência alimenta o Anel de Tharzul.",
    },
  ];
  // Cada integrante possui um retrato exclusivo recortado do atlas oficial do elenco.
  chars.forEach((character) => {
    character.img = `characters/v2/${character.id}.webp`;
  });
  state.unlocked = [...new Set(state.unlocked.filter((id) => chars.some((character) => character.id === id)))];
  let chapters = [], bookLoaded = false, bookError = "";
  let currentReader = null, speech = null, speechButton = null, toastTimer = 0;
  let gameCleanup = null, currentScreen = q(".page:not(.hidden)")?.id || "home";
  let codexQuery = "", codexFilter = "all";
  function toast(message) {
    let target = q(".toast");
    if (!target) { target = document.createElement("div"); target.className = "toast"; target.setAttribute("role", "status"); document.body.append(target); }
    target.textContent = message;
    target.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => target.classList.remove("show"), 2600);
  }
  function reward(points, message) {
    if (!Number.isFinite(points) || points <= 0) return;
    const amount = Math.min(1000, Math.floor(points));
    state.points += amount; state.xp += amount;
    while (state.xp >= 100) { state.xp -= 100; state.chapter++; }
    const saved = persist(); refreshHome();
    toast(`+${amount} pontos • ${message}${saved ? "" : " • salvamento indisponível"}`);
  }
  function refreshHome() {
    if (q("#homeName")) q("#homeName").textContent = state.name;
    if (q("#homePoints")) q("#homePoints").textContent = state.points + " pontos";
    if (q("#homeLevel")) q("#homeLevel").textContent = "Nível " + state.chapter;
    if (q("#homeXp")) q("#homeXp").style.width = Math.min(100, state.xp) + "%";
  }
  q("#home").insertAdjacentHTML("afterbegin", `<div class="game-home"><div class="logo">SINAPSE<span>ϟ</span><br>FINAL</div><div class="tagline">Ecos de Nerakar</div><div class="player-chip"><div class="avatar">C</div><div><strong id="homeName"></strong><small><span id="homeLevel"></span> • <span id="homePoints"></span></small><div class="xp"><i id="homeXp"></i></div></div></div><div class="main-menu"><button class="menu-btn primary" id="continueStory">Continuar leitura</button><button class="menu-btn" data-go="rpg">Explorar Nerakar</button><button class="menu-btn" data-go="arcade">Jogos</button><button class="menu-btn" data-go="characters">Personagens</button><button class="menu-btn" data-go="profile">Perfil offline</button></div></div>`);
  function imagesFor(chapter) {
    const provided = chapter.images?.length ? chapter.images : window.SinapseChapterScenes?.[chapter.number];
    if (provided?.length) return provided.filter((image) => safeImage(image.src));
    return chapter.number <= 12 ? [{ src: `scenes/chapters/chapter-${chapter.number}.webp`, caption: "Ilustração recuperada", alt: "Ilustração do capítulo " + chapter.number, page: 0 }] : [];
  }
  function renderStoryLibrary() {
    const pending = Array.from({ length: 24 }, (_, index) => index + 1).filter((number) => !chapters.some((chapter) => chapter.number === number));
    const completed = chapters.filter((chapter) => reading[chapter.number]?.completed).length;
    q("#story").innerHTML = `<header class="screen-head"><div class="eyebrow">Biblioteca preservada</div><h1>Arquivo de Nerakar</h1><p class="lead">Progresso, marca-textos e comentários ficam neste aparelho.</p></header><div class="stat-row"><div class="stat"><strong>${chapters.length}</strong><span>disponíveis</span></div><div class="stat"><strong>${completed}</strong><span>concluídos</span></div><div class="stat"><strong>${pending.length}</strong><span>pendentes</span></div></div><div class="notice" role="status">${bookError ? escapeHTML(bookError) : !bookLoaded ? "Carregando o livro recuperado…" : `${chapters.filter(chapter => chapter.number <= 12).length} capítulos recuperados e preservados. ${pending.filter(number => number >= 13).length} textos de 13–24 ainda aguardam uma fonte acessível do autor.`}</div><div class="import-panel card"><h2>Integrar capítulos do autor</h2><p class="small">Importe JSON com chapters: number, title e text. pages e images são opcionais. Capítulos existentes são preservados; nenhum texto novo é criado automaticamente.</p><label class="btn alt" for="chapterImport">Importar capítulos 13–24</label><input id="chapterImport" type="file" accept=".json,application/json" class="visually-hidden"><p id="importStatus" class="small" role="status">O capítulo 24 está reservado para “Ecos de Aço e Sangue”.</p></div><div class="section-title"><h2>Capítulos disponíveis</h2><small>${chapters.length ? "texto recuperado ou importado" : "aguardando recuperação"}</small></div><div class="chapter-list">${chapters.map((chapter) => {
      const images = imagesFor(chapter), progress = reading[chapter.number];
      return `<button class="chapter-tile" data-chapter="${chapter.number}">${images.length ? `<img class="chapter-tile-image" src="${escapeHTML(images[0].src)}" alt="" loading="lazy">` : ""}<span class="status">${progress?.completed ? "Concluído" : chapter.pages.length + " páginas"}</span><div class="eyebrow">Capítulo ${chapter.number}</div><h2>${escapeHTML(chapter.title)}</h2><p>${escapeHTML(chapter.text.slice(0, 100).replace(/\s+/g, " "))}…</p><small>${chapter.number <= 12 ? "Fonte recuperada" : "Texto importado pelo usuário"} • ${images.length} ilustrações disponíveis</small></button>`;
    }).join("")}</div><div class="section-title"><h2>Textos pendentes</h2><small>sem conteúdo inventado</small></div><div class="pending-chapters">${pending.map((number) => `<div class="pending-chapter"><b>Capítulo ${number}</b><span>${number === 24 ? "Ecos de Aço e Sangue" : "Texto e título aguardando o autor"}</span></div>`).join("") || "Todos os números solicitados têm uma fonte integrada."}</div>`;
    q("#chapterImport").addEventListener("change", importChapters);
  }
  async function importChapters(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = q("#importStatus");
    try {
      if (!bookLoaded) throw new Error("Aguarde o livro recuperado carregar antes de importar.");
      if (file.size > 20000000) throw new Error("Use um arquivo JSON de até 20 MB.");
      const additions = validateBook(JSON.parse(await file.text()), true);
      const merged = mergeBooks(chapters, additions);
      const extra = merged.filter((chapter) => chapter.number >= 13);
      // Write successfully before changing the in-memory library.
      if (!save("importedChapters", extra)) throw new Error("Importação não salva; libere espaço e tente novamente.");
      chapters = merged;
      renderStoryLibrary();
      q("#importStatus").textContent = `${additions.length} capítulos importados e salvos neste aparelho. Textos fornecidos pelo usuário.`;
      toast("Capítulos integrados sem substituir os originais.");
      document.dispatchEvent(new CustomEvent("sinapse:chapters", { bubbles: true, detail: { chapters: chapters.length } }));
    } catch (error) { status.textContent = error.message; toast(error.message); }
    event.target.value = "";
  }
  async function loadBook() {
    try {
      const book = window.AndroidContent?.readChapters ? JSON.parse(window.AndroidContent.readChapters()) : await fetch("chapters.json").then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); });
      chapters = validateBook(book);
      try {
        const extra = load("importedChapters", []);
        if (Array.isArray(extra) && extra.length) {
          // An updated APK may already include a formerly imported chapter.
          const additions = validateBook({ chapters: extra }, true).filter((chapter) => !chapters.some((original) => original.number === chapter.number));
          chapters = mergeBooks(chapters, additions);
        }
      } catch { toast("Importação local inválida foi preservada, mas não pôde ser aberta."); }
      bookLoaded = true;
      renderStoryLibrary();
      if (currentScreen === "chapterReader" && !currentReader) {
        const resumeNumber = Number(load("lastReading", 1));
        if (chapters.some((chapter) => chapter.number === resumeNumber)) openChapter(resumeNumber);
        else navigate("story");
      }
      document.dispatchEvent(new CustomEvent("sinapse:chapters", { bubbles: true, detail: { chapters: chapters.length } }));
    } catch (error) {
      bookError = "O arquivo chapters.json não pôde ser aberto. Os textos existentes não foram substituídos. " + error.message;
      renderStoryLibrary(); toast("Não foi possível abrir o livro recuperado.");
    }
  }
  function navigate(id) {
    if (!q("#" + id)) { toast("Esta tela ainda não está disponível."); return; }
    const button = document.createElement("button"); button.dataset.go = id;
    document.body.append(button); button.click(); button.remove();
  }
  function progressFor(chapter) {
    let progress = reading[chapter.number];
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) progress = reading[chapter.number] = {};
    if (!Array.isArray(progress.visited)) progress.visited = [];
    progress.visited = [...new Set(progress.visited.filter((page) => Number.isInteger(page) && page >= 0 && page < chapter.pages.length))];
    progress.page = Math.max(0, Math.min(chapter.pages.length - 1, Number.isInteger(progress.page) ? progress.page : Math.floor(Number(load(`chapter_${chapter.number}_page`, 0))) || 0));
    if (!progress.highlights || typeof progress.highlights !== "object" || Array.isArray(progress.highlights)) progress.highlights = {};
    if (!progress.comments || typeof progress.comments !== "object" || Array.isArray(progress.comments)) progress.comments = {};
    return progress;
  }
  function openChapter(number) {
    const chapter = chapters.find((item) => item.number === number);
    if (!chapter) { toast(bookLoaded ? "Texto do capítulo ainda indisponível." : "Aguarde o carregamento do livro."); return; }
    stopSpeech();
    currentReader = { chapter, progress: progressFor(chapter) };
    renderReader(); navigate("chapterReader");
  }
  function renderHighlightedText(target, text, ranges) {
    target.replaceChildren();
    let position = 0;
    for (const range of normalizeHighlights(ranges, text)) {
      target.append(document.createTextNode(text.slice(position, range.start)));
      const mark = document.createElement("mark"); mark.textContent = text.slice(range.start, range.end); target.append(mark);
      position = range.end;
    }
    target.append(document.createTextNode(text.slice(position)));
  }
  function selectedOffsets(target) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) return null;
    const before = document.createRange(); before.selectNodeContents(target); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length, end = start + range.toString().length;
    return { start, end };
  }
  function renderReader() {
    if (!currentReader) return;
    stopSpeech();
    const { chapter, progress } = currentReader, page = progress.page, text = chapter.pages[page];
    if (!progress.visited.includes(page)) progress.visited.push(page);
    progress.updatedAt = new Date().toISOString();
    save("lastReading", chapter.number); const progressSaved = persist();
    const allImages = imagesFor(chapter);
    const image = [...allImages].sort((a, b) => (a.page || 0) - (b.page || 0)).filter((item) => (item.page || 0) <= page).pop() || allImages[0];
    const comments = (Array.isArray(progress.comments[page]) ? progress.comments[page] : []).filter((comment) =>
      comment && typeof comment === "object" && typeof comment.text === "string").slice(0, 50).map((comment) => ({
        author: typeof comment.author === "string" ? comment.author.slice(0, 20) : "Jogador",
        text: comment.text.slice(0, 1000), createdAt: typeof comment.createdAt === "string" ? comment.createdAt : ""
      }));
    progress.comments[page] = comments;
    progress.highlights[page] = normalizeHighlights(progress.highlights[page], text);
    q("#chapterReader").innerHTML = `<button class="back" data-go="story">← Capítulos</button><div class="reader-shell"><header class="screen-head"><div class="eyebrow">Capítulo ${chapter.number} • página ${page + 1}/${chapter.pages.length}</div><h1>${escapeHTML(chapter.title)}</h1></header>${image ? `<figure class="reader-scene"><img class="chapter-cover" src="${escapeHTML(image.src)}" alt="${escapeHTML(image.alt || "Ilustração do capítulo")}"><figcaption>${escapeHTML(image.caption || "Ilustração disponível")}</figcaption></figure>` : '<p class="notice">Imagens deste capítulo aguardam material do autor.</p>'}<div class="reader-progress" role="progressbar" aria-label="Páginas abertas" aria-valuemin="0" aria-valuemax="${chapter.pages.length}" aria-valuenow="${progress.visited.length}"><i style="width:${100 * progress.visited.length / chapter.pages.length}%"></i></div><article id="chapterPageText" class="card chapter" style="font-size:${readerSize}px;white-space:pre-wrap"></article><div class="book-panel"><label for="upgradeFont">Tamanho da letra</label><input id="upgradeFont" type="range" min="16" max="28" value="${readerSize}"><div class="highlight-actions"><button class="btn alt" id="highlightSelection">Marcar seleção</button><button class="btn alt" id="clearHighlights">Limpar marcas desta página</button></div><p class="small">Selecione um trecho do texto e toque em Marcar seleção. Marcas e comentários são locais.</p></div>${allImages.length > 1 ? `<details class="chapter-gallery"><summary>${allImages.length} ilustrações disponíveis</summary>${allImages.map((item) => `<figure><img src="${escapeHTML(item.src)}" alt="${escapeHTML(item.alt || item.caption || "Ilustração")}" loading="lazy"><figcaption>${escapeHTML(item.caption || "Ilustração fornecida")}</figcaption></figure>`).join("")}</details>` : ""}<section class="reader-comments card"><h2>Comentários desta página</h2><p class="small">${comments.length} comentários salvos neste aparelho. Sem envio online.</p><div id="pageComments"></div><form id="commentForm"><label class="field" for="commentText">Seu comentário<textarea id="commentText" maxlength="1000" rows="3" required></textarea></label><button class="btn alt" type="submit">Salvar comentário offline</button></form></section><div class="reader-actions"><button class="btn alt" id="uPrev" ${page === 0 ? "disabled" : ""} aria-label="Página anterior">←</button><button class="btn alt" id="uVoice">🔊 Voz</button><button class="btn primary" id="uNext">${page === chapter.pages.length - 1 ? progress.completed ? "Concluído ✓" : "Concluir" : "Próxima →"}</button></div><p class="small">${progress.visited.length}/${chapter.pages.length} páginas abertas • ${progress.completed ? "capítulo concluído" : progressSaved ? "progresso salvo localmente" : "progresso em memória: salvamento indisponível"}</p></div>`;
    const target = q("#chapterPageText");
    renderHighlightedText(target, text, progress.highlights[page]);
    comments.forEach((comment, index) => {
      const card = document.createElement("article"); card.className = "local-comment";
      const author = document.createElement("strong"); author.textContent = typeof comment.author === "string" ? comment.author : "Jogador";
      const content = document.createElement("p"); content.textContent = String(comment.text || "");
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn alt"; remove.textContent = "Excluir";
      remove.onclick = () => { comments.splice(index, 1); progress.comments[page] = comments; persist(); renderReader(); };
      card.append(author, content, remove); q("#pageComments").append(card);
    });
    q("#upgradeFont").oninput = (event) => { readerSize = Number(event.target.value); save("readerSize", readerSize); target.style.fontSize = readerSize + "px"; };
    const highlightButton = q("#highlightSelection");
    highlightButton.addEventListener("pointerdown", (event) => event.preventDefault());
    highlightButton.onclick = () => {
      const selected = selectedOffsets(target);
      if (!selected) { toast("Selecione um trecho dentro do texto da página."); return; }
      progress.highlights[page] = normalizeHighlights([...(progress.highlights[page] || []), selected], text);
      const saved = persist(); renderHighlightedText(target, text, progress.highlights[page]); window.getSelection()?.removeAllRanges();
      toast(saved ? "Trecho marcado e salvo neste aparelho." : "Trecho marcado em memória; não foi possível salvar.");
    };
    q("#clearHighlights").onclick = () => { delete progress.highlights[page]; persist(); renderHighlightedText(target, text, []); toast("Marcas removidas desta página."); };
    q("#commentForm").onsubmit = (event) => {
      event.preventDefault(); const content = q("#commentText").value.trim();
      if (!content) return;
      if (comments.length >= 50) { toast("Limite de 50 comentários por página. Exclua um para adicionar outro."); return; }
      progress.comments[page] = [...comments, { author: state.name, text: content.slice(0, 1000), createdAt: new Date().toISOString() }];
      const saved = persist(); renderReader(); toast(saved ? "Comentário salvo offline." : "Comentário em memória; não foi possível salvar.");
    };
    q("#uPrev").onclick = () => { progress.page = Math.max(0, page - 1); renderReader(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    q("#uVoice").onclick = () => speak(text, q("#uVoice"));
    q("#uNext").onclick = () => {
      if (page < chapter.pages.length - 1) { progress.page++; renderReader(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (completeChapter(reading, chapter.number, chapter.pages.length)) {
        state.unlocked = [...new Set([...state.unlocked, ...chars.filter((character) => character.unlock <= chapter.number).map((character) => character.id)])];
        // Ledger and XP share one state JSON write, even if the separate annotations storage is full.
        if (claimChapterReward(state, chapter.number)) reward(50, `Capítulo ${chapter.number} concluído`);
        else { persist(); toast("Capítulo concluído. A recompensa já foi registrada."); }
        renderCodex();
      } else if (!progress.completed) { toast("Abra todas as páginas antes de concluir este capítulo."); return; }
      renderStoryLibrary(); navigate("story");
    };
  }
  const originalVoiceHandler = window.onAndroidVoiceState;
  window.onAndroidVoiceState = (status) => {
    if (!speech) { if (typeof originalVoiceHandler === "function") originalVoiceHandler(status); return; }
    if (status === "done" || status === "error") { stopSpeech(); if (status === "error") toast("Narração indisponível neste aparelho."); }
  };
  function stopSpeech() {
    if (!speech) return;
    const active = speech; speech = null;
    if (active.native && window.AndroidVoice?.stop) window.AndroidVoice.stop();
    else if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (speechButton?.isConnected) { speechButton.dataset.reading = "false"; speechButton.textContent = "🔊 Voz"; }
    speechButton = null;
  }
  function speak(text, button) {
    if (speech && speechButton === button) { stopSpeech(); return; }
    stopSpeech();
    speechButton = button;
    if (window.AndroidVoice?.speak) { speech = { native: true }; window.AndroidVoice.speak(text); }
    else if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const utterance = new SpeechSynthesisUtterance(text); speech = utterance;
      utterance.lang = "pt-BR"; utterance.rate = 0.92;
      utterance.onend = () => { if (speech === utterance) stopSpeech(); };
      utterance.onerror = () => { if (speech === utterance) { stopSpeech(); toast("Narração indisponível."); } };
      window.speechSynthesis.speak(utterance);
    } else { speechButton = null; toast("Voz indisponível neste aparelho."); return; }
    q("#soundtrack")?.pause();
    button.dataset.reading = "true"; button.textContent = "■ Parar";
  }
  function isUnlocked(character) { return state.unlocked.includes(character.id) || state.chapter >= character.unlock; }
  function renderCodex() {
    const openCount = chars.filter(isUnlocked).length;
    q("#characters").innerHTML = `<header class="screen-head"><div class="eyebrow">Conheça o universo</div><h1>Personagens • ${openCount}/${chars.length}</h1><p class="lead">Os 22 personagens e retratos recuperados foram preservados.</p></header><div class="codex-tools"><label class="field" for="codexSearch">Buscar personagem ou poder<input id="codexSearch" type="search" maxlength="80" placeholder="Caleb, tempestade…" value="${escapeHTML(codexQuery)}"></label><label class="field" for="codexFilter">Mostrar<select id="codexFilter"><option value="all">Todos</option><option value="open">Desbloqueados</option><option value="locked">Bloqueados</option></select></label></div><p id="codexCount" class="small" role="status"></p><div id="codexResults" class="codex-grid"></div>`;
    q("#codexFilter").value = codexFilter;
    const update = () => {
      const query = codexQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const matches = chars.filter((character) => {
        const open = isUnlocked(character), text = `${character.name} ${character.role} ${character.power}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return text.includes(query) && (codexFilter === "all" || codexFilter === "open" && open || codexFilter === "locked" && !open);
      });
      q("#codexCount").textContent = `${matches.length} personagens encontrados`;
      q("#codexResults").innerHTML = matches.map((character) => {
        const open = isUnlocked(character);
        return `<button class="codex-card ${open ? "" : "locked"}" data-char="${character.id}" ${open ? "" : "disabled"}><img src="${character.img}" alt="${open ? "Retrato de " + character.name : "Personagem bloqueado"}" loading="lazy"><div class="info"><h3>${open ? character.name : "Arquivo bloqueado"}</h3><small>${open ? character.role : "Disponível no nível " + character.unlock}</small></div></button>`;
      }).join("");
    };
    q("#codexSearch").oninput = (event) => { codexQuery = event.target.value; update(); };
    q("#codexFilter").onchange = (event) => { codexFilter = event.target.value; update(); };
    update();
  }
  function showChar(id) {
    const character = chars.find((item) => item.id === id);
    if (!character || !isUnlocked(character)) return;
    q("#characterDetail").innerHTML = `<button class="back" data-go="characters">← Voltar ao códice</button><img class="detail-hero" src="${character.img}" alt="Retrato de ${character.name}"><header class="screen-head"><div class="eyebrow">${character.role}</div><h1>${character.name}</h1><div class="detail-data"><span>${character.age}</span><span>${character.power}</span></div></header><article class="card lore"><h2>Arquivo</h2><p>${character.bio}</p><h2>Curiosidade desbloqueada</h2><p>${character.fact}</p></article>`;
    navigate("characterDetail");
  }
  q("#profile").innerHTML = `<header class="screen-head"><div class="eyebrow">Identidade do jogador</div><h1>Perfil offline</h1></header><div class="profile-card"><div class="player-chip"><div class="avatar">C</div><div><strong id="profileName"></strong><small id="profileStats"></small></div></div><label class="field" for="nameInput">Nome do jogador<input id="nameInput" maxlength="20" autocomplete="nickname"></label><button class="btn primary" id="saveProfile">Salvar perfil neste aparelho</button><p class="small">Perfil, leitura e comentários são locais. Conta online e sincronização ainda indisponíveis.</p></div><div class="section-title"><h2>Conquistas</h2><small>arquivo pessoal</small></div><div id="achievements"></div>`;
  function profilePaint() {
    q("#profileName").textContent = state.name;
    q("#profileStats").textContent = `Nível ${state.chapter} • ${state.points} pontos`;
    q("#nameInput").value = state.name;
    q("#achievements").innerHTML = `<div class="achievement"><i>ϟ</i><div><b>Primeiro impacto</b><small> Abra a história</small></div></div><div class="achievement ${state.puzzle ? "" : "locked"}"><i>◈</i><div><b>Mente sincronizada</b><small> Complete Sinapses</small></div></div><div class="achievement ${state.bestRace >= 15 ? "" : "locked"}"><i>🏎</i><div><b>Fuga perfeita</b><small> Supere 15 destroços</small></div></div><div class="achievement ${state.quiz ? "" : "locked"}"><i>✦</i><div><b>Memória da tempestade</b><small> Acerte ao menos quatro perguntas</small></div></div>`;
  }
  q("#saveProfile").onclick = () => {
    const value = q("#nameInput").value.trim(); if (value) state.name = value;
    const saved = persist(); profilePaint(); refreshHome(); toast(saved ? "Perfil salvo neste aparelho." : "Perfil em memória; não foi possível salvar.");
  };
  q("#continueStory").onclick = () => {
    const number = Number(load("lastReading", 1));
    if (chapters.some((chapter) => chapter.number === number)) openChapter(number); else navigate("story");
  };
  q("#arcade").innerHTML = `<header class="screen-head"><div class="eyebrow">Central de jogos</div><h1>Treine. Corra. Descubra.</h1><p class="lead">Desafios com progresso salvo. Jogos param ao sair da tela ou pausar o aplicativo.</p></header><div class="mode-list"><button class="game-mode" data-play="race"><span class="icon">🏎</span><span><h3>Fuga de Nerakar</h3><p>Controle por toque e setas. Supere seu recorde.</p></span><b>30s</b></button><button class="game-mode" data-play="puzzle"><span class="icon">◈</span><span><h3>Sinapses</h3><p>Memorize quatro pares em até 32 tentativas.</p></span><b>90s</b></button><button class="game-mode" data-go="quiz"><span class="icon">✦</span><span><h3>Quiz da tempestade</h3><p>Seis perguntas preservadas sobre o capítulo 1.</p></span><b>Quiz</b></button><button class="game-mode" data-go="game"><span class="icon">ϟ</span><span><h3>Escolhas sob a chuva</h3><p>Cena alternativa original preservada.</p></span><b>Jogar</b></button></div><div id="gameStage"></div>`;
  function cleanupGame(interrupted = false) {
    if (!gameCleanup) return;
    const cleanup = gameCleanup; gameCleanup = null; cleanup();
    if (interrupted && q("#gameStage")) q("#gameStage").innerHTML = '<p class="notice">Desafio pausado ao sair ou colocar o aplicativo em segundo plano. Toque no modo para iniciar novamente.</p>';
  }
  function race() {
    cleanupGame();
    q("#gameStage").innerHTML = `<div class="section-title"><h2>Fuga de Nerakar</h2><small>toque nas setas</small></div><div class="race"><div class="race-hud"><span id="raceScore">0</span><span id="raceTime">30s</span></div><div class="road"></div><div class="car"></div></div><div class="race-controls"><button id="left" aria-label="Mover para esquerda">←</button><button id="right" aria-label="Mover para direita">→</button></div>`;
    const area = q(".race"), car = q(".car"), scoreLabel = q("#raceScore"), timeLabel = q("#raceTime");
    let lane = 1, score = 0, elapsed = 0, last = 0, spawnElapsed = 0, frame = 0, active = true;
    const obstacles = [];
    const move = (direction) => { if (!active) return; lane = Math.max(0, Math.min(2, lane + direction)); car.style.left = `calc(${30 + lane * 20}% - 22px)`; };
    const key = (event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } };
    q("#left").onclick = () => move(-1); q("#right").onclick = () => move(1);
    document.addEventListener("keydown", key);
    gameCleanup = () => { active = false; cancelAnimationFrame(frame); document.removeEventListener("keydown", key); obstacles.forEach((obstacle) => obstacle.node.remove()); };
    function finish() {
      if (!active) return;
      const previous = state.bestRace; state.bestRace = Math.max(previous, score);
      cleanupGame(); persist();
      // Reward only improvements, avoiding duplicate rewards from the same record.
      if (score > previous) reward(Math.min(100, (score - previous) * 5), "Novo recorde na fuga");
      q("#gameStage").insertAdjacentHTML("beforeend", `<div class="card"><h2>Fim da corrida</h2><p>${score} destroços superados. Recorde: ${state.bestRace}.</p><button class="btn primary" data-play="race">Jogar novamente</button></div>`);
    }
    function tick(now) {
      if (!active || !area.isConnected) return;
      const delta = last ? Math.min(64, now - last) : 0; last = now; elapsed += delta; spawnElapsed += delta;
      timeLabel.textContent = Math.max(0, Math.ceil((30000 - elapsed) / 1000)) + "s";
      if (elapsed >= 30000) { finish(); return; }
      if (spawnElapsed >= 780) {
        spawnElapsed -= 780;
        const node = document.createElement("div"); node.className = "obstacle";
        const obstacle = { node, lane: Math.floor(Math.random() * 3), y: -70 };
        node.style.left = `calc(${30 + obstacle.lane * 20}% - 21px)`; area.append(node); obstacles.push(obstacle);
      }
      for (let index = obstacles.length - 1; index >= 0; index--) {
        const obstacle = obstacles[index]; obstacle.y += delta * (0.145 + elapsed / 300000);
        obstacle.node.style.top = obstacle.y + "px";
        if (obstacle.y > area.clientHeight - 115 && obstacle.y < area.clientHeight - 25 && obstacle.lane === lane) { finish(); return; }
        if (obstacle.y > area.clientHeight) { obstacle.node.remove(); obstacles.splice(index, 1); score++; scoreLabel.textContent = score; }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function puzzle() {
    cleanupGame();
    const icons = ["ϟ", "◈", "⚙", "☄", "ϟ", "◈", "⚙", "☄"];
    for (let index = icons.length - 1; index > 0; index--) { const other = Math.floor(Math.random() * (index + 1)); [icons[index], icons[other]] = [icons[other], icons[index]]; }
    q("#gameStage").innerHTML = `<div class="section-title"><h2>Sinapses</h2><small id="puzzleStatus">0/32 tentativas • 90s</small></div><div class="puzzle-board">${icons.map((_, index) => `<button class="puzzle-card" data-i="${index}" aria-label="Carta ${index + 1}, fechada"></button>`).join("")}</div><p class="small">Abra duas cartas para encontrar um par. Cada primeira vitória concede 80 pontos.</p>`;
    const cards = qa(".puzzle-card"), status = q("#puzzleStatus");
    let active = true, opened = [], matched = 0, attempts = 0, seconds = 90, timeout = 0;
    const timer = setInterval(() => { if (!active) return; seconds--; paint(); if (seconds <= 0) finish(false); }, 1000);
    gameCleanup = () => { active = false; clearInterval(timer); clearTimeout(timeout); cards.forEach((card) => { card.onclick = null; }); };
    function paint() { status.textContent = `${attempts}/32 tentativas • ${seconds}s`; }
    function finish(won) {
      if (!active) return;
      cleanupGame();
      cards.forEach((card) => { card.disabled = true; });
      if (won && !state.puzzle) { state.puzzle = true; persist(); reward(80, "Sinapses restauradas"); }
      q("#gameStage").insertAdjacentHTML("beforeend", `<div class="card"><h2>${won ? "Sinapses restauradas" : "Tempo ou tentativas esgotados"}</h2><p>${matched / 2}/4 pares encontrados em ${attempts} tentativas.</p><button class="btn primary" data-play="puzzle">Jogar novamente</button></div>`);
    }
    cards.forEach((card, index) => {
      card.onclick = () => {
        if (!active || opened.length === 2 || card.classList.contains("open") || card.classList.contains("done")) return;
        card.textContent = icons[index]; card.classList.add("open"); card.setAttribute("aria-label", `Carta ${index + 1}: ${icons[index]}`); opened.push({ card, index });
        if (opened.length !== 2) return;
        attempts++; paint();
        const pair = [...opened];
        timeout = setTimeout(() => {
          if (!active) return;
          if (icons[pair[0].index] === icons[pair[1].index]) {
            pair.forEach(({ card: matchedCard }) => { matchedCard.classList.remove("open"); matchedCard.classList.add("done"); matchedCard.disabled = true; }); matched += 2;
          } else pair.forEach(({ card: hiddenCard, index: hiddenIndex }) => { hiddenCard.classList.remove("open"); hiddenCard.textContent = ""; hiddenCard.setAttribute("aria-label", `Carta ${hiddenIndex + 1}, fechada`); });
          opened = [];
          if (matched === icons.length) finish(true); else if (attempts >= 32) finish(false);
        }, 650);
      };
    });
  }
  function screenChanged(id) {
    if (!id || id === currentScreen) return;
    const previous = currentScreen; currentScreen = id;
    if (previous === "arcade") cleanupGame(true);
    if (previous === "chapterReader") { stopSpeech(); persist(); }
    if (id === "characters") renderCodex();
    if (id === "profile") profilePaint();
    if (id === "story") renderStoryLibrary();
  }
  document.addEventListener("click", (event) => {
    const chapter = event.target.closest("[data-chapter]"); if (chapter) { openChapter(Number(chapter.dataset.chapter)); return; }
    const character = event.target.closest("[data-char]"); if (character) { showChar(character.dataset.char); return; }
    const play = event.target.closest("[data-play]");
    if (play) { if (currentScreen !== "arcade") navigate("arcade"); play.dataset.play === "race" ? race() : puzzle(); q("#gameStage").scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (event.target.closest("#quizNext")) {
      const result = q("#quizQuestion")?.textContent.match(/Você acertou (\d+) de (\d+)/);
      if (result && Number(result[1]) >= 4 && !state.quiz) { state.quiz = true; persist(); reward(60, "Memória da tempestade"); }
    }
  });
  document.addEventListener("sinapse:navigate", (event) => screenChanged(event.detail?.id));
  // Observe only page class changes. Internal animation classes cannot rebuild a screen.
  const observer = new MutationObserver((changes) => {
    if (changes.some((change) => change.target.classList.contains("page"))) screenChanged(q(".page:not(.hidden)")?.id);
  });
  qa(".page").forEach((page) => observer.observe(page, { attributes: true, attributeFilter: ["class"] }));
  function pause() { persist(); stopSpeech(); cleanupGame(true); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  document.addEventListener("sinapse:pause", pause);
  window.addEventListener("pagehide", pause);
  window.SinapseApp = { toast, reward, navigate, getChapters: () => chapters.map((chapter) => ({ ...chapter, pages: [...chapter.pages], images: chapter.images.map((image) => ({ ...image })) })), characters: chars, state, save: persist, openChapter };
  // NativeLifecycle is also called before the WebView enters the background.
  const previousNativeSave = window.SinapseNativeLifecycle?.save;
  window.SinapseNativeLifecycle = { ...(window.SinapseNativeLifecycle || {}), save() { pause(); if (typeof previousNativeSave === "function") previousNativeSave(); } };
  renderStoryLibrary(); renderCodex(); profilePaint(); refreshHome();
  document.dispatchEvent(new CustomEvent("sinapse:ready", { bubbles: true, detail: { app: window.SinapseApp } }));
  loadBook();
})();
