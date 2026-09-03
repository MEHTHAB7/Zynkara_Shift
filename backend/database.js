const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const { Pool } = require('pg');

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  const user = process.env.POSTGRES_USER || 'postgres';
  const pass = process.env.POSTGRES_PASSWORD || '250730';
  const dbName = process.env.POSTGRES_DB || 'VaporupDeploy';
  databaseUrl = `postgresql://${user}:${pass}@localhost:5432/${dbName}`;
} else if (databaseUrl.includes('@postgres-control:') && !process.env.TRAEFIK_NETWORK) {
  // If postgres-control is specified but running on host outside Docker container, use localhost
  databaseUrl = databaseUrl.replace('@postgres-control:', '@localhost:');
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 20, // Matches SQLAlchemy pool_size + max_overflow
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function query(text, params) {
  return await pool.query(text, params);
}

async function initializeDatabase() {
  console.log("Initializing database tables...");
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        subscription_status VARCHAR(50) DEFAULT 'free' NOT NULL,
        github_token VARCHAR(255),
        github_username VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE NOT NULL,
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Ensure github connection and verification columns exist on users table (for existing installations)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_token VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE NOT NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);`);

    // Create Pending Registrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        email VARCHAR(255) PRIMARY KEY,
        hashed_password VARCHAR(255) NOT NULL,
        verification_token VARCHAR(255) NOT NULL,
        verification_expires TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    
    // Create Projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        db_type VARCHAR(50),
        github_repo VARCHAR(255),
        github_branch VARCHAR(100),
        github_token VARCHAR(255),
        app_port INTEGER DEFAULT 80 NOT NULL,
        status VARCHAR(50) DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    
    // Create Deployments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'building' NOT NULL,
        app_image VARCHAR(255) NOT NULL,
        env_vars JSONB,
        logs TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_subdomain ON projects(subdomain);`);

    // Ensure database-level defaults are configured (fixes migration from Python SQLAlchemy)
    await client.query(`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE projects ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE deployments ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;`);
    
    await client.query('COMMIT');
    console.log("Database initialized successfully.");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("Failed to initialize database:", e);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  initializeDatabase
};
