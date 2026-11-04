import { html } from 'lit'
import 'fzl-fund-appshell--lit/styles/theme.css'
import './styles/charts.css'
import { createAppShell, pattern } from 'fzl-fund-appshell--lit'
import { projectsStore } from './services/projects-store.js'
import './webcomponents/ga4-md-imports.js'
import './webcomponents/ga4-line-chart.js'
import './webcomponents/ga4-plotly-chart.js'
import './webcomponents/ga4-stat-tile.js'
import './webcomponents/ga4-bar-list.js'
import './webcomponents/period-picker.js'
import './webcomponents/google-connect-button.js'
import './webcomponents/projects-nav.js'
import './webcomponents/overview-view.js'
import './webcomponents/project-detail-view.js'
import './webcomponents/projects-manage-view.js'

createAppShell({
  mount: '#app',
  title: 'GA4 Projetos',
  home: () => html`<overview-view></overview-view>`,
  routes: [
    {
      name: 'projeto',
      match: pattern('projeto/:id'),
      title: ({ params }) => projectsStore.find(params.id)?.displayName ?? `Propriedade ${params.id}`,
      crumb: ({ params }) => [
        { label: 'Projetos', href: '#/projetos' },
        { label: projectsStore.find(params.id)?.displayName ?? `Propriedade ${params.id}` },
      ],
      render: ({ params }) => html`<project-detail-view .propertyId=${params.id}></project-detail-view>`,
    },
    {
      name: 'projetos',
      match: pattern('projetos'),
      title: 'Escolher projetos',
      crumb: [{ label: 'Escolher projetos' }],
      render: () => html`<projects-manage-view></projects-manage-view>`,
    },
  ],
  drawer: {
    sections: [{ id: 'projetos', label: 'Projetos', expanded: true, render: () => html`<projects-nav></projects-nav>` }],
    // As contas locais do appshell não servem a este app: o acesso aos
    // dados é pela conta Google (botão no cabeçalho). Mantemos Config ativo
    // para temas (claro/escuro/alto contraste), fontes de acessibilidade e idioma.
    shellSections: { conta: false, config: true },
  },
  headerActions: () => html`<google-connect-button></google-connect-button>`,
})
