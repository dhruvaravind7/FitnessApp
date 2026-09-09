import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="center" style={{ minHeight: '100dvh', padding: 24 }}>
      <div className="empty" style={{ maxWidth: 420 }}>
        <span className="empty-icon"><Compass size={26} /></span>
        <h3>Page not found</h3>
        <p>That route doesn&apos;t exist. Let&apos;s get you back on track.</p>
        <Link className="btn btn-primary" to="/">Go to dashboard</Link>
      </div>
    </div>
  )
}
