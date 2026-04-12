import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'The Library', icon: '\u{1F4DA}' },
  { path: '/search', label: 'Search', icon: '\u{1F50D}' },
  { path: '/glossary', label: 'Concept Glossary', icon: '\u{1F4D6}' },
  { path: '/map', label: 'Conversation Map', icon: '\u{1F310}' },
  { path: '/frameworks', label: 'Framework Tracker', icon: '\u{1F9E9}' },
  { path: '/definitions', label: 'Texts & Technology', icon: '\u{2696}' },
];

export default function Layout({ onSettingsOpen }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <div className="mobile-nav">
        <h1>The Core Texts</h1>
        <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>The Core Texts</h1>
          <p>Digital Archive</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={onSettingsOpen}>Settings</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
