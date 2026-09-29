import { Link } from 'react-router-dom'
import { Icon, TEMPLATE_COLORS, TEMPLATE_LETTER } from '../../components/ui'
import { TEMPLATES } from '../../templates'

export default function Templates() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Biblioteka</div>
          <h1>Szablony ankiet</h1>
          <p className="muted" style={{ margin: '8px 0 0', maxWidth: '70ch' }}>
            Każdy nowy klient dostaje kopię wybranych szablonów, którą możesz dowolnie edytować. Szablony bazowe zmienisz w plikach <code>src/templates/*.ts</code>.
          </p>
        </div>
      </div>
      <div className="card">
        {TEMPLATES.map((t) => {
          const qs = t.schema.sections.reduce((n, s) => n + s.questions.length, 0)
          return (
            <div className="brief-row" key={t.key}>
              <div className="brief-icon" style={{ background: TEMPLATE_COLORS[t.key] }}>
                {TEMPLATE_LETTER[t.key]}
              </div>
              <div>
                <h3>{t.title}</h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14.5 }}>{t.description}</p>
                <div className="meta">
                  <span>{t.schema.sections.map((s) => s.title).join(' · ')}</span>
                </div>
                <div className="meta">
                  <span>
                    {t.schema.sections.length} części · {qs} pytań · ok. {t.minutes} min
                  </span>
                </div>
              </div>
              <div className="actions">
                <Link className="btn btn-sm" to={`/panel/szablony/${t.key}/podglad`}>
                  <Icon name="eye" size={15} /> Podgląd
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
