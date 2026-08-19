import { execSync } from 'child_process';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Read .env.prod.unmasked to extract DATABASE_URL / POSTGRES_URL / POSTGRES_PRISMA_URL
const envContent = fs.readFileSync('.env.prod.unmasked', 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

const dbUrl = envVars.DATABASE_URL || envVars.POSTGRES_PRISMA_URL || envVars.POSTGRES_URL || envVars.DATABASE_URL_UNPOOLED;
console.log('Detected Neon Database Host:', dbUrl ? new URL(dbUrl.replace(/^postgresql:\/\//, 'http://')).host : 'None');

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.prod.unmasked');
  process.exit(1);
}

// 1. Run prisma db push with Neon database
console.log('\n--- 1. Pushing Prisma Schema to Neon Cloud Database ---');
execSync(`npx prisma db push --skip-generate`, {
  env: { ...process.env, DATABASE_URL: dbUrl },
  stdio: 'inherit',
});

// 2. Seed Admin & User in Neon Cloud Database
console.log('\n--- 2. Seeding User Accounts in Neon Cloud Database ---');
const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl }
  }
});

async function seed() {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const emailUser = 'yufuy6618@gmail.com';
  const emailPass = 'ujke oimy kevk ddtc'.replace(/\s+/g, '');

  // 1. Upsert yufuy6618@gmail.com
  const u1 = await prisma.user.upsert({
    where: { email: emailUser },
    update: {
      passwordHash,
      name: 'Yash',
      config: {
        upsert: {
          create: {
            emailUser,
            emailPass,
            candidateName: 'Yash',
            candidateEmail: emailUser,
            candidateSkills: JSON.stringify(['Software Engineering', 'Full-Stack Development', 'AI Automation']),
            candidateHighlights: JSON.stringify(['Experienced Software Engineer', 'Built scalable SaaS applications']),
            enableTracking: true,
            dailySendLimit: 40,
          },
          update: {
            emailUser,
            emailPass,
            candidateName: 'Yash',
            candidateEmail: emailUser,
          }
        }
      }
    },
    create: {
      email: emailUser,
      passwordHash,
      name: 'Yash',
      config: {
        create: {
          emailUser,
          emailPass,
          candidateName: 'Yash',
          candidateEmail: emailUser,
          candidateSkills: JSON.stringify(['Software Engineering', 'Full-Stack Development', 'AI Automation']),
          candidateHighlights: JSON.stringify(['Experienced Software Engineer', 'Built scalable SaaS applications']),
          enableTracking: true,
          dailySendLimit: 40,
        }
      }
    }
  });

  // 2. Upsert admin@blostem.local
  const u2 = await prisma.user.upsert({
    where: { email: 'admin@blostem.local' },
    update: {
      passwordHash,
      name: 'Admin User',
      config: {
        upsert: {
          create: {
            emailUser,
            emailPass,
            candidateName: 'Admin User',
            candidateEmail: emailUser,
            enableTracking: true,
            dailySendLimit: 40,
          },
          update: {
            emailUser,
            emailPass,
            candidateEmail: emailUser,
          }
        }
      }
    },
    create: {
      email: 'admin@blostem.local',
      passwordHash,
      name: 'Admin User',
      config: {
        create: {
          emailUser,
          emailPass,
          candidateName: 'Admin User',
          candidateEmail: emailUser,
          enableTracking: true,
          dailySendLimit: 40,
        }
      }
    }
  });

  console.log('✅ Accounts successfully created and ready in Neon Cloud Database:');
  console.log(`   - ${emailUser} (Password: Password123!)`);
  console.log(`   - admin@blostem.local (Password: Password123!)`);
}

seed()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    // Clean up unmasked sensitive env file
    try { fs.unlinkSync('.env.prod.unmasked'); } catch {}
  });
