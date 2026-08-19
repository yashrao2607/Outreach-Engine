import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getUserId } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let emailUser: string | undefined;
    let emailPass: string | undefined;

    try {
      const body = await request.json();
      if (body?.emailUser) emailUser = String(body.emailUser).trim();
      if (body?.emailPass && body.emailPass !== '••••••••') emailPass = String(body.emailPass).trim();
    } catch {}

    // Always fallback to credentials stored in DB if not provided or redacted
    if (!emailUser || !emailPass) {
      const config = await db.appConfig.findUnique({ where: { userId } });
      emailUser = emailUser || config?.emailUser;
      emailPass = emailPass || config?.emailPass;
    }

    if (!emailUser || !emailPass) {
      return NextResponse.json(
        { error: 'Gmail address and App Password are required. Enter your credentials first.' },
        { status: 400 }
      );
    }

    const domain = emailUser.toLowerCase().split('@')[1] || '';
    let transporter;
    if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('office365.com')) {
      transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user: emailUser, pass: emailPass },
      });
    } else if (domain.includes('yahoo.com')) {
      transporter = nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass },
      });
    }

    // Verify SMTP connection settings
    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: 'SMTP credentials verified successfully! Connection established.',
    });
  } catch (error: any) {
    console.error('SMTP verification failed:', error);
    
    // Provide user-friendly messaging for common Gmail SMTP errors
    let userMessage = error.message || 'SMTP Connection failed';
    if (error.code === 'EAUTH') {
      userMessage = 'Authentication failed. Please check your Gmail address and verify that you are using a 16-character App Password, not your normal password.';
    } else if (error.command === 'CONN') {
      userMessage = 'Could not establish connection to Gmail SMTP servers. Please check your network connectivity.';
    }
    
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
