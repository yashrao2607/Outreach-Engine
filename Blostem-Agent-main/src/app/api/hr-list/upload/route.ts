import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getUserId } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name || '';
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel';

    let rows: Record<string, string>[] = [];

    if (isExcel) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json(
          { error: 'Excel file is empty' },
          { status: 400 }
        );
      }
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      // Normalize keys to lowercase and trim
      rows = rawRows.map((rawRow) => {
        const row: Record<string, string> = {};
        for (const [key, val] of Object.entries(rawRow)) {
          const normalizedKey = key.trim().toLowerCase();
          row[normalizedKey] = String(val ?? '').trim();
        }
        return row;
      });
    } else {
      const csvText = await file.text();
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
      });

      if (result.errors.length > 0) {
        console.warn('CSV parse warnings:', result.errors);
      }
      rows = result.data as Record<string, string>[];
    }

    let added = 0;
    const uniqueRowsToInsert: Array<{name: string, email: string, title: string, company: string, userId: string, abVariant: string}> = [];
    const emailsInBatch = new Set<string>();

    // 1. Fetch all existing emails for this user to filter them out in memory
    const existingContacts = await db.hrContact.findMany({
      where: { userId },
      select: { email: true }
    });
    const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase().trim()));

    for (const row of rows) {
      const name = (row['name'] || row['full name'] || '').trim();
      const email = (row['email'] || row['email address'] || '').trim();
      const title = (row['title'] || row['role'] || '').trim();
      const company = (row['company'] || row['organization'] || '').trim();

      if (!name || !email) continue;
      const normalizedEmail = email.toLowerCase().trim();

      if (existingEmails.has(normalizedEmail) || emailsInBatch.has(normalizedEmail)) {
        continue;
      }

      emailsInBatch.add(normalizedEmail);
      const abVariant = uniqueRowsToInsert.length % 2 === 0 ? 'A' : 'B';
      uniqueRowsToInsert.push({ name, email, title, company, userId, abVariant });
    }

    if (uniqueRowsToInsert.length > 0) {
      const result = await db.hrContact.createMany({
        data: uniqueRowsToInsert,
      });
      added = result.count;
    }

    return NextResponse.json({ added, total: rows.length });
  } catch (error) {
    console.error('Failed to upload and parse file:', error);
    return NextResponse.json(
      { error: 'Failed to upload and parse file' },
      { status: 500 }
    );
  }
}
