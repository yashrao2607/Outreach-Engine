import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const emailUser = 'yufuy6618@gmail.com';
  const emailPass = 'ujke oimy kevk ddtc'.replace(/\s+/g, '');

  // 1. Upsert yufuy6618@gmail.com account
  const user1 = await prisma.user.upsert({
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
          },
        },
      },
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
        },
      },
    },
  });

  // 2. Also update admin@blostem.local account
  const userAdmin = await prisma.user.findUnique({ where: { email: 'admin@blostem.local' } });
  if (userAdmin) {
    await prisma.appConfig.upsert({
      where: { userId: userAdmin.id },
      create: {
        userId: userAdmin.id,
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
      },
    });
  }

  console.log('\n========================================');
  console.log('✅ Configuration successfully applied to accounts:');
  console.log(`   Account 1: ${emailUser} / Password: Password123!`);
  console.log(`   Account 2: admin@blostem.local / Password: Password123!`);
  console.log(`   SMTP & IMAP User: ${emailUser}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
