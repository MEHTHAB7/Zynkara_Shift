const fs = require('fs');
const Docker = require('dockerode');

class OrchestrationService {
  constructor() {
    this.volumesBasePath = process.env.VOLUMES_BASE_PATH || '/var/zynkara/volumes';
    this.traefikNetwork = process.env.TRAEFIK_NETWORK || 'zynkara-traefik-net';
    this.platformDomain = process.env.PLATFORM_DOMAIN || 'zynkarashift.duckdns.org';
    
    try {
      this.docker = new Docker();
    } catch (e) {
      console.error("Warning: Failed to connect to docker daemon:", e);
      this.docker = null;
    }
  }

  _generatePassword(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pass = '';
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      pass += chars[idx];
    }
    return pass;
  }

  async _getOrCreateNetwork(networkName) {
    if (!this.docker) throw new Error("Docker client not initialized");
    const network = this.docker.getNetwork(networkName);
    try {
      await network.inspect();
      return network;
    } catch (err) {
      if (err.statusCode === 404) {
        console.log(`Creating isolated bridge network: ${networkName}`);
        return await this.docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          Options: {
            "com.docker.network.bridge.enable_icc": "true"
          }
        });
      }
      throw err;
    }
  }

  async stopAndRemoveProjectContainers(projectId) {
    if (!this.docker) return;
    
    const appName = `zynkara-app-${projectId}`;
    const dbName = `zynkara-db-${projectId}`;
    const netName = `zynkara-project-${projectId}`;

    // Stop and remove app
    try {
      const app = this.docker.getContainer(appName);
      console.log(`Stopping and removing app container: ${appName}`);
      await app.stop({ t: 5 });
      await app.remove();
    } catch (e) {
      // Ignored if not exists
    }

    // Stop and remove db
    try {
      const db = this.docker.getContainer(dbName);
      console.log(`Stopping and removing db container: ${dbName}`);
      await db.stop({ t: 5 });
      await db.remove();
    } catch (e) {
      // Ignored if not exists
    }

    // Remove isolated network
    try {
      const net = this.docker.getNetwork(netName);
      console.log(`Removing isolated project network: ${netName}`);
      await net.remove();
    } catch (e) {
      // Ignored if not exists
    }
  }

  async pullImage(imageName) {
    if (!this.docker) throw new Error("Docker client not initialized");
    console.log(`Pulling image: ${imageName}`);
    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, (err, stream) => {
        if (err) return reject(err);
        this.docker.modem.followProgress(stream, onFinished, onProgress);
        function onFinished(err, output) {
          if (err) return reject(err);
          resolve(output);
        }
        function onProgress(event) {
          // Progress updates logging (optional)
        }
      });
    });
  }

  async provisionDatabase(ownerId, projectId, dbType) {
    if (!this.docker) throw new Error("Docker client not initialized");

    const dbName = `zynkara-db-${projectId}`;
    const netName = `zynkara-project-${projectId}`;

    // Clean up existing db container
    try {
      const oldDb = this.docker.getContainer(dbName);
      await oldDb.stop({ t: 2 });
      await oldDb.remove();
    } catch (e) {}

    // Credentials setup
    const dbUser = 'zynkara_user';
    const dbPass = this._generatePassword();
    const dbDatabase = `zynkara_db_${projectId.replace(/-/g, '_')}`;

    let dbEnv = [];
    let connectionInfo = {};
    let imageName = '';
    let containerDbPath = '';
    let dbPort = '';
    let cmd = null;

    if (dbType === 'postgres') {
      imageName = 'postgres:15-alpine';
      containerDbPath = '/var/lib/postgresql/data';
      dbPort = '5432';
      dbEnv = [
        `POSTGRES_USER=${dbUser}`,
        `POSTGRES_PASSWORD=${dbPass}`,
        `POSTGRES_DB=${dbDatabase}`
      ];
      connectionInfo = {
        DB_TYPE: dbType,
        DB_HOST: dbName,
        DB_PORT: dbPort,
        DB_USER: dbUser,
        DB_PASSWORD: dbPass,
        DB_NAME: dbDatabase,
        DATABASE_URL: `postgresql://${dbUser}:${dbPass}@${dbName}:${dbPort}/${dbDatabase}`
      };
    } else if (dbType === 'mysql') {
      imageName = 'mysql:8.0';
      containerDbPath = '/var/lib/mysql';
      dbPort = '3306';
      dbEnv = [
        `MYSQL_USER=${dbUser}`,
        `MYSQL_PASSWORD=${dbPass}`,
        `MYSQL_DATABASE=${dbDatabase}`,
        'MYSQL_RANDOM_ROOT_PASSWORD=yes'
      ];
      connectionInfo = {
        DB_TYPE: dbType,
        DB_HOST: dbName,
        DB_PORT: dbPort,
        DB_USER: dbUser,
        DB_PASSWORD: dbPass,
        DB_NAME: dbDatabase,
        DATABASE_URL: `mysql+pymysql://${dbUser}:${dbPass}@${dbName}:${dbPort}/${dbDatabase}`
      };
    } else if (dbType === 'mongodb') {
      imageName = 'mongo:6.0';
      containerDbPath = '/data/db';
      dbPort = '27017';
      dbEnv = [
        `MONGO_INITDB_ROOT_USERNAME=${dbUser}`,
        `MONGO_INITDB_ROOT_PASSWORD=${dbPass}`,
        `MONGO_INITDB_DATABASE=${dbDatabase}`
      ];
      connectionInfo = {
        DB_TYPE: dbType,
        DB_HOST: dbName,
        DB_PORT: dbPort,
        DB_USER: dbUser,
        DB_PASSWORD: dbPass,
        DB_NAME: dbDatabase,
        DATABASE_URL: `mongodb://${dbUser}:${dbPass}@${dbName}:${dbPort}/${dbDatabase}?authSource=admin`
      };
    } else if (dbType === 'redis') {
      imageName = 'redis:7-alpine';
      containerDbPath = '/data';
      dbPort = '6379';
      dbEnv = [];
      cmd = ['redis-server', '--requirepass', dbPass];
      connectionInfo = {
        DB_TYPE: dbType,
        DB_HOST: dbName,
        DB_PORT: dbPort,
        DB_PASSWORD: dbPass,
        DATABASE_URL: `redis://:${dbPass}@${dbName}:${dbPort}/0`
      };
    } else {
      throw new Error(`Unsupported database type: ${dbType}`);
    }

    // Pull image if not cached
    try {
      await this.pullImage(imageName);
    } catch (err) {
      console.warn(`Could not pull database image ${imageName}, trying to run anyway:`, err);
    }

    // Volumes base path
    const hostVolumePath = `${this.volumesBasePath}/${ownerId}/${projectId}/${dbType}`;
    try {
      fs.mkdirSync(hostVolumePath, { recursive: true });
    } catch (e) {
      console.error("Warning: Volume directory could not be created:", e);
    }

    console.log(`Deploying database container: ${dbName} (${imageName})`);
    const container = await this.docker.createContainer({
      Image: imageName,
      name: dbName,
      Env: dbEnv,
      Cmd: cmd,
      HostConfig: {
        NetworkMode: netName,
        RestartPolicy: { Name: 'unless-stopped' },
        Binds: [`${hostVolumePath}:${containerDbPath}:rw`],
        Memory: 512 * 1024 * 1024,
        NanoCpus: 500000000 // 0.5 CPU core
      }
    });

    await container.start();
    return { dbEnv, connectionInfo };
  }

  async deployApp(ownerId, projectId, subdomain, appImage, appPort, envVars = {}, dbConnectionInfo = {}) {
    if (!this.docker) throw new Error("Docker client not initialized");

    const appName = `zynkara-app-${projectId}`;
    const projectNetName = `zynkara-project-${projectId}`;

    // Clean up existing app container
    try {
      const oldApp = this.docker.getContainer(appName);
      await oldApp.stop({ t: 2 });
      await oldApp.remove();
    } catch (e) {}

    // Pull image if not local build
    if (!appImage.startsWith('zynkara-local-')) {
      try {
        await this.pullImage(appImage);
      } catch (err) {
        console.warn(`Failed to pull app image ${appImage}, attempting to run:`, err);
      }
    }

    // Environment variables array
    const combinedEnv = { ...dbConnectionInfo, ...envVars };
    const envArray = Object.entries(combinedEnv).map(([key, val]) => `${key}=${val}`);

    // Traefik labels
    const traefikLabels = {
      "traefik.enable": "true",
      [`traefik.http.routers.zynkara-${projectId}.rule`]: `Host(\`${subdomain}.localhost\`) || Host(\`${subdomain}.${this.platformDomain}\`)`,
      [`traefik.http.routers.zynkara-${projectId}.entrypoints`]: "web",
      [`traefik.http.services.zynkara-${projectId}.loadbalancer.server.port`]: String(appPort),
      "traefik.docker.network": this.traefikNetwork
    };

    console.log(`Deploying application container: ${appName} (${appImage})`);
    const appContainer = await this.docker.createContainer({
      Image: appImage,
      name: appName,
      Env: envArray,
      Labels: traefikLabels,
      HostConfig: {
        NetworkMode: projectNetName,
        RestartPolicy: { Name: 'unless-stopped' },
        Memory: 512 * 1024 * 1024,
        NanoCpus: 500000000 // 0.5 CPU core
      }
    });

    // Attach container to Traefik network
    try {
      const traefikNet = this.docker.getNetwork(this.traefikNetwork);
      await traefikNet.connect({ Container: appContainer.id });
    } catch (err) {
      console.error(`Failed to attach app container to Traefik network:`, err);
    }

    // Start container
    await appContainer.start();
    return appContainer;
  }

  async getContainerLogs(projectId, tail = 100) {
    if (!this.docker) return "Docker client not available.";
    try {
      const container = this.docker.getContainer(`zynkara-app-${projectId}`);
      const logsBuffer = await container.logs({
        stdout: true,
        stderr: true,
        tail: tail,
        timestamps: false
      });
      return this._parseDockerLogs(logsBuffer);
    } catch (e) {
      return "Application container not found or starting up...";
    }
  }

  async getContainerStatus(projectId) {
    if (!this.docker) return "unknown";
    try {
      const container = this.docker.getContainer(`zynkara-app-${projectId}`);
      const info = await container.inspect();
      return info.State.Status; // running, exited, paused, etc.
    } catch (e) {
      return "offline";
    }
  }

  _parseDockerLogs(buffer) {
    if (!Buffer.isBuffer(buffer)) return String(buffer);
    
    let offset = 0;
    let output = '';
    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break;
      // Byte 0 indicates stdout (1) vs stderr (2). Bytes 4-7 indicate message length.
      const length = buffer.readUInt32BE(offset + 4);
      if (offset + 8 + length > buffer.length) {
        output += buffer.toString('utf8', offset + 8);
        break;
      }
      output += buffer.toString('utf8', offset + 8, offset + 8 + length);
      offset += 8 + length;
    }
    return output || buffer.toString('utf8');
  }
}

module.exports = OrchestrationService;
