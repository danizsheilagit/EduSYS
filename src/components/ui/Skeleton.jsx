/**
 * Skeleton — Reusable shimmer placeholder components
 * Usage:
 *   <Sk.Line />               — single text line
 *   <Sk.Line width="60%" />   — shorter line
 *   <Sk.Block h={120} />      — rectangular block
 *   <Sk.Circle size={40} />   — avatar/circle
 *   <Sk.StatCards n={4} />    — stats grid
 *   <Sk.Table rows={5} cols={4} /> — table rows
 *   <Sk.CardList n={3} />     — stacked card rows
 *   <Sk.PageHeader />         — page title + subtitle
 */

const shimmerStyle = {
  background: 'var(--sk-bg)',
  backgroundImage: 'linear-gradient(90deg, var(--sk-bg) 0%, var(--sk-shine) 40%, var(--sk-bg) 80%)',
  backgroundSize: '400px 100%',
  animation: 'sk-shimmer 1.4s ease-in-out infinite',
  borderRadius: 6,
}

// Base block
export function Sk({ w='100%', h=14, r=6, style={} }) {
  return <div style={{ width:w, height:h, borderRadius:r, ...shimmerStyle, ...style }}/>
}

// Text line (short default)
Sk.Line = function SkLine({ width='100%', h=13, style={} }) {
  return <div style={{ width, height:h, borderRadius:4, ...shimmerStyle, ...style }}/>
}

// Rectangular block (images, charts, etc.)
Sk.Block = function SkBlock({ h=120, r=8, style={} }) {
  return <div style={{ width:'100%', height:h, borderRadius:r, ...shimmerStyle, ...style }}/>
}

// Circle (avatars, icons)
Sk.Circle = function SkCircle({ size=40 }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, ...shimmerStyle }}/>
}

// ── Composite ──────────────────────────────────────────────────

// Page header (title + subtitle)
Sk.PageHeader = function SkPageHeader() {
  return (
    <div className="page-header" style={{ marginBottom:24 }}>
      <div>
        <Sk.Line width={220} h={22} style={{ marginBottom:8 }}/>
        <Sk.Line width={320} h={13}/>
      </div>
    </div>
  )
}

// Stats cards row
Sk.StatCards = function SkStatCards({ n=4 }) {
  return (
    <div className="stats-grid" style={{ marginBottom:24 }}>
      {Array.from({ length:n }).map((_,i) => (
        <div key={i} className="stat-card">
          <Sk.Circle size={32}/>
          <div style={{ flex:1 }}>
            <Sk.Line width="60%" h={11} style={{ marginBottom:6 }}/>
            <Sk.Line width="40%" h={20}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// Table rows
Sk.Table = function SkTable({ rows=5, cols=4, showHeader=true }) {
  const colWidths = ['30%','40%','15%','15%','15%','20%']
  return (
    <div className="card">
      {showHeader && (
        <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--gray-100)' }}>
          <Sk.Line width={160} h={14}/>
        </div>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <tbody>
            {Array.from({ length:rows }).map((_,i) => (
              <tr key={i} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                {Array.from({ length:cols }).map((_,j) => (
                  <td key={j} style={{ padding:'14px 16px' }}>
                    <Sk.Line width={colWidths[j] || '80%'} h={12}/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// List rows inside a card (for sidebar-style lists)
Sk.CardList = function SkCardList({ n=4, avatar=true }) {
  return (
    <div className="card">
      {Array.from({ length:n }).map((_,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i<n-1 ? '1px solid var(--gray-100)' : 'none' }}>
          {avatar && <Sk.Circle size={36}/>}
          <div style={{ flex:1 }}>
            <Sk.Line width="55%" h={13} style={{ marginBottom:6 }}/>
            <Sk.Line width="80%" h={11}/>
          </div>
          <Sk.Line width={48} h={22} r={99}/>
        </div>
      ))}
    </div>
  )
}

// Course grid cards
Sk.CourseGrid = function SkCourseGrid({ n=4 }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16 }}>
      {Array.from({ length:n }).map((_,i) => (
        <div key={i} className="card" style={{ overflow:'hidden' }}>
          <Sk.Block h={72} r={0}/>
          <div style={{ padding:'14px 16px' }}>
            <Sk.Line width="40%" h={11} style={{ marginBottom:8 }}/>
            <Sk.Line width="80%" h={15} style={{ marginBottom:6 }}/>
            <Sk.Line width="60%" h={11}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// Analytics / chart placeholder
Sk.Chart = function SkChart({ h=140, label='' }) {
  return (
    <div>
      {label && <Sk.Line width={140} h={13} style={{ marginBottom:12 }}/>}
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:h }}>
        {[60,80,45,90,70,55,85,40,75,65].map((p,i) => (
          <div key={i} style={{ flex:1, height:`${p}%`, borderRadius:'4px 4px 0 0', ...shimmerStyle }}/>
        ))}
      </div>
    </div>
  )
}

// Calendar grid skeleton
Sk.Calendar = function SkCalendar() {
  return (
    <div className="card">
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--gray-100)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Sk.Line width={32} h={28} r={6}/>
        <Sk.Line width={140} h={16}/>
        <Sk.Line width={32} h={28} r={6}/>
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {Array.from({length:7}).map((_,i)=><Sk.Line key={i} h={10} width="70%" style={{ margin:'auto' }}/>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {Array.from({length:35}).map((_,i)=>(
            <div key={i} style={{ minHeight:52, borderRadius:8, ...shimmerStyle, opacity: 0.3+Math.random()*0.4 }}/>
          ))}
        </div>
      </div>
    </div>
  )
}

// Dashboard hero
Sk.DashboardHero = function SkDashboardHero() {
  return (
    <div style={{ borderRadius:16, padding:'28px 32px', marginBottom:28, ...shimmerStyle, height:120 }}/>
  )
}

export default Sk
