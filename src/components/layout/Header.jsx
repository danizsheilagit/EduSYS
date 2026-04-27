import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Bell, Settings, LogOut, User,
  ChevronDown, KeyRound, Sparkles, PanelLeftOpen, PanelLeftClose,
  Sun, Moon
} from 'lucide-react'
import { useAuth }    from '@/contexts/AuthContext'
import { useAI }      from '@/contexts/AIContext'
import { useTheme }   from '@/contexts/ThemeContext'
import { useSidebar } from './AppLayout'
import AISettingsModal from '@/components/ai/AISettingsModal'
import GlobalSearch   from './GlobalSearch'

const LOGO_URL = 'https://i.ibb.co.com/kgV7WDhF/Logo-SYS.png'

export default function Header() {
  const { profile, signOut } = useAuth()
  const { setChatOpen }      = useAI()
  const { open, toggle }     = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const navigate             = useNavigate()

  const [dropOpen,  setDropOpen]  = useState(false)
  const [aiModal,   setAiModal]   = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const dropRef  = useRef(null)
  const notifRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current  && !dropRef.current.contains(e.target))  setDropOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : 'U'

  return (
    <>
      <header className="app-header">
        {/* Sidebar toggle */}
        <button onClick={toggle} className="btn btn-ghost btn-icon" title={open ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}>
          {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <span className="header-sep" />

        {/* Search */}
        <GlobalSearch />

        <div className="header-actions">
          {/* Theme toggle */}
          <button
            className="btn btn-ghost btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            style={{ transition: 'transform .3s' }}
          >
            {theme === 'dark'
              ? <Sun  size={16} color="#fbbf24" />
              : <Moon size={16} />}
          </button>

          {/* AI Assistant shortcut */}
          <button
            className="btn btn-ghost btn-icon"
            title="AI Assistant"
            onClick={() => setChatOpen(true)}
          >
            <Sparkles size={16} color="var(--indigo-600)" />
          </button>

          {/* Notifications */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setNotifOpen(v => !v)}
              title="Notifikasi"
            >
              <Bell size={16} />
            </button>
            {notifOpen && (
              <div className="dropdown-menu" style={{ width: 280 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
                  <strong style={{ fontSize: 13 }}>Notifikasi</strong>
                </div>
                <div className="empty-state" style={{ padding: '24px' }}>
                  <Bell size={22} color="var(--gray-300)" />
                  <span className="empty-state-text">Belum ada notifikasi</span>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button className="avatar-btn" onClick={() => setDropOpen(v => !v)}>
              <div className="avatar">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={profile.full_name} />
                  : initials
                }
              </div>
              <span className="avatar-name" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Pengguna'}
              </span>
              <ChevronDown size={12} color="var(--gray-400)" />
            </button>

            {dropOpen && (
              <div className="dropdown-menu">
                {/* User info */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-900)' }}>
                    {profile?.full_name || 'Pengguna'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                    {profile?.role?.toUpperCase()} {profile?.nim ? `· ${profile.nim}` : profile?.nidn ? `· ${profile.nidn}` : ''}
                  </div>
                </div>

                <button className="dropdown-item" onClick={() => { navigate('/profile'); setDropOpen(false) }}>
                  <User size={14} /> Profil Saya
                </button>
                <button className="dropdown-item" onClick={() => { setAiModal(true); setDropOpen(false) }}>
                  <KeyRound size={14} /> Pengaturan AI Key
                </button>
                <button className="dropdown-item" onClick={() => { navigate('/settings'); setDropOpen(false) }}>
                  <Settings size={14} /> Pengaturan
                </button>

                <div className="dropdown-sep" />

                <button className="dropdown-item danger" onClick={signOut}>
                  <LogOut size={14} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* AI Settings Modal */}
      {aiModal && <AISettingsModal onClose={() => setAiModal(false)} />}
    </>
  )
}
