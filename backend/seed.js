require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./database');

async function seedDatabase() {
  // Ensure tables exist
  await db.initializeDatabase();
  
  console.log("Seeding default accounts...");
  
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sovereign.local';
  const premiumEmail = process.env.SEED_PREMIUM_EMAIL || 'premium@sovereign.local';
  const freeEmail = process.env.SEED_FREE_EMAIL || 'free@sovereign.local';

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
  const premiumPassword = process.env.SEED_PREMIUM_PASSWORD || crypto.randomBytes(16).toString('hex');
  const freePassword = process.env.SEED_FREE_PASSWORD || crypto.randomBytes(16).toString('hex');

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`[SEED] Generated random password for ${adminEmail}: ${adminPassword}`);
  }
  if (!process.env.SEED_PREMIUM_PASSWORD) {
    console.log(`[SEED] Generated random password for ${premiumEmail}: ${premiumPassword}`);
  }
  if (!process.env.SEED_FREE_PASSWORD) {
    console.log(`[SEED] Generated random password for ${freeEmail}: ${freePassword}`);
  }

  const usersToSeed = [
    {
      email: adminEmail,
      password: adminPassword,
      subscription: 'free'
    },
    {
      email: premiumEmail,
      password: premiumPassword,
      subscription: 'premium'
    },
    {
      email: freeEmail,
      password: freePassword,
      subscription: 'free'
    }
  ];

  for (const user of usersToSeed) {
    try {
      const checkRes = await db.query('SELECT * FROM users WHERE email = $1', [user.email]);
      if (checkRes.rows.length === 0) {
        console.log(`Seeding user: ${user.email}`);
        const userId = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await db.query(
          'INSERT INTO users (id, email, hashed_password, subscription_status, is_verified) VALUES ($1, $2, $3, $4, $5)',
          [userId, user.email, hashedPassword, user.subscription, true]
        );
      } else {
        console.log(`User already exists: ${user.email}`);
        // Ensure subscription tier is updated/correct and verified is true
        await db.query(
          'UPDATE users SET subscription_status = $1, is_verified = $2 WHERE email = $3',
          [user.subscription, true, user.email]
        );
      }
    } catch (e) {
      console.error(`Error seeding user ${user.email}:`, e);
    }
  }

  console.log("Seeding completed successfully.");
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
