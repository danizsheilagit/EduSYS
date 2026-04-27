import { Component, createContext, useContext, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar     from './Sidebar'
import Header      from './Header'
import AIAssistant from '@/components/ai/AIAssistant'

export const SidebarContext = createContext({ open: true, toggle: () => {} })
export const useSidebar = () => useContext(SidebarContext)

/** Error Boundary */
class ErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('[EduSYS] Render error:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, padding:32 }}>
          <div style={{ fontSize:48 }}>⚠️</div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'var(--gray-800)' }}>Terjadi Kesalahan</h2>
          <p style={{ fontSize:13, color:'var(--gray-500)', textAlign:'center', maxWidth:400 }}>
            Halaman ini mengalami error. Silakan refresh halaman atau kembali ke dashboard.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>🔄 Refresh</button>
            <button className="btn btn-primary btn-sm" onClick={() => { this.setState({ hasError:false }); window.location.href='/dashboard' }}>Ke Dashboard</button>
          </div>
          {import.meta.env.DEV && (
            <pre style={{ fontSize:11, color:'var(--danger)', background:'#fff1f2', padding:12, borderRadius:8, maxWidth:600, overflow:'auto', marginTop:8 }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default function AppLayout() {
  const [open, setOpen] = useState(true)

  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen(v => !v) }}>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main" style={{ marginLeft: open ? 0 : 0 }}>
          <Header />
          <main className="app-content">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <AIAssistant />
      </div>
    </SidebarContext.Provider>
  )
}
