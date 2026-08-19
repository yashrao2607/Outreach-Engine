import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@blostem.local';
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name: 'Admin User',
    },
    create: {
      email,
      passwordHash,
      name: 'Admin User',
      config: {
        create: {
          candidateName: 'Admin User',
          candidateEmail: 'admin@blostem.local',
          candidateSkills: JSON.stringify(['Software Engineering', 'AI Outreach', 'Full-Stack Development']),
          candidateHighlights: JSON.stringify(['5+ years engineering experience', 'Built scalable SaaS products']),
          enableTracking: true,
          dailySendLimit: 40,
        },
      },
    },
  });

  console.log(`\n========================================`);
  console.log(`✅ Seed Successful! Ready to log in:`);
  console.log(`   User ID:   ${user.id}`);
  console.log(`   Email:     ${email}`);
  console.log(`   Password:  ${password}`);
  console.log(`========================================\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
