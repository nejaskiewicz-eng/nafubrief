import type { Template } from '../lib/types'
import { area, date, multi, repeater, single, text } from './builders'

const YES_NO_UNSURE = ['Tak', 'Nie', 'Nie wiem, trzeba sprawdzić']

export const legal: Template = {
  key: 'legal',
  title: 'Dział prawny',
  short: 'Prawny',
  description:
    'Informacje potrzebne do przygotowania dokumentów na stronę: polityki prywatności, polityki cookies, regulaminów, klauzul RODO przy formularzach, zgód, deklaracji dostępności i standardów ochrony małoletnich.',
  intro:
    'Każda strona firmowa musi mieć komplet dokumentów zgodnych z przepisami: RODO, prawem konsumenckim, dyrektywą Omnibus, Europejskim Aktem o Dostępności, AI Act i ustawą o ochronie małoletnich. Twoje odpowiedzi pozwolą mi przygotować je tak, żeby opisywały to, jak naprawdę działa Twoja firma, a nie ogólny szablon z internetu.\n\nPod każdym pytaniem znajdziesz krótkie wyjaśnienie, po co o to pytam. Jeśli czegoś nie wiesz albo nie masz pewności, zostaw puste pole lub zaznacz „nie wiem”. Wyjaśnimy to razem na spotkaniu. Proszę, nie wpisuj tutaj haseł ani danych swoich klientów.',
  minutes: 25,
  accent: '#02AFCA',
  schema: {
    sections: [
      {
        id: 'l1',
        title: 'Dane Twojej firmy',
        description:
          'W dokumentach musi być dokładnie wskazane, kto odpowiada za dane osobowe zbierane przez stronę. Prawnie ta firma nazywa się administratorem danych. Te informacje znajdziesz w CEIDG albo w KRS.',
        questions: [
          text('l1_name', 'Jak brzmi pełna, oficjalna nazwa Twojej firmy?', {
            required: true,
            help: 'Wpisz nazwę dokładnie tak, jak w CEIDG lub KRS. W jednoosobowej działalności zwykle zawiera ona Twoje imię i nazwisko.',
            placeholder: 'np. Salon Optyczny Kowalski Jan Kowalski',
          }),
          single('l1_form', 'W jakiej formie prawnej działa Twoja firma?', [
            'Jednoosobowa działalność gospodarcza (wpis w CEIDG)',
            'Spółka cywilna',
            'Spółka z o.o.',
            'Spółka jawna lub komandytowa',
            'Fundacja lub stowarzyszenie',
          ], {
            allowOther: true,
            required: true,
            help: 'Od formy prawnej zależy, jak opisuję firmę w dokumentach i kto je podpisuje.',
          }),
          area('l1_repr', 'Jeśli firma jest spółką, kto jest upoważniony do jej reprezentowania?', {
            help: 'Podaj imiona, nazwiska i funkcje tych osób, np. „Anna Nowak, prezes zarządu”. W spółce cywilnej wpisz wszystkich wspólników. Jeśli prowadzisz jednoosobową działalność, pomiń to pytanie.',
          }),
          text('l1_nip', 'Jaki jest NIP firmy?', { required: true }),
          text('l1_regon', 'Jaki jest numer REGON firmy?', {
            help: 'Znajdziesz go w CEIDG, na fakturach albo w dokumentach rejestrowych.',
          }),
          text('l1_krs', 'Jeśli firma jest wpisana do KRS, jaki ma numer KRS?', {
            help: 'Dotyczy spółek z o.o., spółek jawnych, komandytowych i fundacji. Przy jednoosobowej działalności pomiń to pytanie.',
          }),
          area('l1_address', 'Jaki jest adres siedziby firmy?', {
            help: 'Chodzi o adres z rejestru. Jeśli jest taki sam jak adres Twojego salonu lub gabinetu, możesz napisać „taki sam jak salon”.',
          }),
          text('l1_privacy_email', 'Na jaki adres e-mail klienci mogą pisać w sprawach swoich danych osobowych?', {
            help: 'Ten adres pojawi się w polityce prywatności. Klienci będą na niego pisać np. z prośbą o usunięcie danych. Może to być Twój zwykły adres firmowy.',
            placeholder: 'np. kontakt@twojafirma.pl',
          }),
          text('l1_privacy_phone', 'Pod jakim numerem telefonu klienci mogą pytać o swoje dane osobowe?', {
            help: 'Też trafi do polityki prywatności. Może to być numer, pod którym zwykle się z Tobą kontaktują.',
          }),
          single('l1_iod', 'Czy Twoja firma ma wyznaczonego Inspektora Ochrony Danych (IOD)?', YES_NO_UNSURE, {
            help: 'IOD to osoba lub firma, która oficjalnie pilnuje ochrony danych i jest zgłoszona do Prezesa UODO. Większość małych firm go nie ma i nie musi mieć. Jeśli nic Ci to nie mówi, najpewniej odpowiedź brzmi „nie”. Jeśli zaznaczysz „Tak”, pojawią się pytania o dane inspektora.',
          }),
          text('l1_iod_name', 'Jak nazywa się Inspektor Ochrony Danych w Twojej firmie?', {
            placeholder: 'Imię i nazwisko albo nazwa firmy pełniącej tę funkcję',
            help: 'Dane inspektora muszą znaleźć się w polityce prywatności i w klauzulach przy formularzach.',
            showIf: { id: 'l1_iod', value: 'Tak' },
          }),
          text('l1_iod_email', 'Pod jakim adresem e-mail można skontaktować się z Inspektorem Ochrony Danych?', {
            placeholder: 'np. iod@twojafirma.pl',
            showIf: { id: 'l1_iod', value: 'Tak' },
          }),
          text('l1_iod_phone', 'Pod jakim numerem telefonu można skontaktować się z Inspektorem Ochrony Danych?', {
            help: 'Jeśli inspektor nie ma osobnego numeru, pomiń to pytanie.',
            showIf: { id: 'l1_iod', value: 'Tak' },
          }),
          single('l1_staff', 'Ile osób pracuje w Twojej firmie, licząc Ciebie oraz osoby na umowach zlecenie i B2B?', [
            'Od 1 do 9 osób',
            'Od 10 do 49 osób',
            'Od 50 do 249 osób',
            '250 osób lub więcej',
          ], {
            help: 'Liczba pracowników razem z obrotem decyduje, czy firma jest mikroprzedsiębiorcą. Mikroprzedsiębiorców świadczących usługi nie obejmuje część obowiązków dotyczących dostępności cyfrowej.',
          }),
          single('l1_turnover', 'Jaki jest mniej więcej roczny obrót Twojej firmy?', [
            'Do 2 mln euro (około 8,5 mln zł)',
            'Powyżej 2 mln euro',
            'Wolę tego nie podawać',
          ], {
            help: 'Nie potrzebuję dokładnej kwoty. Wystarczy przedział, bo to on decyduje o statusie mikroprzedsiębiorcy i o obowiązkach wynikających z Europejskiego Aktu o Dostępności.',
          }),
        ],
      },
      {
        id: 'l2',
        title: 'Badania i dane medyczne',
        description:
          'Ta część dotyczy salonów optycznych, gabinetów i innych miejsc, w których bada się lub leczy klientów. Dane o zdrowiu wymagają w dokumentach szczególnej ochrony. Jeśli Twoja firma nie prowadzi badań, przejdź do kolejnej części.',
        questions: [
          single('l2_rpwdl', 'Czy Twoja firma jest wpisana do rejestru podmiotów wykonujących działalność leczniczą (RPWDL)?', YES_NO_UNSURE, {
            help: 'Wpis do RPWDL oznacza, że firma jest podmiotem leczniczym. Wtedy w dokumentach muszą pojawić się dodatkowe informacje o dokumentacji medycznej i prawach pacjenta.',
          }),
          repeater('l2_staff', 'Kto w Twojej firmie wykonuje badania?', 'Specjalista', [
            ['Imię i nazwisko'],
            ['Zawód, np. optometrysta, okulista, optyk'],
            ['Numer prawa wykonywania zawodu lub dokumentu potwierdzającego uprawnienia'],
          ], {
            help: 'Dodaj osobno każdą osobę, która bada klientów. Uprawnienia będą potrzebne w regulaminie usług i w opisie zespołu na stronie.',
          }),
          single('l2_kids', 'Czy badacie również dzieci?', ['Tak', 'Nie']),
          text('l2_kids_age', 'Od jakiego wieku przyjmujecie dzieci na badanie?', {
            placeholder: 'np. od 4 lat',
            showIf: { id: 'l2_kids', value: 'Tak' },
          }),
          single('l2_guardian', 'Czy podczas badania dziecka musi być obecny rodzic lub opiekun?', [
            'Tak, zawsze',
            'Tak, ale tylko do określonego wieku',
            'Nie',
          ], {
            help: 'Ta zasada trafi do regulaminu usług i do standardów ochrony małoletnich.',
            showIf: { id: 'l2_kids', value: 'Tak' },
          }),
          single('l2_lenses', 'Czy dobieracie i sprzedajecie soczewki kontaktowe?', ['Tak', 'Nie'], {
            help: 'Dobór soczewek wiąże się z dodatkowymi danymi o zdrowiu oczu i osobnymi zasadami w regulaminie.',
          }),
          single('l2_nfz', 'Czy Twoja firma ma podpisaną umowę z NFZ na realizację zleceń na okulary lub soczewki z refundacją?', YES_NO_UNSURE, {
            help: 'Umowa z NFZ oznacza przetwarzanie dodatkowych danych, np. numeru PESEL, i przekazywanie ich do NFZ.',
          }),
          text('l2_software', 'W jakim programie zapisujecie kartoteki klientów i wyniki badań?', {
            placeholder: 'np. nazwa programu optycznego albo „w zeszycie”',
            help: 'Dostawca programu ma dostęp do danych Twoich klientów, więc musi zostać wymieniony w dokumentach.',
          }),
          single('l2_storage', 'Gdzie fizycznie przechowywane są dane z kartoteki?', [
            'Na komputerze w firmie',
            'W chmurze, u dostawcy programu',
            'Częściowo na komputerze, częściowo w chmurze',
            'W wersji papierowej',
            'Nie wiem',
          ]),
          text('l2_storage_vendor', 'Jak nazywa się firma, która dostarcza program albo przechowuje dane w chmurze?', {
            placeholder: 'np. nazwa producenta programu',
          }),
        ],
      },
      {
        id: 'l3',
        title: 'Jakie dane zbierasz i co się z nimi dzieje',
        description:
          'Polityka prywatności musi dokładnie opisywać, jakie dane zbierasz, po co, komu je przekazujesz i jak długo je przechowujesz. Dotyczy to nie tylko strony, ale całej firmy.',
        questions: [
          multi('l3_data', 'Jakie dane o klientach zapisujesz w swojej firmie?', [
            'Imię i nazwisko',
            'Numer telefonu',
            'Adres e-mail',
            'Adres zamieszkania',
            'Data urodzenia',
            'PESEL',
            'Dane o zdrowiu, np. wyniki badań wzroku',
            'Zdjęcia lub nagrania klientów',
            'Dane do faktury',
          ], {
            allowOther: true,
            help: 'Zaznacz wszystko, co zapisujesz w jakiejkolwiek formie: w programie, w kalendarzu, w zeszycie, w telefonie.',
          }),
          area('l3_when', 'W jakich sytuacjach zbierasz te dane i co dokładnie wtedy zapisujesz?', {
            help: 'Opisz to własnymi słowami, np. „przy umawianiu wizyty zapisuję imię i telefon, przy badaniu wyniki i datę urodzenia, przy zamówieniu okularów dodatkowo adres e-mail”.',
          }),
          multi('l3_recipients', 'Którym firmom zewnętrznym przekazujesz dane klientów albo które mają do nich dostęp?', [
            'Laboratorium lub pracownia, np. szlifiernia soczewek',
            'Producenci, np. soczewek kontaktowych',
            'Biuro rachunkowe',
            'Dostawca programu do kartoteki lub sprzedaży',
            'Firma hostingowa, na której serwerze jest strona lub poczta',
            'Informatyk lub firma IT',
            'Firma kurierska',
            'System rezerwacji online, np. Booksy',
            'System do wysyłki SMS lub e-maili',
            'Operator płatności online',
            'Agencja marketingowa',
          ], {
            allowOther: true,
            help: 'Każda taka firma musi być wymieniona w polityce prywatności jako odbiorca danych. Z większością z nich warto też mieć podpisaną umowę powierzenia danych.',
          }),
          area('l3_recipients_names', 'Jeśli znasz nazwy tych firm, wpisz je tutaj.', {
            help: 'Np. „biuro rachunkowe: Rachmistrz sp. z o.o., szlifiernia: Optolab”. Jeśli nie znasz wszystkich, wpisz te, które pamiętasz.',
          }),
          single('l3_retention', 'Jak długo przechowujesz dane klientów, którzy przestali przychodzić?', [
            'Do roku',
            'Od 2 do 5 lat',
            'Dłużej niż 5 lat',
            'Nie usuwam ich wcale',
            'Nie wiem',
          ], {
            allowOther: true,
            help: 'Przepisy wymagają, żeby dane nie były trzymane dłużej, niż to potrzebne. Wspólnie ustalimy rozsądny okres, a Twoja odpowiedź pokaże mi, od czego zaczynamy.',
          }),
          multi('l3_comms', 'Jakie wiadomości wysyłasz klientom SMS-em lub e-mailem?', [
            'Przypomnienia o umówionej wizycie',
            'Zaproszenia na kolejne badanie, np. po roku',
            'Informację, że zamówienie jest gotowe do odbioru',
            'Newsletter',
            'Oferty i promocje',
            'Nie wysyłam żadnych wiadomości',
          ], {
            help: 'Na część wiadomości, zwłaszcza marketingowych, potrzebna jest wcześniejsza zgoda klienta. Przygotuję odpowiednie zgody do formularzy.',
          }),
          single('l3_cctv', 'Czy w Twoim lokalu działa monitoring z kamer?', ['Tak', 'Nie'], {
            help: 'Monitoring wymaga osobnej informacji dla klientów, np. tabliczki przy wejściu i opisu w polityce prywatności.',
          }),
          text('l3_cctv_info', 'Jak długo przechowywane są nagrania z monitoringu?', {
            placeholder: 'np. 14 dni, potem nadpisują się automatycznie',
            showIf: { id: 'l3_cctv', value: 'Tak' },
          }),
          multi('l3_photos', 'Czy robisz zdjęcia klientom i czy je publikujesz?', [
            'Robię zdjęcia klientom, np. w nowych oprawkach',
            'Publikuję zdjęcia klientów w mediach społecznościowych',
            'Publikuję zdjęcia klientów na stronie internetowej',
            'Nie robię zdjęć klientom',
          ], {
            help: 'Publikacja wizerunku wymaga pisemnej zgody klienta. Przygotuję wzór takiej zgody.',
          }),
        ],
      },
      {
        id: 'l4',
        title: 'Strona internetowa i narzędzia na niej',
        description:
          'Od tego, co będzie działać na stronie, zależy treść polityki cookies, baner zgód i informacje przy formularzach.',
        questions: [
          multi('l4_forms', 'Jakie formularze mają się znaleźć na Twojej nowej stronie?', [
            'Formularz kontaktowy',
            'Formularz rezerwacji wizyty lub badania',
            'Zgłoszenie naprawy lub serwisu',
            'Zapis na newsletter',
            'Formularz rekrutacyjny dla kandydatów do pracy',
          ], {
            allowOther: true,
            help: 'Przy każdym formularzu musi być krótka informacja o tym, co dzieje się z wpisanymi danymi. Przygotuję ją osobno dla każdego.',
          }),
          single('l4_booking', 'Czy klienci będą umawiać wizyty przez zewnętrzny system rezerwacji?', [
            'Tak, przez Booksy',
            'Tak, przez ZnanyLekarz',
            'Chcę mieć własny system rezerwacji na stronie',
            'Nie, rezerwacji online nie będzie',
          ], {
            allowOther: true,
            help: 'Zewnętrzny system ma własny regulamin i własną politykę prywatności. Muszę wiedzieć, do czego odesłać klientów.',
          }),
          single('l4_shop', 'Czy przez stronę będzie można coś kupić lub zapłacić?', [
            'Tak, będzie sklep internetowy',
            'Tylko bony podarunkowe, przedpłaty lub zadatki',
            'Nie teraz, ale planuję to w przyszłości',
            'Nie',
          ], {
            help: 'Sprzedaż online wymaga osobnego regulaminu sklepu i dodatkowych informacji dla konsumentów.',
          }),
          multi('l4_tools', 'Które z tych narzędzi mają działać na Twojej stronie?', [
            'Google Analytics, czyli statystyki odwiedzin',
            'Google Tag Manager',
            'Reklamy Google Ads',
            'Meta Pixel, czyli śledzenie pod reklamy na Facebooku i Instagramie',
            'Mapa Google z dojazdem',
            'Filmy z YouTube lub Vimeo',
            'Czat z klientami',
            'Asystent AI odpowiadający na pytania',
            'Przyciski i posty z mediów społecznościowych',
            'Nagrywanie ruchu na stronie, np. Hotjar lub Microsoft Clarity',
            'Nie wiem, chcę to ustalić razem',
          ], {
            allowOther: true,
            help: 'Każde z tych narzędzi zapisuje pliki cookies. Muszę je wszystkie opisać w polityce cookies i uwzględnić w banerze zgód.',
          }),
          single('l4_reviews', 'Czy na stronie mają być widoczne opinie klientów?', [
            'Tak, i sprawdzam, czy opinie pochodzą od prawdziwych klientów',
            'Tak, np. pobrane z Google, bez dodatkowego sprawdzania',
            'Nie',
          ], {
            help: 'Od 2023 roku trzeba poinformować, czy i jak weryfikujesz, że opinie pochodzą od osób, które naprawdę skorzystały z Twoich usług.',
          }),
          single('l4_prices', 'Czy na stronie będą podane ceny lub promocje?', [
            'Tak, ceny i promocje',
            'Tylko ceny, bez promocji',
            'Nie będzie cen',
          ], {
            help: 'Przy każdej obniżce ceny trzeba podać najniższą cenę z ostatnich 30 dni przed obniżką. Tak wymaga dyrektywa Omnibus.',
          }),
        ],
      },
      {
        id: 'l5',
        title: 'Zasady Twoich usług',
        description:
          'Na podstawie tych odpowiedzi przygotuję regulamin usług. Opisz zasady tak, jak działają u Ciebie na co dzień. Nie musisz pisać językiem prawniczym, zajmę się tym.',
        questions: [
          area('l5_pricing', 'Ile kosztuje badanie wzroku i czy jego koszt jest odliczany, gdy klient kupi u Ciebie okulary?', {
            help: 'Np. „badanie kosztuje 100 zł, przy zakupie okularów powyżej 500 zł badanie jest gratis”. Jeśli masz różne rodzaje badań, opisz każde z nich.',
          }),
          area('l5_booking_rules', 'Jak wyglądają zasady umawiania wizyt?', {
            help: 'Opisz, ile trwa badanie, jak można się umówić, do kiedy i jak odwołać wizytę, co się dzieje przy spóźnieniu i co, gdy klient nie przyjdzie bez uprzedzenia.',
          }),
          single('l5_result', 'Czy klient dostaje wynik badania na piśmie, z którym może pójść do innego salonu?', [
            'Tak, zawsze',
            'Tak, jeśli o to poprosi',
            'Tylko wtedy, gdy kupi okulary u mnie',
            'Nie',
          ], { allowOther: true }),
          single('l5_external_rx', 'Czy wykonujesz okulary na podstawie recept wystawionych poza Twoim salonem?', [
            'Tak, z każdej recepty, także z innych salonów',
            'Tylko z recept od lekarzy okulistów',
            'Nie, tylko na podstawie własnych badań',
          ], { allowOther: true }),
          area('l5_orders', 'Jak długo trwa wykonanie zamówienia i jakie są zasady zaliczek?', {
            help: 'Np. ile czeka się na okulary, czy pobierasz zaliczkę, w jakiej wysokości i czy zwracasz ją, gdy klient zrezygnuje.',
          }),
          area('l5_pickup', 'Ile klient ma czasu na odbiór gotowego zamówienia i co się dzieje, jeśli go nie odbierze?', {
            help: 'Np. „czekamy 3 miesiące, potem wysyłamy przypomnienie, po 6 miesiącach zaliczka przepada”.',
          }),
          area('l5_warranty', 'Jakie gwarancje dajesz klientom?', {
            help: 'Opisz gwarancję na oprawki i soczewki, gwarancję adaptacji do soczewek progresywnych (czy jest i na jakich warunkach) oraz zasady wymiany soczewek, gdy zmieni się wada wzroku.',
          }),
          area('l5_complaints', 'Jak klient może złożyć reklamację i kto ją rozpatruje?', {
            help: 'Np. osobiście w salonie, mailowo czy telefonicznie, kto się tym zajmuje i w jakim czasie klient dostaje odpowiedź. Przepisy wymagają odpowiedzi w ciągu 14 dni.',
          }),
          area('l5_service', 'Jak działa u Ciebie serwis i naprawy okularów?', {
            help: 'Opisz, jakie naprawy robisz na miejscu, a jakie wysyłasz dalej, czy naprawiasz okulary kupione w innym miejscu, kto odpowiada za uszkodzenie podczas naprawy i ile kosztują najczęstsze naprawy.',
          }),
          area('l5_aftercare', 'Co klient dostaje po zakupie w ramach opieki posprzedażowej?', {
            help: 'Np. bezpłatne dopasowanie i regulacja oprawek, czyszczenie ultradźwiękowe, kontrola po miesiącu.',
          }),
        ],
      },
      {
        id: 'l6',
        title: 'Ochrona dzieci',
        description:
          'Od 2024 roku każda firma, która obsługuje dzieci, musi mieć spisane standardy ochrony małoletnich, a ich skróconą wersję udostępnić publicznie, np. na stronie. Wymaga tego ustawa nazywana „ustawą Kamilka”. Pomogę Ci je przygotować.',
        questions: [
          single('l6_applies', 'Czy w Twojej firmie obsługiwane są osoby poniżej 18. roku życia?', ['Tak', 'Nie'], {
            help: 'Jeśli tak, obowiązek przygotowania standardów dotyczy Twojej firmy, nawet jeśli dzieci przychodzą z rodzicami.',
          }),
          repeater('l6_responsible', 'Kto w każdym z Twoich salonów odpowiada za przestrzeganie standardów ochrony dzieci?', 'Osoba odpowiedzialna', [
            ['Salon lub lokalizacja'],
            ['Imię i nazwisko'],
            ['Stanowisko lub funkcja, np. właścicielka, kierowniczka salonu'],
            ['Numer telefonu'],
            ['Adres e-mail'],
          ], {
            help: 'To osoba, do której pracownicy i rodzice mogą się zgłosić, jeśli coś ich zaniepokoi. Jej imię, nazwisko i dane kontaktowe muszą znaleźć się w standardach i w ich skróconej wersji na stronie. Może to być Ty. Jeśli w kilku salonach odpowiada ta sama osoba, wpisz ją raz i dopisz wszystkie salony.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          area('l6_staff', 'Które osoby lub stanowiska mają w pracy kontakt z dziećmi?', {
            help: 'Wystarczy lista stanowisk lub imion, np. „optometrystka, dwie sprzedawczynie”. Nie wpisuj tutaj żadnych danych wrażliwych.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          single('l6_checked', 'Czy osoby pracujące z dziećmi zostały sprawdzone w Rejestrze Sprawców Przestępstw na Tle Seksualnym i w Krajowym Rejestrze Karnym?', [
            'Tak, wszystkie',
            'Część z nich',
            'Jeszcze nie',
          ], {
            help: 'To obowiązek pracodawcy przed dopuszczeniem kogoś do pracy z dziećmi. Jeśli jeszcze tego nie zrobiono, wyjaśnię, jak to zrobić.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          text('l6_alone', 'Czy dziecko może zostać obsłużone bez rodzica lub opiekuna? Jeśli tak, od jakiego wieku?', {
            placeholder: 'np. tak, od 16 lat',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          area('l6_photos', 'Czy robisz zdjęcia dzieciom w salonie i czy je publikujesz? Na jakich zasadach?', {
            help: 'Np. „robimy zdjęcia w oprawkach tylko za pisemną zgodą rodzica, publikujemy bez podawania imienia”.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          area('l6_procedure', 'Kto przyjmuje zgłoszenia o możliwej krzywdzie dziecka i do kogo sprawa trafia dalej?', {
            help: 'Np. „zgłoszenie przyjmuje kierowniczka salonu, informuje właścicielkę, a w razie zagrożenia policję”. Na tej podstawie opiszę procedurę interwencji.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          single('l6_training', 'Czy pracownicy zostali przeszkoleni ze standardów ochrony dzieci?', ['Tak', 'Nie', 'Szkolenie jest zaplanowane'], {
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
          date('l6_review', 'Kiedy planujesz następny przegląd standardów ochrony dzieci?', {
            help: 'Standardy trzeba przeglądać co najmniej raz na 2 lata. Jeśli nie masz ustalonej daty, pomiń to pytanie.',
            showIf: { id: 'l6_applies', value: 'Tak' },
          }),
        ],
      },
      {
        id: 'l7',
        title: 'Twoje salony i lokalizacje',
        description:
          'Te dane pojawią się na stronie, w wizytówkach Google i w dokumentach. Jeśli masz kilka miejsc, dodaj każde osobno.',
        questions: [
          repeater('l7_places', 'Podaj dane każdego salonu, gabinetu lub punktu obsługi.', 'Lokalizacja', [
            ['Nazwa i pełny adres'],
            ['Numer telefonu'],
            ['Adres e-mail'],
            ['Godziny otwarcia w poszczególne dni tygodnia', 'textarea'],
            ['Godziny badań, jeśli różnią się od godzin otwarcia'],
            ['Dostępność dla osób z niepełnosprawnościami: czy jest podjazd lub wejście bez schodów, czy salon jest na parterze, czy jest dostępna toaleta i miejsce parkingowe dla osób z niepełnosprawnościami', 'textarea'],
          ], {
            required: true,
            help: 'Informacja o dostępności jest potrzebna do deklaracji dostępności i bardzo pomaga klientom.',
          }),
          single('l7_entities', 'Czy wszystkie Twoje salony działają w ramach jednej firmy?', [
            'Tak, wszystkie należą do jednej firmy',
            'Nie, część to osobne firmy',
          ], {
            help: 'Jeśli któryś salon jest osobną firmą, ma własne obowiązki wobec danych osobowych i potrzebuje osobnych dokumentów.',
          }),
          area('l7_entities_info', 'Które salony są osobnymi firmami? Podaj ich nazwy, NIP i adresy.', {
            showIf: { id: 'l7_entities', value: 'Nie, część to osobne firmy' },
          }),
        ],
      },
      {
        id: 'l8',
        title: 'Zgody i nowe przepisy',
        description:
          'W 2025 i 2026 roku weszło kilka nowych obowiązków dla stron internetowych. Te pytania pomogą mi sprawdzić, które z nich dotyczą Twojej firmy.',
        questions: [
          multi('l8_consents', 'Na co chcesz prosić klientów o zgodę?', [
            'Wysyłanie ofert i newslettera e-mailem',
            'Wysyłanie ofert SMS-em',
            'Dzwonienie z ofertami',
            'Publikację zdjęć z ich wizerunkiem',
            'Przypomnienia o kolejnej wizycie',
            'Dopasowywanie ofert do ich zakupów i potrzeb',
          ], {
            allowOther: true,
            help: 'Każda zgoda musi być osobna i dobrowolna. Przygotuję ich treść do formularzy na stronie i w salonie.',
          }),
          single('l8_cookies', 'Jaki baner zgód na pliki cookies chcesz mieć na stronie?', [
            'Prosty i bezpłatny',
            'Certyfikowany system zgód z Google Consent Mode v2 (potrzebny, jeśli chcesz prowadzić reklamy Google Ads)',
            'Nie wiem, wybierz najlepsze rozwiązanie dla mnie',
          ]),
          single('l8_ai', 'Czy na stronie ma działać asystent AI, który rozmawia z klientami?', ['Tak', 'Może w przyszłości', 'Nie'], {
            help: 'Od sierpnia 2026 roku, zgodnie z AI Act, klient musi być wyraźnie poinformowany, że rozmawia z programem, a nie z człowiekiem.',
          }),
          single('l8_withdraw', 'Czy klient będzie mógł kupić przez stronę produkt, bon lub usługę?', ['Tak', 'Nie', 'Nie wiem jeszcze'], {
            help: 'Od 19 czerwca 2026 roku każda strona, na której można zawrzeć umowę, musi mieć widoczny przycisk „Odstąp od umowy”.',
          }),
          single('l8_gpsr', 'Czy będziesz sprzedawać przez internet produkty, np. okulary, soczewki lub akcesoria?', ['Tak', 'Nie'], {
            help: 'Przy sprzedaży produktów online trzeba podać dane producenta i informacje o bezpieczeństwie produktu. Wymaga tego unijne rozporządzenie GPSR.',
          }),
          area('l8_gpsr_info', 'Jakie produkty chcesz sprzedawać i od jakich producentów?', {
            placeholder: 'np. soczewki kontaktowe marek…, oprawki…, płyny do soczewek',
            showIf: { id: 'l8_gpsr', value: 'Tak' },
          }),
          single('l8_newsletter', 'Jeśli będzie newsletter, czy zapis ma wymagać potwierdzenia kliknięciem w link z e-maila?', [
            'Tak, z potwierdzeniem',
            'Nie, bez potwierdzenia',
            'Nie będzie newslettera',
          ], {
            help: 'Potwierdzenie zapisu (tzw. double opt-in) daje dowód, że osoba naprawdę chciała się zapisać. Polecam je.',
          }),
          area('l8_existing', 'Czy masz już jakieś dokumenty, np. politykę prywatności, regulamin albo standardy ochrony dzieci?', {
            help: 'Wklej linki do nich albo opisz, co masz i skąd pochodzi. Sprawdzę, co można wykorzystać, a co trzeba przygotować od nowa.',
          }),
          text('l8_owner', 'Kto w Twojej firmie będzie pilnował, żeby dokumenty były aktualne?', {
            placeholder: 'Imię i nazwisko lub stanowisko',
            help: 'Przepisy się zmieniają. Dobrze, żeby jedna osoba wiedziała, gdzie są dokumenty i kiedy je przejrzeć.',
          }),
          area('l8_other', 'Czy jest coś jeszcze, o czym powinnam wiedzieć, przygotowując dokumenty?', {
            help: 'Np. nietypowe usługi, współpraca z innymi firmami, wcześniejsze problemy lub pytania od klientów dotyczące ich danych.',
          }),
        ],
      },
    ],
  },
}
