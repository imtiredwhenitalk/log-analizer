import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { analyzeLogFile, currentUser, listAnalyses, logout, type AnalysisResult, type User } from './api'
import AuthScreen from './AuthScreen'
import './App.css'

const iconPaths = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 16v3h14v-3',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.2-3.5c0-.5-.1-1-.2-1.4l2-1.5-2-3.4-2.3.9a8.2 8.2 0 0 0-2.4-1.4L15 3h-4l-.4 2.2c-.9.3-1.7.8-2.4 1.4l-2.3-.9-2 3.4 2 1.5A6 6 0 0 0 5.7 12c0 .5.1 1 .2 1.4l-2 1.5 2 3.4 2.3-.9a8.2 8.2 0 0 0 2.4 1.4L11 21h4l.4-2.2c.9-.3 1.7-.8 2.4-1.4l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.4Z',
  bell: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  search: 'm20 20-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 9v4m0 4h.01M10.3 3.8 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z',
  close: 'M6 6l12 12M18 6 6 18',
  sparkle: 'm12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2L12 3Zm7 14 .5 2.5L22 20l-2.5.5L19 23l-.5-2.5L16 20l2.5-.5L19 17Z',
  chevron: 'm7 10 5 5 5-5',
} as const

type IconName = keyof typeof iconPaths

type Run = {
  name: string
  source: string
  date: string
  events: string
  status: 'Healthy' | 'Warning' | 'Critical'
}

const navItems: { label: string; icon: IconName }[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Upload logs', icon: 'upload' },
  { label: 'History', icon: 'clock' },
  { label: 'Settings', icon: 'settings' },
]

const recentRuns: Run[] = [
  { name: 'production-api.log', source: 'Production API', date: 'Today, 09:42', events: '18,430', status: 'Warning' },
  { name: 'checkout-service.log', source: 'Checkout service', date: 'Yesterday, 18:16', events: '9,284', status: 'Healthy' },
  { name: 'worker-eu-west.log', source: 'Background worker', date: 'Yesterday, 14:02', events: '6,701', status: 'Critical' },
  { name: 'auth-gateway.log', source: 'Auth gateway', date: 'Jun 11, 11:30', events: '4,112', status: 'Healthy' },
]

const analysisToRun = (result: AnalysisResult): Run => ({
  name: result.fileName,
  source: 'Uploaded file',
  date: new Date(result.analyzedAt).toLocaleString(),
  events: result.summary.totalLines.toLocaleString(),
  status: result.summary.criticalFindings > 0 ? 'Critical' : result.summary.findingCount > 0 ? 'Warning' : 'Healthy',
})

const statCards: { label: string; value: string; change: string; detail: string; icon: IconName; tone: string }[] = [
  { label: 'Total events', value: '38,527', change: '+12.8%', detail: 'vs last week', icon: 'file', tone: 'blue' },
  { label: 'Errors detected', value: '1,284', change: '-8.4%', detail: 'vs last week', icon: 'alert', tone: 'orange' },
  { label: 'Critical issues', value: '24', change: '-18.2%', detail: 'vs last week', icon: 'sparkle', tone: 'red' },
  { label: 'Avg. response', value: '184 ms', change: '-6.1%', detail: 'vs last week', icon: 'clock', tone: 'green' },
]

