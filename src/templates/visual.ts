import type { Template } from '../lib/types'
import { area, matrix, multi, single, text, YES_PARTLY_NO } from './builders'

export const visual: Template = {
  key: 'visual',
  title: 'Dział wizualny',
  short: 'Wizualny',
  description: 'Identyfikacja, materiały, styl zdjęć i kierunek wizualny, który do Ciebie pasuje.',
  intro:
    'Ostateczny wygląd strony dobierzemy razem na rozmowie, na gotowych propozycjach wizualnych. Te odpowiedzi pomogą mi przygotować propozycje trafione od pierwszego spotkania.',
  minutes: 10,
  accent: '#02AFCA',
  schema: {
    sections: [
      {
        id: 'v1',
        title: 'Identyfikacja wizualna',
        description:
          'Identyfikacja wizualna (key visual) to stały zestaw elementów, po których klienci rozpoznają Twoją markę: logo, kolory, kroje pisma, styl zdjęć i grafik.',
        questions: [
          single('v1_identity', 'Jak wygląda identyfikacja Twoich salonów?', [
            'Wszystkie salony mają jedną wspólną identyfikację',
            'Każdy salon ma własną',
            'Część elementów jest wspólna, część inna',
            'Nie mamy spójnej identyfikacji',
          ]),
          single('v1_logo', 'Co z logo?', [
            'Zostaje bez zmian',
            'Chcę je odświeżyć',
            'Potrzebuję nowego logo',
            'Nie mam logo',
          ]),
          single('v1_brandbook', 'Czy masz księgę znaku / brand book?', ['Tak', 'Nie', 'Nie wiem']),
          text('v1_colors', 'Kolory firmowe', { placeholder: 'np. granat #0B2545, złoty' }),
          text('v1_avoid', 'Kolory, których nie chcesz na stronie'),
          text('v1_fonts', 'Kroje pisma (fonty), których używasz', { placeholder: 'jeśli wiesz' }),
        ],
      },
      {
        id: 'v2',
        title: 'Materiały, które już masz',
        questions: [
          matrix('v2_materials', 'Jakie materiały już masz?', [
            ['Logo w plikach źródłowych'],
            ['Zdjęcia salonów z zewnątrz i wnętrz'],
            ['Portrety zespołu'],
            ['Zdjęcia zespołu przy pracy'],
            ['Zdjęcia oprawek i produktów'],
            ['Zdjęcia realizacji i klientów (za zgodą)'],
            ['Zdjęcia z wizyt, także z dziećmi (za zgodą)'],
            ['Film wizerunkowy'],
            ['Rolki i krótkie filmy'],
            ['Materiały od producentów'],
            ['Skany dyplomów i nagród'],
          ], YES_PARTLY_NO),
          text('v2_link', 'Link do folderu z materiałami', {
            placeholder: 'Dysk Google, Dropbox, WeTransfer…',
            help: 'Jeśli materiały są już zebrane w jednym miejscu, wklej link.',
          }),
          single('v2_session', 'Czy potrzebna będzie sesja zdjęciowa lub film?', [
            'Tak, zdjęcia',
            'Tak, zdjęcia i film',
            'Nie, mamy materiały',
            'Chcę o tym porozmawiać',
          ]),
        ],
      },
      {
        id: 'v3',
        title: 'Kierunek wizualny',
        questions: [
          multi('v3_style', 'Który kierunek jest Ci najbliższy? Zaznacz maksymalnie 3.', [
            'Jasny i przestronny',
            'Ciemny i elegancki',
            'Ciepły, naturalny',
            'Kolorowy i odważny',
            'Minimalistyczny',
            'Oparty na dużych zdjęciach',
            'Z ilustracjami i grafiką',
            'Luksusowy, z detalami',
          ], { max: 3 }),
          multi('v3_photos', 'Jaki styl zdjęć lubisz?', [
            'Naturalne, z codziennego życia',
            'Studyjne, dopracowane',
            'Detale i zbliżenia produktów',
            'Ludzie przy pracy',
            'Portrety z emocjami',
            'Wnętrza i przestrzeń',
          ], { allowOther: true }),
          single('v3_motion', 'Ruch i animacje na stronie', [
            'Dużo, strona ma żyć i zaskakiwać',
            'Subtelne, eleganckie',
            'Minimum, liczy się szybkość i prostota',
          ]),
          area('v3_like', 'Strony lub marki, których wygląd Ci się podoba, i za co', { placeholder: 'Wklej linki i napisz kilka słów' }),
          area('v3_dislike', 'Czego na pewno nie chcesz na swojej stronie?'),
          area('v3_competitors', 'Strony konkurencji, od których chcesz się wyraźnie odróżnić'),
        ],
      },
    ],
  },
}
