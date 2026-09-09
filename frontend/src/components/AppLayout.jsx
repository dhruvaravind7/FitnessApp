import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ActiveSessionBar from './ActiveSessionBar'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-main">
        <ActiveSessionBar />
        <Outlet />
      </div>
    </div>
  )
}
