import type { Template } from '../lib/types'
import { area, date, multi, single, text, YES_NO_DONTKNOW } from './builders'

export const technical: Template = {
  key: 'technical',
  title: 'Dział techniczny',
  short: 'Techniczny',
  description: 'Domena, hosting, poczta, obecna strona, konta i integracje. Wszystko, czego potrzebuję do bezpiecznego wdrożenia.',
  intro:
    'Te informacje pozwolą mi zaplanować przeniesienie strony bez przerw w działaniu i bez utraty poczty. Jeśli czegoś nie wiesz, zaznacz „nie wiem”, sprawdzimy to razem.\n\nWażne: nigdy nie wpisuj tutaj haseł. Dostępy przekażemy sobie bezpiecznie, osobno.',
  minutes: 10,
  accent: '#0B6E8A',
  schema: {
    sections: [
      {
        id: 't1',
        title: 'Domena i hosting',
        questions: [
          text('t1_domain', 'Adres obecnej strony (domena)', { placeholder: 'np. twojsalon.pl' }),
          text('t1_registrar', 'U kogo jest domena (adres strony)?', { placeholder: 'np. home.pl, OVH, nazwa.pl, nie wiem' }),
          date('t1_domain_until', 'Do kiedy jest opłacona domena?'),
          text('t1_hosting', 'U kogo jest hosting (serwer, na którym działa strona)?'),
          date('t1_hosting_until', 'Do kiedy trwa umowa na hosting?'),
          text('t1_cost', 'Ile rocznie płacisz za domenę i hosting?', {
            help: 'Potrzebuję tej informacji, żeby zaproponować tańszy odpowiednik.',
          }),
          single('t1_logins', 'Kto ma dane do logowania?', [
            'Ja',
            'Poprzedni wykonawca strony',
            'Informatyk / firma IT',
            'Nie wiem',
          ], { allowOther: true }),
          text('t1_other_domains', 'Czy masz inne domeny (np. stare adresy, inne marki)?'),
        ],
      },
      {
        id: 't2',
        title: 'Poczta e-mail',
        questions: [
          single('t2_mail', 'Z jakiej poczty e-mail korzystacie?', [
            'Firmowej, z końcówką domeny (np. kontakt@twojsalon.pl)',
            'Gmail, Onet, WP lub innej darmowej',
            'Z obu',
          ]),
          single('t2_provider', 'Gdzie działa poczta firmowa?', [
            'U tego samego dostawcy co hosting',
            'Google Workspace',
            'Microsoft 365',
            'Nie wiem',
          ], { allowOther: true, showIf: { id: 't2_mail', value: 'Firmowej, z końcówką domeny (np. kontakt@twojsalon.pl)' } }),
          text('t2_boxes', 'Ile skrzynek pocztowych używacie?'),
        ],
      },
      {
        id: 't3',
        title: 'Obecna strona',
        questions: [
          single('t3_cms', 'Na czym jest zbudowana obecna strona?', [
            'WordPress',
            'Wix',
            'WebWave',
            'Shopify / sklep internetowy',
            'Strona pisana od podstaw',
            'Nie wiem',
            'Nie mam strony',
          ], { allowOther: true }),
          area('t3_good', 'Co na obecnej stronie działa dobrze i warto to zachować?'),
          area('t3_bad', 'Co przeszkadza Tobie lub klientom?'),
          single('t3_gsc', 'Czy masz dostęp do Google Search Console?', YES_NO_DONTKNOW),
          single('t3_ga', 'Czy masz dostęp do Google Analytics?', YES_NO_DONTKNOW),
          single('t3_gbp', 'Czy masz Profil Firmy w Google (wizytówkę) i dostęp do niego?', [
            'Tak, mam dostęp',
            'Jest, ale nie mam dostępu',
            'Nie mam wizytówki',
            'Nie wiem',
          ]),
        ],
      },
      {
        id: 't4',
        title: 'Konta i integracje',
        questions: [
          area('t4_social', 'Profile w social media', { help: 'Wklej linki: Facebook, Instagram, TikTok, LinkedIn, YouTube…' }),
          text('t4_booking', 'System rezerwacji, z którego korzystasz (jeśli jest)', { placeholder: 'np. Booksy, ZnanyLekarz' }),
          text('t4_sales', 'Program sprzedażowy / magazynowy / kartoteka', { placeholder: 'nazwa programu' }),
          multi('t4_payments', 'Płatności online, które znasz lub masz', [
            'Przelewy24',
            'PayU',
            'Tpay',
            'Stripe',
            'BLIK',
            'Nie mam, do ustalenia',
          ], { allowOther: true }),
          text('t4_newsletter', 'Narzędzie do newslettera lub SMS (jeśli jest)'),
          area('t4_other', 'Inne narzędzia, z którymi strona ma się łączyć'),
        ],
      },
      {
        id: 't5',
        title: 'Praca ze stroną',
        questions: [
          single('t5_editor', 'Kto będzie aktualizował treści na stronie?', [
            'Ja lub mój zespół',
            'NAFU Design w ramach opieki',
            'Razem: proste rzeczy my, większe NAFU',
          ]),
          single('t5_frequency', 'Jak często chcesz coś zmieniać lub dodawać?', [
            'Kilka razy w tygodniu',
            'Kilka razy w miesiącu',
            'Rzadko, kilka razy w roku',
          ]),
          single('t5_training', 'Czy chcesz krótkie szkolenie z obsługi strony?', ['Tak', 'Nie']),
          single('t5_care', 'Stała opieka techniczna po starcie (aktualizacje, kopie, bezpieczeństwo)', [
            'Tak, chcę mieć spokój',
            'Chcę o tym porozmawiać',
            'Nie',
          ]),
          single('t5_paid', 'Czy jesteś gotowy na płatne oprogramowanie?', [
            'Tak, jestem gotowy',
            'Nie, interesują mnie wyłącznie rozwiązania bez stałych opłat',
            'Chcę najpierw o tym porozmawiać',
          ], {
            help: 'To pytanie wyłącznie o Twoją gotowość, a nie o budżet czy zakres. Twoja odpowiedź mówi mi, jak mam pracować. Jeśli jesteś gotowy, tam gdzie przyniesie to konkretną wartość i realną różnicę, przedstawię Ci różne propozycje, w tym płatne.',
          }),
        ],
      },
      {
        id: 't6',
        title: 'Kontakt techniczny',
        questions: [
          text('t6_name', 'Kto jest osobą kontaktową w sprawach technicznych?', { placeholder: 'Imię i nazwisko' }),
          text('t6_contact', 'Telefon lub e-mail tej osoby'),
          area('t6_notes', 'Coś jeszcze, co powinnam wiedzieć od strony technicznej?'),
        ],
      },
    ],
  },
}
