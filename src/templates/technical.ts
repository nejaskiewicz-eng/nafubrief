import type { Template } from '../lib/types'
import { area, date, multi, single, text } from './builders'

const YES_NO_UNSURE = ['Tak', 'Nie', 'Nie wiem']

export const technical: Template = {
  key: 'technical',
  title: 'Dział techniczny',
  short: 'Techniczny',
  description:
    'Domena, hosting, poczta, obecna strona, konta w Google i mediach społecznościowych oraz narzędzia, z którymi strona ma współpracować.',
  intro:
    'Te informacje pozwolą mi zaplanować przeniesienie strony tak, żeby nic nie przestało działać: ani poczta, ani obecna strona, ani Twoja widoczność w Google. Nie musisz znać się na technice. Jeśli czegoś nie wiesz, zaznacz „nie wiem”, a sprawdzimy to razem.\n\nProszę, nigdy nie wpisuj tutaj haseł. Dostępy przekażemy sobie osobno, w bezpieczny sposób.',
  minutes: 10,
  accent: '#0B6E8A',
  schema: {
    sections: [
      {
        id: 't1',
        title: 'Adres strony i serwer',
        description:
          'Domena to adres Twojej strony, np. twojsalon.pl. Hosting to serwer, na którym strona działa. Zwykle płaci się za nie osobno, raz w roku.',
        questions: [
          text('t1_domain', 'Jaki jest adres Twojej obecnej strony internetowej?', {
            placeholder: 'np. twojsalon.pl',
            help: 'Jeśli nie masz jeszcze strony, ale masz wykupiony adres, też go wpisz.',
          }),
          text('t1_registrar', 'W jakiej firmie jest wykupiony ten adres (domena)?', {
            placeholder: 'np. home.pl, OVH, nazwa.pl, cyber_Folks',
            help: 'Najłatwiej to sprawdzić na fakturze za domenę albo w mailach z przypomnieniem o płatności. Jeśli nie wiesz, zostaw puste.',
          }),
          date('t1_domain_until', 'Do kiedy domena jest opłacona?', {
            help: 'Data jest ważna, bo jeśli domena wygaśnie, strona i poczta przestaną działać.',
          }),
          text('t1_hosting', 'W jakiej firmie jest serwer, na którym działa obecna strona (hosting)?', {
            help: 'Często jest to ta sama firma, w której kupiona jest domena. Jeśli nie wiesz, zostaw puste.',
          }),
          date('t1_hosting_until', 'Do kiedy masz opłacony hosting?'),
          text('t1_cost', 'Ile mniej więcej płacisz rocznie za domenę i hosting razem?', {
            placeholder: 'np. około 400 zł rocznie',
            help: 'Pytam, żeby sprawdzić, czy mogę zaproponować Ci tańsze rozwiązanie o tej samej lub lepszej jakości.',
          }),
          single('t1_logins', 'Kto ma dane do logowania do panelu domeny i hostingu?', [
            'Ja',
            'Poprzedni wykonawca strony',
            'Informatyk lub firma IT',
            'Nikt, nie wiem, gdzie są',
          ], {
            allowOther: true,
            help: 'Nie wpisuj tutaj loginów ani haseł. Chcę tylko wiedzieć, do kogo się zwrócić.',
          }),
          text('t1_other_domains', 'Czy masz jeszcze inne adresy stron, np. stare domeny albo adresy innych marek?', {
            help: 'Warto je przekierować na nową stronę, żeby nie tracić klientów, którzy znają stary adres.',
          }),
        ],
      },
      {
        id: 't2',
        title: 'Poczta e-mail',
        description:
          'Przy zmianie hostingu trzeba uważać na pocztę, żeby nie zginęła ani jedna wiadomość. Dlatego muszę wiedzieć, jak działa u Ciebie.',
        questions: [
          single('t2_mail', 'Z jakiej poczty e-mail korzystasz w firmie?', [
            'Z firmowej, z adresem kończącym się nazwą mojej strony (np. kontakt@twojsalon.pl)',
            'Z darmowej, np. Gmail, Onet, WP',
            'Z obu',
          ]),
          single('t2_provider', 'Gdzie działa Twoja poczta firmowa?', [
            'U tej samej firmy co hosting strony',
            'W Google Workspace (Gmail z adresem firmowym)',
            'W Microsoft 365 (Outlook)',
            'Nie wiem',
          ], {
            allowOther: true,
            showIf: { id: 't2_mail', value: 'Z firmowej, z adresem kończącym się nazwą mojej strony (np. kontakt@twojsalon.pl)' },
          }),
          text('t2_boxes', 'Ile skrzynek pocztowych używacie w firmie?', {
            placeholder: 'np. 3: kontakt@, anna@, salon2@',
          }),
        ],
      },
      {
        id: 't3',
        title: 'Obecna strona',
        questions: [
          single('t3_cms', 'Na czym zbudowana jest Twoja obecna strona?', [
            'WordPress',
            'Wix',
            'WebWave',
            'Shopify lub inny sklep internetowy',
            'Była pisana od podstaw przez programistę',
            'Nie wiem',
            'Nie mam jeszcze strony',
          ], {
            allowOther: true,
            help: 'Jeśli nie wiesz, nic się nie stanie. Sprawdzę to sama po adresie strony.',
          }),
          area('t3_good', 'Co na obecnej stronie działa dobrze i chcesz to zachować?', {
            help: 'Np. konkretne teksty, zdjęcia, zakładki, formularz, który klienci chętnie wypełniają.',
          }),
          area('t3_bad', 'Co Ci przeszkadza w obecnej stronie albo na co skarżą się klienci?', {
            help: 'Np. „trudno ją edytować”, „źle wygląda na telefonie”, „klienci nie mogą znaleźć cennika”.',
          }),
          single('t3_gsc', 'Czy masz dostęp do Google Search Console?', YES_NO_UNSURE, {
            help: 'To bezpłatne narzędzie Google, które pokazuje, jak strona radzi sobie w wyszukiwarce. Przyda się przy przenoszeniu strony, żeby nie stracić pozycji.',
          }),
          single('t3_ga', 'Czy masz dostęp do Google Analytics, czyli statystyk odwiedzin strony?', YES_NO_UNSURE),
          single('t3_gbp', 'Czy Twoja firma ma wizytówkę w Google (Profil Firmy w Google) i czy masz do niej dostęp?', [
            'Tak, mam dostęp',
            'Wizytówka istnieje, ale nie mam do niej dostępu',
            'Nie mam wizytówki',
            'Nie wiem',
          ], {
            help: 'Wizytówka to to, co pokazuje się w Mapach Google po wpisaniu nazwy Twojej firmy. Ma ogromny wpływ na to, ilu klientów Cię znajdzie.',
          }),
        ],
      },
      {
        id: 't4',
        title: 'Konta i narzędzia',
        description: 'Strona może łączyć się z narzędziami, z których już korzystasz. Muszę wiedzieć, jakie to narzędzia.',
        questions: [
          area('t4_social', 'Gdzie Twoja firma jest obecna w mediach społecznościowych?', {
            help: 'Wklej linki do profili, np. na Facebooku, Instagramie, TikToku, LinkedInie czy YouTube.',
          }),
          text('t4_booking', 'Czy korzystasz z jakiegoś systemu do rezerwacji wizyt? Jeśli tak, z jakiego?', {
            placeholder: 'np. Booksy, ZnanyLekarz, kalendarz Google',
          }),
          text('t4_sales', 'W jakim programie prowadzisz sprzedaż, magazyn lub kartoteki klientów?', {
            placeholder: 'nazwa programu',
            help: 'Czasem da się połączyć go ze stroną, np. żeby pokazywać dostępność produktów.',
          }),
          multi('t4_payments', 'Z jakich systemów płatności online korzystasz albo chcesz korzystać?', [
            'Przelewy24',
            'PayU',
            'Tpay',
            'Stripe',
            'BLIK',
            'Nie korzystam, chcę to ustalić razem',
          ], { allowOther: true }),
          text('t4_newsletter', 'Czy używasz programu do wysyłki newslettera lub SMS-ów? Jeśli tak, jakiego?', {
            placeholder: 'np. MailerLite, SMSAPI',
          }),
          area('t4_other', 'Z jakimi innymi narzędziami lub programami strona powinna współpracować?'),
        ],
      },
      {
        id: 't5',
        title: 'Praca ze stroną po starcie',
        questions: [
          single('t5_editor', 'Kto będzie zmieniał treści na stronie, np. ceny, godziny otwarcia czy aktualności?', [
            'Ja lub ktoś z mojego zespołu',
            'NAFU Design w ramach stałej opieki',
            'Razem: drobne zmiany my, większe NAFU Design',
          ]),
          single('t5_frequency', 'Jak często planujesz coś zmieniać lub dodawać na stronie?', [
            'Kilka razy w tygodniu',
            'Kilka razy w miesiącu',
            'Rzadko, kilka razy w roku',
          ]),
          single('t5_training', 'Czy chcesz krótkie szkolenie z samodzielnej obsługi strony?', ['Tak', 'Nie']),
          single('t5_care', 'Czy interesuje Cię stała opieka techniczna po uruchomieniu strony?', [
            'Tak, wolę mieć spokój',
            'Chcę najpierw o tym porozmawiać',
            'Nie',
          ], {
            help: 'Opieka obejmuje m.in. aktualizacje, kopie zapasowe i pilnowanie bezpieczeństwa strony.',
          }),
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
        title: 'Osoba do kontaktu',
        questions: [
          text('t6_name', 'Z kim mogę się kontaktować w sprawach technicznych?', {
            placeholder: 'Imię i nazwisko',
            help: 'Może to być Ty albo np. Twój informatyk.',
          }),
          text('t6_contact', 'Jaki jest telefon lub e-mail tej osoby?'),
          area('t6_notes', 'Czy jest coś jeszcze od strony technicznej, o czym powinnam wiedzieć?', {
            help: 'Np. wcześniejsze problemy ze stroną, umowy z innymi firmami, planowane zmiany.',
          }),
        ],
      },
    ],
  },
}
