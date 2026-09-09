import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { UnitProvider } from './context/UnitContext'
import { ToastProvider } from './context/ToastContext'
import { SessionProvider } from './context/SessionContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import ExerciseDetail from './pages/ExerciseDetail'
import History from './pages/History'
import SessionDetail from './pages/SessionDetail'
import Coach from './pages/Coach'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UnitProvider>
          <ToastProvider>
            <SessionProvider>
              <Routes>
                <Route path="/login" element={<Auth />} />
                <Route path="/create-user" element={<Navigate to="/login?tab=register" replace />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/exercise/:id" element={<ExerciseDetail />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/sessions/:id" element={<SessionDetail />} />
                    <Route path="/coach" element={<Coach />} />
                    <Route path="/coach/:conversationId" element={<Coach />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SessionProvider>
          </ToastProvider>
        </UnitProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