const Icon = ({ name, size = 18 }: { name: IconName; size?: number }) => (
  <svg
    aria-hidden="true"
    className="icon"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d={iconPaths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
)

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('Overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [notice, setNotice] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [runs, setRuns] = useState(recentRuns)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    currentUser().then(setUser).finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    listAnalyses().then((results) => {
      setRuns(results.map(analysisToRun))
    }).catch(() => setNotice('Could not load analysis history'))
  }, [user])

  if (authLoading) return <div className="auth-loading">Loading your workspace…</div>
  if (!user) return <AuthScreen onAuthenticated={setUser} />

  const handleFile = (file?: File) => {
    if (!file) return
    if (!/\.(log|txt|json|csv)$/i.test(file.name)) {
      setNotice('Use a .log, .txt, .json, or .csv file')
      return
    }
    setSelectedFile(file)
    setAnalysis(null)
    setNotice(`${file.name} is ready to analyze`)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleFile(event.dataTransfer.files[0])
  }

  const handleAnalyze = async () => {
    if (!selectedFile || isAnalyzing) return
    const fileToAnalyze = selectedFile
    setIsAnalyzing(true)
    setNotice(`Analyzing ${fileToAnalyze.name}...`)
    try {
      const result = await analyzeLogFile(fileToAnalyze)
      setAnalysis(result)
      setRuns((currentRuns) => [analysisToRun(result), ...currentRuns.filter((run) => run.name !== result.fileName)].slice(0, 5))
      setSelectedFile(null)
      setNotice(`Analysis complete: ${result.summary.findingCount} finding${result.summary.findingCount === 1 ? '' : 's'} detected`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not analyze this file.'
      setNotice(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const visibleStats = analysis
    ? [
      { ...statCards[0], value: analysis.summary.totalLines.toLocaleString(), change: `${analysis.summary.requestCount.toLocaleString()} requests`, detail: 'in uploaded file' },
      { ...statCards[1], value: analysis.summary.errorCount.toLocaleString(), change: `${analysis.summary.status5xx} 5xx`, detail: `${analysis.summary.status4xx} 4xx responses` },
      { ...statCards[2], value: analysis.summary.findingCount.toLocaleString(), change: `${analysis.summary.attackEvents} events`, detail: 'suspicious patterns' },
      { ...statCards[3], value: analysis.summary.averageResponseMs === null ? '—' : `${analysis.summary.averageResponseMs} ms`, change: `${analysis.summary.uniqueIps} IPs`, detail: 'observed in file' },
    ]
    : statCards

  const analysisRisk = analysis
    ? analysis.summary.criticalFindings > 0 ? 'critical' : analysis.summary.findingCount > 0 ? 'warning' : 'healthy'
    : 'healthy'

  const handleLogout = async () => {
    await logout()
    setUser(null)
  }

  const filteredRuns = runs.filter((run) =>
    `${run.name} ${run.source}`.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark"><span /></div>
            <span>log<span className="brand-accent">lens</span></span>
          </div>
          <div className="workspace-switcher">
            <div className="workspace-avatar">AC</div>
            <div className="workspace-copy">
              <span>Workspace</span>
              <strong>Acme Cloud</strong>
            </div>
            <Icon name="chevron" size={15} />
          </div>
          <p className="nav-label">Workspace</p>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                className={`nav-item ${activeNav === item.label ? 'active' : ''}`}
                key={item.label}
                onClick={() => {
                  setActiveNav(item.label)
                  if (item.label !== 'Overview') setNotice(`${item.label} view is ready for your next workflow`)
                }}
                type="button"
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.label === 'History' && <span className="nav-count">4</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Icon name="sparkle" size={17} /></div>
            <strong>Unlock more insights</strong>
            <p>Keep your logs searchable for longer.</p>
            <button type="button" onClick={() => setNotice('Upgrade options are coming soon')}>Explore Pro <Icon name="arrow" size={14} /></button>
          </div>
          <div className="user-profile">
            <div className="user-avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
            <div className="workspace-copy"><strong>{user.displayName}</strong><span>{user.email}</span></div>
            <button aria-label="Sign out" className="more-button" type="button" onClick={handleLogout}><span /><span /><span /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <Icon name="search" size={17} />
              <input aria-label="Search log analyses" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search analyses..." value={searchQuery} />
              <kbd>⌘ K</kbd>
            </label>
            <button aria-label="View notifications" className="icon-button has-notification" type="button" onClick={() => setNotice('You are all caught up')}><Icon name="bell" size={18} /></button>
            <div className="top-avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> All systems operational</div>
              <h1>Good morning, {user.displayName.split(' ')[0]} <span className="wave">✦</span></h1>
              <p>Here&apos;s what&apos;s happening across your logs today.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}><Icon name="upload" size={17} /> Upload logs <span className="button-shortcut">U</span></button>
          </section>

          <section
            className={`upload-banner ${isDragging ? 'dragging' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="banner-orb orb-one" />
            <div className="banner-orb orb-two" />
            <div className="banner-content">
              <div className="banner-icon"><Icon name="sparkle" size={21} /></div>
              <div>
                <span className="banner-kicker">LOG ANALYSIS</span>
                <h2>Turn noisy logs into clear answers.</h2>
                <p>Upload a file and let Loglens find patterns, errors, and anomalies in seconds.</p>
              </div>
            </div>
            <button className="banner-button" type="button" onClick={() => inputRef.current?.click()}>Choose a file <Icon name="arrow" size={16} /></button>
          </section>

          <input accept=".log,.txt,.json,.csv" className="visually-hidden" onChange={handleInputChange} ref={inputRef} type="file" />

          {selectedFile && (
            <div className="file-ready" role="status">
              <div className="file-ready-info"><div className="file-type"><Icon name="file" size={18} /></div><div><strong>{selectedFile.name}</strong><span>{(selectedFile.size / 1024).toFixed(1)} KB · Ready to analyze</span></div></div>
              <div className="file-ready-actions"><button className="text-button" onClick={() => setSelectedFile(null)} type="button">Remove</button><button className="small-primary-button" disabled={isAnalyzing} onClick={handleAnalyze} type="button">{isAnalyzing ? 'Analyzing…' : 'Analyze file'} {!isAnalyzing && <Icon name="arrow" size={14} />}</button></div>
            </div>
          )}

          <section className="stats-grid" aria-label="Log summary">
            {visibleStats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className={`stat-icon ${stat.tone}`}><Icon name={stat.icon} size={18} /></div>
                <div className="stat-meta"><span>{stat.label}</span><button aria-label={`More about ${stat.label}`} className="stat-more" onClick={() => setNotice(`${stat.label}: ${stat.value}`)} type="button">•••</button></div>
                <strong className="stat-value">{stat.value}</strong>
                <div className="stat-change"><span className={stat.change.startsWith('+') ? 'positive' : 'positive'}>{stat.change}</span><span>{stat.detail}</span></div>
              </article>
            ))}
          </section>

          {analysis && (
            <section className="panel analysis-panel">
              <div className="analysis-heading">
                <div>
                  <span className="panel-eyebrow">SECURITY REPORT</span>
                  <h2>{analysis.fileName}</h2>
                  <p>Analyzed {new Date(analysis.analyzedAt).toLocaleString()} · {analysis.summary.totalLines.toLocaleString()} log lines</p>
                </div>
                <span className={`risk-pill ${analysisRisk}`}><i />{analysisRisk === 'critical' ? 'Action required' : analysisRisk === 'warning' ? 'Review recommended' : 'No threats found'}</span>
              </div>
              <div className="analysis-summary-row">
                <div><strong>{analysis.summary.findingCount}</strong><span>unique findings</span></div>
                <div><strong>{analysis.summary.attackEvents}</strong><span>suspicious events</span></div>
                <div><strong>{analysis.summary.status5xx}</strong><span>server errors</span></div>
                <div><strong>{analysis.summary.uniqueIps}</strong><span>source IPs</span></div>
              </div>
              <div className="findings-header"><h3>Detected activity</h3><span>Signature-based analysis</span></div>
              {analysis.detections.length > 0 ? (
                <div className="findings-list">
                  {analysis.detections.map((detection) => (
                    <article className="finding-card" key={detection.id}>
                      <div className={`finding-icon ${detection.severity}`}><Icon name={detection.severity === 'critical' || detection.severity === 'high' ? 'alert' : 'sparkle'} size={17} /></div>
                      <div className="finding-body">
                        <div className="finding-title-row"><div><strong>{detection.title}</strong><span className="attack-type">{detection.attackType}</span></div><span className={`severity ${detection.severity}`}>{detection.severity}</span></div>
                        <p>{detection.description}</p>
                        <div className="finding-meta"><span>{detection.occurrences} occurrence{detection.occurrences === 1 ? '' : 's'}</span><span>{detection.confidence}% confidence</span><span>Lines {detection.examples.map((example) => example.line).join(', ')}</span></div>
                        <div className="recommendation"><strong>Recommendation:</strong> {detection.recommendation}</div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="no-findings"><span className="no-findings-icon"><Icon name="check" size={18} /></span><div><strong>No suspicious signatures found</strong><p>This does not guarantee the application is secure. Check the report together with WAF, application, and host telemetry.</p></div></div>
              )}
              <p className="analysis-disclaimer">{analysis.disclaimer}</p>
            </section>
          )}

          <div className="dashboard-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div><span className="panel-eyebrow">ACTIVITY OVERVIEW</span><h2>Events &amp; errors</h2></div>
                <button className="period-select" type="button" onClick={() => setNotice('Showing data for the last 7 days')}>Last 7 days <Icon name="chevron" size={14} /></button>
              </div>
              <div className="chart-legend"><span><i className="legend-dot events" /> Events</span><span><i className="legend-dot errors" /> Errors</span></div>
              <div className="chart-wrap">
                <div className="chart-y-labels"><span>10k</span><span>7.5k</span><span>5k</span><span>2.5k</span><span>0</span></div>
                <svg aria-label="Events and errors over the last seven days" className="activity-chart" role="img" viewBox="0 0 660 245">
                  <defs>
                    <linearGradient id="eventFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#788cff" stopOpacity=".22" /><stop offset="1" stopColor="#788cff" stopOpacity="0" /></linearGradient>
                    <linearGradient id="errorFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f08a62" stopOpacity=".2" /><stop offset="1" stopColor="#f08a62" stopOpacity="0" /></linearGradient>
                  </defs>
                  <g className="chart-grid"><line x1="0" x2="660" y1="20" y2="20" /><line x1="0" x2="660" y1="70" y2="70" /><line x1="0" x2="660" y1="120" y2="120" /><line x1="0" x2="660" y1="170" y2="170" /><line x1="0" x2="660" y1="220" y2="220" /></g>
                  <path className="chart-area events-area" d="M0 158 C32 148 44 166 74 145 S115 101 143 130 S181 154 210 113 S250 81 278 102 S313 134 344 88 S380 57 409 91 S450 116 478 70 S519 39 550 78 S590 83 625 46 S648 42 660 28 V220 H0Z" />
                  <path className="chart-line events-line" d="M0 158 C32 148 44 166 74 145 S115 101 143 130 S181 154 210 113 S250 81 278 102 S313 134 344 88 S380 57 409 91 S450 116 478 70 S519 39 550 78 S590 83 625 46 S648 42 660 28" />
                  <path className="chart-area errors-area" d="M0 201 C34 194 46 208 75 190 S114 172 143 194 S180 198 210 181 S245 175 278 190 S315 179 344 166 S380 177 409 158 S447 169 478 148 S515 159 550 139 S592 146 625 125 S650 130 660 112 V220 H0Z" />
                  <path className="chart-line errors-line" d="M0 201 C34 194 46 208 75 190 S114 172 143 194 S180 198 210 181 S245 175 278 190 S315 179 344 166 S380 177 409 158 S447 169 478 148 S515 159 550 139 S592 146 625 125 S650 130 660 112" />
                  <circle className="chart-point events-point" cx="478" cy="70" r="4" /><circle className="chart-point errors-point" cx="478" cy="148" r="4" />
                </svg>
                <div className="chart-x-labels"><span>Jun 07</span><span>Jun 08</span><span>Jun 09</span><span>Jun 10</span><span>Jun 11</span><span>Jun 12</span><span>Jun 13</span></div>
              </div>
            </section>

            <section className="panel insights-panel">
              <div className="panel-heading"><div><span className="panel-eyebrow">SMART INSIGHTS</span><h2>Worth a look</h2></div><button aria-label="More insights" className="round-more" onClick={() => setNotice('Insights are up to date')} type="button">•••</button></div>
              <div className="insight-list">
                <div className="insight-item"><div className="insight-badge orange"><Icon name="alert" size={16} /></div><div><strong>Spike in 5xx errors</strong><p>Production API saw 3× more errors around 09:40.</p><button onClick={() => setNotice('Opening 5xx error details')} type="button">View details <Icon name="arrow" size={13} /></button></div></div>
                <div className="insight-item"><div className="insight-badge purple"><Icon name="sparkle" size={16} /></div><div><strong>Slow endpoint detected</strong><p><code>/v1/checkout</code> response time increased by 42%.</p><button onClick={() => setNotice('Opening endpoint details')} type="button">View details <Icon name="arrow" size={13} /></button></div></div>
                <div className="insight-item"><div className="insight-badge green"><Icon name="check" size={16} /></div><div><strong>Everything else looks good</strong><p>No unusual patterns found in 12 services.</p><button onClick={() => setNotice('All service health is normal')} type="button">See service health <Icon name="arrow" size={13} /></button></div></div>
              </div>
            </section>
          </div>

          <section className="panel runs-panel">
            <div className="panel-heading runs-heading"><div><span className="panel-eyebrow">RECENT ANALYSES</span><h2>Latest log runs</h2></div><button className="view-all-button" onClick={() => setActiveNav('History')} type="button">View all <Icon name="arrow" size={14} /></button></div>
            <div className="runs-table-wrap"><table className="runs-table"><thead><tr><th>File name</th><th>Source</th><th>Analyzed</th><th>Events</th><th>Status</th><th /></tr></thead><tbody>{filteredRuns.map((run) => <tr key={run.name}><td><div className="file-cell"><div className="table-file-icon"><Icon name="file" size={16} /></div><strong>{run.name}</strong></div></td><td>{run.source}</td><td>{run.date}</td><td>{run.events}</td><td><span className={`status ${run.status.toLowerCase()}`}><i />{run.status}</span></td><td><button aria-label={`Open ${run.name}`} className="row-arrow" onClick={() => setNotice(`Opening ${run.name}`)} type="button"><Icon name="arrow" size={15} /></button></td></tr>)}</tbody></table>{filteredRuns.length === 0 && <div className="empty-state">No analyses match “{searchQuery}”.</div>}</div>
          </section>
          <p className="footer-note">Loglens <span>•</span> Your logs, made legible.</p>
        </div>
      </main>
      {notice && <button className="toast" onClick={() => setNotice('')} role="status" type="button"><span className="toast-check"><Icon name="check" size={14} /></span>{notice}<Icon name="close" size={14} /></button>}
    </div>
  )
}

export default App
