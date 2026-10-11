# Recuperação e pendências verificadas

## Origem e preservação

Projeto recuperado do GitHub `claudioeamoreco2-spec/Sinapse-Final-Android`, commit `c440b7a2fcbf26dfe87179ac30a7f4c25c3967da` (versão 3.3). Todos os 55 arquivos recuperados foram comparados com os tamanhos e hashes Git originais. Antes de alterar qualquer fonte, foi criado `Sinapse_Final_Backup_c440b7a2.zip`, SHA-256 `4f49448cedfd611c42926b0d426adef4f8fed3a7a818f7cdfdcf7831fbd59607`.

O arquivo original `app/src/main/assets/chapters.json` tem 300.003 bytes e SHA-256 `57b9fd968d82567872cca184d7e314a040b7f33e8f431f17c7f241b408df1646`. Seus 12 capítulos não foram reescritos. O manifesto `recovery/source-manifest.json` guarda os hashes originais, inclusive os capítulos e as 39 imagens preexistentes. `scripts/verify_project.py` verifica a preservação, as novas ilustrações e os recursos referenciados.

## Última execução anterior

Não existem nesta sessão o processo Python anterior, seu log ou o código da alteração chamada “Expand World”. Essa expansão não aparece nas sete revisões recuperadas do repositório. Uma execução antiga do workflow do commit original terminou com sucesso, mas isso não comprova a execução de Python mencionada. Portanto, não é possível afirmar se aquela execução terminou ou falhou. O último ponto comprovadamente recuperado é o commit indicado acima.

## Arquivos inacessíveis

Os seguintes links apontam para arquivos de uma sessão anterior e não existem no ambiente atual; `/mnt/data` está ausente:

- `sandbox:/mnt/data/Ecos_de_Nerakar_Expansao_Com_Novos_Capitulos.zip`
- `sandbox:/mnt/data/Sinapse_Final_Codigo_Fonte_Codex.zip`
- `sandbox:/mnt/data/REQUISITOS_EXPANSAO_ECOS_DE_NERAKAR.md`

Somente os capítulos integrais 1 a 12 aparecem no repositório e em seu histórico acessível. Faltam 13, 14, 15 e 16 a 24. Foram mantidas as posições pendentes e o título informado do capítulo 24, “Ecos de Aço e Sangue”. Nenhum texto ou resumo fictício substitui os capítulos ausentes. As ilustrações desses capítulos dependem do texto original. A importação aceita conteúdo do autor sem sobrescrever capítulos existentes.

## Implementação

- Leitor com conteúdo original, páginas, leitura salva, marca-texto, comentários locais seguros, conclusão premiada uma única vez, narração nativa e importação validada.
- Três ilustrações SVG novas por capítulo disponível: 36 cenas com referências a trechos reais. Retratos e imagens preexistentes preservados.
- RPG em `rpg-data.js` (conteúdo e mapa), `rpg-engine.js` (regras e salvamento) e `rpg.js`/`rpg.css` (interface e controles). Sete biomas, coleta renovável, cultivo, criação de itens, equipamentos, construções, combate, missões e moradores. Bestiário com 24 imagens distintas.
- Rotina de fazenda inspirada no ritmo de Stardew Valley, com arte e conteúdo próprios de Nerakar: quatro culturas, regador, calendário, quatro estações, clima, descanso, comércio e amizade com conversa/presente diário. Floresta e campos permitem cuidar da fazenda sem encontros de combate automáticos; caça manual continua disponível.
- Jogos existentes preservados: corrida e memória com limpeza de animações/temporizadores ao sair; narrativa interativa e quiz com retomada de progresso. Códice com os 22 retratos e pesquisa.
- Perfil offline e backup completo de progresso, exportação pelo seletor Android e restauração sem sobrescrita por eventos de pausa/recarregamento.
- Android com SDK alvo 35, tratamento de barras do sistema/teclado, retorno moderno, falhas do renderizador WebView, pausa/retomada, TTS e pontes limitadas ao conteúdo local.

## Limites restantes

Login e comentários online precisam de backend e configuração de autenticação; o repositório não fornece essa infraestrutura. A interface identifica perfil e comentários como locais.

O projeto não contém a chave de assinatura de produção. O APK gerado pela pipeline é de desenvolvimento. Atualizar uma instalação existente assinada com outra chave exige a chave original; preservar o progresso também exige manter os dados do aplicativo ou exportá-los antes de trocar a instalação.

Testes de regras Java/JS, importação e preservação podem executar localmente. Compilação completa, lint, interface Chromium e WebView Android 13/14/15 dependem do resultado real da pipeline, pois o ambiente de recuperação não tem SDK/Gradle e impede abrir sockets do Chromium. Os resultados finais, quando disponíveis, acompanham a entrega; este documento não declara que testes ainda não executados passaram.
