import { BookOpen } from 'lucide-react'

export default function MataKuliah() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mata Kuliah</h1>
        <p className="page-subtitle">Daftar mata kuliah yang Anda ikuti</p>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpen size={36} color="var(--gray-300)" /></div>
            <p className="empty-state-text">Halaman Mata Kuliah</p>
            <p className="empty-state-sub">Fitur lengkap akan hadir di Phase 2</p>
          </div>
        </div>
      </div>
    </div>
  )
}
