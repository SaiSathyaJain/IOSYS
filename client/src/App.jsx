import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
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

// Enhanced Google Admin Login Component
function AdminLogin({ onLogin }) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = (credentialResponse) => {
    setIsLoading(true);
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log('Login Success:', decoded);

      // Basic Whitelist Check (Optional)
      const allowedEmails = ['sathyajain9@gmail.com', 'saisathyajain@sssihl.edu.in', 'results@sssihl.edu.in'];

      // Allow specific emails OR any email from your organization domain if needed
      if (allowedEmails.includes(decoded.email) || decoded.email.endsWith('@sssihl.edu.in')) {
        setTimeout(() => {
          onLogin(decoded);
          setIsLoading(false);
        }, 800);
      } else {
        setError('Access Denied: Unauthorized Email');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login verify error:', err);
      setError('Login verification failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Animated Background Gradient */}
        <div className="login-gradient-bg"></div>

        {/* Lock Icon with Animation */}
        <div className="login-icon-wrapper">
          <div className="login-icon-circle">
            <Lock size={40} strokeWidth={2.5} />
          </div>
        </div>

        {/* Header Section */}
        <div className="login-header">
          <h2 className="login-title">Admin Access</h2>
          <p className="login-subtitle">Sign in with your authorized account to manage entries</p>
        </div>

        {/* Login Button Container */}
        <div className="login-button-wrapper">
          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Login Failed')}
              theme="filled_blue"
              shape="pill"
              size="large"
            />
          </div>

          {isLoading && (
            <div className="login-loading">
              <div className="login-spinner"></div>
              <span>Verifying credentials...</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Security Notice */}
        <div className="login-footer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.5 }}>
            <path fillRule="evenodd" d="M8 1a3.5 3.5 0 00-3.5 3.5V7A1.5 1.5 0 003 8.5v5A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-5A1.5 1.5 0 0011.5 7V4.5A3.5 3.5 0 008 1zm2 6V4.5a2 2 0 10-4 0V7h4z" clipRule="evenodd" />
          </svg>
          <span>Secured with Google OAuth 2.0</span>
        </div>
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
