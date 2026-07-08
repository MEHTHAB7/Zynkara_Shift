import React, { useState, useEffect, useRef } from 'react';

const ZynkaraLogo = ({ className = "brand-symbol" }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="zynkara-glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      <linearGradient id="zynkara-light" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="zynkara-orange" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ea580c" />
        <stop offset="60%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#facc15" />
      </linearGradient>
    </defs>
    
    {/* Outer Broken Circle Segments */}
    {/* Left and bottom blue/cyan arc */}
    <path 
      d="M 44 50 A 22 22 0 1 1 50 20" 
      stroke="url(#zynkara-glow)" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      fill="none" 
    />
    {/* Top right orange/yellow arc */}
    <path 
      d="M 52 26 A 22 22 0 0 0 40 11" 
      stroke="url(#zynkara-orange)" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      fill="none" 
    />

    {/* Circuit details inside */}
    <path d="M 46 36 L 46 45 M 46 45 L 42 49" stroke="url(#zynkara-glow)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
    <circle cx="46" cy="36" r="1.2" fill="#10b981" opacity="0.8" />
    <circle cx="42" cy="49" r="1.2" fill="#10b981" opacity="0.8" />
    
    <path d="M 22 28 L 22 36" stroke="url(#zynkara-orange)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
    <circle cx="22" cy="28" r="1.2" fill="#ea580c" opacity="0.8" />

    {/* Stylized Z - Glow Layer */}
    <path 
      d="M 22 22 L 42 22 L 22 42 L 36 42" 
      stroke="url(#zynkara-glow)" 
      strokeWidth="6" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none" 
      opacity="0.8"
    />
    {/* Stylized Z - Core Layer */}
    <path 
      d="M 22 22 L 42 22 L 22 42 L 36 42" 
      stroke="url(#zynkara-light)" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none" 
    />

    {/* Diagonal Orange Arrow */}
    <path 
      d="M 26 40 L 45 21" 
      stroke="url(#zynkara-orange)" 
      strokeWidth="4.5" 
      strokeLinecap="round" 
      fill="none" 
    />
    <path 
      d="M 38 18 L 49 17 L 48 28 Z" 
      fill="url(#zynkara-orange)" 
      stroke="url(#zynkara-orange)" 
      strokeWidth="0.5" 
      strokeLinejoin="round" 
    />
  </svg>
);

const AuthBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = Math.min(80, Math.floor((width * height) / 18000));
    const particles = [];

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        this.alpha = Math.random() * 0.5 + 0.2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${this.alpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep dark futuristic canvas bg
      const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(1, '#020408');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Dynamic animated radial glow orbs
      const time = Date.now() * 0.0003;
      const orb1X = width / 2 + Math.cos(time) * (width * 0.25);
      const orb1Y = height / 2 + Math.sin(time * 0.8) * (height * 0.25);
      const orb2X = width / 2 + Math.sin(time * 1.2) * (width * 0.3);
      const orb2Y = height / 2 + Math.cos(time * 0.6) * (height * 0.2);

      // Orb 1: Indigo/Blue
      const orb1Grad = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, Math.min(width, height) * 0.45);
      orb1Grad.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
      orb1Grad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = orb1Grad;
      ctx.fillRect(0, 0, width, height);

      // Orb 2: Emerald/Teal
      const orb2Grad = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, Math.min(width, height) * 0.4);
      orb2Grad.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      orb2Grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = orb2Grad;
      ctx.fillRect(0, 0, width, height);

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      drawLines();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        display: 'block'
      }}
    />
  );
};

