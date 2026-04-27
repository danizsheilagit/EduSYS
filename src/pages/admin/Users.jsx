import { useState, useEffect } from 'react'
import { Users, Search, Edit2, Loader2, X, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ROLES = ['mahasiswa','dosen','admin','guest']
const ROLE_COLORS = { admin:'badge-red', dosen:'badge-amber', mahasiswa:'badge-indigo', guest:'badge-slate' }

export default function AdminUsers() {
  const [users,     setUsers]     = useState([])
  const [prodiList, setProdiList] = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [editForm,  setEditForm]  = useState({})

  useEffect(() => { fetchUsers(); fetchProdi() }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function fetchProdi() {
    const { data } = await supabase.from('program_studi').select('id, name, code').order('name')
    setProdiList(data || [])
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name:     editForm.full_name,
      nim:           editForm.role === 'mahasiswa' ? editForm.nim  : null,
      nidn:          editForm.role === 'dosen'     ? editForm.nidn : null,
      program_studi: editForm.program_studi || null,
      role:          editForm.role,
    }).eq('id', editing.id)
    if (error) {
      console.error('[EduSYS] update profile error:', error)
      toast.error(`Gagal menyimpan: ${error.message}`)
    } else {
      toast.success('Profil berhasil diperbarui')
      fetchUsers()
      setEditing(null)
    }
    setSaving(false)
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.nim?.includes(search)
  )

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Manajemen Pengguna</h1>
          <p className="page-subtitle">{users.length} pengguna terdaftar</p>
        </div>
      </div>

      <div className="card">
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--gray-100)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative', flex:1, maxWidth:320 }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }}/>
            <input className="input" style={{ paddingLeft:32 }} placeholder="Cari nama, email, NIM…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>

        {loading ? (
          <div style={{ padding:32, display:'flex', justifyContent:'center' }}><div className="spinner"/></div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                {['Pengguna','Role','NIM/NIDN','Program Studi','Aksi'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--gray-100)' : 'none' }}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="avatar" style={{ width:30, height:30, fontSize:12 }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt=""/> : u.full_name?.[0]||'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{u.full_name||'–'}</div>
                        <div style={{ fontSize:11, color:'var(--gray-400)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span className={`badge-pill ${ROLE_COLORS[u.role]||'badge-slate'}`}>{u.role}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'var(--gray-600)' }}>{u.nim||u.nidn||'–'}</td>
                  <td style={{ padding:'12px 16px', fontSize:12, color:'var(--gray-600)' }}>{u.program_studi||'–'}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(u); setEditForm({...u}) }}>
                      <Edit2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <div className="modal-header">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Shield size={16} color="var(--indigo-600)"/>
                <span className="modal-title">Edit Pengguna</span>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(null)}><X size={14}/></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nama Lengkap</label>
                <input className="input" value={editForm.full_name||''} onChange={e => setEditForm(f=>({...f,full_name:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">Role</label>
                <select className="input" value={editForm.role} onChange={e => {
                  const newRole = e.target.value
                  setEditForm(f => ({
                    ...f,
                    role: newRole,
                    // Kosongkan field yang tidak relevan saat role berubah
                    nim:  newRole === 'mahasiswa' ? f.nim  : '',
                    nidn: newRole === 'dosen'     ? f.nidn : '',
                  }))
                }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="input-hint">Mengubah role akan mempengaruhi akses sistem</span>
              </div>
              <div className="form-grid form-grid-2">
                {/* NIM — aktif hanya untuk mahasiswa */}
                <div className="input-group">
                  <label className="input-label" style={{ color: editForm.role !== 'mahasiswa' ? 'var(--gray-300)' : undefined }}>
                    NIM
                  </label>
                  <input
                    className="input"
                    placeholder="Untuk mahasiswa"
                    value={editForm.nim || ''}
                    disabled={editForm.role !== 'mahasiswa'}
                    style={editForm.role !== 'mahasiswa'
                      ? { background:'var(--gray-50)', color:'var(--gray-300)', cursor:'not-allowed' }
                      : {}}
                    onChange={e => setEditForm(f => ({...f, nim: e.target.value}))}
                  />
                </div>
                {/* NIDN/NUPTK — aktif hanya untuk dosen */}
                <div className="input-group">
                  <label className="input-label" style={{ color: editForm.role !== 'dosen' ? 'var(--gray-300)' : undefined }}>
                    NIDN/NUPTK
                  </label>
                  <input
                    className="input"
                    placeholder="Untuk dosen"
                    value={editForm.nidn || ''}
                    disabled={editForm.role !== 'dosen'}
                    style={editForm.role !== 'dosen'
                      ? { background:'var(--gray-50)', color:'var(--gray-300)', cursor:'not-allowed' }
                      : {}}
                    onChange={e => setEditForm(f => ({...f, nidn: e.target.value}))}
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Program Studi</label>
                <select
                  className="input"
                  value={editForm.program_studi || ''}
                  onChange={e => setEditForm(f => ({...f, program_studi: e.target.value}))}
                >
                  <option value="">— Pilih Program Studi —</option>
                  {prodiList.map(p => (
                    <option key={p.id} value={p.name}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Batal</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation:'spin .7s linear infinite' }}/> : null} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
