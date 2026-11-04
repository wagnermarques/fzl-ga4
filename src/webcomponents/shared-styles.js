import { css } from 'lit'

/** Layout comum das telas do painel. */
export const viewStyles = css`
  :host {
    display: block;
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px 16px 72px;
  }
  h1 {
    font-size: 1.5rem;
    margin: 0;
  }
  h2 {
    font-size: 1rem;
    font-weight: 500;
    margin: 0 0 12px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin: 12px 0 16px;
  }
  .toolbar .spacer {
    flex: 1;
  }
  .meta {
    font-size: 0.8rem;
    color: var(--md-sys-color-on-surface-variant);
  }
  .card {
    background: var(--md-sys-color-surface);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 16px;
    min-width: 0;
  }
  .grid {
    display: grid;
    gap: 16px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }
  .loading {
    transition: opacity 0.2s;
  }
  .loading[data-busy] {
    opacity: 0.5;
  }
  md-linear-progress {
    width: 100%;
    --md-linear-progress-track-height: 2px;
    --md-linear-progress-active-indicator-height: 2px;
  }
  .notice {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
    margin-bottom: 16px;
  }
  .notice.error {
    background: color-mix(in srgb, var(--md-sys-color-error) 14%, var(--md-sys-color-surface));
    color: var(--md-sys-color-on-surface);
  }
  .notice p {
    margin: 0 0 8px;
  }
  .notice p:last-child {
    margin: 0;
  }
  a {
    color: var(--md-sys-color-primary);
  }
  code {
    background: var(--md-sys-color-surface-variant);
    padding: 1px 4px;
    border-radius: 4px;
  }
`
