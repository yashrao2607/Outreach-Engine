import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/** Returns the logged-in user's id (server-side), or null if unauthenticated. */
export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id || null;
}
