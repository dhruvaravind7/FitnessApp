import { NavLink, useNavigate } from 'react-router-dom'
import {
  Dumbbell, History, LayoutDashboard, LogOut, MessageSquareHeart,
  PanelLeftClose, PanelLeftOpen, Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUnit } from '../context/UnitContext'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/search', label: 'Exercises', icon: Search },
  { to: '/history', label: 'History', icon: History },
  { to: '/coach', label: 'Coach', icon: MessageSquareHeart },
]

export function UnitToggle({ compact = false }) {
  const { unit, setUnit } = useUnit()
  return (
    <div className={`unit-toggle ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Weight unit">
      {['lbs', 'kg'].map((u) => (
        <button key={u} role="radio" aria-checked={unit === u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
          {u}
        </button>
      ))}
    </div>
  )
}

export default function Navbar({ collapsed = false, onToggleSidebar }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // Labels stay in the DOM when collapsed so screen readers still announce them.
  const labelClass = collapsed ? 'sr-only' : ''

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-top">
          <NavLink to="/" className="brand" title={collapsed ? 'FitCoach' : undefined}>
            <span className="brand-mark"><Dumbbell size={18} /></span>
            <span className={labelClass}>FitCoach</span>
          </NavLink>
          <button
            className="btn btn-ghost btn-icon sidebar-toggle"
            onClick={onToggleSidebar}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="side-nav">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined}
                     className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} /> <span className={labelClass}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {/* The kg/lbs pill cannot fit a 64px rail, and it is rarely changed — drop it
              while collapsed rather than shrinking it into something unclickable. */}
          {!collapsed && (
            <div className="row between">
              <span className="small text-2">Units</span>
              <UnitToggle />
            </div>
          )}
          <div className="user-chip">
            <span className="avatar" title={collapsed ? user?.username : undefined}>
              {(user?.username || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className={`user-name ${labelClass}`} title={user?.username}>{user?.username}</span>
            <button className="btn btn-ghost btn-icon" onClick={handleLogout} aria-label="Log out" title="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <nav className="bottom-nav">
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} /> <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
