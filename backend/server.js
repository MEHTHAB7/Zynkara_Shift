require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const AdmZip = require('adm-zip');
const tar = require('tar-fs');

const db = require('./database');
const { seedDatabase } = require('./seed');
const OrchestrationService = require('./orchestration');
const { parseChatbotIntent } = require('./chat');
const dns = require('dns').promises;
const { sendVerificationEmail } = require('./mailer');
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? require('stripe')(stripeSecret) : null;


const app = express();
const PORT = process.env.PORT || 8000;
const SECRET_KEY = process.env.JWT_SECRET || 'zynkara_secure_jwt_secret_key_default';
const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || 'zynkarashift.duckdns.org';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

const orchestration = new OrchestrationService();

// Middleware
app.use(cors());

// Stripe Webhook needs the raw body, so define this BEFORE express.json()
app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).send("Stripe is not configured");
  }
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata && session.metadata.userId;

    if (userId) {
      try {
        await db.query(
          'UPDATE users SET subscription_status = $1 WHERE id = $2',
          ['premium', userId]
        );
        console.log(`User ${userId} successfully upgraded to premium via Stripe Webhook`);
      } catch (err) {
        console.error(`Failed to update subscription status in db for user ${userId}:`, err);
        return res.status(500).json({ error: 'Database update failed' });
      }
    } else {
      console.warn('Stripe Webhook received checkout.session.completed but userId was missing in metadata');
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// Load current user from JWT token
async function loadCurrentUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ detail: "Authentication credentials not provided or invalid" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [decoded.sub]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ detail: "Could not validate credentials" });
    }
    req.currentUser = userQuery.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ detail: "Could not validate credentials" });
  }
}

// Helper to sanitize project names (Security Check)
function validateProjectName(name) {
  if (!name || name.length > 100) return false;
  return /^[a-z0-9\-]+$/.test(name);
}

// Helper to validate email domains & resolve MX records
async function validateEmailDomain(email) {
  if (!email || typeof email !== 'string') return { valid: false, detail: "Invalid email input" };
  const parts = email.split('@');
  if (parts.length !== 2) return { valid: false, detail: "Invalid email address format" };

  const domain = parts[1].trim().toLowerCase();

  // Whitelisted domains
  const whitelistedDomains = [
    'gmail.com',
    'github.com', 'users.noreply.github.com'
  ];

  // Specific check for local test domains
  const isLocalDomain = domain === 'localhost' || domain === 'zynkara.local' || domain.endsWith('.local') || domain.endsWith('.localhost');

  // If it's a whitelisted domain or local test domain
  const isWhitelisted = whitelistedDomains.includes(domain) || whitelistedDomains.some(d => domain.endsWith('.' + d));

  if (!isWhitelisted && !isLocalDomain) {
    return {
      valid: false,
      detail: "Registration is restricted to real email addresses from Gmail or GitHub."
    };
  }

  // DNS MX resolution to verify the domain has a real mail server (skip for local test domains)
  if (!isLocalDomain) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, detail: "Email domain has no active mail server (no MX records)." };
      }
    } catch (err) {
      console.warn(`MX record check failed for domain ${domain}:`, err.message);
      return { valid: false, detail: `Email domain '${domain}' could not be verified (DNS resolve failed).` };
    }
  }

  return { valid: true };
}