export default function App() {
  // Authentication & Session States
  const [token, setToken] = useState(localStorage.getItem('zynkara_token') || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authError, setAuthError] = useState('');
  const [authVerificationRequired, setAuthVerificationRequired] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  // Dashboard & Projects States
  const [projects, setProjects] = useState([]);
  const [platformDomain, setPlatformDomain] = useState('zynkarashift.duckdns.org');

  // Logs Modal States
  const [activeLogsProjectId, setActiveLogsProjectId] = useState(null);
  const [activeLogsTab, setActiveLogsTab] = useState('build'); // 'build' or 'runtime'
  const [buildLogs, setBuildLogs] = useState('');
  const [runtimeLogs, setRuntimeLogs] = useState('');
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Upgrade stripe modal states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);


  // Manual Deploy Modal States
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploySource, setDeploySource] = useState('github'); // 'github' or 'image'
  const [deployName, setDeployName] = useState('');
  const [deployRepo, setDeployRepo] = useState('');
  const [deployBranch, setDeployBranch] = useState('main');
  const [deployGithubToken, setDeployGithubToken] = useState('');
  const [deployImage, setDeployImage] = useState('');
  const [deployPort, setDeployPort] = useState(80);
  const [deployDbType, setDeployDbType] = useState('none'); // 'none', 'postgres', 'mysql', 'mongodb', 'redis'
  const [deployEnvVars, setDeployEnvVars] = useState([{ key: '', value: '' }]);
  const [isDeploying, setIsDeploying] = useState(false);

  // Chatbot copilot states
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Welcome, developer! I am your <strong>ZynkaraShift Copilot</strong>.<br><br>I can provision networks, build persistent volumes, configure databases, and route containers dynamically via Traefik.<br><br>Tell me what you'd like to deploy! For example:<ul><li><em>"Deploy a python server using image python:3.9-slim on port 8000"</em></li><li><em>"Deploy an app named cms using ghost:alpine with mysql database"</em></li></ul>`
    }
  ]);
  const [pendingActionPayload, setPendingActionPayload] = useState(null);
  const [githubTokenInput, setGithubTokenInput] = useState('');

  // GitHub Integration States
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState(null);
  const [gitRepos, setGitRepos] = useState([]);
  const [gitBranches, setGitBranches] = useState([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [showPatModal, setShowPatModal] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [manualRepoInput, setManualRepoInput] = useState(false);

  // Toasts Notification system
  const [toasts, setToasts] = useState([]);

  // Auto-scroll references
  const chatEndRef = useRef(null);
  const logsDisplayRef = useRef(null);

  // Fetch configs and verify tokens
  useEffect(() => {
    fetchConfig();
    if (token) {
      verifyAuthToken(token);
    }
  }, [token]);

  // Check for OAuth token or Stripe success redirect in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const upgradeSuccess = params.get('upgrade_success');
    
    if (oauthToken) {
      localStorage.setItem('zynkara_token', oauthToken);
      setToken(oauthToken);
      showToast('Logged in successfully', 'success');
      
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (upgradeSuccess) {
      showToast('Upgrade process completed successfully!', 'success');
      if (token) {
        verifyAuthToken(token);
      }
      
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [token]);

  // Handle periodic status check polling
  useEffect(() => {
    if (!token || !currentUser) return;
    
    // Poll projects list every 5 seconds silently
    const interval = setInterval(() => {
      fetchProjectsSilently();
    }, 5000);

    return () => clearInterval(interval);
  }, [token, currentUser]);

  // Fetch GitHub repos when deploy modal is opened
  useEffect(() => {
    if (showDeployModal && githubConnected && gitRepos.length === 0) {
      fetchGithubRepos();
    }
  }, [showDeployModal, githubConnected]);
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, pendingActionPayload]);

  // Scroll Logs to bottom when updated
  useEffect(() => {
    if (logsDisplayRef.current) {
      logsDisplayRef.current.scrollTop = logsDisplayRef.current.scrollHeight;
    }
  }, [buildLogs, runtimeLogs]);

  // Fetch logs dynamically if modal is open
  useEffect(() => {
    if (!activeLogsProjectId) return;

    fetchLogs(); // initial load

    // Poll logs every 3 seconds while modal is open
    const interval = setInterval(() => {
      fetchLogsSilently();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeLogsProjectId, activeLogsTab]);

  // Toast Helper
  const showToast = (message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.platform_domain) setPlatformDomain(data.platform_domain);
      }
    } catch (e) {
      console.error('Failed to load platform domain config:', e);
    }
  };

  const verifyAuthToken = async (authToken) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!response.ok) throw new Error('Session expired');
      const data = await response.json();
      setCurrentUser(data);
      fetchProjects(authToken);
      fetchGithubStatus(authToken);
    } catch (err) {
      localStorage.removeItem('zynkara_token');
      setToken(null);
      setCurrentUser(null);
    }
  };

  const fetchGithubStatus = async (authToken = token) => {
    try {
      const response = await fetch('/api/github/status', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGithubConnected(data.connected);
        setGithubUsername(data.username);
        if (data.connected) {
          fetchGithubRepos(authToken);
        }
      }
    } catch (e) {
      console.error("Failed to load GitHub status:", e);
    }
  };

  const fetchGithubRepos = async (authToken = token) => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch('/api/github/repos', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGitRepos(data);
      }
    } catch (e) {
      console.error("Failed to fetch repositories:", e);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchGithubBranches = async (repoFullName) => {
    if (!repoFullName) return;
    setIsLoadingBranches(true);
    try {
      const [owner, repoName] = repoFullName.split('/');
      const response = await fetch(`/api/github/repos/${owner}/${repoName}/branches`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setGitBranches(data);
        if (data.length > 0) {
          setDeployBranch(data.includes('main') ? 'main' : data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch branches:", e);
      showToast("Failed to fetch branches for " + repoFullName, "error");
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleConnectPat = async (e) => {
    e.preventDefault();
    if (!patInput.trim()) return;

    showToast("Connecting GitHub via token...", "info");
    try {
      const response = await fetch('/api/github/connect-token', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ token: patInput.trim() })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Connection failed");

      showToast("GitHub connected successfully!", "success");
      setGithubConnected(true);
      setGithubUsername(data.username);
      setShowPatModal(false);
      setPatInput('');
      fetchGithubRepos();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDisconnectGithub = async () => {
    if (!window.confirm("Are you sure you want to disconnect GitHub?")) return;
    showToast("Disconnecting GitHub...", "info");
    try {
      const response = await fetch('/api/github/disconnect', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to disconnect");

      showToast("GitHub disconnected", "success");
      setGithubConnected(false);
      setGithubUsername(null);
      setGitRepos([]);
      setGitBranches([]);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleConnectOAuth = async () => {
    showToast("Initiating GitHub login...", "info");
    try {
      const response = await fetch('/api/github/oauth/url', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // OAuth not configured, offer PAT connection
        showToast("OAuth not configured by administrator. Please use Personal Access Token.", "warning");
        setShowPatModal(true);
      }
    } catch (err) {
      showToast("Failed to initiate OAuth: " + err.message, "error");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    // Frontend validation for register domain
    if (authMode === 'register') {
      const parts = authEmail.split('@');
      if (parts.length === 2) {
        const domain = parts[1].trim().toLowerCase();
        const whitelistedDomains = [
          'gmail.com',
          'github.com', 'users.noreply.github.com'
        ];
        const isLocalDomain = domain === 'localhost' || domain === 'zynkara.local' || domain.endsWith('.local') || domain.endsWith('.localhost');
        const isWhitelisted = whitelistedDomains.includes(domain) || whitelistedDomains.some(d => domain.endsWith('.' + d));

        if (!isWhitelisted && !isLocalDomain) {
          setAuthError("Registration is restricted to real email addresses from Gmail or GitHub.");
          return;
        }
      }
    }

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      
      let data = {};
      try {
        data = await response.json();
      } catch (err) {}

      if (!response.ok) {
        if (authMode === 'login' && response.status === 403 && data.unverified) {
          setVerificationEmail(authEmail);
          setAuthVerificationRequired(true);
          showToast('Please verify your email address.', 'warning');
          return;
        }
        throw new Error(data.detail || 'Authentication failed');
      }

      if (authMode === 'login') {
        localStorage.setItem('zynkara_token', data.access_token);
        setToken(data.access_token);
        showToast('Login successful', 'success');
      } else {
        setVerificationEmail(authEmail);
        setAuthVerificationRequired(true);
        showToast('Verification code sent! Please verify your email.', 'info');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code: verificationCode })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Verification failed');
      }
      
      localStorage.setItem('zynkara_token', data.access_token);
      setToken(data.access_token);
      showToast('Email verified and login successful!', 'success');
      setAuthVerificationRequired(false);
      setVerificationCode('');
      setVerificationEmail('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleResendCode = async () => {
    setAuthError('');
    showToast('Sending new code...', 'info');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, password: authPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to resend code');
      showToast('Verification code resent!', 'success');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zynkara_token');
    setToken(null);
    setCurrentUser(null);
    setProjects([]);
    showToast('Signed out successfully', 'info');
  };

  const fetchProjects = async (authToken = token) => {
    try {
      const response = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (err) {
      showToast('Failed to load projects', 'error');
    }
  };

  const fetchProjectsSilently = async () => {
    try {
      const response = await fetch('/api/projects', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (e) {}
  };

  const handleStopProject = async (id) => {
    showToast('Stopping application container...', 'info');
    try {
      const response = await fetch(`/api/projects/${id}/stop`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to stop container');
      showToast('Container stopped successfully', 'success');
      fetchProjects();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleStartProject = async (id) => {
    showToast('Starting container services...', 'info');
    try {
      const response = await fetch(`/api/projects/${id}/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to start container');
      showToast('Container started successfully', 'success');
      fetchProjects();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Are you absolutely sure you want to delete this project? This will permanently remove its containers, project network, and database metadata!')) {
      return;
    }
    showToast('Deleting project resources...', 'info');
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete project');
      showToast('Project resources destroyed', 'success');
      fetchProjects();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Logs stream fetchers
  const fetchLogs = async () => {
    if (!activeLogsProjectId) return;
    setIsLogsLoading(true);
    try {
      const response = await fetch(`/api/projects/${activeLogsProjectId}/logs`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to load logs');
      const data = await response.json();
      setBuildLogs(data.build_logs || 'No build logs available.');
      setRuntimeLogs(data.runtime_logs || 'No runtime output logs found (container may be stopped).');
    } catch (e) {
      setBuildLogs(`Error loading build logs: ${e.message}`);
      setRuntimeLogs(`Error loading runtime logs: ${e.message}`);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchLogsSilently = async () => {
    if (!activeLogsProjectId) return;
    try {
      const response = await fetch(`/api/projects/${activeLogsProjectId}/logs`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setBuildLogs(data.build_logs || 'No build logs available.');
        setRuntimeLogs(data.runtime_logs || 'No runtime output logs found (container may be stopped).');
      }
    } catch (e) {}
  };

  // Chat copilot pipeline
  const sendChatMessage = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const userMsgId = Math.random().toString(36).substr(2, 9);
    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text }]);
    setChatInput('');

    const botMsgId = Math.random().toString(36).substr(2, 9);
    setChatMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: 'Analyzing configuration and docker manifests...' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: text })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || 'Chat service error');

      setChatMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: data.reply } : m));
      
      if (data.action_payload && data.action_payload.action === 'deploy') {
        setPendingActionPayload(data.action_payload);
      } else {
        setPendingActionPayload(null);
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: `Oops! I encountered an error: ${err.message}` } : m));
    }
  };

  const executeParsedDeployment = async () => {
    if (!pendingActionPayload) return;

    if (githubTokenInput.trim()) {
      pendingActionPayload.github_token = githubTokenInput.trim();
    }

    showToast('Initiating deployment pipeline...', 'info');
    const payload = { ...pendingActionPayload };
    setPendingActionPayload(null);
    setGithubTokenInput('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.status === 403) {
        setShowUpgradeModal(true);
        showToast('Deployment locked: Limit exceeded', 'error');
        return;
      }

      if (!response.ok) throw new Error(data.detail || 'Deployment failed');

      showToast(`Project '${data.name}' deployment queued successfully!`, 'success');
      fetchProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Manual deployment wizard handlers
  const handleAddEnvVar = () => {
    setDeployEnvVars([...deployEnvVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index) => {
    setDeployEnvVars(deployEnvVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index, field, val) => {
    setDeployEnvVars(deployEnvVars.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  const handleManualDeploySubmit = async (e) => {
    e.preventDefault();
    setIsDeploying(true);

    // Format env variables from array to object map
    const formattedEnv = {};
    deployEnvVars.forEach(item => {
      if (item.key.trim()) {
        formattedEnv[item.key.trim().toUpperCase()] = item.value.trim();
      }
    });

    const payload = {
      name: deployName.toLowerCase().replace(/[^a-z0-9\-]/g, ''),
      db_type: deployDbType === 'none' ? null : deployDbType,
      app_port: parseInt(deployPort, 10),
      env_vars: formattedEnv
    };

    if (deploySource === 'github') {
      payload.github_repo = deployRepo;
      payload.github_branch = deployBranch || 'main';
      if (deployGithubToken.trim()) {
        payload.github_token = deployGithubToken.trim();
      }
    } else {
      payload.app_image = deployImage;
    }

    showToast('Initiating deployment pipeline...', 'info');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.status === 403) {
        setShowUpgradeModal(true);
        showToast('Deployment locked: Limit exceeded', 'error');
        return;
      }

      if (!response.ok) throw new Error(data.detail || 'Deployment failed');

      showToast(`Project '${data.name}' deployment queued successfully!`, 'success');
      fetchProjects();
      
      // Reset form & close modal
      setShowDeployModal(false);
      setDeployName('');
      setDeployRepo('');
      setDeployBranch('main');
      setDeployGithubToken('');
      setDeployImage('');
      setDeployPort(80);
      setDeployDbType('none');
      setDeployEnvVars([{ key: '', value: '' }]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Process Stripe payment redirect
  const processStripePayment = async (e) => {
    if (e) e.preventDefault();
    setIsPaymentProcessing(true);
    setPaymentStatus('Initiating secure Stripe Checkout...');

    try {
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create checkout session');
      }

      const data = await response.json();
      setPaymentStatus('Session created! Redirecting to Stripe...');
      
      // Redirect browser to Stripe Checkout page
      window.location.href = data.url;
    } catch (err) {
      setPaymentStatus(`Error: ${err.message}`);
      setIsPaymentProcessing(false);
      showToast(err.message, 'error');
    }
  };


  // Formatting utils for chatbot chat HTML output
  const formatMsgText = (text) => {
    return {
      __html: text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
    };
  };

  return (
    <>
      {/* Background glow elements */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      {/* Real-time Toasts notifications container */}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(toast => {
          let icon = 'fa-info-circle';
          let color = 'var(--primary)';
          if (toast.type === 'success') {
            icon = 'fa-check-circle';
            color = 'var(--success)';
          } else if (toast.type === 'error') {
            icon = 'fa-exclamation-circle';
            color = 'var(--danger)';
          } else if (toast.type === 'warning') {
            icon = 'fa-exclamation-triangle';
            color = 'var(--warning)';
          }
          return (
            <div key={toast.id} className="toast-message glass" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              borderLeft: `3px solid ${color}`,
              animation: 'slideUp 0.3s ease-out'
            }}>
              <i className={`fa-solid ${icon}`} style={{ color }}></i>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>

      {/* Auth overlay panel */}
      {!token && (
        <div className="overlay active auth-overlay">
          <AuthBackground />
          <div className="auth-card glass">
            <div className="auth-header">
              <ZynkaraLogo className="brand-symbol" />
              <h2>ZynkaraShift</h2>
              <p>Self-Hosted, Zero-Cost Cloud PaaS</p>
            </div>
            
            {!authVerificationRequired && (
              <div className="auth-tabs">
                <button className={`tab-btn ${authMode === 'login' ? 'active' : ''}`} onClick={() => setAuthMode('login')}>Sign In</button>
                <button className={`tab-btn ${authMode === 'register' ? 'active' : ''}`} onClick={() => setAuthMode('register')}>Register</button>
              </div>
            )}

            {authVerificationRequired ? (
              <form onSubmit={handleVerifySubmit}>
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    We've sent a 6-digit verification code to <br/>
                    <strong style={{ color: '#fff' }}>{verificationEmail}</strong>.
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '6px', lineHeight: '1.4' }}>
                    Note: If you are testing locally, the code is also printed in the server logs.
                  </p>
                </div>
                <div className="input-group">
                  <label htmlFor="auth-code"><i className="fa-solid fa-key"></i> Verification Code</label>
                  <input 
                    type="text" 
                    id="auth-code" 
                    required 
                    maxLength="6"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', fontFamily: 'monospace' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ marginBottom: '10px' }}>
                  <span>Verify Email</span> <i className="fa-solid fa-check"></i>
                </button>
                <button type="button" className="btn btn-secondary btn-block" onClick={handleResendCode} style={{ marginBottom: '10px' }}>
                  <i className="fa-solid fa-arrow-rotate-right"></i> Resend Verification Code
                </button>
                <button type="button" className="btn btn-link btn-block" onClick={() => { setAuthVerificationRequired(false); setAuthError(''); }} style={{ fontSize: '12px', marginTop: '10px', color: 'var(--text-muted)', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                  Back to {authMode === 'login' ? 'Sign In' : 'Register'}
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleAuthSubmit}>
                  <div className="input-group">
                    <label htmlFor="auth-email"><i className="fa-solid fa-envelope"></i> Email Address</label>
                    <input 
                      type="email" 
                      id="auth-email" 
                      required 
                      placeholder="name@domain.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="auth-password"><i className="fa-solid fa-lock"></i> Password</label>
                    <input 
                      type="password" 
                      id="auth-password" 
                      required 
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block">
                    <span>{authMode === 'login' ? 'Sign In' : 'Register Account'}</span> <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </form>

                <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Or continue with</span>
                  <span style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <a href="/api/auth/oauth/github" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textDecoration: 'none' }}>
                    <i className="fa-brands fa-github"></i> GitHub
                  </a>
                  <a href="/api/auth/oauth/google" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textDecoration: 'none' }}>
                    <i className="fa-brands fa-google"></i> Google
                  </a>
                </div>
              </>
            )}
            {authError && <p className="error-text">{authError}</p>}
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      {token && currentUser && (
        <div className="dashboard-wrapper">
          {/* Navigation Header */}
          <header className="main-header glass">
            <div className="header-brand">
              <ZynkaraLogo className="brand-symbol-sm" />
              <h1>ZynkaraShift <span className="badge badge-beta">Control Plane</span></h1>
            </div>
            <div className="header-user">
              <div className="user-info">
                <div className="user-email">{currentUser.email}</div>
                <div className="user-tier">
                  <span className={`badge ${currentUser.subscription_status === 'premium' ? 'badge-premium' : 'badge-free'}`}>
                    {currentUser.subscription_status === 'premium' ? 'Premium Plan' : 'Free Tier (3 Max)'}
                  </span>
                </div>
              </div>
              {currentUser.subscription_status !== 'premium' && (
                <button className="btn btn-secondary btn-xs" onClick={() => setShowUpgradeModal(true)} style={{ borderColor: '#fbbf24', color: '#fbbf24' }}>
                  <i className="fa-solid fa-crown"></i> Upgrade
                </button>
              )}
              <button className="btn btn-secondary btn-icon" onClick={handleLogout} title="Sign Out">
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </header>

          {/* Grid Layout */}
          <main className="dashboard-grid">
            {/* Left Panel: Chatbot Assistant */}
            <section className="panel chatbot-panel glass">
              <div className="panel-header">
                <div className="panel-title">
                  <i className="fa-solid fa-robot"></i>
                  <h2>AI Deployment Copilot</h2>
                </div>
                <span className="status-indicator online">Online</span>
              </div>
              
              <div className="chat-history">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`chat-msg chat-msg-${msg.sender}`}>
                    <p dangerouslySetInnerHTML={formatMsgText(msg.text)}></p>
                  </div>
                ))}
                
                {/* Deployment approval panel */}
                {pendingActionPayload && (
                  <div className="action-preview glass">
                    <div className="preview-header">
                      <span className="preview-title"><i className="fa-solid fa-rocket"></i> Parsed Deployment Payload</span>
                      <button className="close-preview-btn" onClick={() => setPendingActionPayload(null)} title="Clear Preview" aria-label="Clear Preview"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="preview-body">
                      <table className="preview-details-table">
                        <tbody>
                          <tr>
                            <td className="preview-details-label">Project Name:</td>
                            <td className="preview-details-value"><strong>{pendingActionPayload.name}</strong></td>
                          </tr>
                          {pendingActionPayload.github_repo ? (
                            <>
                              <tr>
                                <td className="preview-details-label">GitHub Repo:</td>
                                <td className="preview-details-value"><i className="fa-brands fa-github"></i> {pendingActionPayload.github_repo}</td>
                              </tr>
                              <tr>
                                <td className="preview-details-label">Branch:</td>
                                <td className="preview-details-value">{pendingActionPayload.github_branch || 'main'}</td>
                              </tr>
                            </>
                          ) : (
                            <tr>
                              <td className="preview-details-label">Docker Image:</td>
                              <td className="preview-details-value">{pendingActionPayload.app_image}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="preview-details-label">Target Port:</td>
                            <td className="preview-details-value">{pendingActionPayload.app_port}</td>
                          </tr>
                          <tr>
                            <td className="preview-details-label">Database:</td>
                            <td className="preview-details-value">{pendingActionPayload.db_type ? pendingActionPayload.db_type.toUpperCase() : 'None'}</td>
                          </tr>
                          {pendingActionPayload.env_vars && Object.keys(pendingActionPayload.env_vars).length > 0 && (
                            <tr>
                              <td className="preview-details-label">Env Vars:</td>
                              <td className="preview-details-value">{JSON.stringify(pendingActionPayload.env_vars)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      
                      {pendingActionPayload.github_repo && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '2px' }}>GitHub Token (optional, for private repos):</label>
                          <input 
                            type="password" 
                            placeholder="Enter personal access token..." 
                            className="preview-input"
                            value={githubTokenInput}
                            onChange={(e) => setGithubTokenInput(e.target.value)}
                            style={{
                              width: '100%',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '6px 10px',
                              color: '#fff',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <button className="btn btn-success btn-sm btn-block" onClick={executeParsedDeployment}>
                      <i className="fa-solid fa-check"></i> Approve & Deploy Container
                    </button>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-wrapper">
                <form onSubmit={sendChatMessage} className="chat-input-row">
                  <input 
                    type="text" 
                    placeholder="Ask to deploy an app (e.g. 'deploy nginx:alpine on port 80')..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    autoComplete="off" 
                    required 
                  />
                  <button type="submit" className="btn btn-primary btn-icon" title="Send Message" aria-label="Send Message">
                    <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                  </button>
                </form>
              </div>
            </section>

            {/* Right Panel: Projects & Services dashboard */}
            <section className="panel dashboard-panel glass">
              <div className="panel-header">
                <div className="panel-title">
                  <i className="fa-solid fa-cubes"></i>
                  <h2>Projects & Services</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowDeployModal(true)}>
                    <i className="fa-solid fa-plus"></i> Deploy Project
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => fetchProjects()}>
                    <i className="fa-solid fa-rotate"></i> Refresh
                  </button>
                </div>
              </div>

              <div className="projects-list-container">
                {/* GitHub Integration Status Banner */}
                <div className="github-integration-card glass" style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px',
                  borderLeft: '4px solid #24292e',
                  background: 'rgba(15, 23, 42, 0.45)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '15px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px'
                    }}>
                      <i className="fa-brands fa-github"></i>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>GitHub Account Connection</h4>
                      {githubConnected ? (
                        <p style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500, marginTop: '2px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', marginRight: '6px', verticalAlign: 'middle' }}></span>
                          Connected as <strong style={{ color: '#fff' }}>{githubUsername}</strong>
                        </p>
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Not connected. Connect to deploy your private and public repositories.
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {githubConnected ? (
                      <button className="btn btn-secondary btn-xs" onClick={handleDisconnectGithub} style={{ color: 'var(--danger)', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
                        <i className="fa-solid fa-link-slash"></i> Disconnect
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-primary btn-xs" onClick={handleConnectOAuth}>
                          <i className="fa-brands fa-github"></i> Connect via GitHub
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => setShowPatModal(true)}>
                          <i className="fa-solid fa-key"></i> Use Token
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {projects.length === 0 ? (
                  <div className="empty-state">
                    <i className="fa-solid fa-circle-nodes empty-state-icon"></i>
                    <h3>No active deployments</h3>
                    <p>Deploy a project by instructing the AI Copilot on the left side of the dashboard, or click "Deploy Project" above!</p>
                  </div>
                ) : (
                  projects.map(p => {
                    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    const domain = isLocalhost ? `${p.subdomain}.localhost` : `${p.subdomain}.${platformDomain}`;
                    const port = window.location.port ? `:${window.location.port}` : '';
                    const publicUrl = `http://${domain}${port}`;
                    
                    return (
                      <div key={p.id} className="project-card glass" data-project-id={p.id}>
                        <div className="project-card-header">
                          <div className="project-meta">
                            <h3>{p.name}</h3>
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="project-subdomain">
                              {domain} <i className="fa-solid fa-up-right-from-square" style={{ fontSize: '10px' }}></i>
                            </a>
                          </div>
                          <span className={`status-badge status-${p.status}`}>{p.status}</span>
                        </div>
                        
                        <div className="project-details">
                          {p.github_repo && (
                            <div className="detail-row">
                              <span className="detail-label">Git Repo:</span>
                              <span className="detail-value">
                                <a href={`https://github.com/${p.github_repo}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                  <i className="fa-brands fa-github"></i> {p.github_repo} ({p.github_branch || 'main'})
                                </a>
                              </span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span className="detail-label">Service Port:</span>
                            <span className="detail-value">{p.app_port}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Database Type:</span>
                            <span className="detail-value">{p.db_type ? p.db_type.toUpperCase() : 'None'}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Created At:</span>
                            <span className="detail-value">{new Date(p.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="project-actions">
                          {p.status === 'active' ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleStopProject(p.id)} title="Stop Service">
                              <i className="fa-solid fa-square"></i> Stop
                            </button>
                          ) : p.status === 'stopped' ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleStartProject(p.id)} title="Start Service">
                              <i className="fa-solid fa-play"></i> Start
                            </button>
                          ) : (
                            <button className="btn btn-secondary btn-sm" disabled>
                              <i className="fa-solid fa-spinner fa-spin"></i> Building
                            </button>
                          )}
                          
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveLogsProjectId(p.id)}>
                            <i className="fa-solid fa-terminal"></i> Logs
                          </button>
                          
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteProject(p.id)} title="Delete Project">
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </main>
        </div>
      )}

      {/* Manual Deploy Wizard Overlay Modal */}
      {showDeployModal && (
        <div className="overlay active" style={{ zIndex: 200 }}>
          <div className="payment-card glass" style={{ maxWidth: '580px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <button className="close-overlay-btn" onClick={() => setShowDeployModal(false)} title="Close" aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="payment-header" style={{ marginBottom: '20px' }}>
              <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '10px' }}></i>
              <h2>Deploy New Project</h2>
              <p>Host from a GitHub Repository or raw Docker Image</p>
            </div>

            <div className="auth-tabs" style={{ marginBottom: '20px' }}>
              <button className={`tab-btn ${deploySource === 'github' ? 'active' : ''}`} type="button" onClick={() => setDeploySource('github')}>
                <i className="fa-brands fa-github"></i> GitHub Repository
              </button>
              <button className={`tab-btn ${deploySource === 'image' ? 'active' : ''}`} type="button" onClick={() => setDeploySource('image')}>
                <i className="fa-solid fa-cubes"></i> Docker Image
              </button>
            </div>

            <form onSubmit={handleManualDeploySubmit}>
              <div className="input-group">
                <label><i className="fa-solid fa-tag"></i> Project Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="my-cool-service"
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                />
              </div>

              {deploySource === 'github' ? (
                <>
                  {githubConnected && !manualRepoInput ? (
                    <>
                      <div className="input-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span><i className="fa-brands fa-github"></i> Select Repository</span>
                          <button className="btn btn-secondary btn-xs" type="button" onClick={() => setManualRepoInput(true)}>
                            Enter manually
                          </button>
                        </label>
                        {isLoadingRepos ? (
                          <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <i className="fa-solid fa-spinner fa-spin"></i> Loading repositories...
                          </div>
                        ) : gitRepos.length === 0 ? (
                          <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>No repositories found.</span>
                            <button className="btn btn-secondary btn-xs" type="button" onClick={() => fetchGithubRepos()}>Retry</button>
                          </div>
                        ) : (
                          <select
                            value={deployRepo}
                            required
                            onChange={(e) => {
                              setDeployRepo(e.target.value);
                              const repoNameOnly = e.target.value.split('/')[1] || '';
                              if (!deployName || deployName === deployRepo.split('/')[1]) {
                                setDeployName(repoNameOnly.toLowerCase().replace(/[^a-z0-9\-]/g, ''));
                              }
                              fetchGithubBranches(e.target.value);
                            }}
                            style={{
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              padding: '10px 14px',
                              color: '#fff',
                              outline: 'none',
                              fontSize: '14px',
                              fontFamily: 'inherit',
                              width: '100%',
                              height: '42px'
                            }}
                          >
                            <option value="" style={{ background: '#0f172a' }}>-- Select a repository --</option>
                            {gitRepos.map(repo => (
                              <option key={repo.name} value={repo.name} style={{ background: '#0f172a' }}>
                                {repo.name} {repo.private ? '🔒' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="row" style={{ display: 'flex', gap: '10px' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label><i className="fa-solid fa-code-branch"></i> Branch</label>
                          {isLoadingBranches ? (
                            <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <i className="fa-solid fa-spinner fa-spin"></i> Loading...
                            </div>
                          ) : gitBranches.length === 0 ? (
                            <input 
                              type="text" 
                              placeholder="main"
                              value={deployBranch}
                              onChange={(e) => setDeployBranch(e.target.value)}
                            />
                          ) : (
                            <select
                              value={deployBranch}
                              required
                              onChange={(e) => setDeployBranch(e.target.value)}
                              style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                padding: '10px 14px',
                                color: '#fff',
                                outline: 'none',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                width: '100%',
                                height: '42px'
                              }}
                            >
                              {gitBranches.map(branch => (
                                <option key={branch} value={branch} style={{ background: '#0f172a' }}>
                                  {branch}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label><i className="fa-solid fa-key"></i> GitHub Token</label>
                          <input 
                            type="password" 
                            placeholder="Using connected account token"
                            disabled
                            value=""
                            style={{
                              opacity: 0.6,
                              cursor: 'not-allowed',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              padding: '10px 14px',
                              color: '#fff',
                              outline: 'none',
                              fontSize: '14px',
                              width: '100%',
                              height: '42px'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="input-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span><i className="fa-solid fa-folder-tree"></i> GitHub Repository</span>
                          {githubConnected && (
                            <button className="btn btn-secondary btn-xs" type="button" onClick={() => setManualRepoInput(false)}>
                              Select from list
                            </button>
                          )}
                        </label>
                        <input 
                          type="text" 
                          required 
                          placeholder="owner/repo (e.g. facebook/react)"
                          value={deployRepo}
                          onChange={(e) => setDeployRepo(e.target.value)}
                        />
                      </div>
                      <div className="row" style={{ display: 'flex', gap: '10px' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label><i className="fa-solid fa-code-branch"></i> Branch</label>
                          <input 
                            type="text" 
                            placeholder="main"
                            value={deployBranch}
                            onChange={(e) => setDeployBranch(e.target.value)}
                          />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label><i className="fa-solid fa-key"></i> GitHub Token (optional)</label>
                          <input 
                            type="password" 
                            placeholder="For private repos"
                            value={deployGithubToken}
                            onChange={(e) => setDeployGithubToken(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="input-group">
                  <label><i className="fa-solid fa-cube"></i> Docker Image Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="nginx:alpine or python:3.9-slim"
                    value={deployImage}
                    onChange={(e) => setDeployImage(e.target.value)}
                  />
                </div>
              )}

              <div className="row" style={{ display: 'flex', gap: '10px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label><i className="fa-solid fa-circle-right"></i> Internal App Port</label>
                  <input 
                    type="number" 
                    required 
                    value={deployPort}
                    onChange={(e) => setDeployPort(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label><i className="fa-solid fa-database"></i> Database Service</label>
                  <select 
                    value={deployDbType} 
                    onChange={(e) => setDeployDbType(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      color: '#fff',
                      outline: 'none',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      width: '100%',
                      height: '42px'
                    }}
                  >
                    <option value="none" style={{ background: '#0f172a' }}>None</option>
                    <option value="postgres" style={{ background: '#0f172a' }}>PostgreSQL</option>
                    <option value="mysql" style={{ background: '#0f172a' }}>MySQL</option>
                    <option value="mongodb" style={{ background: '#0f172a' }}>MongoDB</option>
                    <option value="redis" style={{ background: '#0f172a' }}>Redis</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Environment Variables Block */}
              <div style={{ margin: '15px 0 20px 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 600 }}>Environment Variables</h3>
                  <button className="btn btn-secondary btn-xs" type="button" onClick={handleAddEnvVar}>
                    <i className="fa-solid fa-plus"></i> Add Variable
                  </button>
                </div>

                {deployEnvVars.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      placeholder="KEY (e.g. API_KEY)" 
                      value={item.key}
                      onChange={(e) => handleEnvVarChange(idx, 'key', e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                    <input 
                      type="text" 
                      placeholder="value" 
                      value={item.value}
                      onChange={(e) => handleEnvVarChange(idx, 'value', e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                    <button 
                      className="btn btn-danger btn-xs btn-icon" 
                      type="button" 
                      onClick={() => handleRemoveEnvVar(idx)} 
                      style={{ height: '34px', width: '34px' }}
                      title="Remove Variable"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={isDeploying} style={{ padding: '12px 18px' }}>
                {isDeploying ? (
                  <span><i className="fa-solid fa-spinner fa-spin"></i> Deploying...</span>
                ) : (
                  <span><i className="fa-solid fa-rocket"></i> Launch Application</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stripe mock checkout upgrade payment overlay modal */}
      {showUpgradeModal && (
        <div className="overlay active">
          <div className="payment-card glass">
            <button className="close-overlay-btn" onClick={() => setShowUpgradeModal(false)} title="Close" aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
            <div className="payment-header">
              <i className="fa-solid fa-crown premium-icon"></i>
              <h2>Unlock Unlimited Deployments</h2>
              <p>Reach beyond the 3-free-project local subscription cap</p>
            </div>
            
            <div className="premium-features">
              <div className="feature-item">
                <i className="fa-solid fa-check feature-check"></i>
                <span>Deploy <strong>Unlimited Projects</strong> on your host machine</span>
              </div>
              <div className="feature-item">
                <i className="fa-solid fa-check feature-check"></i>
                <span>Configure unlimited PostgreSQL, MySQL, Redis & MongoDB services</span>
              </div>
              <div className="feature-item">
                <i className="fa-solid fa-check feature-check"></i>
                <span>Premium multi-core allocation and expanded container memory rules</span>
              </div>
            </div>

            <div className="billing-details">
              <div className="price-row">
                <span>ZynkaraShift Premium License</span>
                <span className="price-value">$15<span className="price-period">/mo</span></span>
              </div>
            </div>

            <form onSubmit={processStripePayment}>
              <button type="submit" className="btn btn-primary btn-block btn-premium" disabled={isPaymentProcessing}>
                {isPaymentProcessing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Redirecting to Stripe Secure Pay...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-credit-card" style={{ marginRight: '8px' }}></i> Proceed to Secure Checkout
                  </>
                )}
              </button>
              <div className="stripe-secure-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                <i className="fa-solid fa-shield-halved" style={{ color: '#10b981' }}></i>
                <span>Secured by Stripe. Cancel subscription anytime.</span>
              </div>
            </form>
            {paymentStatus && <p className="success-text" style={{ textAlign: 'center', marginTop: '10px' }}>{paymentStatus}</p>}
          </div>
        </div>
      )}

      {/* GitHub Personal Access Token connection modal overlay */}
      {showPatModal && (
        <div className="overlay active" style={{ zIndex: 300 }}>
          <div className="payment-card glass" style={{ maxWidth: '480px', width: '90%' }}>
            <button className="close-overlay-btn" onClick={() => setShowPatModal(false)} title="Close" aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="payment-header" style={{ marginBottom: '20px' }}>
              <i className="fa-brands fa-github" style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '10px' }}></i>
              <h2>Connect GitHub via PAT</h2>
              <p>Generate a Personal Access Token on GitHub with <strong>repo</strong> and <strong>user</strong> permissions.</p>
            </div>

            <form onSubmit={handleConnectPat}>
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="github-pat"><i className="fa-solid fa-key"></i> Personal Access Token</label>
                <input 
                  type="password" 
                  id="github-pat"
                  required 
                  placeholder="ghp_..."
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px',
                    width: '100%'
                  }}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" style={{ padding: '12px' }}>
                Connect Token
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Logs Viewer Modal Overlay */}
      {activeLogsProjectId && (
        <div className="overlay active">
          <div className="logs-card glass">
            <div className="logs-header">
              <h2><i className="fa-solid fa-terminal"></i> Container & Deploy Logs</h2>
              <div className="logs-actions">
                <button className="btn btn-secondary btn-xs" onClick={fetchLogs} disabled={isLogsLoading}>
                  <i className={`fa-solid fa-arrows-rotate ${isLogsLoading ? 'fa-spin' : ''}`}></i> Refresh
                </button>
                <button className="close-overlay-btn-static" onClick={() => setActiveLogsProjectId(null)} title="Close Logs" aria-label="Close Logs"><i className="fa-solid fa-xmark"></i></button>
              </div>
            </div>
            <div className="logs-tabs">
              <button className={`logs-tab ${activeLogsTab === 'build' ? 'active' : ''}`} onClick={() => setActiveLogsTab('build')}>Build Pipeline Logs</button>
              <button className={`logs-tab ${activeLogsTab === 'runtime' ? 'active' : ''}`} onClick={() => setActiveLogsTab('runtime')}>Runtime Application Logs</button>
            </div>
            <pre className="logs-content" id="logs-display" ref={logsDisplayRef}>
              {activeLogsTab === 'build' ? buildLogs : runtimeLogs}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
