import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import AdminLayout from './pages/admin/AdminLayout'
import BriefAnswers, { BriefPreview } from './pages/admin/BriefAnswers'
import BriefEditor from './pages/admin/BriefEditor'
import ClientDetail from './pages/admin/ClientDetail'
import Dashboard from './pages/admin/Dashboard'
import Login from './pages/admin/Login'
import Templates from './pages/admin/Templates'
import BriefFormPage, { Notice } from './pages/client/BriefForm'
import ClientArea, { ClientTab } from './pages/client/ClientArea'
import Portal from './pages/client/Portal'
import './styles.css'

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/panel" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/logowanie', element: <Login variant="client" /> },
  // podglądy (pełny ekran, bez menu panelu)
  { path: '/panel/ankieta/:id/podglad', element: <BriefPreview /> },
  { path: '/panel/szablony/:key/podglad', element: <BriefPreview /> },
  {
    path: '/panel',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'klient/:id', element: <ClientDetail /> },
      { path: 'ankieta/:id', element: <BriefAnswers /> },
      { path: 'ankieta/:id/edycja', element: <BriefEditor /> },
      { path: 'szablony', element: <Templates /> },
    ],
  },
  // strony klienta: krótkie adresy, np. /optyka-perfect-hg98 i /optyka-perfect-hg98/prawny
  {
    path: '/:client',
    element: <ClientArea />,
    children: [
      { index: true, element: <Portal /> },
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
