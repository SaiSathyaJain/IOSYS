import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminPortal from './components/AdminPortal/AdminPortal'
import Dashboard from './components/Dashboard/Dashboard'
import TeamSelection from './pages/TeamSelection'
import TeamPortal from './components/TeamPortal/TeamPortal'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/team" element={<TeamSelection />} />
        <Route path="/team/:teamSlug" element={<TeamPortal />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