// Background deployment pipeline
async function executeDeploymentPipeline(project, appImage, appPort, envVars) {
  const deploymentId = crypto.randomUUID();

  try {
    // Create deployment record
    await db.query(
      'INSERT INTO deployments (id, project_id, status, app_image, env_vars, logs) VALUES ($1, $2, $3, $4, $5, $6)',
      [deploymentId, project.id, 'building', appImage, JSON.stringify(envVars), 'Initializing deployment pipeline...\n']
    );

    const appendLogs = async (text) => {
      console.log(`[Deploy ${project.id}]: ${text}`);
      await db.query(
        'UPDATE deployments SET logs = COALESCE(logs, \'\') || $1 WHERE id = $2',
        [text + '\n', deploymentId]
      );
    };

    let finalAppImage = appImage;

    // Check for Github repository build source
    if (project.github_repo) {
      await appendLogs(`Cloning GitHub repository: '${project.github_repo}' (branch: '${project.github_branch || 'main'}')...`);

      let repoClean = project.github_repo.trim();
      if (repoClean.startsWith('https://github.com/')) {
        repoClean = repoClean.replace('https://github.com/', '');
      }
      if (repoClean.endsWith('.git')) {
        repoClean = repoClean.substring(0, repoClean.length - 4);
      }

      const parts = repoClean.split('/').filter(Boolean);
      if (parts.length < 2) {
        throw new Error(`Invalid GitHub repository identifier: ${project.github_repo}`);
      }
      const owner = parts[parts.length - 2];
      const repo = parts[parts.length - 1];
      const branchName = project.github_branch || 'main';

      const zipballUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branchName}`;
      await appendLogs(`Downloading zipball from GitHub repository...`);

      const headers = { 'User-Agent': 'ZynkaraShift-PaaS' };
      if (project.github_token) {
        headers['Authorization'] = `token ${project.github_token}`;
      }

      const response = await axios({
        url: zipballUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        headers: headers
      });

      await appendLogs('Repository downloaded. Extracting zipball...');

      const buildDir = path.join(__dirname, 'build-temp', crypto.randomUUID());
      fs.mkdirSync(buildDir, { recursive: true });

      try {
        const zip = new AdmZip(Buffer.from(response.data));
        zip.extractAllTo(buildDir, true);

        // Find root folder in extraction directory
        const dirs = fs.readdirSync(buildDir).filter(f => fs.statSync(path.join(buildDir, f)).isDirectory());
        if (dirs.length === 0) {
          throw new Error('Extracted zipball is empty');
        }
        const repoRoot = path.join(buildDir, dirs[0]);

        // Validate Dockerfile presence (Security check & requirements check)
        const dockerfilePath = path.join(repoRoot, 'Dockerfile');
        if (!fs.existsSync(dockerfilePath)) {
          throw new Error('Dockerfile not found in repository root. Please ensure your repository contains a Dockerfile.');
        }

        await appendLogs('Dockerfile found. Commencing docker image build...');

        const imageTag = `zynkara-local-${project.id.replace(/-/g, '')}:latest`;

        // Pack into tar stream for Docker daemon
        const pack = tar.pack(repoRoot);

        await appendLogs(`Building Docker image with tag '${imageTag}'...`);

        await new Promise((resolve, reject) => {
          orchestration.docker.buildImage(pack, { t: imageTag, rm: true }, (err, stream) => {
            if (err) return reject(err);

            orchestration.docker.modem.followProgress(stream, onFinished, onProgress);

            function onFinished(err, output) {
              if (err) return reject(err);
              resolve(output);
            }

            async function onProgress(event) {
              if (event.stream) {
                appendLogs(event.stream.trim());
              } else if (event.status) {
                appendLogs(event.status.trim());
              }
            }
          });
        });

        await appendLogs(`Docker image built successfully with tag '${imageTag}'.`);
        finalAppImage = imageTag;

        // Update database with built image tag
        await db.query('UPDATE deployments SET app_image = $1 WHERE id = $2', [imageTag, deploymentId]);

      } finally {
        // Cleanup build directory
        try {
          fs.rmSync(buildDir, { recursive: true, force: true });
        } catch (e) { }
      }
    }

    await appendLogs('Checking network config...');
    // Create network
    await orchestration._getOrCreateNetwork(`zynkara-project-${project.id}`);

    // Provision Database if requested
    let dbConn = null;
    if (project.db_type) {
      await appendLogs(`Provisioning database microservice of type ${project.db_type}...`);
      const dbResult = await orchestration.provisionDatabase(
        project.owner_id,
        project.id,
        project.db_type
      );
      dbConn = dbResult.connectionInfo;
      await appendLogs('Database microservice provisioned. Connection string injected.');
    }

    // Deploy App Container
    await appendLogs(`Deploying app container ${finalAppImage} listening on port ${project.app_port}...`);
    await orchestration.deployApp(
      project.owner_id,
      project.id,
      project.subdomain,
      finalAppImage,
      project.app_port,
      envVars,
      dbConn
    );

    // Update DB status to active
    await db.query('UPDATE projects SET status = $1 WHERE id = $2', ['active', project.id]);
    await db.query('UPDATE deployments SET status = $1, logs = COALESCE(logs, \'\') || $2 WHERE id = $3', ['running', 'Success! Application routed via Traefik reverse proxy.\n', deploymentId]);

  } catch (err) {
    console.error('Deployment pipeline error:', err);
    try {
      await db.query(
        'UPDATE deployments SET status = $1, logs = COALESCE(logs, \'\') || $2 WHERE id = $3',
        ['failed', `Error during deployment pipeline: ${err.message}\n`, deploymentId]
      );
      await db.query('UPDATE projects SET status = $1 WHERE id = $2', ['stopped', project.id]);
    } catch (dbErr) {
      console.error('Failed to log error to database:', dbErr);
    }
  }
}

// --- AUTH ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Validate email domain & MX records
  const domainValidation = await validateEmailDomain(cleanEmail);
  if (!domainValidation.valid) {
    return res.status(400).json({ detail: domainValidation.detail });
  }

  try {
    // 1. Check if email is already in the main users table
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ detail: "Email already registered" });
    }

    // 2. Generate a 6-digit verification code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Save to pending_registrations (insert or update on conflict)
    await db.query(
      `INSERT INTO pending_registrations (email, hashed_password, verification_token, verification_expires) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) 
       DO UPDATE SET hashed_password = $2, verification_token = $3, verification_expires = $4`,
      [cleanEmail, hashedPassword, verificationCode, expiresAt]
    );

    // 4. Send verification email
    await sendVerificationEmail(cleanEmail, verificationCode);

    res.json({
      email: cleanEmail,
      requires_verification: true,
      message: "Verification code sent to your email address."
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ detail: "Internal database error" });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ detail: "Email and verification code are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  try {
    // 1. Fetch pending registration record
    const pendingRes = await db.query('SELECT * FROM pending_registrations WHERE email = $1', [cleanEmail]);
    if (pendingRes.rows.length === 0) {
      return res.status(400).json({ detail: "No pending registration found for this email." });
    }

    const record = pendingRes.rows[0];

    // 2. Verify code and expiration
    if (record.verification_token !== cleanCode) {
      return res.status(400).json({ detail: "Incorrect verification code." });
    }

    if (new Date() > new Date(record.verification_expires)) {
      return res.status(400).json({ detail: "Verification code has expired. Please request a new code." });
    }

    // 3. Move user to active users table
    const userId = crypto.randomUUID();
    await db.query(
      `INSERT INTO users (id, email, hashed_password, subscription_status, is_verified) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, cleanEmail, record.hashed_password, 'free', true]
    );

    // 4. Delete from pending registrations
    await db.query('DELETE FROM pending_registrations WHERE email = $1', [cleanEmail]);

    // 5. Generate JWT token
    const token = jwt.sign({ sub: cleanEmail }, SECRET_KEY);
    res.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: userId,
        email: cleanEmail,
        subscription_status: 'free'
      }
    });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ detail: "Failed to verify email. Internal server error." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (userRes.rows.length === 0) {
      // Check if they are in pending_registrations
      const pendingRes = await db.query('SELECT * FROM pending_registrations WHERE email = $1', [cleanEmail]);
      if (pendingRes.rows.length > 0) {
        return res.status(403).json({
          detail: "Please verify your email address before logging in.",
          unverified: true
        });
      }
      return res.status(401).json({ detail: "Incorrect email or password" });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) {
      return res.status(401).json({ detail: "Incorrect email or password" });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        detail: "Please verify your email address before logging in.",
        unverified: true
      });
    }

    const token = jwt.sign({ sub: user.email }, SECRET_KEY);
    res.json({ access_token: token, token_type: "bearer" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

app.get('/api/auth/me', loadCurrentUser, (req, res) => {
  res.json({
    id: req.currentUser.id,
    email: req.currentUser.email,
    subscription_status: req.currentUser.subscription_status,
    created_at: req.currentUser.created_at
  });
});

// --- UNIFIED OAUTH ENDPOINTS ---

// Mock Simulator Router View
app.get('/api/auth/oauth/mock', (req, res) => {
  const { provider, redirect_uri } = req.query;
  if (!provider || !redirect_uri) {
    return res.status(400).send("Missing query parameters: provider and redirect_uri");
  }

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const providerDisplay = provider === 'github' ? 'GitHub' : capitalize(provider);

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${providerDisplay} Login Simulator - ZynkaraShift</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@600;800&display=swap" rel="stylesheet">
        <style>
          body {
            margin: 0;
            font-family: 'Inter', sans-serif;
            background: radial-gradient(circle at top right, #1e1b4b, #0f172a);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 40px;
            max-width: 450px;
            width: 100%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            text-align: center;
          }
          h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 26px;
            margin: 0 0 10px 0;
            background: linear-gradient(135deg, #818cf8, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 30px;
          }
          .form-group {
            margin-bottom: 20px;
            text-align: left;
          }
          label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #cbd5e1;
          }
          input, select {
            width: 100%;
            padding: 12px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: #f8fafc;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
          }
          input:focus, select:focus {
            border-color: #818cf8;
          }
          button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            transition: transform 0.1s, opacity 0.2s;
            margin-top: 10px;
          }
          button:hover {
            opacity: 0.95;
          }
          button:active {
            transform: scale(0.98);
          }
          .provider-badge {
            display: inline-block;
            padding: 4px 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 99px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #818cf8;
            margin-bottom: 12px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="provider-badge">${providerDisplay}</div>
          <h1>Developer OAuth Simulator</h1>
          <p>
            You are testing ZynkaraShift locally. This screen simulates authentication consent 
            for <strong>${providerDisplay}</strong> without requiring real credentials.
          </p>
          <form action="${redirect_uri}" method="GET">
            <input type="hidden" name="code" value="mock_auth_code_12345" />
            <input type="hidden" name="state" value="mock_state" />
            
            <div class="form-group">
              <label for="email">Simulate Email Address</label>
              <input type="email" id="email" name="mock_email" required placeholder="e.g. testuser@${provider === 'github' ? 'github.com' : provider + '.com'}" />
            </div>
            
            <button type="submit">Authorize & Return to App</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// Redirect to provider Authorize URL
app.get('/api/auth/oauth/:provider', (req, res) => {
  const provider = req.params.provider.toLowerCase();
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const redirectUri = `${protocol}://${host}/api/auth/oauth/${provider}/callback`;

  let clientId = '';
  let authUrl = '';

  if (provider === 'github') {
    clientId = GITHUB_CLIENT_ID;
    authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  } else if (provider === 'google') {
    clientId = process.env.GOOGLE_CLIENT_ID;
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile`;
  } else {
    return res.status(400).send("Unsupported OAuth provider");
  }

  // If credentials missing, or if using default developer keys on local/test domains, use Mock Simulator
  const isDefaultKey = clientId === 'Ov23li0R90HCA9WIdJmD' || 
                       clientId === '374864384964-0kon4hk28p7h6urapjvf9bq8mj3m42n2.apps.googleusercontent.com' ||
                       clientId === '151324834505-ps5s6qc0hj55sn166g1lm8gu0qc86cli.apps.googleusercontent.com';
  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('.local') || host.includes('github.dev');
  const bypassMock = process.env.BYPASS_MOCK_AUTH === 'true';

  if (!clientId || (isDefaultKey && isLocalHost && !bypassMock)) {
    console.log(`[OAUTH] Client credentials missing or default dev keys on local host for ${provider}. Redirecting to Mock Simulator.`);
    return res.redirect(`/api/auth/oauth/mock?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`);
  }

  res.redirect(authUrl);
});

// OAuth Callback Receiver
app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
  const provider = req.params.provider.toLowerCase();
  const { code, mock_email, state } = req.query;

  if (!code) {
    return res.status(400).send("OAuth authorization code missing.");
  }

  // Handle GitHub Account connection flow if state (JWT token) is present
  if (provider === 'github' && state && !mock_email) {
    let userId;
    try {
      const decoded = jwt.verify(state, SECRET_KEY);
      const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [decoded.sub]);
      if (userQuery.rows.length === 0) {
        return res.status(401).send("OAuth authentication failed: user not found.");
      }
      userId = userQuery.rows[0].id;
    } catch (err) {
      console.error("OAuth callback JWT verification failed:", err);
      return res.status(401).send("OAuth state verification failed. Session may have expired.");
    }

    try {
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code
        },
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ZynkaraShift-PaaS'
          }
        }
      );

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        console.error("OAuth access token response:", tokenResponse.data);
        return res.status(400).send(`Failed to retrieve access token: ${tokenResponse.data.error_description || tokenResponse.data.error || 'Unknown error'}`);
      }

      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'User-Agent': 'ZynkaraShift-PaaS'
        }
      });

      const username = userResponse.data.login;
      if (!username) {
        return res.status(400).send("Failed to retrieve username from GitHub profile.");
      }

      await db.query(
        'UPDATE users SET github_token = $1, github_username = $2 WHERE id = $3',
        [accessToken, username, userId]
      );

      return res.redirect('/?github_connected=true');
    } catch (err) {
      console.error("GitHub OAuth Callback error:", err.response?.data || err.message);
      return res.status(500).send(`GitHub authentication error: ${err.message}`);
    }
  }

  let email = '';
  let oauthId = '';

  // Mock Simulator or Real OAuth
  if (mock_email) {
    email = mock_email.trim().toLowerCase();
    oauthId = `mock-${provider}-${crypto.createHash('md5').update(email).digest('hex').substring(0, 10)}`;
  } else {
    try {
      if (provider === 'github') {
        const tokenResponse = await axios.post(
          'https://github.com/login/oauth/access_token',
          { client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code: code },
          { headers: { 'Accept': 'application/json', 'User-Agent': 'ZynkaraShift-PaaS' } }
        );
        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) throw new Error(tokenResponse.data.error_description || "Failed to exchange GitHub access token");

        const userResponse = await axios.get('https://api.github.com/user', {
          headers: { 'Authorization': `token ${accessToken}`, 'User-Agent': 'ZynkaraShift-PaaS' }
        });
        oauthId = String(userResponse.data.id);

        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
          headers: { 'Authorization': `token ${accessToken}`, 'User-Agent': 'ZynkaraShift-PaaS' }
        });
        const primaryEmailObj = emailsResponse.data.find(e => e.primary && e.verified) || emailsResponse.data[0];
        email = primaryEmailObj ? primaryEmailObj.email.toLowerCase() : userResponse.data.email?.toLowerCase();
        if (!email) email = `${userResponse.data.login}@users.noreply.github.com`.toLowerCase();
      } else if (provider === 'google') {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/oauth/google/callback`
        });
        const idToken = tokenResponse.data.id_token;
        if (!idToken) throw new Error("ID Token missing from Google response");
        const decoded = jwt.decode(idToken);
        email = decoded.email.toLowerCase();
        oauthId = decoded.sub;
      } else {
        return res.status(400).send("Unsupported OAuth provider callback");
      }
    } catch (err) {
      console.error(`OAuth callback error for provider \${provider}:`, err.message);
      return res.status(500).send(`Authentication error: \${err.message}`);
    }
  }

  if (!email) {
    return res.status(400).send("Could not retrieve email from OAuth profile.");
  }

  // Validate email domain compatibility
  const domainValidation = await validateEmailDomain(email);
  if (!domainValidation.valid) {
    return res.status(400).send(`OAuth registration denied: \${domainValidation.detail}`);
  }

  try {
    let userQuery = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let userId;

    if (userQuery.rows.length === 0) {
      userId = crypto.randomUUID();
      const mockPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      await db.query(
        `INSERT INTO users (id, email, hashed_password, subscription_status, is_verified, oauth_provider, oauth_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, email, mockPasswordHash, 'free', true, provider, oauthId]
      );
    } else {
      const user = userQuery.rows[0];
      userId = user.id;
      if (!user.oauth_provider) {
        await db.query(
          'UPDATE users SET oauth_provider = $1, oauth_id = $2, is_verified = TRUE WHERE id = $3',
          [provider, oauthId, userId]
        );
      }
    }

    // Clean up pending registrations
    await db.query('DELETE FROM pending_registrations WHERE email = $1', [email]);

    // Generate JWT token
    const token = jwt.sign({ sub: email }, SECRET_KEY);

    // Redirect back to frontend dashboard with token
    res.redirect(`/?oauth_token=${token}`);
  } catch (err) {
    console.error("OAuth database resolution error:", err);
    res.status(500).send("Database error during OAuth user resolution.");
  }
});

// --- SUBSCRIPTION ENDPOINTS ---

app.post('/api/subscription/create-checkout-session', loadCurrentUser, async (req, res) => {
  const origin = req.headers.referer || req.headers.origin || 'http://localhost:5173';

  if (!stripe) {
    // If Stripe is not configured, perform an instant upgrade for testing
    try {
      await db.query(
        'UPDATE users SET subscription_status = $1 WHERE id = $2',
        ['premium', req.currentUser.id]
      );
      return res.json({ url: `${origin}?upgrade_success=true` });
    } catch (err) {
      console.error("Mock upgrade failed:", err);
      return res.status(500).json({ detail: "Mock upgrade failed due to a database error." });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}?upgrade_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}`,
      metadata: {
        userId: req.currentUser.id.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session creation error:", err);
    res.status(500).json({ detail: "Failed to create Stripe checkout session: " + err.message });
  }
});

// --- PROJECT ENDPOINTS ---

app.post('/api/projects', loadCurrentUser, async (req, res) => {
  const { name, app_image, db_type, github_repo, github_branch, github_token, env_vars, app_port } = req.body;

  // Security checks on input parameters
  if (!validateProjectName(name)) {
    return res.status(400).json({ detail: "Invalid project name. Only lowercase alphanumeric and hyphens allowed (max 100 chars)." });
  }

  if (db_type && !['postgres', 'mysql', 'mongodb', 'redis'].includes(db_type)) {
    return res.status(400).json({ detail: "Unsupported database type." });
  }

  if (!app_image && !github_repo) {
    return res.status(400).json({ detail: "Either app_image or github_repo must be provided." });
  }

  const port = parseInt(app_port || 80, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    return res.status(400).json({ detail: "Invalid target port specification." });
  }

  try {
    // 1. Check Subscription limit (Security limit gate)
    const activeProjectsRes = await db.query(
      'SELECT COUNT(*) FROM projects WHERE owner_id = $1 AND status = $2',
      [req.currentUser.id, 'active']
    );
    const activeCount = parseInt(activeProjectsRes.rows[0].count, 10);

    if (activeCount >= 3 && req.currentUser.subscription_status !== 'premium') {
      return res.status(403).json({
        error: "Subscription required",
        message: "You have reached the maximum limit of 3 free deployed projects. Please upgrade to a premium tier to unlock unlimited deployments."
      });
    }

    // 2. Generate unique subdomain
    let baseSubdomain = name.toLowerCase().replace(/[^a-z0-9\-]/g, '');
    if (!baseSubdomain) baseSubdomain = `app-${crypto.randomBytes(3).toString('hex')}`;

    let subdomain = baseSubdomain;
    let counter = 1;
    while (true) {
      const subRes = await db.query('SELECT * FROM projects WHERE subdomain = $1', [subdomain]);
      if (subRes.rows.length === 0) break;
      subdomain = `${baseSubdomain}-${counter}`;
      counter++;
    }

    // 3. Create project record
    const projectId = crypto.randomUUID();
    const tokenToUse = github_token || req.currentUser.github_token || null;
    const newProject = {
      id: projectId,
      name,
      subdomain,
      owner_id: req.currentUser.id,
      db_type: db_type || null,
      github_repo: github_repo || null,
      github_branch: github_branch || 'main',
      github_token: tokenToUse,
      app_port: port,
      status: 'active',
      created_at: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO projects (id, name, subdomain, owner_id, db_type, github_repo, github_branch, github_token, app_port, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newProject.id, newProject.name, newProject.subdomain, newProject.owner_id,
        newProject.db_type, newProject.github_repo, newProject.github_branch,
        newProject.github_token, newProject.app_port, newProject.status
      ]
    );

    // 4. Asynchronously launch deployment pipeline background task (FastAPI equivalent)
    const targetImage = app_image || `github/${github_repo.toLowerCase()}`;
    setImmediate(() => {
      executeDeploymentPipeline(newProject, targetImage, port, env_vars || {});
    });

    const { github_token, ...returnedProject } = newProject;
    res.json(returnedProject);

  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Internal database query error" });
  }
});

app.get('/api/projects', loadCurrentUser, async (req, res) => {
  try {
    const projectsRes = await db.query('SELECT * FROM projects WHERE owner_id = $1', [req.currentUser.id]);
    const projects = projectsRes.rows.map(row => {
      const { github_token, ...rest } = row;
      return rest;
    });

    // Dynamically poll Docker state for current statuses (FastAPI equivalent)
    for (const project of projects) {
      const dockerStatus = await orchestration.getContainerStatus(project.id);

      let mappedStatus = project.status;
      if (dockerStatus === 'running') {
        mappedStatus = 'active';
      } else if (dockerStatus === 'offline' || dockerStatus === 'exited') {
        mappedStatus = 'stopped';
      }

      if (mappedStatus !== project.status) {
        project.status = mappedStatus;
        await db.query('UPDATE projects SET status = $1 WHERE id = $2', [mappedStatus, project.id]);
      }
    }

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Failed to load projects" });
  }
});

app.get('/api/projects/:project_id', loadCurrentUser, async (req, res) => {
  try {
    const projRes = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.project_id, req.currentUser.id]
    );

    if (projRes.rows.length === 0) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const { github_token, ...rest } = projRes.rows[0];
    res.json(rest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Database fetch failed" });
  }
});

app.get('/api/projects/:project_id/deployments', loadCurrentUser, async (req, res) => {
  try {
    // Owner authorization check
    const projRes = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.project_id, req.currentUser.id]
    );
    if (projRes.rows.length === 0) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const deployRes = await db.query(
      'SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.project_id]
    );

    res.json(deployRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Failed to fetch deployment records" });
  }
});

app.get('/api/projects/:project_id/logs', loadCurrentUser, async (req, res) => {
  try {
    // Owner validation
    const projRes = await db.query(
      'SELECT db_type FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.project_id, req.currentUser.id]
    );
    if (projRes.rows.length === 0) {
      return res.status(404).json({ detail: "Project not found" });
    }

    // Fetch build logs from database
    const latestDeployRes = await db.query(
      'SELECT logs FROM deployments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.project_id]
    );
    const build_logs = latestDeployRes.rows.length > 0 ? latestDeployRes.rows[0].logs : "";

    // Fetch container runtime logs dynamically
    const runtime_logs = await orchestration.getContainerLogs(req.params.project_id);

    res.json({ build_logs, runtime_logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Failed to get logs" });
  }
});

app.post('/api/projects/:project_id/stop', loadCurrentUser, async (req, res) => {
  try {
    const projRes = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.project_id, req.currentUser.id]
    );
    if (projRes.rows.length === 0) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const project = projRes.rows[0];

    if (orchestration.docker) {
      try {
        const container = orchestration.docker.getContainer(`zynkara-app-${project.id}`);
        await container.stop();
      } catch (e) { }

      if (project.db_type) {
        try {
          const dbContainer = orchestration.docker.getContainer(`zynkara-db-${project.id}`);
          await dbContainer.stop();
        } catch (e) { }
      }
    }

    await db.query('UPDATE projects SET status = $1 WHERE id = $2', ['stopped', project.id]);
    res.json({ message: "Project stopped successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Failed to stop service containers" });
  }
});

app.post('/api/projects/:project_id/start', loadCurrentUser, async (req, res) => {
  try {
    const projRes = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.project_id, req.currentUser.id]
    );
    if (projRes.rows.length === 0) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const project = projRes.rows[0];

    if (orchestration.docker) {
      if (project.db_type) {
        try {
          const dbContainer = orchestration.docker.getContainer(`zynkara-db-${project.id}`);
          await dbContainer.start();
        } catch (e) {
          return res.status(500).json({ detail: `Failed to start database container: ${e.message}` });
        }
      }
      try {
        const container = orchestration.docker.getContainer(`zynkara-app-${project.id}`);
        await container.start();
      } catch (e) {
        return res.status(500).json({ detail: `Failed to start application container: ${e.message}` });
      }
    }

    await db.query('UPDATE projects SET status = $1 WHERE id = $2', ['active', project.id]);
    res.json({ message: "Project started successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Failed to start service containers" });
  }
});

