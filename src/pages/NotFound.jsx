import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--gray-50)', gap: 12 }}>
      <div style={{ fontSize: 60 }}>🔍</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color:'var(--gray-900)' }}>404 — Halaman Tidak Ditemukan</h1>
      <p style={{ color:'var(--gray-500)', fontSize: 14 }}>Halaman yang Anda cari tidak ada atau telah dipindahkan.</p>
      <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
        Kembali ke Dashboard
      </button>
    </div>
  )
}
