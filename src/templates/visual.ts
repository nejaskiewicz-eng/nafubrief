import type { Template } from '../lib/types'
import { area, matrix, multi, single, text, YES_PARTLY_NO } from './builders'

export const visual: Template = {
  key: 'visual',
  title: 'Dział wizualny',
  short: 'Wizualny',
  description: 'Identyfikacja wizualna, zdjęcia i materiały, które już masz, oraz styl, który do Ciebie pasuje.',
  intro:
    'Ostateczny wygląd strony dobierzemy razem na rozmowie, na gotowych propozycjach wizualnych. Te odpowiedzi pomogą mi przygotować propozycje, które od pierwszego spotkania będą bliskie temu, czego szukasz.\n\nNie ma tu dobrych ani złych odpowiedzi. Kieruj się tym, co Ci się podoba i co pasuje do Twojej firmy.',
  minutes: 10,
  accent: '#02AFCA',
  schema: {
    sections: [
      {
        id: 'v1',
        title: 'Logo, kolory i kroje pisma',
        description:
          'Identyfikacja wizualna to stały zestaw elementów, po których klienci rozpoznają Twoją markę: logo, kolory, kroje pisma, styl zdjęć i grafik.',
        questions: [
          single('v1_identity', 'Jak wygląda identyfikacja wizualna Twoich salonów?', [
            'Wszystkie salony mają jedną, wspólną identyfikację',
            'Każdy salon ma własną',
            'Część elementów jest wspólna, część się różni',
            'Nie mamy spójnej identyfikacji',
          ]),
          single('v1_logo', 'Co chcesz zrobić z obecnym logo?', [
            'Zostawić bez zmian',
            'Odświeżyć, ale zachować jego charakter',
            'Zaprojektować nowe',
            'Nie mam logo',
          ]),
          single('v1_brandbook', 'Czy masz księgę znaku, czyli dokument z zasadami używania logo, kolorów i krojów pisma?', ['Tak', 'Nie', 'Nie wiem'], {
            help: 'Jeśli tak, prześlij ją razem z innymi materiałami. Dzięki niej strona będzie w pełni spójna z Twoją marką.',
          }),
          text('v1_colors', 'Jakie są kolory Twojej firmy?', {
            placeholder: 'np. granat i złoty albo kody kolorów, jeśli je znasz',
          }),
          text('v1_avoid', 'Czy są kolory, których na pewno nie chcesz na stronie?'),
          text('v1_fonts', 'Czy wiesz, jakich krojów pisma (fontów) używasz w materiałach firmowych?', {
            placeholder: 'np. Montserrat, Playfair Display',
            help: 'Jeśli nie wiesz, zostaw puste. Sprawdzę to w plikach, które mi prześlesz.',
          }),
        ],
      },
      {
        id: 'v2',
        title: 'Materiały, które już masz',
        description: 'Dzięki tej liście będę wiedzieć, co mogę wykorzystać od razu, a co trzeba przygotować.',
        questions: [
          matrix('v2_materials', 'Które z tych materiałów już masz?', [
            ['Logo w plikach źródłowych', 'Pliki do edycji, np. AI, EPS, SVG lub PDF, a nie tylko obrazek JPG'],
            ['Zdjęcia salonów z zewnątrz i wnętrz'],
            ['Portrety zespołu'],
            ['Zdjęcia zespołu przy pracy'],
            ['Zdjęcia oprawek i produktów'],
            ['Zdjęcia klientów i realizacji', 'Tylko takie, na których publikację klienci wyrazili zgodę'],
            ['Zdjęcia z wizyt, także z dziećmi', 'Tylko za zgodą klientów lub rodziców'],
            ['Film wizerunkowy'],
            ['Rolki i krótkie filmy'],
            ['Materiały od producentów', 'Zdjęcia, katalogi i opisy produktów od marek, które sprzedajesz'],
            ['Skany dyplomów, certyfikatów i nagród'],
          ], YES_PARTLY_NO),
          text('v2_link', 'Jeśli masz już materiały zebrane w jednym miejscu, wklej link do folderu.', {
            placeholder: 'np. Dysk Google, Dropbox, WeTransfer',
            help: 'Upewnij się, że folder jest udostępniony do odczytu dla osób z linkiem.',
          }),
          single('v2_session', 'Czy do nowej strony potrzebna będzie sesja zdjęciowa lub film?', [
            'Tak, sesja zdjęciowa',
            'Tak, sesja zdjęciowa i film',
            'Nie, mamy wystarczająco dobre materiały',
            'Chcę o tym porozmawiać',
          ]),
        ],
      },
      {
        id: 'v3',
        title: 'Styl, który Ci się podoba',
        questions: [
          multi('v3_style', 'Który styl strony jest Ci najbliższy? Zaznacz maksymalnie 3 odpowiedzi.', [
            'Jasny i przestronny',
            'Ciemny i elegancki',
            'Ciepły, naturalny',
            'Kolorowy i odważny',
            'Minimalistyczny',
            'Oparty na dużych zdjęciach',
            'Z ilustracjami i grafikami',
            'Luksusowy, z dopracowanymi detalami',
          ], { max: 3 }),
          multi('v3_photos', 'Jakie zdjęcia najbardziej Ci się podobają?', [
            'Naturalne, jak z codziennego życia',
            'Studyjne, dopracowane',
            'Zbliżenia produktów i detali',
            'Ludzie przy pracy',
            'Portrety pełne emocji',
            'Wnętrza i przestrzeń',
          ], { allowOther: true }),
          single('v3_motion', 'Ile ruchu i animacji chcesz na stronie?', [
            'Dużo, strona ma żyć i zaskakiwać',
            'Trochę, subtelnie i elegancko',
            'Jak najmniej, liczy się szybkość i prostota',
          ]),
          area('v3_like', 'Jakie strony lub marki podobają Ci się wizualnie i dlaczego?', {
            placeholder: 'Wklej linki i dopisz kilka słów, co Ci się w nich podoba',
            help: 'Mogą to być strony z dowolnej branży. Wystarczy np. „podoba mi się, jak pokazują zdjęcia” albo „lubię te kolory”.',
          }),
          area('v3_dislike', 'Czego na pewno nie chcesz na swojej stronie?', {
            help: 'Np. konkretnych kolorów, stylu zdjęć, rozwiązań, które irytują Cię na innych stronach.',
          }),
          area('v3_competitors', 'Od stron których firm konkurencyjnych chcesz się wyraźnie odróżnić?', {
            help: 'Wklej linki. Sprawdzę, jak wyglądają, i zaproponuję coś, co wyróżni Cię na ich tle.',
          }),
        ],
      },
    ],
  },
}
