import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import ActiveSessionBar from './ActiveSessionBar'
import './AppLayout.css'

// Routes that carry their own side panel, where the full sidebar would mean two nav
// columns side by side. /coach has a 280px conversation list, so the sidebar collapses
// to an icon rail there by default. The toggle still overrides it per visit.
const COLLAPSED_ROUTES = [/^\/coach(\/|$)/]

export default function AppLayout() {
  const { pathname } = useLocation()
  const routeCollapsed = COLLAPSED_ROUTES.some((re) => re.test(pathname))
  // null = follow the route's default; true/false = the user overrode it on this page.
  const [override, setOverride] = useState(null)

  // Forget the override on navigation so each route gets its own default back.
  useEffect(() => { setOverride(null) }, [pathname])

  const collapsed = override ?? routeCollapsed

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Navbar collapsed={collapsed} onToggleSidebar={() => setOverride(!collapsed)} />
      <div className="app-main">
        <ActiveSessionBar />
        <Outlet />
      </div>
    </div>
  )
}
