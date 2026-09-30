import { Icon, copyText, useToast } from '../../components/ui'
import type { Client } from '../../lib/types'

/** Polecenia dla Claude do przygotowania dokumentów prawnych (tylko panel administratorki) */
export default function LegalCommands({ client }: { client: Client }) {
  const toast = useToast()
  const commands: Array<[string, string, string]> = [
    [
      'Dla obecnej strony',
      'Szybkie zabezpieczenie prawne strony, która działa teraz, na czas projektowania nowej.',
      `Przygotuj dokumenty prawne dla obecnej strony klienta ${client.slug} (NAFU Brief).`,
    ],
    [
      'Dla nowej strony',
      'Pełny komplet dokumentów pod nowy projekt.',
      `Przygotuj dokumenty prawne dla nowej strony klienta ${client.slug} (NAFU Brief).`,
    ],
  ]
  return (
    <div className="script-note">
      <div>
        <strong>Dokumenty prawne przygotujesz w Claude, z Twoimi skillami prawnymi</strong>
        <p>
          Skopiuj polecenie i wklej je w Claude (projekt nafu-brief). Claude pobierze ankietę prawną, profil, salony, zespół i usługi klienta, przygotuje dokumenty na Twoich skillach i doda je tutaj jako <b>niewidoczne dla klienta</b>, z notatką wewnętrzną o brakach. Po sprawdzeniu klikasz „Udostępnij klientowi”.
        </p>
        <div className="cmd-list">
          {commands.map(([label, hint, cmd]) => (
            <div className="cmd" key={label}>
              <div>
                <strong>{label}</strong>
                <span className="muted">{hint}</span>
                <code className="script-code">{cmd}</code>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => copyText(cmd).then(() => toast('Skopiowano polecenie'))}>
                <Icon name="copy" size={15} /> Kopiuj
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
