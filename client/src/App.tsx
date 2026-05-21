import { useState, useEffect } from 'react'
import './App.css'
import type { ContentItem, EdgeBox, SyncLog, CreatorStats, User } from './types'

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('ileemore_token') || '')
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ileemore_user')
    return saved ? JSON.parse(saved) : null
  })

  const [activeTab, setActiveTab] = useState<'dashboard' | 'boxes' | 'api-docs' | 'team'>('dashboard')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedDocTab, setSelectedDocTab] = useState<'curl' | 'js' | 'python' | 'go' | 'rust'>('curl')
  const [selectedDocSec, setSelectedDocSec] = useState<'overview' | 'auth' | 'stats' | 'upload' | 'list' | 'nodes' | 'sync' | 'logs'>('overview')
  const [stats, setStats] = useState<CreatorStats | null>(null)
  const [content, setContent] = useState<ContentItem[]>([])
  const [boxes, setBoxes] = useState<EdgeBox[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')

  // Gated Authentication Bypass & Developer Hub Extras
  const [viewingPublicDocs, setViewingPublicDocs] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [serverHealth, setServerHealth] = useState<'online' | 'checking' | 'offline'>('checking')
  const [apiConsoleKeyOverrides, setApiConsoleKeyOverrides] = useState<Record<string, string>>({})
  const [apiConsoleResponses, setApiConsoleResponses] = useState<Record<string, { status: number; statusText: string; body: string; headers: Record<string, string>; latencyMs?: number } | null>>({})
  const [apiConsoleLoading, setApiConsoleLoading] = useState<Record<string, boolean>>({})
  const [apiConsoleInputs, setApiConsoleInputs] = useState<Record<string, any>>({})

  // Auth form states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')

  // Form states for content upload
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<'MP4' | 'ZIP' | 'PDF' | 'EPUB'>('MP4')
  const [fileName, setFileName] = useState('')
  const [sizeInput, setSizeInput] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('math')
  const [selectedRegions, setSelectedRegions] = useState<{ ondo: boolean; ibadan: boolean }>({
    ondo: false,
    ibadan: true
  })
  
  // UI notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewManifestItem, setViewManifestItem] = useState<ContentItem | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeGb, setUpgradeGb] = useState<number>(1)

  // Learning Progress Filter States
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedStudent, setSelectedStudent] = useState<string>('all')

  const getFilteredStats = () => {
    const baseCompleted = 1333425;
    const baseGb = 1425.5;
    const baseMinutes = 666712.5;
    const baseOnlineNodes = stats ? stats.activeBoxesCount : 2;

    let classFactor = 1.0;
    if (selectedClass === 'primary') classFactor = 0.35;
    else if (selectedClass === 'junior') classFactor = 0.45;
    else if (selectedClass === 'senior') classFactor = 0.20;

    let studentFactor = 1.0;
    let successRate = 100;
    let abandonmentRate = 0;
    
    if (selectedStudent === 'top') { 
      studentFactor = 0.25; 
      successRate = 98;
      abandonmentRate = 2;
    } else if (selectedStudent === 'ontrack') { 
      studentFactor = 0.60; 
      successRate = 88;
      abandonmentRate = 12;
    } else if (selectedStudent === 'intervention') { 
      studentFactor = 0.15; 
      successRate = 76;
      abandonmentRate = 24;
    }

    const factor = classFactor * studentFactor;
    
    const completed = Math.round(baseCompleted * factor);
    const gb = parseFloat((baseGb * factor).toFixed(1));
    const minutes = parseFloat((baseMinutes * factor).toFixed(1));

    // Dynamic Chart parameters
    // Y-axis height is 240px. The baseline is at 195px.
    // The peak is at 30px (so max height is 195 - 30 = 165px).
    const peakHeight = Math.max(25, 165 * factor);
    const peakY = 195 - peakHeight;

    // Y-axis labels text based on max range for selected group
    const formatChartLabel = (val: number) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M views`;
      if (val >= 1000) return `${Math.round(val / 1000)}K views`;
      return `${Math.round(val)} views`;
    };

    const maxVal = completed;
    const labelMax = formatChartLabel(maxVal);
    const labelMid1 = formatChartLabel(maxVal * 0.78);
    const labelMid2 = formatChartLabel(maxVal * 0.5);

    return {
      completed,
      gb,
      minutes,
      onlineNodes: baseOnlineNodes,
      successRate,
      abandonmentRate,
      peakY,
      labelMax,
      labelMid1,
      labelMid2
    };
  };

  // Auth helper methods
  const handleLogout = () => {
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(err => console.error('Logout error on backend:', err))
    }
    setToken('')
    setCurrentUser(null)
    localStorage.removeItem('ileemore_token')
    localStorage.removeItem('ileemore_user')
    showNotice('You have been signed out.', 'info')
  }

  // Fetch stats and lists from Express APIs (with Token injection)
  const fetchAllData = () => {
    if (!token) return

    const headers = { 'Authorization': `Bearer ${token}` }

    fetch(`${API_BASE_URL}/api/creator/stats`, { headers })
      .then(res => {
        if (res.status === 401) { handleLogout(); return; }
        return res.json()
      })
      .then(data => data && setStats(data))
      .catch(err => console.error('Error fetching stats:', err))

    fetch(`${API_BASE_URL}/api/content`, { headers })
      .then(res => {
        if (res.status === 401) { handleLogout(); return; }
        return res.json()
      })
      .then(data => data && setContent(data))
      .catch(err => console.error('Error fetching content:', err))

    fetch(`${API_BASE_URL}/api/boxes`, { headers })
      .then(res => {
        if (res.status === 401) { handleLogout(); return; }
        return res.json()
      })
      .then(data => data && setBoxes(data))
      .catch(err => console.error('Error fetching boxes:', err))

    fetch(`${API_BASE_URL}/api/sync-logs`, { headers })
      .then(res => {
        if (res.status === 401) { handleLogout(); return; }
        return res.json()
      })
      .then(data => data && setSyncLogs(data))
      .catch(err => console.error('Error fetching sync logs:', err))

    const userJson = localStorage.getItem('ileemore_user')
    const userObj = userJson ? JSON.parse(userJson) : null
    if (userObj && (userObj.role === 'Owner' || !userObj.role)) {
      fetch(`${API_BASE_URL}/api/team`, { headers })
        .then(res => {
          if (res.status === 401) { handleLogout(); return; }
          return res.json()
        })
        .then(data => data && setTeamMembers(data))
        .catch(err => console.error('Error fetching team members:', err))
    }
  }

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteName || !inviteEmail || !invitePassword) {
      showNotice('All invitation fields are required.', 'error')
      return
    }

    if (invitePassword.length < 6) {
      showNotice('Temporary password must be at least 6 characters.', 'error')
      return
    }

    setIsSubmitting(true)
    fetch(`${API_BASE_URL}/api/team/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: inviteName, email: inviteEmail, password: invitePassword })
    })
      .then(res => {
        if (res.status === 401) { handleLogout(); throw new Error('Session expired.') }
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || 'Failed to invite team member.') })
        }
        return res.json()
      })
      .then(() => {
        showNotice(`Successfully invited team member: ${inviteName}`, 'success')
        setInviteName('')
        setInviteEmail('')
        setInvitePassword('')
        fetchAllData()
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  const handleApproveContent = (itemId: string) => {
    fetch(`${API_BASE_URL}/api/content/${itemId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401) { handleLogout(); throw new Error('Session expired.') }
        if (!res.ok) throw new Error('Failed to approve content.')
        return res.json()
      })
      .then(() => {
        showNotice('Content approved and scheduled for sync successfully!', 'success')
        fetchAllData()
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
  }

  const handleRejectContent = (itemId: string) => {
    if (!window.confirm('Are you sure you want to reject and delete this content upload?')) return

    fetch(`${API_BASE_URL}/api/content/${itemId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401) { handleLogout(); throw new Error('Session expired.') }
        if (!res.ok) throw new Error('Failed to reject content.')
        return res.json()
      })
      .then(() => {
        showNotice('Content upload rejected and deleted successfully.', 'info')
        fetchAllData()
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
  }

  const handleBuyStorage = (amountGb: number) => {
    setIsSubmitting(true)
    fetch(`${API_BASE_URL}/api/creator/buy-storage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amountGb })
    })
      .then(res => {
        if (res.status === 401) { handleLogout(); throw new Error('Session expired.') }
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || 'Failed to purchase storage.') })
        }
        return res.json()
      })
      .then(data => {
        showNotice(data.message, 'success')
        setShowUpgradeModal(false)
        fetchAllData()
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  // Initial fetch and 2-second background polling to track async pipeline changes
  useEffect(() => {
    if (token) {
      fetchAllData()
      const interval = setInterval(fetchAllData, 2000)
      return () => clearInterval(interval)
    }
  }, [token])

  // Login handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      showNotice('Please provide your email and password.', 'error')
      return
    }

    setIsSubmitting(true)
    fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || 'Invalid credentials.') })
        }
        return res.json()
      })
      .then(data => {
        setToken(data.token)
        setCurrentUser(data.user)
        localStorage.setItem('ileemore_token', data.token)
        localStorage.setItem('ileemore_user', JSON.stringify(data.user))
        showNotice(`Welcome back, ${data.user.name}!`, 'success')
        
        // Reset login form fields
        setLoginEmail('')
        setLoginPassword('')
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  // Registration handler
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!registerName || !registerEmail || !registerPassword || !registerConfirmPassword) {
      showNotice('All registration fields are mandatory.', 'error')
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      showNotice('Passwords do not match. Please verify.', 'error')
      return
    }

    if (registerPassword.length < 6) {
      showNotice('Password must be at least 6 characters in length.', 'error')
      return
    }

    setIsSubmitting(true)
    fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: registerName, email: registerEmail, password: registerPassword })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || 'Registration failed.') })
        }
        return res.json()
      })
      .then(data => {
        setToken(data.token)
        setCurrentUser(data.user)
        localStorage.setItem('ileemore_token', data.token)
        localStorage.setItem('ileemore_user', JSON.stringify(data.user))
        showNotice(`Account created successfully. Welcome, ${data.user.name}!`, 'success')
        
        // Reset registration fields
        setRegisterName('')
        setRegisterEmail('')
        setRegisterPassword('')
        setRegisterConfirmPassword('')
      })
      .catch(err => {
        showNotice(err.message, 'error')
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  // Quick preset loading helper to demo compliance rules
  const loadPreset = (preset: 'oversized' | 'invalid_zip' | 'valid_video' | 'valid_zip') => {
    if (preset === 'oversized') {
      setTitle('Calculus Volume II Masterclass')
      setDescription('Uncompressed H.264 video guide covering integration formulas.')
      setFormat('MP4')
      setFileName('calculus_vol2_masterclass_1080p.mp4')
      setSizeInput('580')
      setSelectedSubject('math')
      setSelectedRegions({ ondo: true, ibadan: false })
    } else if (preset === 'invalid_zip') {
      setTitle('Basic Biology Flashcard Bundle')
      setDescription('Compressed archive of cells diagrams.')
      setFormat('ZIP')
      setFileName('biology_flashcards_no_index.zip')
      setSizeInput('45')
      setSelectedSubject('science')
      setSelectedRegions({ ondo: false, ibadan: true })
    } else if (preset === 'valid_video') {
      setTitle('Geometric Optics Simulation')
      setDescription('Brief tutorial video illustrating lens bending behaviors.')
      setFormat('MP4')
      setFileName('geometric_optics_lens.mp4')
      setSizeInput('85')
      setSelectedSubject('physics')
      setSelectedRegions({ ondo: false, ibadan: true })
    } else if (preset === 'valid_zip') {
      setTitle('Interactive Periodic Table Module')
      setDescription('HTML5 periodic table suite containing index.html at root namespace.')
      setFormat('ZIP')
      setFileName('periodic_table_index.html.zip')
      setSizeInput('18')
      setSelectedSubject('chemistry')
      setSelectedRegions({ ondo: true, ibadan: true })
    }
  }

  const handlePillClick = (preset: 'what' | 'video' | 'zip' | 'oversized') => {
    if (preset === 'what') {
      showNotice("Ingestion Assistant: I can validate MP4 videos, ZIP simulations, PDFs, and EPUBs, format files for school devices, and sync them to edge hardware nodes. Try a preset below to populate the upload form!", "info");
    } else if (preset === 'video') {
      loadPreset('valid_video');
      showNotice("Ingestion Assistant: Populated form with Geometric Optics MP4 simulation!", "success");
    } else if (preset === 'zip') {
      loadPreset('valid_zip');
      showNotice("Ingestion Assistant: Populated form with Interactive Periodic Table ZIP simulation!", "success");
    } else if (preset === 'oversized') {
      loadPreset('oversized');
      showNotice("Ingestion Assistant: Populated form with oversized Calculus Volume II Masterclass!", "error");
    }
  }

  // Submit handler to start upload pipeline
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

    // Front-end size check warnings
    const limits: Record<string, number> = { MP4: 500, ZIP: 200, PDF: 100, EPUB: 50 }
    if (sizeMb > limits[format]) {
      showNotice(`This file is too large. Max size is ${limits[format]}MB.`, 'error')
      return
    }

    if (format === 'ZIP' && !fileName.toLowerCase().includes('index.html') && !fileName.toLowerCase().includes('lab') && !fileName.toLowerCase().includes('interactive')) {
      showNotice('ZIP files must contain an "index.html" start page.', 'error')
      return
    }

    setIsSubmitting(true)
    
    // Construct routing tags based on subject dropdown and region checkboxes
    const targetTags: string[] = [selectedSubject]
    if (selectedRegions.ondo) targetTags.push('ondo-node')
    if (selectedRegions.ibadan) targetTags.push('ibadan-node')
    
    // Help match the default enrolled tags on remote boxes
    if (selectedSubject === 'math') targetTags.push('secondary-school', 'algebra')
    if (selectedSubject === 'physics') targetTags.push('science', 'interactive')
    if (selectedSubject === 'chemistry') targetTags.push('science', 'interactive')
    if (selectedSubject === 'science') targetTags.push('science', 'interactive')
    if (selectedSubject === 'english') targetTags.push('primary-school', 'reading')
    if (selectedSubject === 'history') targetTags.push('social-studies', 'west-africa')

    const payload = {
      title,
      description,
      format,
      fileName,
      sizeBytes: sizeMb * 1024 * 1024,
      targetTags
    }

    fetch(`${API_BASE_URL}/api/content/upload`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (res.status === 401) { handleLogout(); throw new Error('Session expired.') }
        if (!res.ok) throw new Error('Failed to upload file.')
        return res.json()
      })
      .then(() => {
        showNotice('File submitted. Check the table below to see optimization progress.', 'success')
        // Reset form
        setTitle('')
        setDescription('')
        setFileName('')
        setSizeInput('')
        setSelectedSubject('math')
        setSelectedRegions({ ondo: false, ibadan: true })
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
    fetch(`${API_BASE_URL}/api/boxes/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ boxId, syncType: 'delta' })
    })
      .then(res => {
        if (res.status === 401) { handleLogout(); throw new Error('Session expired.') }
        if (!res.ok) throw new Error('Failed to sync box.')
        return res.json()
      })
      .then(() => {
        showNotice(`Sync request sent. Box "${boxName}" is now downloading new files.`, 'success')
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

  // Health check API Probe & Console Execution Helper
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') {
          setServerHealth('online');
        } else {
          setServerHealth('offline');
        }
      })
      .catch(() => setServerHealth('offline'));
  }, []);

  const runConsoleRequest = (secId: string, endpointPath: string, method: 'GET' | 'POST', defaultPayload?: any) => {
    const key = currentUser?.apiKey || apiConsoleKeyOverrides[secId] || apiConsoleKeyOverrides['global'] || '';
    
    setApiConsoleLoading(prev => ({ ...prev, [secId]: true }));
    setApiConsoleResponses(prev => ({ ...prev, [secId]: null }));

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${key}`,
    };

    let fetchOptions: RequestInit = {
      method,
      headers
    };

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      
      const inputs = apiConsoleInputs[secId] || {};
      const payload = { ...defaultPayload, ...inputs };
      
      if (payload.targetTags && typeof payload.targetTags === 'string') {
        payload.targetTags = payload.targetTags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      }
      if (payload.sizeBytes && typeof payload.sizeBytes === 'string') {
        payload.sizeBytes = Number(payload.sizeBytes);
      }

      fetchOptions.body = JSON.stringify(payload);
    }

    const startTime = Date.now();

    fetch(`${API_BASE_URL}/api${endpointPath}`, fetchOptions)
      .then(async res => {
        const bodyText = await res.text();
        let parsedBody = bodyText;
        try {
          parsedBody = JSON.parse(bodyText);
        } catch(e) {}

        const elapsed = Date.now() - startTime;
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((val, key) => {
          resHeaders[key] = val;
        });

        setApiConsoleResponses(prev => ({
          ...prev,
          [secId]: {
            status: res.status,
            statusText: res.statusText || (res.status === 201 ? 'Created' : res.status === 200 ? 'OK' : 'Error'),
            body: typeof parsedBody === 'object' ? JSON.stringify(parsedBody, null, 2) : parsedBody,
            headers: resHeaders,
            latencyMs: elapsed
          }
        }));
      })
      .catch(err => {
        const elapsed = Date.now() - startTime;
        setApiConsoleResponses(prev => ({
          ...prev,
          [secId]: {
            status: 0,
            statusText: 'Network Error',
            body: `TypeError: Failed to execute network fetch to API Gateway.\nIs the backend server running?\n\nDetails: ${err.message}`,
            headers: {},
            latencyMs: elapsed
          }
        }));
      })
      .finally(() => {
        setApiConsoleLoading(prev => ({ ...prev, [secId]: false }));
      });
  };

  const renderCodeSnippet = (_secId: string, apiPath: string, method: 'GET' | 'POST', postBodySample?: any) => {
    const key = currentUser ? (showApiKey ? currentUser.apiKey : 'sk_live_••••••••••••••••••••••••••••••••') : (apiConsoleKeyOverrides['global'] || 'sk_live_guest_sandbox_preview_key');
    const baseUrl = `${API_BASE_URL}/api`;

    let codeText = '';

    if (selectedDocTab === 'curl') {
      if (method === 'GET') {
        codeText = `curl -H "Authorization: Bearer ${key}" \\\n  ${baseUrl}${apiPath}`;
      } else {
        codeText = `curl -X POST ${baseUrl}${apiPath} \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(postBodySample, null, 4)}'`;
      }
    } else if (selectedDocTab === 'js') {
      if (method === 'GET') {
        codeText = `fetch('${baseUrl}${apiPath}', {\n  headers: {\n    'Authorization': 'Bearer ${key}'\n  }\n})\n.then(res => res.json())\n.then(data => console.log(data));`;
      } else {
        codeText = `fetch('${baseUrl}${apiPath}', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer ${key}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify(${JSON.stringify(postBodySample, null, 4)})\n})\n.then(res => res.json())\n.then(data => console.log(data));`;
      }
    } else if (selectedDocTab === 'python') {
      if (method === 'GET') {
        codeText = `import requests\n\nheaders = {\n    "Authorization": "Bearer ${key}"\n}\n\nresponse = requests.get("${baseUrl}${apiPath}", headers=headers)\nprint(response.json())`;
      } else {
        codeText = `import requests\n\nheaders = {\n    "Authorization": "Bearer ${key}",\n    "Content-Type": "application/json"\n}\n\npayload = ${JSON.stringify(postBodySample, null, 4).replace(/true/g, 'True').replace(/false/g, 'False')}\n\nresponse = requests.post("${baseUrl}${apiPath}", headers=headers, json=payload)\nprint(response.json())`;
      }
    } else if (selectedDocTab === 'go') {
      if (method === 'GET') {
        codeText = `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"io"\n)\n\nfunc main() {\n\tclient := &http.Client{}\n\treq, _ := http.NewRequest("GET", "${baseUrl}${apiPath}", nil)\n\treq.Header.Set("Authorization", "Bearer ${key}")\n\tresp, _ := client.Do(req)\n\tdefer resp.Body.Close()\n\tbody, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(body))\n}`;
      } else {
        codeText = `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"bytes"\n\t"encoding/json"\n\t"io"\n)\n\nfunc main() {\n\tclient := &http.Client{}\n\tpayload, _ := json.Marshal(${JSON.stringify(postBodySample)})\n\treq, _ := http.NewRequest("POST", "${baseUrl}${apiPath}", bytes.NewBuffer(payload))\n\treq.Header.Set("Authorization", "Bearer ${key}")\n\treq.Header.Set("Content-Type", "application/json")\n\tresp, _ := client.Do(req)\n\tdefer resp.Body.Close()\n\tbody, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(body))\n}`;
      }
    } else if (selectedDocTab === 'rust') {
      if (method === 'GET') {
        codeText = `use reqwest::header::{\n    HeaderMap, HeaderValue, AUTHORIZATION\n};\n\n#[tokio::main]\nasync fn main() -> Result<(), reqwest::Error> {\n    let mut headers = HeaderMap::new();\n    headers.insert(AUTHORIZATION, HeaderValue::from_str("Bearer ${key}").unwrap());\n    let client = reqwest::Client::new();\n    let res = client.get("${baseUrl}${apiPath}")\n        .headers(headers)\n        .send()\n        .await?\n        .text()\n        .await?;\n    println!("{}", res);\n    Ok(())\n}`;
      } else {
        codeText = `use reqwest::header::{\n    HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE\n};\nuse serde_json::json;\n\n#[tokio::main]\nasync fn main() -> Result<(), reqwest::Error> {\n    let mut headers = HeaderMap::new();\n    headers.insert(AUTHORIZATION, HeaderValue::from_str("Bearer ${key}").unwrap());\n    headers.insert(CONTENT_TYPE, HeaderValue::from_str("application/json").unwrap());\n    let client = reqwest::Client::new();\n    let payload = json!(${JSON.stringify(postBodySample, null, 8)});\n    let res = client.post("${baseUrl}${apiPath}")\n        .headers(headers)\n        .json(&payload)\n        .send()\n        .await?\n        .text()\n        .await?;\n    println!("{}", res);\n    Ok(())\n}`;
      }
    }

    return (
      <div className="sdk-guides-panel" style={{ width: '100%' }}>
        <div className="doc-tabs-header" style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem', overflowX: 'auto' }}>
          {(['curl', 'js', 'python', 'go', 'rust'] as const).map(lang => (
            <button 
              key={lang}
              type="button" 
              className={`doc-tab-btn ${selectedDocTab === lang ? 'doc-tab-active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
              onClick={() => setSelectedDocTab(lang)}
            >
              {lang === 'curl' ? 'cURL' : lang === 'js' ? 'Node.js' : lang === 'python' ? 'Python' : lang === 'go' ? 'Go' : 'Rust'}
            </button>
          ))}
        </div>

        <div className="sdk-code-wrapper" style={{ marginTop: '0.5rem' }}>
          <pre className="code-snippet-pre" style={{ fontSize: '0.75rem', padding: '0.85rem', whiteSpace: 'pre-wrap', maxHeight: '250px', overflowY: 'auto' }}>
            {codeText}
          </pre>
        </div>
      </div>
    );
  };

  const renderApiConsole = (secId: string, endpointPath: string, method: 'GET' | 'POST', defaultPayload?: any) => {
    const isResponseActive = !!apiConsoleResponses[secId];
    const response = apiConsoleResponses[secId];
    const isLoading = !!apiConsoleLoading[secId];
    const key = currentUser?.apiKey || apiConsoleKeyOverrides[secId] || apiConsoleKeyOverrides['global'] || '';

    return (
      <div className="console-widget glass-card" style={{ marginTop: '1.25rem', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '1rem', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-cyan)', margin: 0 }}>
            Live API Sandbox Client
          </h4>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Interactive Tester</span>
        </div>

        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label className="form-label" style={{ fontSize: '0.72rem' }}>Authorization Secret Key</label>
          <input 
            type="text" 
            className="form-control" 
            style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', padding: '0.4rem 0.6rem' }}
            placeholder={currentUser ? "Using current profile key" : "Paste your sk_live_... key to test"}
            value={key}
            onChange={e => setApiConsoleKeyOverrides({ ...apiConsoleKeyOverrides, [secId]: e.target.value, global: e.target.value })}
          />
        </div>

        {method === 'POST' && defaultPayload && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem', padding: '0.6rem', background: 'hsl(220, 20%, 97%)', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Payload Fields Config:</span>
            {Object.keys(defaultPayload).map(field => {
              const currentValue = apiConsoleInputs[secId]?.[field] !== undefined ? apiConsoleInputs[secId][field] : defaultPayload[field];
              return (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{field}</label>
                  {field === 'format' ? (
                    <select 
                      className="form-control" 
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem' }}
                      value={currentValue}
                      onChange={e => setApiConsoleInputs({
                        ...apiConsoleInputs,
                        [secId]: { ...(apiConsoleInputs[secId] || {}), [field]: e.target.value }
                      })}
                    >
                      <option value="ZIP">ZIP (HTML5 Simulation)</option>
                      <option value="MP4">MP4 Video</option>
                      <option value="PDF">PDF Document</option>
                      <option value="EPUB">EPUB Ebook</option>
                    </select>
                  ) : (
                    <input 
                      type={typeof defaultPayload[field] === 'number' ? 'number' : 'text'}
                      className="form-control"
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem' }}
                      value={currentValue}
                      onChange={e => setApiConsoleInputs({
                        ...apiConsoleInputs,
                        [secId]: { ...(apiConsoleInputs[secId] || {}), [field]: e.target.value }
                      })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button 
          type="button" 
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.5rem', fontSize: '0.78rem', borderRadius: '6px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))' }}
          disabled={isLoading}
          onClick={() => runConsoleRequest(secId, endpointPath, method, defaultPayload)}
        >
          {isLoading ? 'Dispatching...' : 'Run Network Request'}
        </button>

        {isResponseActive && response && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className={`status-pill ${response.status >= 200 && response.status < 300 ? 'status-ready' : 'status-failed'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                  {response.status === 0 ? 'FAIL' : response.status} {response.statusText}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Latency: {response.latencyMs}ms
                </span>
              </div>
              <button 
                type="button" 
                style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', fontSize: '0.7rem', cursor: 'pointer' }}
                onClick={() => setApiConsoleResponses({ ...apiConsoleResponses, [secId]: null })}
              >
                Clear
              </button>
            </div>

            <pre className="code-snippet-pre response-pre" style={{ margin: 0, fontSize: '0.72rem', maxHeight: '180px', overflowY: 'auto' }}>
              {response.body}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderDeveloperDocs = (isGuest: boolean) => {
    const docsRoutes = [
      { id: 'overview', title: 'Keys & Sandbox', type: 'guide', category: 'Setup', icon: '' },
      { id: 'auth', title: 'Access Codes', type: 'guide', category: 'Setup', icon: '' },
      { id: 'stats', title: 'Check Storage Stats', type: 'GET', category: 'Sending Files', icon: 'GET' },
      { id: 'upload', title: 'Send a File', type: 'POST', category: 'Sending Files', icon: 'POST' },
      { id: 'list', title: 'List All Files', type: 'GET', category: 'Sending Files', icon: 'GET' },
      { id: 'nodes', title: 'List Active Boxes', type: 'GET', category: 'School Boxes', icon: 'GET' },
      { id: 'sync', title: 'Update a Box', type: 'POST', category: 'School Boxes', icon: 'POST' },
      { id: 'logs', title: 'View Update Logs', type: 'GET', category: 'School Boxes', icon: 'GET' },
    ];

    const filteredRoutes = docsRoutes.filter(route => {
      if (!docSearchQuery) return true;
      const query = docSearchQuery.toLowerCase();
      return (
        route.title.toLowerCase().includes(query) ||
        route.type.toLowerCase().includes(query) ||
        route.category.toLowerCase().includes(query) ||
        route.id.toLowerCase().includes(query)
      );
    });

    return (
      <div className="tab-pane animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Global Dev Header */}
        <header className="docs-header-bar glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Connect Other Systems
              </h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Guides to send files from other apps & test them here
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className={`status-indicator indicator-${serverHealth === 'online' ? 'online' : 'offline'}`} style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem' }}>
              {serverHealth === 'online' ? '● SERVER READY' : serverHealth === 'checking' ? '● CHECKING SERVER...' : '● SERVER OFFLINE'}
            </span>

            {isGuest ? (
              <button 
                className="btn btn-primary" 
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem', borderRadius: '8px' }}
                onClick={() => {
                  setViewingPublicDocs(false);
                  setActiveTab('dashboard');
                }}
              >
                Sign In to Portal
              </button>
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Profile: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{currentUser?.email}</code>
              </span>
            )}
          </div>
        </header>

        <div className="docs-layout-container" style={{ flexGrow: 1, display: 'flex', gap: '1rem', overflow: 'hidden' }}>
          
          {/* Left Column: API Sidebar */}
          <aside className="docs-nav-sidebar glass-card animate-slide-in" style={{ width: '260px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            
            {/* Search Input field */}
            <div className="docs-search-wrapper" style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="docs-search-input form-control" 
                style={{ width: '100%', fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                placeholder="Search guides..." 
                value={docSearchQuery}
                onChange={e => setDocSearchQuery(e.target.value)}
              />
              {docSearchQuery && (
                <button 
                  type="button"
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  onClick={() => setDocSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Render categories & links */}
            {['Setup', 'Sending Files', 'School Boxes'].map(cat => {
              const catRoutes = filteredRoutes.filter(r => r.category === cat);
              if (catRoutes.length === 0) return null;

              return (
                <div key={cat} className="docs-nav-section">
                  <h4 className="docs-nav-section-title" style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '0.4rem', paddingLeft: '0.4rem' }}>
                    {cat}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {catRoutes.map(route => {
                      const isActive = selectedDocSec === route.id;
                      return (
                        <button 
                          key={route.id}
                          className={`docs-nav-link ${isActive ? 'docs-nav-active' : ''}`}
                          style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', transition: 'var(--transition-smooth)' }}
                          onClick={() => setSelectedDocSec(route.id as any)}
                        >
                          {route.type === 'guide' ? (
                            <span>{route.icon}</span>
                          ) : (
                            <span className={`method-tag ${route.type === 'GET' ? 'tag-get' : 'tag-post'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                              {route.type}
                            </span>
                          )}
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {route.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredRoutes.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No routes found matching your search.
              </div>
            )}
          </aside>

          {/* Middle & Right Content Panel */}
          <div className="docs-content-wrapper" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            
            {/* 1. OVERVIEW & CREDENTIALS */}
            {selectedDocSec === 'overview' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <h2 className="docs-title">Connect Your Code</h2>
                  <p className="docs-text">
                    This guide helps you write scripts to send files to school boxes automatically from your own database or systems.
                  </p>
                  <p className="docs-text">
                    You can use standard web requests to send files. Use the credentials below to authorize your code.
                  </p>

                  <div className="dev-setup-credentials" style={{ marginTop: '1rem' }}>
                    <h3 className="docs-subtitle">Your Secret Keys</h3>
                    <p className="docs-text-sub">Use these headers in your script to authenticate.</p>
                    
                    <div className="setup-cred-card glass-card" style={{ marginTop: '0.5rem', gap: '1rem' }}>
                      <div className="cred-field-group">
                        <label className="cred-label">Web Address (Base URL)</label>
                        <div className="cred-input-wrapper">
                          <input 
                            type="text" 
                            readOnly 
                            className="cred-input-code" 
                            value={`${API_BASE_URL}/api`} 
                          />
                          <button 
                            type="button"
                            className="btn-cred-copy"
                            onClick={() => {
                              navigator.clipboard.writeText(`${API_BASE_URL}/api`);
                              showNotice('Base URL copied to clipboard!', 'success');
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="cred-field-group">
                        <label className="cred-label">Access Key</label>
                        {currentUser ? (
                          <div className="cred-input-wrapper">
                            <input 
                              type={showApiKey ? 'text' : 'password'} 
                              readOnly 
                              className="cred-input-code key-highlight" 
                              value={currentUser.apiKey || ''} 
                            />
                            <button 
                              type="button"
                              className="btn-cred-toggle"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? 'Hide' : 'Show'}
                            </button>
                            <button 
                              type="button"
                              className="btn-cred-copy"
                              onClick={() => {
                                navigator.clipboard.writeText(currentUser.apiKey || '');
                                showNotice('Secret Key copied to clipboard!', 'success');
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <div className="cred-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                              <input 
                                type="text" 
                                className="cred-input-code key-highlight" 
                                placeholder="Paste custom sk_live_... key for sandbox trials"
                                value={apiConsoleKeyOverrides['global'] || ''} 
                                onChange={e => setApiConsoleKeyOverrides({ ...apiConsoleKeyOverrides, global: e.target.value })}
                              />
                              {apiConsoleKeyOverrides['global'] && (
                                <button 
                                  type="button" 
                                  className="btn-cred-copy"
                                  onClick={() => setApiConsoleKeyOverrides({ ...apiConsoleKeyOverrides, global: '' })}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              No account active. Register or sign in to receive your access key.
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="caution-box" style={{ marginTop: '0.5rem', padding: '0.75rem' }}>
                        <span className="caution-icon">Warning:</span>
                        <div className="caution-text" style={{ fontSize: '0.78rem' }}>
                          <strong>Keep this key safe!</strong> Do not share it or put it in public code. Secret keys bypass standard login screens.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="prd-limitations-section" style={{ marginTop: '1.25rem' }}>
                    <h3 className="docs-subtitle">File Size & Type Limits</h3>
                    <p className="docs-text-sub">Your files must fit within these limits to be accepted:</p>
                    
                    <div className="limits-table-wrapper" style={{ marginTop: '0.5rem' }}>
                      <table className="limits-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Max Size</th>
                            <th>Rules</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><span className="format-ref format-mp4">MP4</span></td>
                            <td><code>500 MB</code></td>
                            <td>Standard video format. We will resize it automatically to fit school devices.</td>
                          </tr>
                          <tr>
                            <td><span className="format-ref format-zip">ZIP</span></td>
                            <td><code>200 MB</code></td>
                            <td>Educational interactive app. Must contain a home page named <code>index.html</code>.</td>
                          </tr>
                          <tr>
                            <td><span className="format-ref format-pdf">PDF</span></td>
                            <td><code>100 MB</code></td>
                            <td>Standard PDF document.</td>
                          </tr>
                          <tr>
                            <td><span className="format-ref format-epub">EPUB</span></td>
                            <td><code>50 MB</code></td>
                            <td>Standard EPUB book.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="docs-right-col">
                  <div className="sdk-guides-panel">
                    <h3 className="docs-subtitle-mono">Sample Code</h3>
                    <p className="docs-text-sub" style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Copy this code to start sending files from your script.</p>
                    {renderCodeSnippet('overview', '/health', 'GET')}
                  </div>
                </div>
              </div>
            )}

            {/* 2. ACCESS CODES */}
            {selectedDocSec === 'auth' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <h2 className="docs-title">Security Details</h2>
                  <p className="docs-text">
                    To send files, you must include your access key in the header of every request.
                  </p>
                  <p className="docs-text">
                    If the key is missing or incorrect, the server will reply with an 'Unauthorized' (401) error.
                  </p>

                  <div className="docs-param-block" style={{ marginTop: '1rem' }}>
                    <h3 className="docs-subtitle">Request Headers</h3>
                    
                    <div className="param-table-wrapper" style={{ marginTop: '0.5rem' }}>
                      <table className="param-table">
                        <thead>
                          <tr>
                            <th>Header Name</th>
                            <th>Type</th>
                            <th>Required?</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><code>Authorization</code></td>
                            <td><code>string</code></td>
                            <td><span className="required-badge">Yes</span></td>
                            <td>Must be: <code>Bearer &lt;your_access_key&gt;</code></td>
                          </tr>
                          <tr>
                            <td><code>Content-Type</code></td>
                            <td><code>string</code></td>
                            <td><span className="required-badge">Yes</span></td>
                            <td>Must be: <code>application/json</code></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">Failed Response Example</h4>
                  <pre className="code-snippet-pre error-response-pre" style={{ fontSize: '0.75rem' }}>
{`HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Invalid access key."
}`}
                  </pre>
                </div>
              </div>
            )}

            {/* 3. CHECK STORAGE STATS */}
            {selectedDocSec === 'stats' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <div className="endpoint-route-header">
                    <span className="docs-method-badge method-get">GET</span>
                    <code className="docs-endpoint-path">/creator/stats</code>
                  </div>
                  
                  <h2 className="docs-title" style={{ marginTop: '0.5rem' }}>Check Storage Stats</h2>
                  <p className="docs-text">
                    Get the amount of storage used, total files sent, success rate, and active boxes.
                  </p>

                  <h3 className="docs-subtitle" style={{ marginTop: '1rem' }}>Data Returned</h3>
                  <div className="param-table-wrapper" style={{ marginTop: '0.5rem' }}>
                    <table className="param-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><code>totalStorageUsedBytes</code></td>
                          <td><code>integer</code></td>
                          <td>Storage space used by files (in bytes).</td>
                        </tr>
                        <tr>
                          <td><code>storageLimitBytes</code></td>
                          <td><code>integer</code></td>
                          <td>Total storage capacity.</td>
                        </tr>
                        <tr>
                          <td><code>totalUploads</code></td>
                          <td><code>integer</code></td>
                          <td>Total number of files sent.</td>
                        </tr>
                        <tr>
                          <td><code>successRate</code></td>
                          <td><code>integer</code></td>
                          <td>Percentage of files successfully checked.</td>
                        </tr>
                        <tr>
                          <td><code>activeBoxesCount</code></td>
                          <td><code>integer</code></td>
                          <td>Number of active school boxes.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">cURL & SDK Sample Code</h4>
                  {renderCodeSnippet('stats', '/creator/stats', 'GET')}
                  {renderApiConsole('stats', '/creator/stats', 'GET')}
                </div>
              </div>
            )}

            {/* 4. SEND A FILE */}
            {selectedDocSec === 'upload' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <div className="endpoint-route-header">
                    <span className="docs-method-badge method-post">POST</span>
                    <code className="docs-endpoint-path">/content/upload</code>
                  </div>
                  
                  <h2 className="docs-title" style={{ marginTop: '0.5rem' }}>Send a File</h2>
                  <p className="docs-text">
                    Upload a file from your code. The file will be checked and sent to the selected school boxes.
                  </p>

                  <h3 className="docs-subtitle" style={{ marginTop: '1rem' }}>Data to Send</h3>
                  <div className="param-table-wrapper" style={{ marginTop: '0.5rem' }}>
                    <table className="param-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Required?</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><code>title</code></td>
                          <td><code>string</code></td>
                          <td><span className="required-badge">Yes</span></td>
                          <td>The name of the lesson or book.</td>
                        </tr>
                        <tr>
                          <td><code>format</code></td>
                          <td><code>string</code></td>
                          <td><span className="required-badge">Yes</span></td>
                          <td>Must be: <code>MP4</code>, <code>ZIP</code>, <code>PDF</code>, or <code>EPUB</code>.</td>
                        </tr>
                        <tr>
                          <td><code>fileName</code></td>
                          <td><code>string</code></td>
                          <td><span className="required-badge">Yes</span></td>
                          <td>The file name (e.g. math.zip).</td>
                        </tr>
                        <tr>
                          <td><code>sizeBytes</code></td>
                          <td><code>integer</code></td>
                          <td><span className="required-badge">Yes</span></td>
                          <td>File size in bytes.</td>
                        </tr>
                        <tr>
                          <td><code>description</code></td>
                          <td><code>string</code></td>
                          <td><span className="optional-badge">No</span></td>
                          <td>Short description of the file.</td>
                        </tr>
                        <tr>
                          <td><code>targetTags</code></td>
                          <td><code>array</code></td>
                          <td><span className="optional-badge">No</span></td>
                          <td>Subjects or boxes to target (e.g. <code>["math", "ondo-node"]</code>).</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">cURL & SDK Sample Code</h4>
                  {renderCodeSnippet('upload', '/content/upload', 'POST', {
                    title: "Interactive Biology Cell Lab",
                    format: "ZIP",
                    fileName: "biology_cells_index.html.zip",
                    sizeBytes: 20971520,
                    description: "Biology cells interactive lab simulator",
                    targetTags: "biology, science, interactive"
                  })}
                  {renderApiConsole('upload', '/content/upload', 'POST', {
                    title: "Interactive Biology Cell Lab",
                    format: "ZIP",
                    fileName: "biology_cells_index.html.zip",
                    sizeBytes: 20971520,
                    description: "Biology cells interactive lab simulator",
                    targetTags: "biology, science, interactive"
                  })}
                </div>
              </div>
            )}

            {/* 5. LIST YOUR FILES */}
            {selectedDocSec === 'list' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <div className="endpoint-route-header">
                    <span className="docs-method-badge method-get">GET</span>
                    <code className="docs-endpoint-path">/content</code>
                  </div>
                  
                  <h2 className="docs-title" style={{ marginTop: '0.5rem' }}>List Your Files</h2>
                  <p className="docs-text">
                    Get a list of all files you have sent, their current status, and which boxes they went to.
                  </p>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">cURL & SDK Sample Code</h4>
                  {renderCodeSnippet('list', '/content', 'GET')}
                  {renderApiConsole('list', '/content', 'GET')}
                </div>
              </div>
            )}

            {/* 6. LIST SCHOOL BOXES */}
            {selectedDocSec === 'nodes' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <div className="endpoint-route-header">
                    <span className="docs-method-badge method-get">GET</span>
                    <code className="docs-endpoint-path">/boxes</code>
                  </div>
                  
                  <h2 className="docs-title" style={{ marginTop: '0.5rem' }}>List School Boxes</h2>
                  <p className="docs-text">
                    Get a list of all active school boxes, their ID, and sync schedules.
                  </p>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">cURL & SDK Sample Code</h4>
                  {renderCodeSnippet('nodes', '/boxes', 'GET')}
                  {renderApiConsole('nodes', '/boxes', 'GET')}
                </div>
              </div>
            )}

            {/* 7. UPDATE A BOX */}
            {selectedDocSec === 'sync' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <div className="endpoint-route-header">
                    <span className="docs-method-badge method-post">POST</span>
                    <code className="docs-endpoint-path">/boxes/sync</code>
                  </div>
                  
                  <h2 className="docs-title" style={{ marginTop: '0.5rem' }}>Update a Box</h2>
                  <p className="docs-text">
                    Force a school box to connect and check for new files immediately.
                  </p>

                  <h3 className="docs-subtitle" style={{ marginTop: '1rem' }}>Data to Send</h3>
                  <div className="param-table-wrapper" style={{ marginTop: '0.5rem' }}>
                    <table className="param-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Required?</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><code>boxId</code></td>
                          <td><code>string</code></td>
                          <td><span className="required-badge">Yes</span></td>
                          <td>The Box ID (e.g. <code>"box-03"</code>).</td>
                        </tr>
                        <tr>
                          <td><code>syncType</code></td>
                          <td><code>string</code></td>
                          <td><span className="optional-badge">No</span></td>
                          <td>Sync type (defaults to <code>"delta"</code>).</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">cURL & SDK Sample Code</h4>
                  {renderCodeSnippet('sync', '/boxes/sync', 'POST', {
                    boxId: "box-03",
                    syncType: "delta"
                  })}
                  {renderApiConsole('sync', '/boxes/sync', 'POST', {
                    boxId: "box-03",
                    syncType: "delta"
                  })}
                </div>
              </div>
            )}

            {/* 8. VIEW UPDATE LOGS */}
            {selectedDocSec === 'logs' && (
              <div className="docs-split-panel animate-fade-in">
                <div className="docs-middle-col">
                  <div className="endpoint-route-header">
                    <span className="docs-method-badge method-get">GET</span>
                    <code className="docs-endpoint-path">/sync-logs</code>
                  </div>
                  
                  <h2 className="docs-title" style={{ marginTop: '0.5rem' }}>View Update Logs</h2>
                  <p className="docs-text">
                    View the history of updates made by school boxes.
                  </p>
                </div>

                <div className="docs-right-col">
                  <h4 className="docs-right-heading">cURL & SDK Sample Code</h4>
                  {renderCodeSnippet('logs', '/sync-logs', 'GET')}
                  {renderApiConsole('logs', '/sync-logs', 'GET')}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    );
  };

  // Render Authentication Portal if not logged in
  if (!token || !currentUser) {
    if (viewingPublicDocs) {
      return (
        <div className="container" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', justifyContent: 'flex-start', alignItems: 'center' }}>
          <div className="glow-sphere main-glow"></div>
          <div className="glow-sphere secondary-glow"></div>

          {notification && (
            <div className={`notification-toast toast-${notification.type}`}>
              <span className="toast-message">{notification.message}</span>
            </div>
          )}

          <div className="app-shell glass-card" style={{ width: '100%', maxWidth: '1400px', height: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column' }}>
            <main className="main-content" style={{ padding: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              {renderDeveloperDocs(true)}
            </main>
          </div>
        </div>
      )
    }

    return (
      <div className="auth-container">
        <div className="glow-sphere main-glow"></div>
        <div className="glow-sphere secondary-glow"></div>

        {notification && (
          <div className={`notification-toast toast-${notification.type}`}>
            <span className="toast-message">{notification.message}</span>
          </div>
        )}

        <div className="auth-card glass-card">
          <div className="auth-header">
            <h1 className="auth-title">Ileemore</h1>
            <span className="auth-subtitle">
              {authMode === 'login' 
                ? 'Sign in to send lessons to school boxes' 
                : 'Create an account to start sending files'}
            </span>
          </div>

          {authMode === 'login' ? (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="e.g. name@company.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary form-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label className="form-label">Organization Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Kano Math Academy"
                  value={registerName}
                  onChange={e => setRegisterName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="e.g. headmaster@academy.org"
                  value={registerEmail}
                  onChange={e => setRegisterEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password (min 6 characters)</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••"
                  value={registerConfirmPassword}
                  onChange={e => setRegisterConfirmPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary form-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            {authMode === 'login' ? (
              <>
                <div>
                  New to the platform?{' '}
                  <button className="auth-toggle-link" onClick={() => setAuthMode('register')}>
                    Create an Account
                  </button>
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    className="auth-toggle-link" 
                    style={{ color: 'var(--accent-cyan)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      setViewingPublicDocs(true);
                      setSelectedDocSec('overview');
                    }}
                  >
                    API Documentation
                  </button>
                </div>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button className="auth-toggle-link" onClick={() => setAuthMode('login')}>
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const fStats = getFilteredStats();

  // Otherwise, render full Authenticated Workspace Portal
  return (
    <div className="container">
      <div className="glow-sphere main-glow" style={{ width: '400px', height: '400px', top: '10%', left: '5%', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, rgba(34, 211, 238, 0) 70%)' }}></div>
      <div className="glow-sphere secondary-glow" style={{ width: '500px', height: '500px', bottom: '5%', right: '10%', background: 'radial-gradient(circle, rgba(192, 132, 252, 0.12) 0%, rgba(192, 132, 252, 0) 70%)' }}></div>

      {notification && (
        <div className={`notification-toast toast-${notification.type}`} style={{ zIndex: 9999 }}>
          <span className="toast-message">{notification.message}</span>
        </div>
      )}

      {/* Main Glassmorphic Panel Shell */}
      <div className="app-shell glass-card">
        
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'rgba(34, 211, 238, 0.1)', color: 'var(--accent-cyan)', borderRadius: '6px', fontWeight: 'bold' }}>Q</span>
            <div>
              <h2 className="logo-title" style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, letterSpacing: '0.05em' }}>Ileemore</h2>
              <span className="logo-sub" style={{ fontSize: '0.68rem', opacity: 0.6 }}>1438210</span>
            </div>
            
            {/* Toggle icon block */}
            <span style={{ marginLeft: 'auto', opacity: 0.5, cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
            </span>
          </div>

          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Command Center
            </button>
            <button 
              className={`nav-item ${activeTab === 'boxes' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('boxes')}
            >
              School Boxes
            </button>
            {(currentUser.role === 'Owner' || !currentUser.role) && (
              <button 
                className={`nav-item ${activeTab === 'team' ? 'nav-active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                Team Management
              </button>
            )}
            <button 
              className={`nav-item ${activeTab === 'api-docs' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('api-docs')}
            >
              API Documentation
            </button>
          </nav>

          {/* Bottom links block mimicking the screenshot */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="nav-item-bottom" onClick={() => setActiveTab('api-docs')}>
              Audit logs
            </button>
            <button className="nav-item-bottom" onClick={() => setActiveTab('api-docs')}>
              Developers
            </button>

            <div className="auth-user-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', color: '#090d16' }}>
                {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'IM'}
              </div>
              <div className="auth-user-info" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span className="auth-user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name || 'Simi'}</span>
                <span className="auth-user-email" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.role || 'Owner'}</span>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.4 }}>&gt;</span>
            </div>

            <button className="btn-logout" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="main-content">
          
          {/* TAB 1: UNIFIED DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="tab-pane animate-fade-in">
                {/* Header inside the insights column */}
                <div className="insights-header-bar">
                  <h1 className="insights-header-title">Insights</h1>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Live mode toggle mimicking screenshot */}
                    <div className="live-mode-toggle-bar">
                      <span className="switch-label-glowing">Live mode</span>
                      <div className="switch-toggle-pill">
                        <div className="switch-toggle-handle"></div>
                      </div>
                    </div>

                    <div className="insights-filters">
                      <select 
                        className="class-select-dark" 
                        value={selectedClass} 
                        onChange={(e) => setSelectedClass(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid #1e293b',
                          color: '#fff',
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="all">All Classes</option>
                        <option value="primary">Primary (Grades 1-6)</option>
                        <option value="junior">Junior Secondary</option>
                        <option value="senior">Senior Secondary</option>
                      </select>

                      <select 
                        className="student-select-dark" 
                        value={selectedStudent} 
                        onChange={(e) => setSelectedStudent(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid #1e293b',
                          color: '#fff',
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="all">All Students</option>
                        <option value="top">Top Performers (90%+ Avg)</option>
                        <option value="ontrack">On Track (60%-90% Avg)</option>
                        <option value="intervention">Need Intervention (&lt;60% Avg)</option>
                      </select>

                      <div className="filter-badge-interactive">
                        <span>Filter by date</span>
                        <strong>Date is Last 30 days</strong>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>✕</span>
                      </div>
                      
                      <select className="currency-select-dark" defaultValue="NGN">
                        <option value="NGN">NGN ₦</option>
                        <option value="USD">USD $</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* The 2-column Grid of Insights vs Assistant */}
                <div className="dashboard-layout">
                  
                  {/* Left Column inside main: Insights Panel */}
                  <div className="insights-column">
                    
                    {/* Stats Cards Row */}
                    {stats && (
                      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', width: '100%' }}>
                        <div className="stat-card glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="stat-desc" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Content Completed</span>
                          <span className="stat-num" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{fStats.completed.toLocaleString()}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>100% completion rate</span>
                          </div>
                        </div>
                        
                        <div className="stat-card glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', cursor: 'pointer' }} onClick={() => setShowUpgradeModal(true)}>
                          <span className="stat-desc" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Data Volume Watched</span>
                          <span className="stat-num" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{fStats.gb.toLocaleString()} GB</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--accent-purple)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.25rem' }}>
                            Storage cap: {formatStorageSize(stats.storageLimitBytes)} (Upgrade)
                          </span>
                        </div>

                        <div className="stat-card glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="stat-desc" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Learning Minutes</span>
                          <span className="stat-num" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{fStats.minutes.toLocaleString()} min</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            High engagement levels
                          </span>
                        </div>

                        <div className="stat-card glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="stat-desc" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Active Learning Nodes</span>
                          <span className="stat-num" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{fStats.onlineNodes} Boxes Online</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.25rem' }}>
                            Ibadan & Ondo hardware active
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Custom SVG Line Chart matching screenshot exactly */}
                    <div className="chart-container-dark">
                      <div className="chart-title-bar">
                        <h4 className="chart-title">Daily Student Content Views (Last 30 Days)</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>Active Peak: May 3 ({fStats.completed.toLocaleString()} daily views)</span>
                      </div>

                      <div style={{ position: 'relative', width: '100%', height: '240px' }}>
                        <svg width="100%" height="100%" viewBox="0 0 1000 240" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                          {/* Define glowing cyan drop shadows & linear gradients */}
                          <defs>
                            <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                            </linearGradient>
                            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="6" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>

                          {/* Y-axis Grid Lines & labels */}
                          <g stroke="rgba(255,255,255,0.03)" strokeWidth="1">
                            <line x1="50" y1="30" x2="950" y2="30" />
                            <line x1="50" y1="85" x2="950" y2="85" />
                            <line x1="50" y1="140" x2="950" y2="140" />
                            <line x1="50" y1="195" x2="950" y2="195" />
                          </g>

                          {/* Y-axis Text Labels */}
                          <g fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-sans)">
                            <text x="15" y="34">{fStats.labelMax}</text>
                            <text x="15" y="89">{fStats.labelMid1}</text>
                            <text x="15" y="144">{fStats.labelMid2}</text>
                            <text x="15" y="199">0 views</text>
                          </g>

                          {/* Chart Line with spike centered on May 3rd */}
                          <path
                            d={`M 50,195 L 114,195 L 178,195 L 242,195 L 307,195 L 371,${fStats.peakY} L 435,195 L 500,195 L 564,195 L 628,195 L 692,195 L 757,195 L 821,195 L 885,195 L 950,195`}
                            fill="url(#chart-glow)"
                          />
                          <path
                            d={`M 50,195 L 114,195 L 178,195 L 242,195 L 307,195 L 371,${fStats.peakY} L 435,195 L 500,195 L 564,195 L 628,195 L 692,195 L 757,195 L 821,195 L 885,195 L 950,195`}
                            fill="none"
                            stroke="var(--accent-cyan)"
                            strokeWidth="3.5"
                            filter="url(#neon-glow)"
                          />

                          {/* Peak Pulsing Point at May 3 */}
                          <circle cx="371" cy={fStats.peakY} r="6" fill="#fff" stroke="var(--accent-cyan)" strokeWidth="3" />
                          <circle cx="371" cy={fStats.peakY} r="12" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5" opacity="0.6">
                            <animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                          </circle>

                          {/* X-axis Labels */}
                          <g fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-sans)" textAnchor="middle">
                            <text x="50" y="225">Apr 23</text>
                            <text x="114" y="225">Apr 25</text>
                            <text x="178" y="225">Apr 27</text>
                            <text x="242" y="225">Apr 29</text>
                            <text x="307" y="225">May 1</text>
                            <text x="371" y="225" fill="var(--accent-cyan)" fontWeight="bold">May 3</text>
                            <text x="435" y="225">May 5</text>
                            <text x="500" y="225">May 7</text>
                            <text x="564" y="225">May 9</text>
                            <text x="628" y="225">May 11</text>
                            <text x="692" y="225">May 13</text>
                            <text x="757" y="225">May 15</text>
                            <text x="821" y="225">May 17</text>
                            <text x="885" y="225">May 19</text>
                            <text x="950" y="225">May 21</text>
                          </g>
                        </svg>
                      </div>
                    </div>

                    {/* Three Bottom Gauge Columns */}
                    <div className="bottom-gauges-row">
                      
                      {/* Gauge 1: Success Rate */}
                      <div className="gauge-card-dark">
                        <span className="gauge-title">Classroom Success Rate</span>
                        
                        <div className="gauge-svg-wrapper">
                          <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-success)" strokeWidth="8"
                                    strokeDasharray="314.15" strokeDashoffset={314.15 - (314.15 * fStats.successRate) / 100} strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 6px var(--color-success))', transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'stroke-dashoffset 0.6s ease' }}/>
                          </svg>
                          <span className="gauge-center-text" style={{ color: 'var(--color-success)' }}>{fStats.successRate}%</span>
                        </div>

                        <div className="gauge-legend-container">
                          <div className="gauge-legend-item">
                            <span className="legend-dot-label">
                              <span className="legend-dot" style={{ background: 'var(--color-success)' }}></span>
                              Successful lessons
                            </span>
                            <strong>{fStats.completed.toLocaleString()}</strong>
                          </div>
                          <div className="gauge-legend-item">
                            <span className="legend-dot-label">
                              <span className="legend-dot" style={{ background: '#334155' }}></span>
                              Processing errors
                            </span>
                            <strong>0</strong>
                          </div>
                        </div>
                      </div>

                      {/* Gauge 2: Ingestion & Approval Queue Monitor */}
                      <div className="gauge-card-dark" style={{ alignItems: 'stretch', justifyContent: 'flex-start' }}>
                        <span className="gauge-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span>Queue Monitor</span>
                          <span style={{ fontSize: '0.72rem', background: 'rgba(192, 132, 252, 0.1)', color: 'var(--accent-purple)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {content.filter(item => item.approvalStatus === 'pending').length} Actionable
                          </span>
                        </span>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          {content.filter(item => item.approvalStatus === 'pending').length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <span>No data matches your current filters.<br/>All creator uploads have been processed.</span>
                            </div>
                          ) : (
                            <div style={{ maxHeight: '145px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                              {content.filter(item => item.approvalStatus === 'pending').map(item => (
                                <div key={item.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e293b', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>By: {item.uploaderName || 'Creator'} ({formatStorageSize(item.sizeBytes)})</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                    <button onClick={() => handleApproveContent(item.id)} style={{ background: 'var(--color-success)', color: '#090d16', border: 'none', borderRadius: '4px', fontSize: '0.68rem', padding: '0.2rem 0.4rem', fontWeight: 'bold', cursor: 'pointer' }}>Approve</button>
                                    <button onClick={() => handleRejectContent(item.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', fontSize: '0.68rem', padding: '0.2rem 0.4rem', cursor: 'pointer' }}>Reject</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gauge 3: Abandonment Rate */}
                      <div className="gauge-card-dark">
                        <span className="gauge-title">Lesson Abandonment Rate</span>
                        
                        <div className="gauge-svg-wrapper">
                          <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-warning)" strokeWidth="8"
                                    strokeDasharray="314.15" strokeDashoffset={314.15 - (314.15 * fStats.abandonmentRate) / 100} strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 6px var(--color-warning))', transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'stroke-dashoffset 0.6s ease' }}/>
                          </svg>
                          <span className="gauge-center-text" style={{ color: 'var(--color-warning)' }}>{fStats.abandonmentRate}%</span>
                        </div>

                        <div className="gauge-legend-container">
                          <div className="gauge-legend-item">
                            <span className="legend-dot-label">
                              <span className="legend-dot" style={{ background: 'var(--color-warning)' }}></span>
                              Aborted sessions
                            </span>
                            <strong>{Math.round(fStats.completed * fStats.abandonmentRate / 100).toLocaleString()}</strong>
                          </div>
                          <div className="gauge-legend-item">
                            <span className="legend-dot-label">
                              <span className="legend-dot" style={{ background: '#334155' }}></span>
                              Completed lessons
                            </span>
                            <strong>{fStats.completed.toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>

                    </div>


                  {/* Catalog list section underneath */}
                  <section className="section-panel glass-card" style={{ marginTop: '0.5rem' }}>
                    <h3 className="section-title">Sent Files & Ingestion Catalog</h3>
                    <div className="table-responsive">
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Uploaded By</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Approval</th>
                            <th>Status</th>
                            <th>Sent To</th>
                            <th>Check Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {content.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                No files sent yet. Use the ingestion form on the right to start sending files.
                              </td>
                            </tr>
                          ) : (
                            content.map(item => {
                              const translateTags = (tags: string[]) => {
                                const subjectMap: Record<string, string> = {
                                  math: 'Mathematics',
                                  physics: 'Physics',
                                  chemistry: 'Chemistry',
                                  science: 'Science/Biology',
                                  english: 'English',
                                  history: 'History'
                                };
                                const regionMap: Record<string, string> = {
                                  'ibadan-node': 'Ibadan Node',
                                  'ondo-node': 'Ondo Node'
                                };
                                const subject = tags.find(t => subjectMap[t]);
                                const regions = tags.filter(t => regionMap[t]).map(t => regionMap[t]);
                                const subjectStr = subject ? subjectMap[subject] : '';
                                const regionStr = regions.join(', ');
                                
                                if (subjectStr && regionStr) return `${subjectStr} • ${regionStr}`;
                                return subjectStr || regionStr || 'None';
                              };
                              
                              return (
                                <tr key={item.id}>
                                  <td>
                                    <div className="cell-title">{item.title}</div>
                                    <span className="cell-sub">{item.fileName}</span>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.uploaderName || 'Edtech Labs'}</div>
                                    <span className="status-pill" style={{ fontSize: '0.62rem', padding: '0.05rem 0.25rem', background: item.uploaderRole === 'Creator' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)', color: item.uploaderRole === 'Creator' ? 'rgb(59, 130, 246)' : 'var(--accent-purple)' }}>
                                      {item.uploaderRole || 'Owner'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`format-badge format-${item.format}`}>
                                      {item.format === 'MP4' ? 'Video' : item.format === 'ZIP' ? 'ZIP App' : item.format === 'PDF' ? 'PDF Book' : 'Ebook'}
                                    </span>
                                  </td>
                                  <td className="cell-mono">{formatStorageSize(item.sizeBytes)}</td>
                                  <td>
                                    <span className={`status-pill ${item.approvalStatus === 'approved' ? 'status-ready' : 'status-queued'}`} style={{ fontSize: '0.72rem' }}>
                                      {item.approvalStatus === 'approved' ? 'Approved' : 'Pending'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="status-cell">
                                      <span className={`status-pill status-${item.status}`}>
                                        {item.status === 'ready' ? 'Ready' : item.status === 'queued' ? 'Waiting' : item.status === 'validating' ? 'Checking' : item.status === 'transcoding' ? 'Optimizing' : item.status === 'manifest_generating' ? 'Preparing' : 'Failed'}
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
                                          Error: {item.errorMessage}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="cell-title" style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                      {translateTags(item.targetTags)}
                                    </div>
                                  </td>
                                  <td>
                                    {item.status === 'ready' && item.manifest ? (
                                      <button 
                                        className="btn-table btn-table-manifest"
                                        onClick={() => setViewManifestItem(item)}
                                      >
                                        Check Status
                                      </button>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Processing...</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                </div>

                {/* Right Column: Ingestion Assistant Panel */}
                <aside className="assistant-sidebar">
                  <div className="assistant-title">
                    <span>New conversation</span>
                  </div>

                  <div className="chat-bubble">
                    <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>Ingestion Assistant</strong>
                    <p className="assistant-welcome">
                      What would you like to understand about your business today? Ask and learn anything, or dispatch new lessons below.
                    </p>
                    
                    {/* Compact Prefill Pills */}
                    <div className="pills-container">
                      <button type="button" className="action-pill" onClick={() => handlePillClick('what')}>What can you do?</button>
                      <button type="button" className="action-pill" onClick={() => handlePillClick('video')}>Sample Video</button>
                      <button type="button" className="action-pill" onClick={() => handlePillClick('zip')}>Sample ZIP</button>
                      <button type="button" className="action-pill" onClick={() => handlePillClick('oversized')}>Oversized File</button>
                    </div>
                  </div>

                  {/* Compact form inside right column */}
                  <form className="compact-upload-form" onSubmit={handleUploadSubmit}>
                    <strong style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.15rem' }}>Dispatch New Content</strong>
                    
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lesson or Book Title</label>
                      <input 
                        type="text" 
                        className="form-control-dark"
                        placeholder="e.g. Mathematics Class 1 Guide"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Subject</label>
                        <select 
                          className="form-control-dark"
                          value={selectedSubject}
                          onChange={e => setSelectedSubject(e.target.value)}
                        >
                          <option value="math">Mathematics</option>
                          <option value="physics">Physics</option>
                          <option value="chemistry">Chemistry</option>
                          <option value="science">Science</option>
                          <option value="english">English</option>
                          <option value="history">History</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Format Type</label>
                        <select 
                          className="form-control-dark"
                          value={format}
                          onChange={e => setFormat(e.target.value as any)}
                        >
                          <option value="MP4">Video (MP4)</option>
                          <option value="ZIP">ZIP App</option>
                          <option value="PDF">PDF Book</option>
                          <option value="EPUB">EPUB Ebook</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.5rem' }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Size (MB)</label>
                        <input 
                          type="number" 
                          className="form-control-dark"
                          placeholder="85"
                          value={sizeInput}
                          onChange={e => setSizeInput(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>File Name</label>
                        <input 
                          type="text" 
                          className="form-control-dark"
                          placeholder="e.g. geometric_optics.mp4"
                          value={fileName}
                          onChange={e => setFileName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Destination Nodes</label>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.1rem' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedRegions.ibadan}
                            onChange={e => setSelectedRegions({ ...selectedRegions, ibadan: e.target.checked })}
                          />
                          Ibadan Box
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedRegions.ondo}
                            onChange={e => setSelectedRegions({ ...selectedRegions, ondo: e.target.checked })}
                          />
                          Ondo Box
                        </label>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="btn-cyan-glowing"
                      disabled={isSubmitting}
                      style={{ border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                    >
                      {isSubmitting ? 'Validating & Ingesting...' : 'Dispatch Lesson to Nodes'}
                    </button>
                  </form>
                </aside>

              </div>
            </div>
          )}

          {/* TAB 3: EDGE BOX SYNC */}
          {activeTab === 'boxes' && (
            <div className="tab-pane animate-fade-in">
              <header className="tab-header">
                <div>
                  <h1 className="tab-title">School Boxes</h1>
                  <p className="tab-subtitle">See which school boxes are active and when they last got new files.</p>
                </div>
              </header>

              <div className="boxes-grid">
                
                {/* Deployed Hardware */}
                <section className="section-panel glass-card">
                  <h3 className="section-title">Active School Boxes</h3>
                  <div className="boxes-list">
                    {boxes.map(box => {
                      const translateTag = (t: string) => {
                        const tagMap: Record<string, string> = {
                          math: 'Mathematics',
                          physics: 'Physics',
                          chemistry: 'Chemistry',
                          science: 'Science/Biology',
                          english: 'English',
                          history: 'History',
                          'secondary-school': 'Secondary School',
                          'primary-school': 'Primary School',
                          'social-studies': 'Social Studies',
                          'west-africa': 'West Africa',
                          'ondo-node': 'Ondo Region',
                          'ibadan-node': 'Ibadan Region',
                          'reading': 'Reading',
                          'algebra': 'Algebra',
                          'interactive': 'Interactive Apps'
                        };
                        return tagMap[t] || t;
                      };

                      return (
                        <div key={box.id} className="box-card glass-card">
                          <div className="box-card-header">
                            <div>
                              <h4 className="box-card-title">{box.name}</h4>
                              <span className="box-cert">Box ID: <code>{box.deviceCertificateId}</code></span>
                            </div>
                            <span className={`status-indicator indicator-${box.status}`}>
                              {box.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="box-details">
                            <div className="detail-item">
                              <strong>Automatic Update:</strong> Daily at {box.syncSchedule}
                            </div>
                            <div className="detail-item">
                              <strong>Last Updated:</strong> {box.lastSyncTime ? new Date(box.lastSyncTime).toLocaleString() : 'Never Updated'}
                            </div>
                            <div className="detail-item">
                              <strong>Lessons Sent to this Box:</strong>
                              <div className="tags-container" style={{ marginTop: '0.4rem' }}>
                                {box.enrolledTags.map(tag => (
                                  <span key={tag} className="tag-badge badge-blue">{translateTag(tag)}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {(currentUser.role === 'Owner' || !currentUser.role) ? (
                            <button 
                              className="btn-sync"
                              disabled={box.status === 'offline'}
                              onClick={() => triggerBoxSync(box.id, box.name)}
                            >
                              Update Box Now
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', padding: '0.5rem 0', fontWeight: 500, textAlign: 'center' }}>
                              Only organization owners can trigger manual updates.
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Sync Logs activity */}
                <aside className="section-panel glass-card">
                  <h3 className="section-title">Recent Activity</h3>
                  <div className="sync-timeline">
                    {syncLogs.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sync activity recorded.</div>
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
                              Fetched {log.filesSynced} new file(s) ({log.dataTransferMb} MB).
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

          {/* TAB 3.5: TEAM MANAGEMENT */}
          {activeTab === 'team' && (currentUser.role === 'Owner' || !currentUser.role) && (
            <div className="tab-pane animate-fade-in">
              <header className="tab-header">
                <div>
                  <h1 className="tab-title">Team Management</h1>
                  <p className="tab-subtitle">Invite your team to create and upload content, and manage their publishing privileges.</p>
                </div>
              </header>

              <div className="team-grid">
                
                {/* Active Team Members List */}
                <section className="section-panel glass-card">
                  <h3 className="section-title">Active Team Creators</h3>
                  <p className="tab-subtitle" style={{ marginBottom: '1.5rem' }}>
                    The following creators can log in, upload lessons, and view your collaborative catalog.
                  </p>
                  
                  {teamMembers.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0, 0, 0, 0.01)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                      No team members invited yet. Use the form to add creators to your team.
                    </div>
                  ) : (
                    <div className="team-members-list">
                      {teamMembers.map(member => (
                        <div key={member.id} className="team-member-card glass-card">
                          <div className="member-avatar">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="member-info">
                            <h4 className="member-name">{member.name}</h4>
                            <span className="member-email">{member.email}</span>
                            <span className="member-role">Creator</span>
                          </div>
                          <div className="member-meta">
                            <span className="member-joined">Joined {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Recently'}</span>
                            <span className="status-pill status-ready" style={{ display: 'inline-block', width: 'fit-content', fontSize: '0.68rem', padding: '0.1rem 0.4rem', marginTop: '0.25rem' }}>Active</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Invite a Team Member Form */}
                <section className="section-panel glass-card">
                  <h3 className="section-title">Invite a Creator</h3>
                  <p className="tab-subtitle" style={{ marginBottom: '1.5rem' }}>
                    Add a new team member. They will receive credentials to log in and upload files.
                  </p>

                  <form className="invite-form" onSubmit={handleInviteSubmit}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Jane Doe"
                        value={inviteName}
                        onChange={e => setInviteName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input 
                        type="email" 
                        className="form-control"
                        placeholder="e.g. jane@ileemore.org"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Temporary Password (min 6 characters)</label>
                      <input 
                        type="password" 
                        className="form-control"
                        placeholder="••••••••"
                        value={invitePassword}
                        onChange={e => setInvitePassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="info-box-premium" style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)', marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        <strong>Publishing Protection:</strong> Uploads from this team member will automatically go to your <strong>Approval Queue</strong> before syncing to school boxes.
                      </p>
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary form-submit"
                      disabled={isSubmitting}
                      style={{ width: '100%' }}
                    >
                      {isSubmitting ? 'Sending invitation...' : 'Invite Team Creator'}
                    </button>
                  </form>
                </section>

              </div>
            </div>
          )}

          {/* TAB 4: DEVELOPER APIS & SDKS */}
          {activeTab === 'api-docs' && renderDeveloperDocs(false)}

        </main>
      </div>

      {/* MANIFEST MODAL */}
      {viewManifestItem && viewManifestItem.manifest && (
        <div className="modal-overlay" onClick={() => setViewManifestItem(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delivery Details</h3>
              <button className="modal-close" onClick={() => setViewManifestItem(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Here is the checklist for this file:
              </p>

              <div className="status-checklist" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', background: 'rgba(0, 0, 0, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>[OK]</span>
                  <span>File uploaded successfully</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: viewManifestItem.status === 'failed' ? 'var(--color-error)' : 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    {viewManifestItem.status === 'failed' ? '[Failed]' : '[OK]'}
                  </span>
                  <span>{viewManifestItem.status === 'failed' ? 'File check failed' : 'File format and size checked'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: viewManifestItem.status === 'failed' ? 'var(--text-muted)' : 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    {viewManifestItem.status === 'failed' ? '[Pending]' : '[OK]'}
                  </span>
                  <span>{viewManifestItem.format === 'MP4' ? 'Video resized for school devices' : 'File prepared for offline use'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: viewManifestItem.status === 'ready' ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                    {viewManifestItem.status === 'ready' ? '[Ready]' : '[Pending]'}
                  </span>
                  <span>{viewManifestItem.status === 'ready' ? 'Ready to download to school boxes' : 'Processing...'}</span>
                </div>
              </div>

              <div className="manifest-fields" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div className="m-field" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <strong>File ID:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{viewManifestItem.manifest.contentId}</span>
                </div>
                <div className="m-field" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <strong>File Signature:</strong> <code className="m-checksum" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{viewManifestItem.manifest.fileChecksum}</code>
                </div>
                <div className="m-field" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <strong>Box Optimization:</strong> <span>{viewManifestItem.manifest.targetDeviceCriteria.transcoded ? 'Resized to save space' : 'Original format'}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setViewManifestItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* BUY STORAGE MODAL */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Upgrade Workspace Storage</h3>
              <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                Extend your organization's storage capacity to support more high-definition lessons and offline school textbooks.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Select Upgrade Block</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  {[1, 5, 10].map(gb => (
                    <div 
                      key={gb}
                      className={`preset-item ${upgradeGb === gb ? 'preset-active' : ''}`}
                      onClick={() => setUpgradeGb(gb)}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        padding: '1rem', 
                        borderRadius: '12px', 
                        border: upgradeGb === gb ? '2px solid var(--accent-purple, #a855f7)' : '1px solid var(--border-color)', 
                        cursor: 'pointer',
                        background: upgradeGb === gb ? 'rgba(168, 85, 247, 0.05)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: upgradeGb === gb ? 'var(--accent-purple, #a855f7)' : 'var(--text-primary)' }}>+{gb} GB</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        ₦{(gb * 7500).toLocaleString()}/mo
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.015)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Capacity:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{stats ? formatStorageSize(stats.storageLimitBytes) : '1 GB'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Upgraded Capacity:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple, #a855f7)' }}>
                    {stats ? formatStorageSize(stats.storageLimitBytes + upgradeGb * 1073741824) : `${1 + upgradeGb} GB`}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>Total Order Amount:</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>₦{(upgradeGb * 7500).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpgradeModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--accent-purple, #a855f7)' }}
                onClick={() => handleBuyStorage(upgradeGb)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing Purchase...' : `Confirm & Upgrade`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
