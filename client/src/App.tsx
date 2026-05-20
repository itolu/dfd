import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [backendStatus, setBackendStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [backendData, setBackendData] = useState<any>(null)

  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((data) => {
        setBackendStatus('connected')
        setBackendData(data)
      })
      .catch((err) => {
        console.error(err)
        setBackendStatus('error')
      })
  }, [])

  return (
    <div className="container">
      <div className="glow-sphere main-glow"></div>
      <div className="glow-sphere secondary-glow"></div>

      <header className="header">
        <div className="logo-container">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">TypeScript Fullstack</span>
        </div>
      </header>

      <main className="content">
        <section className="hero-section">
          <h1 className="title animate-fade-in">
            Workspace <span className="text-gradient">Initialized</span>
          </h1>
          <p className="subtitle animate-fade-in-delayed">
            Your high-performance TypeScript development environment is ready. 
            Edit files in <code>client/</code> or <code>server/</code> to start building.
          </p>
        </section>

        <div className="grid-container animate-slide-up">
          {/* Card 1: Interactive State */}
          <div className="card glass-card">
            <h3 className="card-title">Interactive Counter</h3>
            <p className="card-description">Verify frontend state reactivity and HMR.</p>
            <div className="card-body">
              <button 
                className="btn btn-primary"
                onClick={() => setCount((c) => c + 1)}
              >
                Count: {count}
              </button>
            </div>
          </div>

          {/* Card 2: Backend Connectivity */}
          <div className="card glass-card">
            <h3 className="card-title">API Connection Status</h3>
            <p className="card-description">Real-time telemetry from the Express server.</p>
            <div className="card-body">
              <div className="status-badge-container">
                {backendStatus === 'loading' && (
                  <span className="status-badge status-loading">
                    <span className="pulse-dot"></span> Checking backend...
                  </span>
                )}
                {backendStatus === 'connected' && (
                  <div className="status-connected-info">
                    <span className="status-badge status-success">
                      🟢 Connected
                    </span>
                    <div className="telemetry-info">
                      <p><strong>Uptime:</strong> {Math.round(backendData?.uptime || 0)}s</p>
                      <p><strong>Time:</strong> {backendData?.timestamp ? new Date(backendData.timestamp).toLocaleTimeString() : ''}</p>
                    </div>
                  </div>
                )}
                {backendStatus === 'error' && (
                  <div className="status-error-info">
                    <span className="status-badge status-failed">
                      🔴 Offline
                    </span>
                    <p className="telemetry-error">Cannot connect to Express server at <code>:5000</code>.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Initialized by <strong>Antigravity AI</strong> • Ready for your custom application instructions.</p>
      </footer>
    </div>
  )
}

export default App
