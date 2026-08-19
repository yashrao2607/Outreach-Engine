import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'yufuy6618@gmail.com' } });
  
  const contact = await prisma.hrContact.create({
    data: {
      userId: user.id,
      name: 'Sarah Connor',
      email: 'sarah.connor@example.com',
      company: 'TechCorp Solutions',
      title: 'Talent Acquisition Director',
      status: 'pending',
    },
  });

  console.log('✅ Created sample contact:', contact.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
