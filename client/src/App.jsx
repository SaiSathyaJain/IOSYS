import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './pages/LandingPage'
import AdminPortal from './components/AdminPortal/AdminPortal'
import Dashboard from './components/Dashboard/Dashboard'
import TeamSelection from './pages/TeamSelection'
import TeamPortal from './components/TeamPortal/TeamPortal'
import './index.css'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/team" element={<TeamSelection />} />
        <Route path="/team/:teamSlug" element={<TeamPortal />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

export default App
