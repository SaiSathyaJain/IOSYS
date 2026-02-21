import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminEntry from './pages/AdminEntry'
import AdminDashboard from './pages/AdminDashboard'
import TeamSelection from './pages/TeamSelection'
import TeamWorkspace from './pages/TeamWorkspace'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <div className="dynamic-background"></div>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/entry" element={<AdminEntry />} />
          <Route path="/team" element={<TeamSelection />} />
          <Route path="/team/:teamId" element={<TeamWorkspace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
