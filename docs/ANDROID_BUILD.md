# Compilação e validação Android

A aplicação mantém o pacote `com.sinapsefinal.leitor` e a origem `file:///android_asset/index.html`, para preservar os dados de leitura e jogos existentes no WebView. A versão atual das fontes é `3.4.0` (`versionCode 9`), com `minSdk 23` e `compileSdk/targetSdk 35`.

## Compilar

Pré-requisitos: JDK 17 completo, Gradle 8.9, Android SDK Platform 35 e Build Tools 35.0.0. O repositório original não tinha Gradle wrapper; os comandos abaixo usam a distribuição Gradle instalada. Não há chave de assinatura de produção no projeto.

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/check_android_core.py
node --test tests/*.cjs
python3 scripts/generate_soundtrack.py
python3 scripts/verify_project.py
python3 -m pip install playwright
python3 scripts/test_browser.py --browser /usr/bin/google-chrome
gradle :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --stacktrace
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose app/build/outputs/apk/debug/app-debug.apk
```

O APK de desenvolvimento fica em `app/build/outputs/apk/debug/app-debug.apk`. Uma instalação anterior com outra chave de assinatura não pode receber uma atualização desse APK; preserve/exporte o progresso antes de qualquer troca de instalação. Produzir uma atualização assinada para os usuários existentes exige a chave de produção original.

## Pipeline preparado

`.github/workflows/build-android.yml` roda em pushes para `main`/`codex/**`, pull requests e acionamento manual. Verifica importação, preservação das fontes/imagens, módulos Java/JS, interface no Chromium, lint Android, compilação e assinatura. Publica um artifact de APK Debug somente após esses passos passarem.

Um job separado executa testes instrumentados no WebView real em emuladores API 33, 34 e 35 (Android 13, 14 e 15). Os testes confirmam carregamento dos capítulos offline, disponibilidade das pontes nativas, bloqueio de rede e persistência após background/recriação da Activity. Relatórios e capturas do browser são artifacts separados.

Preparar um workflow ou teste não significa que ele executou. Consulte o resultado de cada execução antes de afirmar compatibilidade ou entregar um APK.

## Integração WebView

- `AndroidContent.readChapters()` retorna somente o arquivo fixo `assets/chapters.json`. Resolve o carregamento offline sem liberar `fetch` de arquivos privados.
- `AndroidContent.exportBackup(json)` aceita um objeto JSON de até 4 MiB e abre o seletor de destino do Android. A gravação roda fora da thread da interface; `sinapse:export` informa `saved`, `cancelled` ou `error`.
- Campos de importação `.json` usam o seletor de arquivos do sistema. Não exigem permissões gerais de armazenamento.
- Os eventos `sinapse:pause`, `sinapse:resume` e `sinapse:save` são disparados no document com propagação para window. O hook `SinapseNativeLifecycle.save()` permite salvar antes da pausa.
- `AndroidVoice` aguarda a inicialização/idioma português do TTS, preserva o texto em blocos válidos e cancela narração ao sair do aplicativo.
- Apenas assets locais carregam no WebView com pontes nativas. Links HTTPS abrem no navegador externo; o aplicativo continua offline, sem login ou backend de comentários.

## Limites desta sessão

Os testes Java puros foram executados localmente (1.931 verificações). XML e YAML foram analisados. O ambiente local não dispõe de Gradle, Android SDK, adb ou emulador e o proxy de downloads não estava acessível; por isso a compilação do MainActivity contra o SDK, lint Android e testes instrumentados dependem do resultado real do pipeline. O módulo `jdk.compiler` está disponível localmente, mesmo sem o executável `javac`, e permite testar os helpers Java.
