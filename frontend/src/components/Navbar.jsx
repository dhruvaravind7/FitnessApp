import { NavLink, useNavigate } from 'react-router-dom'
import { Dumbbell, History, LayoutDashboard, LogOut, MessageSquareHeart, Search } from 'lucide-react'
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

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><Dumbbell size={18} /></span>
          <span>FitCoach</span>
        </NavLink>
        <nav className="side-nav">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="row between">
            <span className="small text-2">Units</span>
            <UnitToggle />
          </div>
          <div className="user-chip">
            <span className="avatar">{(user?.username || '?').slice(0, 1).toUpperCase()}</span>
            <span className="user-name" title={user?.username}>{user?.username}</span>
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
