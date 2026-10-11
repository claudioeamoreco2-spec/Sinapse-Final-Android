(() => {
  'use strict';
  const q = (selector) => document.querySelector(selector);
  const notify = (message) => window.SinapseApp?.toast(message);
  const ownedKey = (key) => /^(sf_|sf2_|nerakar[_-])/.test(key);
  function flush() {
    if (window.SinapseRestoring) return;
    window.SinapseApp?.save();
    window.NerakarRPG?.save();
  }
  const previousNativeSave = window.SinapseNativeLifecycle?.save;
  window.SinapseNativeLifecycle = Object.assign(window.SinapseNativeLifecycle || {}, { save() {
    if (window.SinapseRestoring) return;
    if (typeof previousNativeSave === 'function') previousNativeSave();
    flush();
  } });
  window.addEventListener('pagehide', flush);
  window.addEventListener('sinapse:pause', () => {
    flush();
    const audio = q('#soundtrack');
    audio?.pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flush();
      const audio = q('#soundtrack');
      audio?.pause();
    }
  });

  function exportProgress() {
    flush();
    const values = {};
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (ownedKey(key)) values[key] = localStorage.getItem(key);
      }
      const json = JSON.stringify({ format: 'sinapse-final-progress', version: 1, exportedAt: new Date().toISOString(), values }, null, 2);
      if (window.AndroidContent?.exportBackup) {
        window.AndroidContent.exportBackup(json);
        return;
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'Sinapse_Final_Progresso.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Progresso exportado. Guarde o arquivo para restaurar sua leitura.');
    } catch {
      notify('Não foi possível exportar o progresso neste aparelho.');
    }
  }

  async function importProgress(file) {
    if (!file || file.size > 4 * 1024 * 1024) {
      notify('Selecione um backup JSON de até 4 MB.');
      return;
    }
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'sinapse-final-progress' || backup.version !== 1 || !backup.values || typeof backup.values !== 'object' || Array.isArray(backup.values)) throw new Error('Formato inválido');
      const entries = Object.entries(backup.values);
      if (entries.length > 2000 || entries.some(([key, value]) => !ownedKey(key) || typeof value !== 'string')) throw new Error('Dados inválidos');
      // Validate all entries before writes; roll back the whole import on quota failure.
      const previous = entries.map(([key]) => [key, localStorage.getItem(key)]);
      window.SinapseRestoring = true;
      try {
        for (const [key, value] of entries) localStorage.setItem(key, value);
      } catch (error) {
        for (const [key] of previous) localStorage.removeItem(key);
        for (const [key, value] of previous) {
          if (value !== null) localStorage.setItem(key, value);
        }
        throw error;
      }
      location.reload();
    } catch {
      window.SinapseRestoring = false;
      notify('Backup inválido ou sem espaço. O progresso anterior foi preservado.');
    }
  }

  function install() {
    const menu = q('#home .main-menu');
    if (menu && !q('#home [data-go="rpg"]')) {
      const explore = document.createElement('button');
      explore.className = 'menu-btn world-link';
      explore.dataset.go = 'rpg';
      explore.textContent = 'Explorar Nerakar';
      menu.insertBefore(explore, menu.children[1] || null);
    }
    if (menu && !q('#home [data-go="bestiary"]')) {
      const bestiary = document.createElement('button');
      bestiary.className = 'menu-btn';
      bestiary.dataset.go = 'bestiary';
      bestiary.textContent = 'Bestiário';
      menu.append(bestiary);
    }
    const profile = q('#profile');
    if (profile && !q('#progressBackup')) {
      const panel = document.createElement('section');
      panel.id = 'progressBackup';
      panel.className = 'card';
      panel.innerHTML = '<h2>Seu progresso</h2><p class="small">Leitura, anotações, jogos e mundo de Nerakar ficam neste aparelho. Exporte um backup antes de trocar de celular.</p><div class="backup-controls"><button type="button" class="btn alt" id="exportProgress">Exportar progresso</button><label class="btn alt">Restaurar backup<input class="backup-file" type="file" id="importProgress" accept="application/json,.json"></label></div>';
      profile.append(panel);
      q('#exportProgress').addEventListener('click', exportProgress);
      q('#importProgress').addEventListener('change', (event) => importProgress(event.target.files[0]));
    }
    window.NerakarRPG?.init();
  }
  window.addEventListener('sinapse:ready', install);
  window.addEventListener('sinapse:export', (event) => {
    if (event.detail === 'saved' || event.detail?.state === 'saved' || event.detail?.status === 'saved') notify('Backup salvo.');
    else if (event.detail === 'error' || event.detail?.state === 'error' || event.detail?.status === 'error') notify('Não foi possível salvar o backup.');
  });
  install();
})();
