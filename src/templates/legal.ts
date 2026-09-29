import type { Template } from '../lib/types'
import { area, date, multi, repeater, single, text, YES_NO_DONTKNOW } from './builders'

export const legal: Template = {
  key: 'legal',
  title: 'Dział prawny',
  short: 'Prawny',
  description:
    'Dane do przygotowania kompletu dokumentów strony: polityki prywatności i cookies, regulaminów, klauzul RODO, zgód, deklaracji dostępności i standardów ochrony małoletnich.',
  intro:
    'Na podstawie Twoich odpowiedzi przygotujemy dokumenty zgodne z przepisami obowiązującymi w 2026 roku (RODO, prawo konsumenckie, dyrektywa Omnibus, Europejski Akt o Dostępności, AI Act, ustawa o ochronie małoletnich). Jeśli czegoś nie wiesz — zostaw puste albo zaznacz „nie wiem”, wyjaśnimy to razem. Nie wpisuj tu haseł ani danych klientów.',
  minutes: 25,
  accent: '#02AFCA',
  schema: {
    sections: [
      {
        id: 'l1',
        title: 'Dane administratora',
        description: 'Firma, która odpowiada za dane osobowe zbierane przez stronę.',
        questions: [
          text('l1_name', 'Pełna nazwa firmy', { required: true, placeholder: 'np. Optyk Kowalski Jan Kowalski' }),
          single('l1_form', 'Forma prawna', [
            'Jednoosobowa działalność gospodarcza (CEIDG)',
            'Spółka cywilna',
            'Spółka z o.o.',
            'Spółka jawna / komandytowa',
            'Fundacja / stowarzyszenie',
          ], { allowOther: true, required: true }),
          area('l1_repr', 'Jeśli to spółka: kto ją reprezentuje?', {
            help: 'Imiona, nazwiska i funkcje osób uprawnionych do reprezentacji (np. prezes zarządu, wspólnicy).',
          }),
          text('l1_nip', 'NIP', { required: true }),
          text('l1_regon', 'REGON'),
          text('l1_krs', 'Numer KRS (jeśli spółka)'),
          area('l1_address', 'Adres siedziby', { help: 'Jeśli jest inny niż adresy salonów / lokali.' }),
          text('l1_privacy_email', 'Adres e-mail do spraw ochrony danych', { placeholder: 'np. rodo@twojafirma.pl' }),
          text('l1_privacy_phone', 'Telefon do spraw ochrony danych'),
          single('l1_iod', 'Czy masz wyznaczonego Inspektora Ochrony Danych (IOD)?', YES_NO_DONTKNOW),
          area('l1_iod_data', 'Dane IOD', {
            help: 'Imię i nazwisko lub nazwa firmy, e-mail, telefon.',
            showIf: { id: 'l1_iod', value: 'Tak' },
          }),
          single('l1_staff', 'Liczba pracowników (łącznie ze współpracownikami na stałe)', ['0–9', '10–49', '50–249', '250 i więcej']),
          single('l1_turnover', 'Roczny obrót lub suma bilansowa', ['Do 2 mln euro', 'Powyżej 2 mln euro', 'Wolę nie podawać'], {
            help: 'Decyduje, czy firma jest mikroprzedsiębiorcą i czy obejmuje ją obowiązek dostępności cyfrowej (Europejski Akt o Dostępności).',
          }),
        ],
      },
      {
        id: 'l2',
        title: 'Status medyczny',
        description:
          'Dotyczy salonów optycznych, gabinetów i placówek, które badają lub leczą. Jeśli Cię nie dotyczy — przejdź dalej.',
        questions: [
          single('l2_rpwdl', 'Czy firma jest wpisana do RPWDL jako podmiot leczniczy?', YES_NO_DONTKNOW),
          repeater('l2_staff', 'Kto wykonuje badania?', 'Specjalista', [
            ['Imię i nazwisko'],
            ['Zawód (optometrysta, okulista, optyk…)'],
            ['Numer prawa wykonywania zawodu / uprawnień'],
          ]),
          single('l2_kids', 'Czy badania dotyczą też dzieci?', ['Tak', 'Nie']),
          text('l2_kids_age', 'Od jakiego wieku badacie dzieci?', { showIf: { id: 'l2_kids', value: 'Tak' } }),
          single('l2_guardian', 'Czy przy badaniu dziecka wymagana jest obecność opiekuna?', ['Tak, zawsze', 'Tak, do określonego wieku', 'Nie'], {
            showIf: { id: 'l2_kids', value: 'Tak' },
          }),
          single('l2_lenses', 'Czy dobieracie i sprzedajecie soczewki kontaktowe?', ['Tak', 'Nie']),
          single('l2_nfz', 'Czy macie umowę z NFZ na realizację zleceń na wyroby medyczne (refundacja)?', YES_NO_DONTKNOW),
          text('l2_software', 'W jakim programie prowadzona jest kartoteka klienta?'),
          single('l2_storage', 'Gdzie są przechowywane dane kartoteki?', ['Lokalnie, na komputerze w firmie', 'W chmurze', 'Częściowo lokalnie, częściowo w chmurze', 'Nie wiem']),
          text('l2_storage_vendor', 'Dostawca chmury / programu', { placeholder: 'np. nazwa firmy, która dostarcza program' }),
        ],
      },
      {
        id: 'l3',
        title: 'Przepływ danych osobowych',
        description: 'Jakie dane zbierasz, komu je przekazujesz i jak długo je przechowujesz.',
        questions: [
          multi('l3_data', 'Jakie dane zbierasz od klientów?', [
            'Imię i nazwisko',
            'Telefon',
            'E-mail',
            'Adres',
            'Data urodzenia',
            'PESEL',
            'Dane o zdrowiu (np. wyniki badań)',
            'Wizerunek (zdjęcia, nagrania)',
            'Dane do faktury',
          ], { allowOther: true }),
          area('l3_when', 'Przy jakich okazjach zbierasz te dane?', {
            help: 'Np. przy wizycie, zamówieniu, badaniu, serwisie — co dokładnie jest zapisywane w każdej sytuacji.',
          }),
          multi('l3_recipients', 'Komu dane są przekazywane?', [
            'Laboratorium / pracownia (np. szlifiernia)',
            'Producenci (np. soczewek)',
            'Biuro rachunkowe',
            'Dostawca programu do kartoteki / sprzedaży',
            'Firma hostingowa',
            'Firma IT / informatyk',
            'Kurier',
            'System rezerwacji online',
            'System do wysyłki SMS / e-mail',
            'Operator płatności',
            'Agencja marketingowa',
          ], { allowOther: true }),
          area('l3_recipients_names', 'Nazwy tych firm (jeśli znasz)', { help: 'Potrzebne do listy odbiorców danych w polityce prywatności.' }),
          single('l3_retention', 'Jak długo przechowujesz dane klientów, którzy nie wracają?', [
            'Do roku',
            '2–5 lat',
            'Powyżej 5 lat',
            'Bezterminowo / nie usuwamy',
            'Nie wiem',
          ], { allowOther: true }),
          multi('l3_comms', 'Jakie wiadomości wysyłasz klientom?', [
            'Przypomnienia SMS (np. o kolejnym badaniu)',
            'Przypomnienia e-mail',
            'Informację „zamówienie gotowe do odbioru”',
            'Newsletter',
            'Oferty i promocje',
            'Nie wysyłamy wiadomości',
          ]),
          single('l3_cctv', 'Czy w lokalu jest monitoring wizyjny?', ['Tak', 'Nie']),
          text('l3_cctv_info', 'Jak długo przechowywane są nagrania?', { showIf: { id: 'l3_cctv', value: 'Tak' } }),
          multi('l3_photos', 'Zdjęcia klientów', [
            'Robimy zdjęcia klientom (np. w oprawach)',
            'Publikujemy zdjęcia klientów w social mediach',
            'Publikujemy zdjęcia klientów na stronie',
            'Nie robimy zdjęć klientom',
          ]),
        ],
      },
      {
        id: 'l4',
        title: 'Strona internetowa i narzędzia',
        description: 'Od tego zależy treść polityki cookies, klauzul przy formularzach i obowiązki cenowe.',
        questions: [
          multi('l4_forms', 'Jakie formularze mają być na stronie?', [
            'Kontaktowy',
            'Rezerwacja wizyty / badania',
            'Zapytanie o serwis',
            'Zapis na newsletter',
            'Formularz rekrutacyjny',
          ], { allowOther: true }),
          single('l4_booking', 'Czy rezerwacja idzie przez zewnętrzny system?', [
            'Booksy',
            'ZnanyLekarz',
            'Własny system na stronie',
            'Rezerwacji online nie będzie',
          ], { allowOther: true }),
          single('l4_shop', 'Czy będzie sprzedaż online?', [
            'Tak, sklep internetowy',
            'Tylko bony / przedpłaty / zadatki',
            'Nie teraz, ale w przyszłości',
            'Nie',
          ]),
          multi('l4_tools', 'Narzędzia analityczne i marketingowe na stronie', [
            'Google Analytics',
            'Google Tag Manager',
            'Google Ads',
            'Meta Pixel (Facebook / Instagram)',
            'Osadzona mapa Google',
            'Filmy z YouTube / Vimeo',
            'Czat na stronie',
            'Asystent AI / chatbot',
            'Wtyczki social media',
            'Nagrywanie sesji (Hotjar, Clarity)',
            'Nie wiem — zdecydujmy razem',
          ], { allowOther: true }),
          single('l4_reviews', 'Czy na stronie będą opinie klientów?', [
            'Tak — weryfikujemy, że pochodzą od faktycznych klientów',
            'Tak — bez weryfikacji (np. z Google)',
            'Nie',
          ], {
            help: 'Prawo wymaga informacji, czy i jak sprawdzasz, że opinie pochodzą od klientów.',
          }),
          single('l4_prices', 'Czy na stronie będą ceny i promocje?', [
            'Ceny i promocje',
            'Tylko ceny',
            'Bez cen',
          ], {
            help: 'Przy promocjach obowiązuje podanie najniższej ceny z 30 dni przed obniżką (dyrektywa Omnibus).',
          }),
        ],
      },
      {
        id: 'l5',
        title: 'Usługi — do regulaminu',
        description: 'Zasady, które trafią do regulaminu usług i będą jasne dla klientów.',
        questions: [
          area('l5_pricing', 'Cennik badania z zakupem i bez. Czy koszt badania jest odliczany od zakupu i na jakich warunkach?'),
          area('l5_booking_rules', 'Czas trwania badania, zasady umawiania, odwoływania, spóźnień i nieprzyjścia'),
          single('l5_result', 'Czy klient dostaje wynik badania na piśmie i może go zabrać do innego salonu?', [
            'Tak, zawsze',
            'Tak, na prośbę',
            'Tylko przy zakupie',
            'Nie',
          ], { allowOther: true }),
          single('l5_external_rx', 'Czy realizujecie recepty od okulistów spoza salonu i z innych salonów?', ['Tak, wszystkie', 'Tylko od okulistów', 'Nie'], { allowOther: true }),
          area('l5_orders', 'Termin realizacji zamówień, zaliczki i ich zwrot przy rezygnacji'),
          area('l5_pickup', 'Termin na odbiór gotowego zamówienia i co się dzieje z nieodebranym'),
          area('l5_warranty', 'Gwarancje', {
            help: 'Na oprawy, soczewki, adaptację do progresywnych (czy jest i na jakich warunkach), wymianę soczewek przy zmianie wady.',
          }),
          area('l5_complaints', 'Reklamacje: gdzie i jak zgłaszać, termin rozpatrzenia, kto rozpatruje'),
          area('l5_service', 'Serwis', {
            help: 'Jakie naprawy robicie na miejscu, jakie wysyłacie, czy przyjmujecie produkty kupione gdzie indziej, odpowiedzialność za uszkodzenie przy naprawie, cennik.',
          }),
          area('l5_aftercare', 'Obsługa posprzedażowa', { help: 'Np. darmowe regulacje, czyszczenie, kontrole.' }),
        ],
      },
      {
        id: 'l6',
        title: 'Standardy ochrony małoletnich',
        description:
          'Obowiązkowe dla firm, które mają kontakt z dziećmi (ustawa z 2023 r., tzw. ustawa Kamilka). Wersja skrócona standardów musi być dostępna publicznie, np. na stronie.',
        questions: [
          single('l6_applies', 'Czy w firmie obsługiwane są osoby poniżej 18. roku życia?', ['Tak', 'Nie']),
          repeater('l6_responsible', 'Osoba odpowiedzialna za standardy w każdej lokalizacji', 'Osoba', [
            ['Lokalizacja'],
            ['Imię i nazwisko'],
            ['Kontakt (telefon, e-mail)'],
          ], { showIf: { id: 'l6_applies', value: 'Tak' } }),
          area('l6_staff', 'Pracownicy mający kontakt z dziećmi', {
            help: 'Lista stanowisk lub osób. Nie wpisuj tu danych wrażliwych.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          single('l6_checked', 'Czy pracownicy zostali sprawdzeni w Rejestrze Sprawców Przestępstw na Tle Seksualnym i w KRK?', [
            'Tak, wszyscy',
            'Częściowo',
            'Jeszcze nie',
          ], { showIf: { id: 'l6_applies', value: 'Tak' } }),
          text('l6_alone', 'Czy dziecko może być obsługiwane bez opiekuna? Od jakiego wieku?', { showIf: { id: 'l6_applies', value: 'Tak' } }),
          area('l6_photos', 'Zasady fotografowania dzieci i publikacji ich wizerunku', { showIf: { id: 'l6_applies', value: 'Tak' } }),
          area('l6_procedure', 'Kto przyjmuje zgłoszenia i do kogo eskalować sprawę (procedura interwencji)?', { showIf: { id: 'l6_applies', value: 'Tak' } }),
          single('l6_training', 'Czy pracownicy zostali przeszkoleni ze standardów?', ['Tak', 'Nie', 'Planujemy'], { showIf: { id: 'l6_applies', value: 'Tak' } }),
          date('l6_review', 'Planowana data przeglądu standardów', { showIf: { id: 'l6_applies', value: 'Tak' } }),
        ],
      },
      {
        id: 'l7',
        title: 'Lokalizacje',
        description: 'Dane każdego salonu, gabinetu lub punktu obsługi.',
        questions: [
          repeater('l7_places', 'Twoje lokalizacje', 'Lokalizacja', [
            ['Nazwa / adres'],
            ['Telefon'],
            ['E-mail'],
            ['Godziny otwarcia', 'textarea'],
            ['Godziny badań (jeśli inne)'],
            ['Dostępność architektoniczna: podjazd, parter, toaleta, parking dla osób z niepełnosprawnościami', 'textarea'],
          ], { required: true }),
          single('l7_entities', 'Czy wszystkie lokalizacje działają pod tą samą firmą?', [
            'Tak, jedna firma',
            'Nie, część to osobne firmy',
          ], { help: 'Osobna firma = osobny administrator danych i osobne dokumenty.' }),
          area('l7_entities_info', 'Które lokalizacje to osobne firmy? Podaj ich dane.', { showIf: { id: 'l7_entities', value: 'Nie, część to osobne firmy' } }),
        ],
      },
      {
        id: 'l8',
        title: 'Zgody i wymogi 2026',
        description: 'Nowe obowiązki, które obejmują strony internetowe w 2025 i 2026 roku.',
        questions: [
          multi('l8_consents', 'Na co chcesz zbierać zgody od klientów?', [
            'Marketing e-mail (newsletter, oferty)',
            'Marketing SMS',
            'Kontakt telefoniczny w celach marketingowych',
            'Publikacja wizerunku',
            'Przypomnienia o kolejnej wizycie',
            'Personalizacja ofert (profilowanie)',
          ], { allowOther: true }),
          single('l8_cookies', 'Baner zgód cookies', [
            'Proste i bezpłatne rozwiązanie',
            'Certyfikowana platforma zgód (CMP) z Google Consent Mode v2 — potrzebna przy Google Ads',
            'Zdecyduj za mnie',
          ]),
          single('l8_ai', 'Czy na stronie ma działać asystent AI / chatbot?', ['Tak', 'Może później', 'Nie'], {
            help: 'Od sierpnia 2026 r. (AI Act) użytkownik musi być wyraźnie poinformowany, że rozmawia z AI.',
          }),
          single('l8_withdraw', 'Jeśli będzie sprzedaż online: czy klient może zawrzeć umowę przez stronę (np. kupić produkt, bon, usługę)?', [
            'Tak',
            'Nie',
            'Nie dotyczy',
          ], {
            help: 'Od 19 czerwca 2026 r. sklepy muszą mieć widoczny przycisk „Odstąp od umowy”.',
          }),
          single('l8_gpsr', 'Czy będziesz sprzedawać produkty fizyczne online?', ['Tak', 'Nie'], {
            help: 'Przy sprzedaży online obowiązują informacje o producencie i bezpieczeństwie produktu (rozporządzenie GPSR).',
          }),
          area('l8_gpsr_info', 'Jakie produkty i od jakich producentów?', { showIf: { id: 'l8_gpsr', value: 'Tak' } }),
          single('l8_newsletter', 'Newsletter z potwierdzeniem zapisu (double opt-in)?', ['Tak', 'Nie', 'Nie będzie newslettera']),
          area('l8_existing', 'Masz już jakieś dokumenty?', {
            help: 'Polityka prywatności, regulamin, klauzule, standardy ochrony małoletnich. Wklej linki lub opisz, co masz.',
          }),
          text('l8_owner', 'Kto u Ciebie odpowiada za aktualizację dokumentów?', { placeholder: 'Imię i nazwisko / stanowisko' }),
          area('l8_other', 'Coś jeszcze, o czym powinnam wiedzieć?'),
        ],
      },
    ],
  },
}
