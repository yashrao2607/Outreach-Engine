import { db } from '@/lib/db';

export interface CompanySignals {
  companyName: string;
  website: string;
  techStack: string[];
  description: string;
  keySignal: string;
}

const COMMON_TECH_KEYWORDS = [
  'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'FastAPI', 'Django',
  'Go', 'Golang', 'Rust', 'Java', 'Spring Boot', 'PostgreSQL', 'Postgres', 'MongoDB', 'Redis',
  'GraphQL', 'REST API', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'TailwindCSS',
  'Microservices', 'Kafka', 'Elasticsearch', 'CI/CD', 'Machine Learning', 'AI', 'PyTorch'
];

export async function getCompanySignals(companyName: string, domainHint?: string): Promise<CompanySignals> {
  if (!companyName || !companyName.trim()) {
    return {
      companyName: 'the team',
      website: '',
      techStack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      description: 'innovative software company',
      keySignal: 'scaling modern web applications and backend systems',
    };
  }

  const cleanName = companyName.trim();

  // 1. Check Database Cache
  try {
    const cached = await db.companyResearch.findFirst({
      where: {
        companyName: { equals: cleanName, mode: 'insensitive' },
      },
    });

    if (cached && cached.products) {
      let stack: string[] = [];
      try {
        stack = JSON.parse(cached.products);
      } catch {}

      return {
        companyName: cached.companyName || cleanName,
        website: cached.website || '',
        techStack: stack.length > 0 ? stack : ['Next.js', 'TypeScript', 'PostgreSQL', 'Cloud Architecture'],
        description: cached.description || `${cleanName} technology platform`,
        keySignal: cached.industry ? `engineering scalable solutions in ${cached.industry}` : 'scaling modern engineering systems',
      };
    }
  } catch (dbErr) {
    console.warn('[Company Scraper] Cache lookup skipped:', dbErr);
  }

  // 2. Derive Domain & Fast Signal Discovery
  let domain = domainHint || '';
  if (!domain) {
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    domain = `https://${slug}.com`;
  } else if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
    domain = `https://${domain}`;
  }

  const detectedTech = new Set<string>();
  let dynamicDescription = `${cleanName} technology and engineering ecosystem`;

  // Try fast live web metadata discovery (2.5s timeout)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(domain, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const lowerHtml = html.toLowerCase();

      // Extract meta description if present
      const metaDescMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                            html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
      if (metaDescMatch && metaDescMatch[1]) {
        dynamicDescription = metaDescMatch[1].trim().slice(0, 200);
      }

      // Detect tech keywords from HTML & scripts
      for (const kw of COMMON_TECH_KEYWORDS) {
        if (lowerHtml.includes(kw.toLowerCase())) {
          detectedTech.add(kw);
        }
      }
    }
  } catch (webErr) {
    // Timeout or network block -> proceed with heuristics
  }

  // Fallback / Baseline tech heuristics
  if (detectedTech.size === 0) {
    const lowerName = cleanName.toLowerCase();
    if (lowerName.includes('ai') || lowerName.includes('tech') || lowerName.includes('data')) {
      ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'AWS'].forEach((k) => detectedTech.add(k));
    } else if (lowerName.includes('pay') || lowerName.includes('bank') || lowerName.includes('fin')) {
      ['Java', 'Spring Boot', 'Go', 'PostgreSQL', 'Redis', 'Microservices'].forEach((k) => detectedTech.add(k));
    } else if (lowerName.includes('health') || lowerName.includes('care') || lowerName.includes('med')) {
      ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'].forEach((k) => detectedTech.add(k));
    } else {
      ['Next.js', 'React', 'TypeScript', 'Node.js', 'PostgreSQL'].forEach((k) => detectedTech.add(k));
    }
  }

  const techStackList = Array.from(detectedTech).slice(0, 6);

  const result: CompanySignals = {
    companyName: cleanName,
    website: domain,
    techStack: techStackList,
    description: dynamicDescription,
    keySignal: `building high-performance software and scaling ${techStackList.slice(0, 2).join(' & ')} architecture`,
  };

  // 3. Cache Result in Database
  try {
    await db.companyResearch.create({
      data: {
        url: domain,
        companyName: cleanName,
        industry: 'Software & Technology',
        description: result.description,
        products: JSON.stringify(result.techStack),
        status: 'completed',
      },
    });
  } catch {}

  return result;
}
