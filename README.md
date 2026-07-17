# Stickman Runner

Um platformer/runner em 2D feito com **Phaser 3**, para *Tecnologias
Multimédia* TP2 (**época de recurso**).

**Autores:**
- João Fernandes: número de aluno 29964
- Gabriel Banks: número de aluno 29730

## Descrição do jogo

Guia um stickman ao longo de níveis criados por jogadores.

O projeto inclui também um **editor de níveis** (`editor.html`) usado para construir os
níveis/campanhas que vêm com o jogo 

ver [Editor de níveis](#editor-de-níveis) abaixo.

## Controlos

| Ação | Teclas |
|---|---|
| Mover esquerda / direita | Setas ou `A` / `D` |
| Saltar | Seta para cima ou `Space` |
| Pausar | Esc / botão de pausa (durante o jogo) |
| Recomeçar após game over | `R` ou o botão no ecrã |

## Como executar

O jogo tem de ser servido via HTTP (não abrir como um URL `file://`), pois carrega manifests
JSON, dados dos níveis, e ficheiros de tradução através de `fetch`.

```bash
npm install
npm start
```

Isto corre `serve -l 5500 .` e serve a raiz do projeto. Depois abrir:

- `http://localhost:5500/index.html` o jogo
- `http://localhost:5500/editor.html` o editor de níveis

## Versão do Phaser

**Phaser 3.80.1**, carregado via tag `<script>` de CDN em `index.html`/`editor.html`
(`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`)
 não é necessário nenhum bundler/passo de build; o código do jogo em si é composto por módulos ES simples
(`type="module"`) carregados diretamente dentro do browser.

## Funcionalidades

- **Física**: "Arcade Physics" (gravidade, movimento orientado por velocidade,
  `collider`/`overlap`) controla o jogador, plataformas móveis, obstáculos, e inimigos.
- **Renderização procedural do jogador**: o stickman é um `Phaser.GameObjects.Container` que
  transporta o corpo físico diretamente; a sua pose (parado/a correr/a saltar) é redesenhada a
  cada frame a partir de ângulos dos membros, em vez de usar frames pré-desenhados de um
  spritesheet, isto para reduzir no workload do projeto.
- **Inimigos**: vários tipos de inimigos com comportamentos distintos (patrulha/perseguição/
  falso amigo/obstáculo).
- **Internacionalização**: interface completa em **Inglês e Português** através de
  `src/i18n.js`, sem strings fixas no código das cenas; a escolha de idioma mantém-se após
  recarregar a página.
- **Áudio**: efeitos sonoros de salto/vitória/derrota controlados por um pequeno manifest de
  nome-de-evento → ficheiro (`assets/audio/sound-events.json`), pelo que adicionar um som é
  apenas uma edição de JSON + largar um ficheiro.
- **Editor de níveis**: um editor no browser (`editor.html`) para construir secções de nível
  baseadas em tiles, organizá-las em níveis/campanhas
  tudo guardado localmente no browser via IndexedDB, sem necessidade de backend no servidor.
- **Interface localizada e responsiva**: os ecrãs de menu, pausa, e fim de jogo são overlays em
  HTML sobrepostos à canvas do Phaser, pelo que escalam/redimensionam de forma independente da
  vista do jogo.

## Ficheiros multimédia

| Tipo | Ficheiros | Formato | Origem |
|---|---|---|---|
| Áudio | `assets/audio/{jump,win,lose}.ogg` | OGG Vorbis, ~4–8 KB cada | Sintetizados pelos autores (geração de tons/sweeps), sem questões de licenciamento |
| Imagens | `assets/images/*.png` | PNG | Camadas de parallax de fundo e texturas de plataformas criadas para este projeto |
| Níveis/traduções | `assets/levels/*.json`, `src/locales/{en,pt}.json` | JSON | Criados pelos autores para este projeto |

O tamanho total da pasta `assets/` é bem inferior a 1 MB; os clipes de áudio são efeitos curtos
de disparo único (não música de fundo), e as imagens são texturas pequenas de tiles/fundo,
mantendo os tempos de carregamento desprezáveis num servidor local.

## Estrutura do projeto

```
2026-tm-2026eprecurso/
├── index.html            # ponto de entrada do jogo
├── editor.html            # ponto de entrada do editor de níveis/campanhas
├── package.json
├── src/
│   ├── main.js             # configuração do Phaser, registo de cenas
│   ├── i18n.js              # helper de traduções (t(key), setLanguage())
│   ├── locales/             # en.json, pt.json
│   ├── entities/            # Stickman + classes de inimigos
│   ├── audio/                # SoundManager (sistema nome-de-evento -> ficheiro de som)
│   ├── scenes/               # Boot, Preload, Menu, Game, GameOver
│   ├── world/                # carregamento de níveis/secções, parallax + texturas de tiles
│   ├── data/                 # wrapper de IndexedDB + (de)serialização de assets
│   └── editor/                # lógica do editor de níveis (UI, pintura, inspector, etc.)
└── assets/
    ├── images/                # fundos, texturas de plataformas
    ├── audio/                 # sound-events.json + clipes OGG
    └── levels/                # dados JSON de níveis/secções
```

## Editor de níveis

`editor.html` é uma ferramenta independente para construir o conteúdo do jogo:
pintar secções de nível baseadas em tiles, encadear secções em níveis e níveis em campanhas,
configurar a aparência dos tiles.
Tudo é guardado no lado do cliente, no IndexedDB do browser (base de dados nome `stickman-editor`)
não há armazenamento do lado do servidor envolvido,  e uma campanha pode ser exportada para um único
ficheiro JSON para backup ou partilha.
O menu principal do jogo lê as campanhas diretamente da mesma base IndexedDB,
pelo que tudo o que for construído no editor fica imediatamente jogável a partir de `index.html`.
