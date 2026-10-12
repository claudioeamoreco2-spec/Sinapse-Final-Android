#!/usr/bin/env python3
"""Functional tests of the same offline assets loaded by Android's WebView."""
import argparse
from functools import partial
import http.server
import json
from pathlib import Path
import shutil
import threading
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def run(browser_path):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'app/src/main/assets')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    output = ROOT / 'qa-output'
    output.mkdir(exist_ok=True)
    url = 'http://127.0.0.1:' + str(server.server_port) + '/index.html'
    errors, missing, results = [], [], []
    failure = None
    page = None
    passed = False
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=browser_path, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: missing.append(response.url) if response.status >= 400 else None)
            page.goto(url)
            page.wait_for_function('window.SinapseApp && window.SinapseApp.getChapters().length === 12')
            assert page.title() == 'Sinapse Final — Ecos de Nerakar'
            page.locator('nav [data-go="story"]').click()
            assert page.locator('#story [data-chapter]').count() == 12
            assert 'Ecos de Aço e Sangue' in page.locator('#story').inner_text()
            originals = page.evaluate('SinapseApp.getChapters().map(c=>({number:c.number,title:c.title,text:c.text,pages:c.pages}))')
            page.locator('#story [data-chapter="1"]').click()
            page.wait_for_selector('#chapterPageText')
            page.evaluate("""() => {const text=document.querySelector('#chapterPageText'); const node=text.firstChild; const range=document.createRange(); range.setStart(node,0); range.setEnd(node,Math.min(45,node.textContent.length)); const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range)}""")
            page.locator('#highlightSelection').click()
            assert page.locator('#chapterPageText mark').count() == 1
            xss = '<img src=x onerror="window.__commentXSS=1"> Comentário de teste'
            page.locator('#commentText').fill(xss)
            page.locator('#commentForm [type="submit"]').click()
            assert xss in page.locator('#pageComments').inner_text()
            assert page.evaluate('window.__commentXSS || null') is None
            assert page.locator('#pageComments img').count() == 0
            page.locator('#uNext').click()
            page.reload()
            page.wait_for_function('window.SinapseApp && window.SinapseApp.getChapters().length === 12')
            page.evaluate('SinapseApp.openChapter(1)')
            assert page.evaluate('JSON.parse(localStorage.getItem("sf2_reading"))["1"].page') == 1
            assert 'página 2/6' in page.locator('#chapterReader').inner_text().lower()
            page.locator('#uPrev').click()
            assert page.locator('#chapterPageText mark').count() == 1
            assert xss in page.locator('#pageComments').inner_text()
            page.screenshot(path=str(output / 'reader-mobile.png'), full_page=True)
            for _ in range(5):
                page.locator('#uNext').click()
            before = page.evaluate('SinapseApp.state.points')
            page.locator('#uNext').click()
            after = page.evaluate('SinapseApp.state.points')
            assert after == before + 50
            page.evaluate('SinapseApp.openChapter(1)')
            page.locator('#uNext').click()
            assert page.evaluate('SinapseApp.state.points') == after
            results.append('Leitura/paginação/marca-texto/comentário seguro/persistência/conclusão única')

            page.locator('nav [data-go="story"]').click()
            author_source = {'chapters': [{'number': 16, 'title': 'Fixture de importação de teste', 'text': 'Texto de teste para validação; não é capítulo do autor. ' * 50}]}
            page.locator('#chapterImport').set_input_files({'name': 'fixture.json', 'mimeType': 'application/json', 'buffer': json.dumps(author_source).encode()})
            page.wait_for_function('SinapseApp.getChapters().length === 13')
            assert page.evaluate('SinapseApp.getChapters().filter(c=>c.number<=12).map(c=>({number:c.number,title:c.title,text:c.text,pages:c.pages}))') == originals
            invalid = {'chapters': [{'number': 24, 'title': 'Título inválido', 'text': 'Fixture de teste.'}]}
            page.locator('#chapterImport').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode()})
            expect(page.locator('#importStatus')).to_have_text('O capítulo 24 deve se chamar "Ecos de Aço e Sangue".')
            assert page.evaluate('SinapseApp.getChapters().length') == 13
            page.locator('#chapterImport').set_input_files({'name': 'duplicate.json', 'mimeType': 'application/json', 'buffer': json.dumps(author_source).encode()})
            expect(page.locator('#importStatus')).to_have_text('O capítulo 16 já existe e foi preservado.')
            assert page.evaluate('SinapseApp.getChapters().length') == 13
            page.reload()
            page.wait_for_function('window.SinapseApp && SinapseApp.getChapters().length===13')
            results.append('Importação persistente, duplicatas/título24 recusados e originais intactos')

            page.locator('nav [data-go="arcade"]').click()
            page.locator('[data-play="race"]').first.click()
            page.wait_for_timeout(150)
            page.locator('[data-play="puzzle"]').first.click()
            assert page.locator('.puzzle-card').count() == 8
            assert all(not text.strip() for text in page.locator('.puzzle-card').all_text_contents())
            page.locator('.puzzle-card').nth(0).click()
            page.locator('.puzzle-card').nth(1).click()
            page.locator('nav [data-go="rpg"]').click()
            page.wait_for_timeout(700)
            assert not errors, errors
            results.append('Corrida/memória e troca de telas sem callbacks obsoletos')
            page.locator('nav [data-go="characters"]').click()
            page.locator('#codexSearch').fill('Caleb')
            # Search also includes roles: Sael is identified as Caleb's father.
            expect(page.locator('#codexResults [data-char]')).to_have_count(2)
            assert sorted(page.locator('#codexResults [data-char]').evaluate_all('(cards) => cards.map(card => card.dataset.char)')) == ['caleb', 'sael']
            page.locator('#codexSearch').fill('')
            expect(page.locator('#codexResults [data-char]')).to_have_count(22)
            results.append('Códice: 22 retratos preservados e busca funcional')

            page.locator('nav [data-go="rpg"]').click()
            page.wait_for_function('window.NerakarRPG && window.NerakarRPG.getGame()')
            assert page.locator('#rpg canvas').count() >= 1
            starting_y = page.evaluate('NerakarRPG.getGame().state.player.y')
            page.locator('#rpg [data-direction="down"]').click()
            assert page.evaluate('NerakarRPG.getGame().state.player.y') == starting_y + 1
            page.locator('#rpg [data-rpg-panel="build"]').click()
            page.locator('#rpg-buildings .rpg-option').filter(has_text='Acampamento').get_by_role('button', name='Construir aqui', exact=True).click()
            assert page.evaluate('Object.values(NerakarRPG.getGame().state.buildings).some(b=>b.type==="camp")')
            page.locator('#rpg [data-rpg-panel="inventory"]').click()
            assert 'Espada simples' in page.locator('#rpg-inventory').inner_text()
            assert 'Regador' in page.locator('#rpg-inventory').inner_text()
            first_day = page.evaluate('NerakarRPG.getGame().calendar().day')
            page.locator('#rpg-rest').click()
            expect(page.locator('#rpg-day')).to_have_text(f'Dia {first_day + 1}')
            for direction in ['down', 'down', 'right']:
                page.locator(f'#rpg [data-direction="{direction}"]').click()
            assert page.evaluate('NerakarRPG.getGame().state.player.x === 25 && NerakarRPG.getGame().state.player.y === 23')
            page.locator('#rpg [data-rpg-panel="people"]').click()
            farm_shop = page.locator('#rpg-shops .rpg-shop').filter(has=page.get_by_role('heading', name='Sementes e colheitas', exact=True))
            wheat_row = farm_shop.locator('.rpg-shop-list').first.locator('.rpg-shop-item').filter(has_text='Sementes de trigo')
            coins_before = page.evaluate('NerakarRPG.getGame().count("coin")')
            seeds_before = page.evaluate('NerakarRPG.getGame().count("wheat_seed")')
            wheat_row.locator('input').fill('2')
            wheat_row.get_by_role('button', name='Comprar', exact=True).click()
            assert page.evaluate('NerakarRPG.getGame().count("coin")') == coins_before - 6
            assert page.evaluate('NerakarRPG.getGame().count("wheat_seed")') == seeds_before + 2
            farmer = page.locator('#rpg-people .rpg-person').filter(has_text='Agricultora')
            farmer.get_by_role('button', name='Conversar', exact=True).click()
            friendship_before = page.evaluate('NerakarRPG.getGame().friendship("farmer").points')
            farmer.locator('select').select_option('food')
            farmer.get_by_role('button', name='Dar presente', exact=True).click()
            assert page.evaluate('NerakarRPG.getGame().friendship("farmer").points') > friendship_before
            expect(farmer.get_by_role('button', name='Presente entregue hoje', exact=True)).to_be_disabled()
            results.append('Fazenda: regador inicial, descanso/calendário, compra de sementes e amizade com limite diário')
            page.locator('#rpg-save-now').click()
            page.screenshot(path=str(output / 'rpg-mobile.png'), full_page=True)
            # Use a gameplay fixture to discover an enemy, then verify that
            # navigation refreshes the already-created bestiary DOM.
            discovered = page.evaluate('''() => {
                const game = NerakarRPG.getGame();
                for (let y = 0; y < NerakarData.height; y++) {
                    for (let x = 0; x < NerakarData.width; x++) {
                        const tile = NerakarData.getTile(x, y);
                        if (tile.biome !== 'forest' || !tile.walkable) continue;
                        Object.assign(game.state.player, {x, y});
                        const result = game.startEncounter('forest_wolf');
                        if (!result.ok) throw new Error(result.message);
                        game.battle('flee');
                        return Object.keys(game.state.discovered).length;
                    }
                }
                throw new Error('Fixture de floresta não encontrada');
            }''')
            page.evaluate('SinapseApp.navigate("bestiary")')
            page.wait_for_selector('#bestiary img')
            assert page.locator('#bestiary img').count() >= 20
            expect(page.locator('#rpg-beast-count')).to_contain_text(f'{discovered}/24 criaturas descobertas')
            expect(page.locator('#rpg-beasts .rpg-beast-card').filter(has_text='Lobo da floresta').locator('.rpg-discovery')).to_have_text('Descoberta')
            page.locator('#bestiary img').evaluate_all('(images) => images.forEach(image => image.loading = "eager")')
            page.wait_for_function('Array.from(document.querySelectorAll("#bestiary img")).every(image => image.complete && image.naturalWidth > 0)')
            page.screenshot(path=str(output / 'bestiary-mobile.png'), full_page=True)
            results.append('RPG: controles/construção/inventário; bestiário atualiza descobertas e carrega pelo menos 20 imagens')
            page.locator('nav [data-go="profile"]').click()
            with page.expect_download() as download_event:
                page.locator('#exportProgress').click()
            download = download_event.value
            backup_path = output / 'progress-roundtrip.json'
            download.save_as(str(backup_path))
            backup = json.loads(backup_path.read_text())
            assert backup['format'] == 'sinapse-final-progress'
            restored_profile = json.loads(backup['values']['sf2_state'])
            restored_profile['name'] = 'Restaurado'
            backup['values']['sf2_state'] = json.dumps(restored_profile)
            restored_reading = json.loads(backup['values']['sf2_reading'])
            restored_reading['1']['page'] = 2
            backup['values']['sf2_reading'] = json.dumps(restored_reading)
            restored_rpg = json.loads(backup['values']['sf_nerakar_rpg_v2'])
            restored_rpg['state']['player'].update({'x': 26, 'y': 20})
            backup['values']['sf_nerakar_rpg_v2'] = json.dumps(restored_rpg)
            with page.expect_navigation(wait_until='load'):
                page.locator('#importProgress').set_input_files({'name': 'restored.json', 'mimeType': 'application/json', 'buffer': json.dumps(backup).encode()})
            page.wait_for_function('window.SinapseApp && SinapseApp.state.name === "Restaurado" && window.NerakarRPG && NerakarRPG.getGame()')
            assert page.evaluate('NerakarRPG.getGame().state.player.x') == 26
            assert page.evaluate('NerakarRPG.getGame().state.player.y') == 20
            page.evaluate('SinapseApp.openChapter(1)')
            assert page.evaluate('JSON.parse(localStorage.getItem("sf2_reading"))["1"].page') == 2
            assert 'página 3/6' in page.locator('#chapterReader').inner_text().lower()
            results.append('Backup completo exporta/restaura leitor e RPG sem ser sobrescrito por pagehide')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Overflow horizontal mobile'
            assert not missing, missing
            assert not errors, errors
            context.close()
            browser.close()
        passed = True
    except Exception as error:
        failure = f'{type(error).__name__}: {error}'
        if page is not None and not page.is_closed():
            try:
                page.screenshot(path=str(output / 'browser-failure.png'), full_page=True, timeout=5000)
            except Exception:
                pass
        raise
    finally:
        report = {'passed': passed, 'checks': results, 'errors': errors, 'missing_resources': missing, 'failure': failure}
        (output / 'browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(report, ensure_ascii=False))
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default=shutil.which('google-chrome') or shutil.which('chromium'))
    args = parser.parse_args()
    if not args.browser:
        raise SystemExit('Chromium/Chrome não encontrado; teste browser não executado.')
    run(args.browser)
