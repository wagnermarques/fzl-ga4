# GA4 Projetos (`fzl-ga4`)

Painel PWA que centraliza as métricas do **Google Analytics 4** de múltiplos projetos em um só lugar: visão geral comparativa lado a lado, detalhe por projeto, explorador de dimensões e usuários em tempo real.

Construído sobre o monorepo [fzl-fund-ui](https://github.com/wagnermarques/fzl-fund-ui.git) (`fzl-fund-appshell--lit` + `@fzl/webcomponents-lit` + `@fzl/design-tokens`), integrado como **submódulo git** em `fzl-fund-ui/` e **npm workspaces**, combinando a arquitetura de autenticação direta via navegador com os gráficos interativos **Plotly.js** e relatórios multidimensionais inspirados no [bi_static_dashboards](https://git.unesp.br/outros-locais/ead/bi_static_dashboards).

## Como os dados são lidos

Sem backend: o próprio navegador solicita à sua conta Google permissão **somente leitura** (`analytics.readonly`) via Google Identity Services (OAuth2) e consulta diretamente as APIs do Google:

- **Analytics Admin API**: lista todas as contas e propriedades GA4 que a conta Google enxerga;
- **Analytics Data API**: `batchRunReports` (KPIs com variação contra o período anterior, séries diárias e rankings Top 15 por dimensão) e `runRealtimeReport` (usuários ativos nos últimos 30 minutos).

O token de acesso dura ~1h apenas em `sessionStorage`. As respostas dos relatórios ficam em cache no `localStorage` para uso **offline** com indicação do horário da coleta.

## Configuração do Google Cloud (uma vez)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou selecione um projeto.
2. **APIs e serviços → Biblioteca**: ative **Google Analytics Data API** e **Google Analytics Admin API**.
3. **Tela de permissão OAuth**: adicione o escopo `.../auth/analytics.readonly`.
4. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Em *Origens JavaScript autorizadas*, inclua:
   - `http://localhost:5173` (dev) e `http://localhost:4173` (preview);
   - a origem de produção (ex.: `https://wagnermarques.github.io`).
5. Copie o ID do cliente para `.env.local`:

   ```sh
   cp .env.example .env.local
   # VITE_GOOGLE_OAUTH_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   ```

## Rodando

```sh
git clone --recurse-submodules <este repo>   # ou: git submodule update --init
npm install
npm run dev        # http://localhost:5173
npm test
npm run build && npm run preview
```

## Telas e Recursos

| Rota | Tela |
|---|---|
| `#/` | **Visão geral**: KPIs consolidados de todos os projetos selecionados, usuários ativos em tempo real (30 min), série temporal comparativa por projeto (Plotly ou SVG) e cartões individuais por propriedade |
| `#/projeto/:id` | **Detalhe do projeto**: 5 KPIs com variação vs período anterior, gráfico diário combinado (*Resumo Geral*: barras de Sessões + linhas de Usuários e Visualizações), **Explorador de Dimensões** (*Geográfico*, *Dispositivos*, *Tráfego*, *Páginas e Telas*) em Top 15 horizontal e rankings rápidos |
| `#/projetos` | **Gerenciar projetos**: descoberta automática das propriedades da conta Google, filtro de busca e reordenação drag-and-drop / teclado via `<fzl-lit-card-list>` |
| `#/config/*` | **Configurações do AppShell**: temas (`light`, `dark`, `high-contrast-light`, `high-contrast-dark`), fontes de acessibilidade (`Atkinson Hyperlegible`, `OpenDyslexic`), escala de texto e idioma (`pt-BR`, `en-US`, `es-ES`) |

## Estrutura

```
fzl-fund-ui/              submódulo git (appshell-lit + @fzl/webcomponents-* + @fzl/design-tokens)
appshell.config.js        configuração declarativa do AppShell, temas, acessibilidade e PWA
src/
  main.js                 createAppShell({ routes, drawer, headerActions })
  format.js               formatação pt-BR (números, durações, datas e ticks)
  services/
    google-auth-service.js  token OAuth2 (GIS) em sessionStorage
    ga4-client.js           Admin API + Data API com cache offline em localStorage
    reports.js              builders de queries GA4 e normalizadores puros (testados com Vitest)
    projects-store.js       projetos selecionados, período (7/28/90d) e motor gráfico (plotly/svg)
  webcomponents/          views e componentes de visualização (<ga4-plotly-chart>, <ga4-line-chart>, <ga4-stat-tile>, <ga4-bar-list>)
  styles/charts.css       paleta categórica validada para daltonismo e temas claro/escuro/alto contraste
```

Atualizar o submódulo `fzl-fund-ui`: `git submodule update --remote fzl-fund-ui`.
