import { ExternalLink, FileText, Image, Film, Archive, File } from 'lucide-react'

const MIME_ICONS = {
  'application/pdf':                   { icon: FileText, color: '#ef4444', label: 'PDF' },
  'image/':                            { icon: Image,    color: '#10b981', label: 'Gambar' },
  'video/':                            { icon: Film,     color: '#8b5cf6', label: 'Video' },
  'application/zip':                   { icon: Archive,  color: '#f59e0b', label: 'ZIP' },
  'application/vnd.google-apps.document': { icon: FileText, color: '#4285f4', label: 'Docs' },
  'application/vnd.google-apps.presentation': { icon: FileText, color: '#fbbc04', label: 'Slides' },
  'application/vnd.google-apps.spreadsheet': { icon: FileText, color: '#34a853', label: 'Sheets' },
}

function getMimeInfo(mimeType) {
  if (!mimeType) return { icon: File, color: 'var(--gray-400)', label: 'Link' }
  for (const [key, val] of Object.entries(MIME_ICONS)) {
    if (mimeType.startsWith(key)) return val
  }
  return { icon: File, color: 'var(--gray-400)', label: 'File' }
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * FilePreview — shows a file card with Drive link
 * Props: name, mimeType, webViewLink, fileSize
 */
export default function FilePreview({ name, mimeType, webViewLink, fileSize, compact = false }) {
  if (!webViewLink && !name) return null

  const { icon: Icon, color, label } = getMimeInfo(mimeType)

  if (compact) {
    return (
      <a
        href={webViewLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
          borderRadius: 6, fontSize: 12, color: 'var(--gray-700)',
          textDecoration: 'none', maxWidth: 260,
        }}
      >
        <Icon size={12} color={color} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {name || 'Lihat File'}
        </span>
        <ExternalLink size={10} color="var(--gray-400)" />
      </a>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      border: '1px solid var(--gray-200)', borderRadius: 8,
      background: '#fff',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name || 'File'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
          {label} {fileSize ? `· ${formatBytes(fileSize)}` : ''}
        </div>
      </div>
      {webViewLink && (
        <a
          href={webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          <ExternalLink size={12} /> Buka
        </a>
      )}
    </div>
  )
}
