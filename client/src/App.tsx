import { useState, useEffect } from 'react'
import './App.css'
import type { ContentItem, EdgeBox, SyncLog, CreatorStats } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'boxes'>('dashboard')
  const [stats, setStats] = useState<CreatorStats | null>(null)
  const [content, setContent] = useState<ContentItem[]>([])
  const [boxes, setBoxes] = useState<EdgeBox[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])

  // Form states for content upload
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<'MP4' | 'ZIP' | 'PDF' | 'EPUB'>('MP4')
  const [fileName, setFileName] = useState('')
  const [sizeInput, setSizeInput] = useState<string>('')
  const [tagsInput, setTagsInput] = useState('math, secondary-school')
  
  // UI notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewManifestItem, setViewManifestItem] = useState<ContentItem | null>(null)

  // Fetch stats and lists from Express APIs
  const fetchAllData = () => {
    fetch('http://localhost:5000/api/creator/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Error fetching stats:', err))

    fetch('http://localhost:5000/api/content')
      .then(res => res.json())
      .then(data => setContent(data))
      .catch(err => console.error('Error fetching content:', err))

    fetch('http://localhost:5000/api/boxes')
      .then(res => res.json())
      .then(data => setBoxes(data))
      .catch(err => console.error('Error fetching boxes:', err))

    fetch('http://localhost:5000/api/sync-logs')
      .then(res => res.json())
      .then(data => setSyncLogs(data))
      .catch(err => console.error('Error fetching sync logs:', err))
  }

  // Initial fetch and 2-second background polling to track async pipeline changes
  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 2000)
    return () => clearInterval(interval)
  }, [])

  // Quick preset loading helper to demo compliance rules
  const loadPreset = (preset: 'oversized' | 'invalid_zip' | 'valid_video' | 'valid_zip') => {
    if (preset === 'oversized') {
      setTitle('Calculus Volume II Masterclass')
      setDescription('Uncompressed H.264 video guide covering integration formulas.')
      setFormat('MP4')
      setFileName('calculus_vol2_masterclass_1080p.mp4')
      setSizeInput('580') // 580MB (exceeds 500MB limit)
      setTagsInput('math, secondary-school, advanced')
    } else if (preset === 'invalid_zip') {
      setTitle('Basic Biology Flashcard Bundle')
      setDescription('Compressed archive of cells diagrams.')
      setFormat('ZIP')
      setFileName('biology_flashcards_no_index.zip') // triggers no-index.html validation error
      setSizeInput('45')
      setTagsInput('biology, science, flashcards')
    } else if (preset === 'valid_video') {
      setTitle('Geometric Optics Simulation')
      setDescription('Brief tutorial video illustrating lens bending behaviors.')
      setFormat('MP4')
      setFileName('geometric_optics_lens.mp4')
      setSizeInput('85')
      setTagsInput('physics, optics, secondary-school')
    } else if (preset === 'valid_zip') {
      setTitle('Interactive Periodic Table Module')
      setDescription('HTML5 periodic table suite containing index.html at root namespace.')
      setFormat('ZIP')
      setFileName('periodic_table_index.html.zip')
      setSizeInput('18')
      setTagsInput('chemistry, interactive, science')
    }
  }

  // Submit hander to start upload pipeline
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !fileName || !sizeInput) {
      showNotice('Please fill in all mandatory upload fields.', 'error')
      return
    }

    const sizeMb = Number(sizeInput)
    if (isNaN(sizeMb) || sizeMb <= 0) {
      showNotice('Please enter a valid file size in MB.', 'error')
      return
    }

    // Front-end strict PRD check warnings
    const limits: Record<string, number> = { MP4: 500, ZIP: 200, PDF: 100, EPUB: 50 }
    if (sizeMb > limits[format]) {
      showNotice(`Warning: File size (${sizeMb}MB) exceeds the PRD boundary limit of ${limits[format]}MB for ${format}. Submission rejected.`, 'error')
      return
    }

    if (format === 'ZIP' && !fileName.toLowerCase().includes('index.html') && !fileName.toLowerCase().includes('lab') && !fileName.toLowerCase().includes('interactive')) {
      showNotice('Warning: HTML5 ZIP packages must contain an "index.html" file at root namespace.', 'error')
      return
    }

    setIsSubmitting(true)
    const payload = {
      title,
      description,
      format,
      fileName,
      sizeBytes: sizeMb * 1024 * 1024,
      targetTags: tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
    }

    fetch('http://localhost:5000/api/content/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('API server ingestion failed.')
        return res.json()
      })
      .then(() => {
        showNotice('Asset staged successfully. Ingestion validation pipeline started.', 'success')
        // Reset form
        setTitle('')
        setDescription('')
        setFileName('')
        setSizeInput('')
        setTagsInput('math, secondary-school')
        setActiveTab('dashboard')
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  // Action: Trigger a simulated Edge Box sync schedule event
  const triggerBoxSync = (boxId: string, boxName: string) => {
    fetch('http://localhost:5000/api/boxes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boxId, syncType: 'delta' })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to trigger synchronization.')
        return res.json()
      })
      .then(() => {
        showNotice(`Delta sync request sent. Edge Box "${boxName}" successfully synced delta manifests at 02:00 simulated schedule.`, 'success')
        fetchAllData()
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
  }

  const showNotice = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const formatStorageSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${Math.round(mb * 10) / 10} MB`
    return `${Math.round((mb / 1024) * 100) / 100} GB`
  }

  return (
    <div className="container">
      <div className="glow-sphere main-glow"></div>
      <div className="glow-sphere secondary-glow"></div>

      {notification && (
        <div className={`notification-toast toast-${notification.type}`}>
          <span className="toast-icon">
            {notification.type === 'success' && '🟢'}
            {notification.type === 'error' && '🔴'}
            {notification.type === 'info' && '🔵'}
          </span>
          <span className="toast-message">{notification.message}</span>
        </div>
      )}

      {/* Main Glassmorphic Panel Shell */}
      <div className="app-shell glass-card">
        
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-section">
            <span className="logo-icon">📚</span>
            <div>
              <h2 className="logo-title">Ileemore</h2>
              <span className="logo-sub">Creator Portal</span>
            </div>
          </div>

          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="nav-icon">📊</span> Ingestion Dashboard
            </button>
            <button 
              className={`nav-item ${activeTab === 'upload' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <span className="nav-icon">📤</span> Ingest Content
            </button>
            <button 
              className={`nav-item ${activeTab === 'boxes' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('boxes')}
            >
              <span className="nav-icon">📶</span> Edge Box Sync
            </button>
          </nav>

          {stats && (
            <div className="storage-meter-container">
              <div className="storage-label">
                <span>Storage Utilized</span>
                <span>{Math.round((stats.totalStorageUsedBytes / stats.storageLimitBytes) * 100)}%</span>
              </div>
              <div className="storage-bar">
                <div 
                  className="storage-bar-fill"
                  style={{ width: `${(stats.totalStorageUsedBytes / stats.storageLimitBytes) * 100}%` }}
                ></div>
              </div>
              <span className="storage-text">
                {formatStorageSize(stats.totalStorageUsedBytes)} of {formatStorageSize(stats.storageLimitBytes)}
              </span>
            </div>
          )}
        </aside>

        {/* Content Area */}
        <main className="main-content">
          
          {/* TAB 1: DASHBOARD STATS */}
          {activeTab === 'dashboard' && (
            <div className="tab-pane animate-fade-in">
              <header className="tab-header">
                <div>
                  <h1 className="tab-title">Creator Analytics</h1>
                  <p className="tab-subtitle">Monitor file ingestion processing states and distribution nodes.</p>
                </div>
              </header>

              {/* Stats Cards */}
              {stats && (
                <div className="stats-row">
                  <div className="stat-card glass-card">
                    <span className="stat-icon">💾</span>
                    <div>
                      <span className="stat-num">{formatStorageSize(stats.totalStorageUsedBytes)}</span>
                      <span className="stat-desc">Space Occupied</span>
                    </div>
                  </div>
                  <div className="stat-card glass-card">
                    <span className="stat-icon">📁</span>
                    <div>
                      <span className="stat-num">{stats.totalUploads}</span>
                      <span className="stat-desc">Ingested Packages</span>
                    </div>
                  </div>
                  <div className="stat-card glass-card">
                    <span className="stat-icon">🛡️</span>
                    <div>
                      <span className="stat-num">{stats.successRate}%</span>
                      <span className="stat-desc">Validation Rate</span>
                    </div>
                  </div>
                  <div className="stat-card glass-card">
                    <span className="stat-icon">📦</span>
                    <div>
                      <span className="stat-num">{stats.activeBoxesCount}</span>
                      <span className="stat-desc">Enrolled Edge Boxes</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pipeline List */}
              <section className="section-panel glass-card">
                <h3 className="section-title">Ingestion & Processing Pipeline</h3>
                <div className="table-responsive">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Content Name</th>
                        <th>Format</th>
                        <th>File Size</th>
                        <th>Pipeline Status</th>
                        <th>Distribution Tags</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            No content items uploaded yet. Go to the "Ingest Content" tab to begin.
                          </td>
                        </tr>
                      ) : (
                        content.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div className="cell-title">{item.title}</div>
                              <span className="cell-sub">{item.fileName}</span>
                            </td>
                            <td>
                              <span className={`format-badge format-${item.format}`}>
                                {item.format}
                              </span>
                            </td>
                            <td className="cell-mono">{formatStorageSize(item.sizeBytes)}</td>
                            <td>
                              <div className="status-cell">
                                <span className={`status-pill status-${item.status}`}>
                                  {item.status.toUpperCase().replace('_', ' ')}
                                </span>
                                {item.status !== 'ready' && item.status !== 'failed' && (
                                  <div className="cell-progress-container">
                                    <div className="cell-progress-bar">
                                      <div 
                                        className="cell-progress-fill"
                                        style={{ width: `${item.progress}%` }}
                                      ></div>
                                    </div>
                                    <span className="cell-progress-num">{item.progress}%</span>
                                  </div>
                                )}
                                {item.status === 'failed' && (
                                  <span className="pipeline-error-text" title={item.errorMessage}>
                                    ⚠️ {item.errorMessage}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="tags-container">
                                {item.targetTags.map(tag => (
                                  <span key={tag} className="tag-badge">{tag}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              {item.status === 'ready' && item.manifest ? (
                                <button 
                                  className="btn-table btn-table-manifest"
                                  onClick={() => setViewManifestItem(item)}
                                >
                                  📄 Manifest
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Processing</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: UPLOAD PORTAL */}
          {activeTab === 'upload' && (
            <div className="tab-pane animate-fade-in">
              <header className="tab-header">
                <div>
                  <h1 className="tab-title">Staging Ingestion Portal</h1>
                  <p className="tab-subtitle">Configure package formats and metadata properties. Files are automatically processed, validated, and compressed.</p>
                </div>
              </header>

              <div className="upload-grid">
                
                {/* Form */}
                <form className="upload-form glass-card" onSubmit={handleUploadSubmit}>
                  <div className="form-group">
                    <label className="form-label">Package Title</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Waves In Mechanics Lab Guide"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description / Core Objective</label>
                    <textarea 
                      className="form-control form-textarea"
                      placeholder="Enter a brief summary of the educational content..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Format Standards</label>
                      <select 
                        className="form-control"
                        value={format}
                        onChange={e => setFormat(e.target.value as any)}
                      >
                        <option value="MP4">MP4 Video (Max 500MB)</option>
                        <option value="ZIP">HTML5 ZIP (Max 200MB)</option>
                        <option value="PDF">PDF eBook (Max 100MB)</option>
                        <option value="EPUB">EPUB Reader (Max 50MB)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">File Size (in MB)</label>
                      <input 
                        type="number" 
                        className="form-control"
                        placeholder="e.g. 45"
                        value={sizeInput}
                        onChange={e => setSizeInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Staged File Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. mechanics_waves.zip"
                      value={fileName}
                      onChange={e => setFileName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Target Distribution Profile Tags (comma separated)</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. physics, science, primary-school"
                      value={tagsInput}
                      onChange={e => setTagsInput(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary form-submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Uploading to Ingestion Server...' : '🚀 Stage Ingestion Asset'}
                  </button>
                </form>

                {/* Preset Interactive Demos Card */}
                <div className="presets-card glass-card">
                  <h3 className="section-title">Compliance Verification Demos</h3>
                  <p className="presets-intro">
                    Verify the strict cloud-edge ingestion validation checks described in the PRD by launching pre-configured test scenarios.
                  </p>

                  <div className="preset-item" onClick={() => loadPreset('oversized')}>
                    <div className="preset-header">
                      <span className="preset-badge badge-err">Rejection Warning</span>
                      <strong>Oversized Video Ingestion</strong>
                    </div>
                    <p className="preset-desc">Loads an MP4 video of 580MB, instantly violating the 500MB boundary limit.</p>
                  </div>

                  <div className="preset-item" onClick={() => loadPreset('invalid_zip')}>
                    <div className="preset-header">
                      <span className="preset-badge badge-err">ZIP Error</span>
                      <strong>HTML5 ZIP Boundary Breach</strong>
                    </div>
                    <p className="preset-desc">Loads an HTML5 ZIP package missing the root <code>index.html</code> file boundary.</p>
                  </div>

                  <div className="preset-item" onClick={() => loadPreset('valid_video')}>
                    <div className="preset-header">
                      <span className="preset-badge badge-ok">H.264 Transcode</span>
                      <strong>Valid MP4 Video Ingestion</strong>
                    </div>
                    <p className="preset-desc">Loads an H.264 video. Automatically transcoded down to box-compatible 480p.</p>
                  </div>

                  <div className="preset-item" onClick={() => loadPreset('valid_zip')}>
                    <div className="preset-header">
                      <span className="preset-badge badge-ok">Zip Check</span>
                      <strong>Compliant ZIP Package</strong>
                    </div>
                    <p className="preset-desc">Loads a clean simulation ZIP that packages index.html at root namespace.</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: EDGE BOX SYNC */}
          {activeTab === 'boxes' && (
            <div className="tab-pane animate-fade-in">
              <header className="tab-header">
                <div>
                  <h1 className="tab-title">Edge Distribution Node Console</h1>
                  <p className="tab-subtitle">Manage deployed Edge Box hardware, cryptographically trusted device certificates, and daily manifest synchronizations.</p>
                </div>
              </header>

              <div className="boxes-grid">
                
                {/* Deployed Hardware */}
                <section className="section-panel glass-card">
                  <h3 className="section-title">Deployed Deconfigured Nodes</h3>
                  <div className="boxes-list">
                    {boxes.map(box => (
                      <div key={box.id} className="box-card glass-card">
                        <div className="box-card-header">
                          <div>
                            <h4 className="box-card-title">{box.name}</h4>
                            <span className="box-cert">🔑 Certificate ID: <code>{box.deviceCertificateId}</code></span>
                          </div>
                          <span className={`status-indicator indicator-${box.status}`}>
                            {box.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="box-details">
                          <div className="detail-item">
                            <strong>Sync Config:</strong> Daily Delta Sync at {box.syncSchedule}
                          </div>
                          <div className="detail-item">
                            <strong>Last Sync:</strong> {box.lastSyncTime ? new Date(box.lastSyncTime).toLocaleString() : 'Never Sync'}
                          </div>
                          <div className="detail-item">
                            <strong>Enrolled Tags:</strong>
                            <div className="tags-container" style={{ marginTop: '0.4rem' }}>
                              {box.enrolledTags.map(tag => (
                                <span key={tag} className="tag-badge badge-blue">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button 
                          className="btn-sync"
                          disabled={box.status === 'offline'}
                          onClick={() => triggerBoxSync(box.id, box.name)}
                        >
                          🔄 Sync Now
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Sync Logs activity */}
                <aside className="section-panel glass-card">
                  <h3 className="section-title">Recent Sync Activity Log</h3>
                  <div className="sync-timeline">
                    {syncLogs.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recent synchronization activity.</div>
                    ) : (
                      syncLogs.map(log => (
                        <div key={log.id} className="timeline-item">
                          <span className="timeline-dot dot-success"></span>
                          <div className="timeline-info-wrapper">
                            <div className="timeline-header">
                              <strong>{log.boxName}</strong>
                              <span className="timeline-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="timeline-body">
                              Successfully completed a scheduled <strong>{log.type.toUpperCase()}</strong> delta-sync. 
                              Distributed <strong>{log.filesSynced} packages</strong> • Transferred <strong>{log.dataTransferMb} MB</strong> of metrics and delta manifests.
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </aside>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* MANIFEST MODAL */}
      {viewManifestItem && viewManifestItem.manifest && (
        <div className="modal-overlay" onClick={() => setViewManifestItem(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📄 Cloud Ingestion Distribution Manifest</h3>
              <button className="modal-close" onClick={() => setViewManifestItem(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Below is the structured cryptographic distribution descriptor automatically generated for DRM validation on remote edge nodes.
              </p>

              <pre className="manifest-json">
                {JSON.stringify(viewManifestItem.manifest, null, 2)}
              </pre>

              <div className="manifest-fields">
                <div className="m-field">
                  <strong>Content Reference ID:</strong> <span>{viewManifestItem.manifest.contentId}</span>
                </div>
                <div className="m-field">
                  <strong>Validation Checksum (SHA-256):</strong> <code className="m-checksum">{viewManifestItem.manifest.fileChecksum}</code>
                </div>
                <div className="m-field">
                  <strong>Edge Compression/Transcoding:</strong> <span>{viewManifestItem.manifest.targetDeviceCriteria.transcoded ? '🟢 Auto H.264 Transcoded (scaled to 480p @ 1Mbps)' : '⚪ No Conversion Needed'}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setViewManifestItem(null)}>Close Manifest</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
