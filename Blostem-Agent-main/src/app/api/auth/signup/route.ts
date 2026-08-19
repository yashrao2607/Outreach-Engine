import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Create a new tenant: a User + their own empty AppConfig. */
export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();
    const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: 'Password must be 128 characters or fewer.' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email: normEmail } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        email: normEmail,
        passwordHash,
        name: typeof name === 'string' ? name.trim() : '',
        config: { create: {} },
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error('Signup failed:', error);
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
  }
}
