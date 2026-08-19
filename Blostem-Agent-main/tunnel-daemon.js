// DEPRECATED / OPTIONAL: The app now auto-starts a cloudflared tunnel on launch
// (see src/lib/tunnel.ts + src/instrumentation.ts) and detects the public URL
// itself — no manual URL entry needed. This standalone localhost.run/ssh daemon
// remains only as an alternative fallback; you normally do NOT need to run it.

const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function log(msg) {
  console.log(`[Daemon ${new Date().toISOString()}] ${msg}`);
}

async function updateDatabaseUrl(newUrl) {
  try {
    const configs = await prisma.appConfig.findMany();
    for (const c of configs) {
      await prisma.appConfig.update({
        where: { id: c.id },
        data: { appUrl: newUrl }
      });
    }
    log(`Successfully updated database appUrl to: ${newUrl} for ${configs.length} configuration(s).`);
  } catch (err) {
    log(`Failed to update database: ${err.message}`);
  }
}

function startTunnel() {
  log('Starting SSH tunnel...');
  
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-R', '80:localhost:3000',
    'nokey@localhost.run'
  ]);

  ssh.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    
    // Parse URL e.g. "https://beac925083d6fd.lhr.life"
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
    if (match) {
      const url = match[0];
      log(`Detected new tunnel URL: ${url}`);
      updateDatabaseUrl(url);
    }
  });

  ssh.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  ssh.on('close', (code) => {
    log(`SSH tunnel exited with code ${code}. Restarting in 5 seconds...`);
    setTimeout(startTunnel, 5000);
  });
}

startTunnel();
