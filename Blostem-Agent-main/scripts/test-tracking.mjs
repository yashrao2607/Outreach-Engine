import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contact = await prisma.hrContact.findFirst({
    where: { email: 'sarah.connor@example.com' },
  });

  if (!contact) {
    console.log('Contact not found');
    return;
  }

  console.log('--- BEFORE TRACKING ---');
  console.log(`Opened: ${contact.opened}, Open Count: ${contact.openCount}`);
  console.log(`Clicked: ${contact.clicked}, Click Count: ${contact.clickCount}`);

  // 1. Simulate recipient opening the email (Pixel GET request)
  const openRes = await fetch(`http://127.0.0.1:3000/api/track/open?id=${contact.id}`);
  console.log(`\n[API Track Open] Status: ${openRes.status}, Content-Type: ${openRes.headers.get('content-type')}`);

  // 2. Simulate recipient clicking a link (Redirect GET request)
  const clickRes = await fetch(
    `http://127.0.0.1:3000/api/track/click?id=${contact.id}&type=cta&url=${encodeURIComponent('https://cal.com/example')}`,
    { redirect: 'manual' }
  );
  console.log(`[API Track Click] Status: ${clickRes.status}, Redirects To: ${clickRes.headers.get('location')}`);

  // 3. Fetch from DB to verify real-time counter increment
  const updated = await prisma.hrContact.findUnique({ where: { id: contact.id } });
  console.log('\n--- AFTER TRACKING (Live Database) ---');
  console.log(`Opened: ${updated.opened}, Total Opens: ${updated.openCount}, Opened At: ${updated.openedAt}`);
  console.log(`Clicked: ${updated.clicked}, Total Clicks: ${updated.clickCount}, CTA Clicked: ${updated.ctaClicked}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