app.delete('/api/projects/:project_id', loadCurrentUser, async (req, res) => {
  try {
    const projRes = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.project_id, req.currentUser.id]
    );
    if (projRes.rows.length === 0) {
      return res.status(404).json({ detail: "Project not found" });
    }

    // Stop and remove docker resources
    await orchestration.stopAndRemoveProjectContainers(req.params.project_id);

    // Delete database records
    await db.query('DELETE FROM projects WHERE id = $1', [req.params.project_id]);

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Failed to destroy project resources" });
  }
});

// --- GITHUB INTEGRATION ENDPOINTS ---

// Check GitHub connection status
app.get('/api/github/status', loadCurrentUser, async (req, res) => {
  res.json({
    connected: !!req.currentUser.github_token,
    username: req.currentUser.github_username || null
  });
});

// Connect via Personal Access Token
app.post('/api/github/connect-token', loadCurrentUser, async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ detail: "GitHub personal access token is required" });
  }

  try {
    // Validate token by fetching the user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'ZynkaraShift-PaaS'
      }
    });

    const username = userResponse.data.login;
    if (!username) {
      return res.status(400).json({ detail: "Failed to retrieve GitHub username from token" });
    }

    // Save to database
    await db.query(
      'UPDATE users SET github_token = $1, github_username = $2 WHERE id = $3',
      [token, username, req.currentUser.id]
    );

    res.json({
      detail: "GitHub account connected successfully",
      username: username
    });
  } catch (err) {
    console.error("Error validating GitHub token:", err.response?.data || err.message);
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ detail: `Invalid GitHub token: ${msg}` });
  }
});

