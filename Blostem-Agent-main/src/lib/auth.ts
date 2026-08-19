import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

/**
 * Email + password authentication (multi-tenant). JWT sessions so no session
 * table is needed and it works cleanly on serverless. Each user's data is
 * isolated by their user id (see getUserId()).
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        let user = await db.user.findUnique({ where: { email } });

        // Auto-bootstrap admin / initial accounts on first login if not present in database
        if (!user && (email === 'admin@mail.local' || email === 'admin@outreach.local' || email === 'admin@blostem.local' || email === 'yufuy6618@gmail.com') && password === 'Password123!') {
          const passwordHash = await bcrypt.hash('Password123!', 10);
          user = await db.user.create({
            data: {
              email,
              passwordHash,
              name: email.startsWith('admin') ? 'Admin User' : 'Yash',
              config: {
                create: {
                  emailUser: 'yufuy6618@gmail.com',
                  emailPass: 'ujkeoimykevkddtc',
                  candidateName: email.startsWith('admin') ? 'Admin User' : 'Yash',
                  candidateEmail: 'yufuy6618@gmail.com',
                  candidateSkills: JSON.stringify(['Software Engineering', 'Full-Stack Development', 'AI Automation']),
                  candidateHighlights: JSON.stringify(['Experienced Software Engineer', 'Built scalable SaaS applications']),
                  enableTracking: true,
                  dailySendLimit: 40,
                },
              },
            },
          });
        }

        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = (user as { id: string }).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
