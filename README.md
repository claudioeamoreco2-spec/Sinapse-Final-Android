# Sinapse Final — Ecos de Nerakar

Aplicativo Android offline, recuperado do commit `c440b7a2fcbf26dfe87179ac30a7f4c25c3967da`. Mantém o pacote e a origem do WebView para preservar o progresso existente. Fontes da atualização: versão 3.4.0, Android mínimo 6, alvo Android 15.

## Conteúdo disponível

Os capítulos integrais **1 a 12** foram preservados, assim como todas as imagens originais. O leitor oferece páginas, retomada da leitura, marca-texto, comentários locais, narração e três novas ilustrações por capítulo disponível. Os capítulos **13 a 24 estão pendentes**, porque seus textos não estavam nos arquivos acessíveis. O título reservado do capítulo 24 é **Ecos de Aço e Sangue**.

Na tela História, importe um JSON do autor no formato abaixo. Textos existentes não podem ser sobrescritos. Também existe importação de JSON ou pasta de TXT/MD pelo script `scripts/import_chapters.py`.

```json
{"chapters":[{"number":16,"title":"Título original do autor","text":"Texto integral original do autor"}]}
```

```sh
python3 scripts/import_chapters.py texto-do-autor.json --dry-run
python3 scripts/import_chapters.py texto-do-autor.json
```

O primeiro comando verifica a entrada. O segundo salva uma cópia do arquivo anterior e incorpora somente os novos capítulos. O exemplo acima descreve o formato; não é conteúdo do livro.

## Exploração e fazenda

Nerakar reúne sete biomas num mapa de 56 × 48 terrenos, recursos, quatro culturas com rega, calendário/estações/clima, comércio, amizade, ferramentas, equipamentos, construções, combate, moradores, missões e um bestiário com 24 criaturas ilustradas. A expansão usa a rotina de fazenda como referência, com identidade, arte e diálogos próprios de Sinapse Final.

No celular, use o direcional e os botões de ação. No computador, use WASD/setas, E para coletar, F para conversar e Espaço para atacar. Inventário, receitas, construções, missões e cultivo ficam nas abas do RPG. O salvamento é automático; o botão Salvar cria uma gravação imediata.

Na tela Perfil, **Exportar progresso** guarda leitura, comentários, marcações, jogos e RPG num único JSON. **Restaurar progresso** importa esse arquivo, valida as chaves e recarrega o aplicativo. No Android, o seletor de documentos permite escolher o destino sem permissões gerais de armazenamento.

## Validação e compilação

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/check_android_core.py
node --test tests/*.cjs
python3 scripts/generate_soundtrack.py
python3 scripts/verify_project.py
```

O workflow `.github/workflows/build-android.yml` executa ainda testes reais da interface no Chromium, lint e compilação do APK, verificação de assinatura e testes de WebView nos Android 13, 14 e 15. Preparar o workflow não comprova sua execução: consulte o resultado da execução correspondente.

Instruções de SDK, assinatura e testes: [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md). Histórico de recuperação, arquivos inacessíveis e pendências: [docs/RECUPERACAO_E_PENDENCIAS.md](docs/RECUPERACAO_E_PENDENCIAS.md).