// Disconnect GitHub
app.delete('/api/github/disconnect', loadCurrentUser, async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET github_token = NULL, github_username = NULL WHERE id = $1',
      [req.currentUser.id]
    );
    res.json({ detail: "GitHub account disconnected successfully" });
  } catch (err) {
    console.error("Error disconnecting GitHub:", err);
    res.status(500).json({ detail: "Failed to disconnect GitHub account" });
  }
});

// Get GitHub OAuth URL
app.get('/api/github/oauth/url', loadCurrentUser, (req, res) => {
  const host = req.get('host');
  const isDefaultKey = GITHUB_CLIENT_ID === 'Ov23li0R90HCA9WIdJmD';
  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('.local') || host.includes('github.dev');
  const bypassMock = process.env.BYPASS_MOCK_AUTH === 'true';

  if (!GITHUB_CLIENT_ID || (isDefaultKey && isLocalHost && !bypassMock)) {
    return res.json({ url: null, reason: "OAuth is not configured or using default developer keys on local environment." });
  }

  // Construct redirect URL dynamically using request host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const redirectUri = `${protocol}://${host}/api/auth/oauth/github/callback`;

  // Encode the JWT token as state so we can identify the user on callback
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${token}`;
  res.json({ url: oauthUrl });
});

// GitHub OAuth callback
app.get('/api/github/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send("Callback parameters 'code' and 'state' are required.");
  }

  let userId;
  try {
    // Authenticate the user using the state parameter containing the JWT token
    const decoded = jwt.verify(state, SECRET_KEY);
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1', [decoded.sub]);
    if (userQuery.rows.length === 0) {
      return res.status(401).send("OAuth authentication failed: user not found.");
    }
    userId = userQuery.rows[0].id;
  } catch (err) {
    console.error("OAuth callback JWT verification failed:", err);
    return res.status(401).send("OAuth state verification failed. Session may have expired.");
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code
      },
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ZynkaraShift-PaaS'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      console.error("OAuth access token response:", tokenResponse.data);
      return res.status(400).send(`Failed to retrieve access token: ${tokenResponse.data.error_description || tokenResponse.data.error || 'Unknown error'}`);
    }

    // Retrieve GitHub user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'ZynkaraShift-PaaS'
      }
    });

    const username = userResponse.data.login;
    if (!username) {
      return res.status(400).send("Failed to retrieve username from GitHub profile.");
    }

    // Save to user
    await db.query(
      'UPDATE users SET github_token = $1, github_username = $2 WHERE id = $3',
      [accessToken, username, userId]
    );

    // Redirect back to dashboard
    res.redirect('/?github_connected=true');
  } catch (err) {
    console.error("GitHub OAuth Callback error:", err.response?.data || err.message);
    res.status(500).send(`GitHub authentication error: ${err.message}`);
  }
});

// Fetch user's GitHub repositories
app.get('/api/github/repos', loadCurrentUser, async (req, res) => {
  const token = req.currentUser.github_token;
  if (!token) {
    return res.status(400).json({ detail: "GitHub account not connected" });
  }

  try {
    // List user repositories (public & private)
    const reposResponse = await axios.get(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'ZynkaraShift-PaaS'
        }
      }
    );

    const repos = reposResponse.data.map(repo => ({
      name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch
    }));

    res.json(repos);
  } catch (err) {
    console.error("Error fetching GitHub repos:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      detail: `Failed to load GitHub repositories: ${err.response?.data?.message || err.message}`
    });
  }
});

// Fetch branches for a specific repository
app.get('/api/github/repos/:owner/:repo/branches', loadCurrentUser, async (req, res) => {
  const token = req.currentUser.github_token;
  if (!token) {
    return res.status(400).json({ detail: "GitHub account not connected" });
  }

  const { owner, repo } = req.params;

  try {
    const branchesResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'ZynkaraShift-PaaS'
        }
      }
    );

    const branches = branchesResponse.data.map(b => b.name);
    res.json(branches);
  } catch (err) {
    console.error(`Error fetching branches for ${owner}/${repo}:`, err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      detail: `Failed to load branches: ${err.response?.data?.message || err.message}`
    });
  }
});

// --- CHATBOT ASSISTANT ---

app.post('/api/chat', loadCurrentUser, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ detail: "Message text is required" });
  }

  const { reply, actionPayload } = parseChatbotIntent(message);
  res.json({ reply, action_payload: actionPayload });
});

// --- PLATFORM CONFIG ---

app.get('/api/config', (req, res) => {
  res.json({ platform_domain: PLATFORM_DOMAIN });
});

// --- FRONTEND STATIC MOUNTING ---
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Control Plane API running. React Frontend needs to be built with npm run build.');
  });
}

// Start Server
db.initializeDatabase()
  .then(() => seedDatabase())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ZynkaraShift Control Plane API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize or seed database on startup:", err);
  });
