function randomString(length = 5) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let str = '';
  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

function parseChatbotIntent(userMessage) {
  const msg = userMessage.toLowerCase();
  
  // Check if user is asking to deploy
  const deployKeywords = ["deploy", "run", "start", "create", "launch", "provision", "spin up"];
  const hasDeployIntent = deployKeywords.some(kw => msg.includes(kw));

  if (!hasDeployIntent) {
    if (["subscription", "limit", "free", "premium", "upgrade"].some(kw => msg.includes(kw))) {
      const reply = 
        "ZynkaraShift offers a **Free Tier** allowing up to **3 active projects**. " +
        "Each project gets its own isolated network, app container, and optional database container (Postgres, MySQL, MongoDB, or Redis) with volume mapping. " +
        "To unlock unlimited projects, you can upgrade to the **Premium Tier** for $15/month. Click the 'Upgrade to Premium' button in the dashboard to upgrade!";
      return { reply, actionPayload: null };
    }

    const reply = 
      "Hi! I'm your ZynkaraShift PaaS Assistant. I can help you deploy full-stack apps dynamically. " +
      "Try saying something like:\n" +
      "* *\"Deploy a portfolio using nginx:alpine on port 80\"*\n" +
      "* *\"Deploy python-api:latest on port 8080 with mongodb\"*\n" +
      "* *\"Start a Node app named api-server with node:18-alpine on port 3000 and postgres database\"*";
    return { reply, actionPayload: null };
  }

  // Default parameters
  let projectName = "my-app";
  let appImage = null;
  let githubRepo = null;
  let githubBranch = "main";
  let dbType = null;
  let appPort = 80;
  const envVars = {};

  // Extract GitHub repository
  const gitRegex = /(?:github\.com\/|github\s+repo\s+|github\s+)([\w\-]+\/[\w\-]+)/i;
  const gitMatch = userMessage.match(gitRegex);
  if (gitMatch) {
    githubRepo = gitMatch[1];
    // Extract branch
    const branchRegex = /(?:branch|ref|tag)\s+([\w\-]+)/i;
    const branchMatch = userMessage.match(branchRegex);
    if (branchMatch) {
      githubBranch = branchMatch[1];
    }
  }

  // Extract project name
  const nameRegex = /(?:name|named|called)\s+([a-zA-Z0-9\-]+)/i;
  const nameMatch = userMessage.match(nameRegex);
  if (nameMatch) {
    projectName = nameMatch[1].toLowerCase();
  } else if (githubRepo) {
    projectName = githubRepo.split('/').pop().toLowerCase();
  } else {
    projectName = `app-${randomString(5)}`;
  }

  // Extract image if not GitHub repo
  if (!githubRepo) {
    appImage = "nginx:alpine"; // Fallback
    const imgRegex = /(?:image|img|using|tag)\s+([a-zA-Z0-9_\-\.\/]+:[a-zA-Z0-9_\-\.]+)/i;
    const imgMatch = userMessage.match(imgRegex);
    if (imgMatch) {
      appImage = imgMatch[1];
    } else {
      const words = userMessage.split(/\s+/);
      for (const word of words) {
        if (word.includes(':') && !word.includes('/') && !word.startsWith('http')) {
          const cleaned = word.replace(/[^\w\-\.:]/g, '');
          if (cleaned.includes(':')) {
            appImage = cleaned;
            break;
          }
        }
      }
    }
  }

  // Extract dbType
  if (msg.includes("postgres") || msg.includes("postgresql")) {
    dbType = "postgres";
  } else if (msg.includes("mysql")) {
    dbType = "mysql";
  } else if (msg.includes("mongo") || msg.includes("mongodb")) {
    dbType = "mongodb";
  } else if (msg.includes("redis")) {
    dbType = "redis";
  }

  // Extract port
  const portRegex = /(?:port|listening on|port:)\s*(\d+)/i;
  const portMatch = userMessage.match(portRegex);
  if (portMatch) {
    appPort = parseInt(portMatch[1], 10);
  }

  // Extract environment variables e.g. KEY=VALUE
  const envRegex = /([a-zA-Z_][a-zA-Z0-9_]*)=([a-zA-Z0-9_\-\./]+)/g;
  let match;
  while ((match = envRegex.exec(userMessage)) !== null) {
    envVars[match[1].toUpperCase()] = match[2];
  }

  // Construct Action Payload
  const actionPayload = {
    action: "deploy",
    name: projectName,
    db_type: dbType,
    app_port: appPort,
    env_vars: envVars
  };

  if (githubRepo) {
    actionPayload.github_repo = githubRepo;
    actionPayload.github_branch = githubBranch;
  } else {
    actionPayload.app_image = appImage;
  }

  const dbStr = dbType ? `with a private, persistent **${dbType.toUpperCase()}** database` : "without a database";
  let reply = "";

  if (githubRepo) {
    reply = 
      `I've detected a deployment from GitHub! I will download your repository **${githubRepo}** (branch: **${githubBranch}**), ` +
      `build the Docker image dynamically using its \`Dockerfile\`, and deploy it as **${projectName}** on port **${appPort}** ${dbStr}.\n\n` +
      `Setting up isolated bridge network: \`zynkara-project-${projectName}\`...\n` +
      `Generating secure credentials and dynamic Traefik routing rules...\n\n` +
      `Click the **Approve** button on the dashboard to start the Git download and build process.`;
  } else {
    reply = 
      `I've analyzed your request! I am going to deploy a new project named **${projectName}** ` +
      `running **${appImage}** on internal port **${appPort}** ${dbStr}.\n\n` +
      `Setting up isolated bridge network: \`zynkara-project-${projectName}\`...\n` +
      `Generating secure credentials and dynamic Traefik routing rules...\n\n` +
      `Click the **Approve** button on the dashboard to finalize and execute this deployment.`;
  }

  return { reply, actionPayload };
}

module.exports = { parseChatbotIntent };
