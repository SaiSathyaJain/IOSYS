import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { LayoutDashboard, FileText, Send, Moon, Sun, Menu, X, Home, Lock } from 'lucide-react';
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import AdminPortal from './components/AdminPortal/AdminPortal';
import TeamPortal from './components/TeamPortal/TeamPortal';
import Dashboard from './components/Dashboard/Dashboard';
import LandingPage from './components/LandingPage/LandingPage';
import './App.css';

function NavLink({ to, icon: Icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${isActive ? 'active' : ''}`}>
      <Icon size={18} />
      <span>{children}</span>
    </Link>
  );
}

// Google Admin Login Component
function AdminLogin({ onLogin }) {
  const [error, setError] = useState('');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Fetch user info using the access token
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });
        const userInfo = await response.json();
        console.log('Login Success:', userInfo);

        // Basic Whitelist Check (Optional)
        const allowedEmails = ['sathyajain9@gmail.com', 'saisathyajain@sssihl.edu.in', 'results@sssihl.edu.in'];

        // Allow specific emails OR any email from your organization domain if needed
        if (allowedEmails.includes(userInfo.email) || userInfo.email.endsWith('@sssihl.edu.in')) {
          onLogin(userInfo);
        } else {
          setError('Access Denied: Unrestricted Email');
        }
      } catch (err) {
        console.error('Login verify error:', err);
        setError('Login verification failed');
      }
    },
    onError: () => setError('Login Failed'),
  });

  return (
    <div className="admin-login-container">
      <div className="card admin-login-card">
        <div className="admin-login-icon">
          <Lock size={48} />
        </div>
        <h2 className="admin-login-title">Admin Access</h2>
        <p className="admin-login-subtitle">Sign in to manage entries</p>

        <div className="admin-login-button-wrapper">
          <button className="btn-google" onClick={() => login()} aria-label="Sign in with Google">
            <div className="btn-google__icon-wrapper">
              <svg className="btn-google__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            </div>
            <span className="btn-google__text">Sign in with Google</span>
          </button>
        </div>

        {error && <p className="admin-login-error">{error}</p>}
      </div>
    </div>
  );
}

function Layout({ children, type = 'main' }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const particlesInit = useCallback(async engine => {
    await loadSlim(engine);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    // Check auth
    if (localStorage.getItem('adminAuth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    localStorage.setItem('adminAuth', 'true');
    localStorage.setItem('adminUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUser');
    window.location.href = '/';
  };

  // If Admin portal and not authenticated, show login
  if (type === 'admin' && !isAuthenticated) {
    return (
      <div className="app space-theme-wrapper">
        {/* Particles Background for Login Screen */}
        <Particles
          id="tsparticles-login"
          init={particlesInit}
          options={{
            background: { color: { value: isDarkMode ? "#0b0f19" : "#f0f2f5" } },
            particles: {
              color: { value: isDarkMode ? "#ffffff" : "#334155" },
              links: { color: isDarkMode ? "#ffffff" : "#334155", opacity: 0.1 },
              move: { enable: true, speed: 0.5 },
              number: { value: 60, density: { enable: true, area: 800 } },
              opacity: { value: 0.3 }
            }
          }}
          className="particles-bg"
        />
        <nav className="navbar">
          <div className="nav-brand">
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="brand-logo">IO</div>
              <h1>Admin Portal</h1>
            </Link>
          </div>
          <button className="theme-toggle" onClick={toggleTheme}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </nav>
        <main className="main-content" style={{ position: 'relative', zIndex: 10 }}>
          <AdminLogin onLogin={handleLogin} />
        </main>
      </div>
    );
  }

  return (
    <div className="app space-theme-wrapper">
      {/* Global Particles Background for Portals */}
      <Particles
        id="tsparticles-app"
        init={particlesInit}
        options={{
          background: { color: { value: isDarkMode ? "#0b0f19" : "#f0f2f5" } },
          particles: {
            color: { value: isDarkMode ? "#ffffff" : "#334155" },
            links: { color: isDarkMode ? "#ffffff" : "#334155", opacity: 0.1 },
            move: { enable: true, speed: 0.5 },
            number: { value: 60, density: { enable: true, area: 800 } },
            opacity: { value: 0.3 },
            size: { value: { min: 1, max: 3 } }
          }
        }}
        className="particles-bg"
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 0 }}
      />

      <nav className="navbar">
        <div className="nav-brand">
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="brand-logo">IO</div>
            <h1>
              {type === 'admin' ? 'Admin Portal' : type === 'team' ? 'Team Portal' : 'Inward/Outward'}
            </h1>
          </Link>
        </div>

        <div className="nav-links desktop-nav">
          {type === 'admin' && (
            <>
              <NavLink to="/admin" icon={LayoutDashboard}>Dashboard</NavLink>
              <NavLink to="/admin/entries" icon={FileText}>Entries</NavLink>
            </>
          )}

          {type === 'team' && (
            <NavLink to="/team" icon={Send}>Assignments</NavLink>
          )}

          {type !== 'main' && (
            <NavLink to="/" icon={Home}>Home</NavLink>
          )}

          {type === 'admin' && (
            <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}>
              Logout
            </button>
          )}

          <div className="divider-vertical"></div>

          <button className="theme-toggle" onClick={toggleTheme} title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-nav">
          {type === 'admin' && (
            <>
              <Link to="/admin" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <Link to="/admin/entries" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>
                <FileText size={20} /> Entries
              </Link>
            </>
          )}
          {type === 'team' && (
            <Link to="/team" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>
              <Send size={20} /> Assignments
            </Link>
          )}
          <Link to="/" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            <Home size={20} /> Home
          </Link>
          <button className="mobile-theme-item" onClick={toggleTheme}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      )}

      <main className="main-content" style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing Page - No Layout Wrapper */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<Layout type="admin"><Dashboard /></Layout>} />
        <Route path="/admin/entries" element={<Layout type="admin"><AdminPortal /></Layout>} />
        <Route path="/team" element={<Layout type="team"><TeamPortal /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;
