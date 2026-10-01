import { StrictMode, Suspense, lazy, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Loading, ToastProvider } from './components/ui'
import Login from './pages/admin/Login'
import BriefFormPage, { Notice } from './pages/client/BriefForm'
import ClientArea, { ClientTab } from './pages/client/ClientArea'
import Portal from './pages/client/Portal'
import './styles.css'

// Panel administratorki ładowany osobno: klient nie pobiera jego kodu
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const ClientDetail = lazy(() => import('./pages/admin/ClientDetail'))
const BriefAnswers = lazy(() => import('./pages/admin/BriefAnswers'))
const BriefPreview = lazy(() => import('./pages/admin/BriefAnswers').then((m) => ({ default: m.BriefPreview })))
const BriefEditor = lazy(() => import('./pages/admin/BriefEditor'))
const Templates = lazy(() => import('./pages/admin/Templates'))
const S = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>

// Po wdrożeniu nowej wersji otwarta karta może prosić o plik, którego już nie ma na serwerze.
// Zamiast ekranu błędu odświeżamy stronę, najwyżej raz na 30 sekund, żeby nie wpaść w pętlę.
window.addEventListener('vite:preloadError', (e) => {
  const KEY = 'nafu-reload-after-deploy'
  const last = Number(sessionStorage.getItem(KEY) || 0)
  if (Date.now() - last < 30_000) return
  sessionStorage.setItem(KEY, String(Date.now()))
  e.preventDefault()
  window.location.reload()
})

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/panel" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/logowanie', element: <Login variant="client" /> },
  // podglądy (pełny ekran, bez menu panelu)
  { path: '/panel/ankieta/:id/podglad', element: S(<BriefPreview />) },
  { path: '/panel/szablony/:key/podglad', element: S(<BriefPreview />) },
  {
    path: '/panel',
    element: S(<AdminLayout />),
    errorElement: <Notice title="Coś poszło nie tak" text="Odśwież stronę. Jeśli błąd wróci, daj mi znać." />,
    children: [
      { index: true, element: S(<Dashboard />) },
      { path: 'klient/:id', element: S(<ClientDetail />) },
      { path: 'ankieta/:id', element: S(<BriefAnswers />) },
      { path: 'ankieta/:id/edycja', element: S(<BriefEditor />) },
      { path: 'szablony', element: S(<Templates />) },
    ],
  },
  // strony klienta: krótkie adresy, np. /optyka-perfect-hg98 i /optyka-perfect-hg98/prawny
  {
    path: '/:client',
    element: <ClientArea />,
    errorElement: <Notice title="Coś poszło nie tak" text="Odśwież stronę. Jeśli błąd wróci, napisz do mnie." />,
    children: [
      { index: true, element: <Portal /> },
      { path: 'sprawy', element: <ClientTab tab="sprawy" /> },
      { path: 'podglad', element: <ClientTab tab="podglad" /> },
      { path: 'dostepy', element: <ClientTab tab="dostepy" /> },
      { path: 'dokumenty', element: <ClientTab tab="dokumenty" /> },
      { path: 'profil', element: <ClientTab tab="profil" /> },
      { path: 'media', element: <ClientTab tab="media" /> },
      { path: 'zespol', element: <ClientTab tab="zespol" /> },
      { path: 'uslugi', element: <ClientTab tab="uslugi" /> },
      { path: 'wiadomosci', element: <ClientTab tab="wiadomosci" /> },
      { path: ':brief', element: <BriefFormPage /> },
    ],
  },
  { path: '*', element: <Notice title="Nie ma takiej strony" text="Sprawdź, czy link jest kompletny." /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
)
