import { LitElement, html, css } from 'lit'
import { projectsStore } from '../services/projects-store.js'

/** Seção "Projetos" do drawer — a lista muda quando o usuário escolhe
 *  propriedades, por isso é um componente com assinatura ao store e não
 *  uma lista fixa de items no createAppShell. */
export class ProjectsNav extends LitElement {
  static properties = { _projects: { state: true } }

  static styles = css`
    :host {
      display: block;
    }
    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin: 0 7px;
    }
  `

  connectedCallback() {
    super.connectedCallback()
    this._unsub = projectsStore.subscribe(({ projects }) => (this._projects = projects))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsub?.()
  }

  render() {
    return html`<md-list>
      <md-list-item type="link" href="#/">
        <md-icon slot="start">dashboard</md-icon>
        Visão geral
      </md-list-item>
      ${this._projects.map(
        (p) => html`<md-list-item type="link" href="#/projeto/${p.propertyId}">
          <span slot="start" class="swatch" style="background:${projectsStore.colorOf(p.propertyId) ?? 'var(--series-other)'}"></span>
          ${p.displayName}
        </md-list-item>`,
      )}
      <md-list-item type="link" href="#/projetos">
        <md-icon slot="start">tune</md-icon>
        Escolher projetos
      </md-list-item>
    </md-list>`
  }
}

customElements.define('projects-nav', ProjectsNav)
