# 🌟 Outreach Engine: The Ultimate User & Technical Guide

Welcome to the complete, easy-to-understand guide for **Outreach Engine** (Blostem Cold Outreach Platform). 

Whether you are a candidate looking to land interviews or an engineer exploring the codebase, this document explains **every single feature**, **why it exists**, **how you use it**, and **how it works under the hood** with clear visual figures.

---

## 📑 Complete Table of Features

| # | Feature Name | Plain English Summary | Key Component / Route |
| :---: | :--- | :--- | :--- |
| **1** | [**Automated Multi-Step Follow-Up Sequences**](#1-automated-multi-step-follow-up-sequences-threaded-drip) | Automatically follows up in the *same email thread* if the recruiter hasn't replied. | `/api/generate-followup`<br>`/api/send-email` |
| **2** | [**Smart AI Reply Classifier & 1-Click Copilot**](#2-smart-ai-reply-classifier--1-click-copilot) | Reads incoming recruiter emails, classifies their intent (Interview, CTC, etc.), and writes a 1-click reply. | `/api/hr-list/check-replies`<br>`email-preview-dialog.tsx` |
| **3** | [**AI Cold Job Application Copywriter**](#3-ai-cold-job-application-copywriter) | Writes hyper-personalized, high-converting job emails highlighting your real skills in 80 words. | `/api/generate-email` |
| **4** | [**Real-Time Company Tech-Stack Enrichment**](#4-real-time-company-tech-stack-enrichment) | Scans the company's website to find what technologies they use (React, Python, AWS) and weaves it into your email. | `/lib/company-scraper.ts`<br>`/api/enrich-company` |
| **5** | [**Subject Line & Hook A/B Testing Engine**](#5-subject-line--hook-ab-testing-engine) | Splits your emails 50/50 between two subject styles to see which one gets you more interviews. | `dashboard-tab.tsx`<br>`/api/generate-email` |
| **6** | [**1-Click LinkedIn Recruiter Ingest**](#6-1-click-linkedin-recruiter-ingest) | Bookmarklet and Chrome Extension that grabs recruiter info from LinkedIn and adds them to your list in 1 click. | `/api/ingest/linkedin`<br>`public/extension/` |
| **7** | [**Multi-Provider SMTP Outbox Engine**](#7-multi-provider-smtp-outbox-engine) | Connects securely to Gmail, Outlook, Office 365, or Yahoo with instant connection testing. | `/api/config/test-smtp`<br>`/api/send-email` |
| **8** | [**Real-Time Open & Click Tracking Telemetry**](#8-real-time-open--click-tracking-telemetry) | Lets you know the second a recruiter opens your email or clicks your resume/portfolio link. | `/api/track/open`<br>`/api/track/click` |
| **9** | [**Pre-Send Anti-Spam Heuristic Analyzer**](#9-pre-send-anti-spam-heuristic-analyzer) | Grades your email draft from 0–100 before sending to make sure it won't land in the spam folder. | `/api/spam-check` |
| **10** | [**DNS Deliverability Inspector (SPF, DKIM, DMARC)**](#10-dns-deliverability-inspector-spf-dkim-dmarc) | Inspects your domain's email health and gives you exact copy-paste DNS records to guarantee inbox arrival. | `/api/dns-check` |
| **11** | [**Bulk Spreadsheet Importer & Deduplicator**](#11-bulk-spreadsheet-importer--deduplicator) | Upload CSV or Excel sheets with hundreds of HR contacts; cleans duplicates automatically. | `/api/hr-list/upload` |
| **12** | [**Autonomous Outreach Scheduler & Hacker Terminal**](#12-autonomous-outreach-scheduler--hacker-terminal) | Puts your outreach on autopilot with smart delays and a live developer terminal. | `automation-tab.tsx` |
| **13** | [**Compose Studio with Spintax & AI Refiner**](#13-compose-studio-with-spintax--ai-refiner) | Interactive email editor where you can test prompts, spin words, and send test emails to yourself. | `email-preview-dialog.tsx` |
| **14** | [**Interactive Analytics & Visual Charts Hub**](#14-interactive-analytics--visual-charts-hub) | Visual breakdown of your application funnel: sent, opened, clicked, and interview reply rates. | `dashboard-tab.tsx` |
| **15** | [**CAN-SPAM Suppression & One-Click Unsubscribe**](#15-can-spam-suppression--one-click-unsubscribe) | Keeps you safe from email bans with 1-click opt-out links and automatic bounce handling. | `/api/u`<br>`/api/suppression` |
| **16** | [**Resume Parser & Candidate Profile Customizer**](#16-resume-parser--candidate-profile-customizer) | Stores your skills, degree, highlights, and custom prompt rules to personalize every message. | `/api/upload-resume`<br>`settings-tab.tsx` |
| **17** | [**Secure Multi-Tenant Authentication System**](#17-secure-multi-tenant-authentication-system) | Protects your account with NextAuth sessions, bcrypt password encryption, and isolated pipelines. | `/api/auth/[...nextauth]` |

---

## 🏛️ High-Level System Architecture

Here is how the entire platform works together:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                           USER INTERFACE                               │
 │   Dashboard  •  Compose Studio  •  Scheduler Console  •  Settings      │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
      ┌────────────────────┐ ┌───────────────┐ ┌───────────────────┐
      │  LinkedIn Ingest   │ │ AI Generator  │ │ Auto Scheduler    │
      │ Extension & Bookm. │ │ (Groq Llama)  │ │ Outbox Loop Engine│
      └──────────┬─────────┘ └───────┬───────┘ └─────────┬─────────┘
                 │                   │                   │
 ════════════════╪═══════════════════╪═══════════════════╪═════════════════
  BACKEND API LAYER (Next.js 16 Serverless Functions)    │
 ════════════════╪═══════════════════╪═══════════════════╪═════════════════
                 ▼                   ▼                   ▼
      ┌────────────────────┐ ┌───────────────┐ ┌───────────────────┐
      │ /api/enrich-company│ │/api/spam-check│ │  /api/send-email  │
      │  Tech Scraper      │ │ Deliverability│ │ Multi-SMTP Outbox │
      └──────────┬─────────┘ └───────┬───────┘ └─────────┬─────────┘
                 │                   │                   │
                 └───────────────────┼───────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │    PostgreSQL Database (Prisma)   │
                   │ Contacts, Follow-ups, Logs, Auth  │
                   └───────────────────────────────────┘
```

---

## 🔍 In-Depth Breakdown of Every Feature

---

### 1. Automated Multi-Step Follow-Up Sequences (Threaded Drip)

#### 💡 In Plain English:
Imagine sending an application to a recruiter. They might miss it because their inbox is flooded. Rather than you having to remember to message them again 3 days later, **Outreach Engine automatically sends a polite follow-up in the exact same email thread**!

```
Initial Email (Day 0) ──────► "Software Engineer Application — Yash"
                                      │
                 [Recruiter does not reply for 3 days]
                                      │
                                      ▼
Follow-Up 1 (Day 3)   ──────► "Re: Software Engineer Application — Yash"
                                (Polite reminder + key project highlight)
                                      │
                 [Recruiter does not reply for 4 days]
                                      │
                                      ▼
Follow-Up 2 (Day 7)   ──────► "Re: Software Engineer Application — Yash"
                                (Final brief check-in + resume link)
```

#### ⚙️ Technical Mechanics:
1. **RFC-2822 Threading Headers**: When sending Follow-Up 1 or 2, `src/app/api/send-email/route.ts` injects standard email headers:
   - `inReplyTo`: `<original-message-id@mail.gmail.com>`
   - `references`: `[<original-message-id>, <follow-up-1-id>]`
   - `subject`: `Re: <originalSubject>`
   *This guarantees that Gmail and Outlook attach the follow-up inside the existing conversation rather than starting a new email.*
2. **PostgreSQL Relational Tracking**: Each step is logged in the `HrFollowUp` table linked to the `HrContact` record with timestamps and open/click status.
3. **Automated Scheduling**: The background scheduler checks `nextFollowUpDue` against current time. If due and no reply has been received, it generates and dispatches the follow-up.

---

### 2. Smart AI Reply Classifier & 1-Click Copilot

#### 💡 In Plain English:
When a recruiter replies to you, you don't even have to open your Gmail to figure out what they want. The system automatically reads their reply, labels it (e.g. **🟢 Interview Interest** or **🔵 CTC Requested**), and **writes the perfect reply for you**. All you do is click **"⚡ 1-Click Send Response"**!

```
 Recruiter Inbound Email
           │
           ▼
 ┌──────────────────────────────────────────────┐
 │             AI Intent Classifier             │
 │  1. 🟢 INTERVIEW_INTEREST (Wants to talk)    │
 │  2. 🟡 FORWARDED (Sent to tech team)         │
 │  3. 🔵 INFO_REQUESTED (Wants CTC/Resume)     │
 │  4. ⚪ REJECTION (Closed position)           │
 │  5. ⚪ OTHER (Out of office / Acknowledgement│
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
 ┌──────────────────────────────────────────────┐
 │         AI Suggested Response Copilot        │
 │  "Hi Sarah, thank you! I would love to chat. │
 │   I'm available this Thursday at 2 PM..."    │
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
       [⚡ 1-Click Send Response Button]
```

#### ⚙️ Technical Mechanics:
1. **IMAP Stream Polling**: `src/app/api/hr-list/check-replies/route.ts` connects over TLS to `imap.gmail.com:993` or `outlook.office365.com:993`.
2. **Thread History Stripper**: Parses raw email chunks, removes quotes (`> On ... wrote:`), and extracts the new incoming message.
3. **Groq Llama 3.3 Evaluation**: Prompts the LLM with strict JSON schema output: `{ classification: "INTERVIEW_INTEREST", snippet: "...", suggestedDraft: "..." }`.
4. **Auto-Cancellation Safeguard**: As soon as a reply is confirmed, the contact's `followUpStatus` is changed to `cancelled` to ensure no automated follow-ups are ever sent to a recruiter who already responded.

---

### 3. AI Cold Job Application Copywriter

#### 💡 In Plain English:
Writing cold emails by hand takes 15 minutes each. Generic AI prompts sound robotic and like sales pitches. Outreach Engine's AI is specifically trained to sound like a **humble, talented candidate writing a crisp, 80-word email** that recruiters actually enjoy reading.

```
 ┌────────────────────────────────────────────────────────┐
 │                   CANDIDATE PROFILE                    │
 │  • Degree: Computer Science, Tier 1 College            │
 │  • Core Skills: Next.js, TypeScript, PostgreSQL, AWS   │
 │  • Highlight: Built a real-time app serving 10k users  │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                  GROQ LLAMA 3.3 ENGINE                 │
 │  • Strict rules: 75–110 words, no sales clichés       │
 │  • Direct hook + genuine project alignment             │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                    GENERATED EMAIL                     │
 │  Subject: Software Engineer Application — Yash (React) │
 │                                                        │
 │  Hi Sarah,                                             │
 │  I've been following Stripe's developer tools and love │
 │  your engineering culture. As a Software Engineer with│
 │  deep experience in TypeScript, Next.js, and Postgres, │
 │  I recently built a distributed app handling 10k users.│
 │                                                        │
 │  I've attached my resume (link) and would love a brief │
 │  5-minute intro chat if you have open engineering roles│
 │                                                        │
 │  Best regards,                                         │
 │  Yash Yadav                                            │
 └────────────────────────────────────────────────────────┘
```

#### ⚙️ Technical Mechanics:
- **Model**: Groq Llama 3.3 70B/120B with fallback to Gemini 1.5 Pro and deterministic templates.
- **Sliding-Window Rate Limiter**: Limits requests to 29 calls per minute to guarantee 0 rate-limit crashes.
- **Dynamic Variable Injection**: Injects college, degree, resume links, and Calendly booking URLs dynamically into the signature.

---

### 4. Real-Time Company Tech-Stack Enrichment

#### 💡 In Plain English:
If you apply to a company that uses **Python and Docker**, your email should mention Python and Docker. If they use **React and Node.js**, your email should mention React. The system automatically visits their website, checks what tech they use, and customizes your email automatically!

```
 Recruiter: John Doe @ Uber
           │
           ▼
 ┌──────────────────────────────────────────────┐
 │           Live Domain Web Scanner            │
 │  Visits: https://uber.com (2.5s fast scan)   │
 │  Detects: Go, Python, Kafka, React, Microserv│
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
 ┌──────────────────────────────────────────────┐
 │          AI Prompt Personalization           │
 │  "Naturally align candidate's Go & Python    │
 │   experience with Uber's microservices stack"│
 └──────────────────────────────────────────────┘
```

#### ⚙️ Technical Mechanics:
1. `src/lib/company-scraper.ts` executes a 2.5-second timeout HTTP fetch to the company's website.
2. Extracts `<meta name="description">` and scans HTML/scripts for 30+ core engineering frameworks (`FastAPI`, `Next.js`, `Kubernetes`, `PostgreSQL`, `Tailwind`, etc.).
3. Stores findings in the `CompanyResearch` database table so future lookups for the same company execute in 0 milliseconds.

---

### 5. Subject Line & Hook A/B Testing Engine

#### 💡 In Plain English:
Not sure if recruiters prefer a direct subject like *"Software Engineer Application"* or a friendly one like *"Exploring engineering roles at Acme"*? The system automatically alternates between both styles and **shows you a live scoreboard of which one gets more opens and replies**!

```
                      100 Recruiter Contacts
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       50 Contacts: Variant A          50 Contacts: Variant B
      "Software Engineer App — Yash"  "Yash — exploring roles @ Stripe"
                 │                               │
                 ▼                               ▼
         Open Rate: 68%                  Open Rate: 42%
         Reply Rate: 18%                 Reply Rate: 8%
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
               🏆 Winner Identified: Variant A!
```

#### ⚙️ Technical Mechanics:
- **Variant A (Direct Pitch)**: Direct, skills-first subject and technical competency body.
- **Variant B (Conversational)**: Warmer, role-inquiry subject with enthusiasm for company mission.
- **Dashboard Comparison Card**: Calculates separate open and reply percentage benchmarks for Variant A vs Variant B in real time.

---

### 6. 1-Click LinkedIn Recruiter Ingest (API + Bookmarklet + Extension)

#### 💡 In Plain English:
When you find a recruiter on LinkedIn, you don't need to copy-paste their name, company, and title into a spreadsheet. Just click the **Outreach Bookmarklet** on your browser or use the **Chrome Extension**, and they are instantly added to your dashboard!

```
 LinkedIn Profile Page (linkedin.com/in/recruiter-profile)
           │
           ▼
 Click Bookmarklet or Extension Popup
           │
           ▼
 ┌──────────────────────────────────────────────┐
 │  Extracts:                                   │
 │  • Name: Sarah Jenkins                       │
 │  • Title: Senior Technical Recruiter         │
 │  • Company: Datadog                          │
 └──────────────────────┬───────────────────────┘
                        │
                        ▼ (POST /api/ingest/linkedin)
 ┌──────────────────────────────────────────────┐
 │  • Authenticated via API Token               │
 │  • Checks for duplicate email/company        │
 │  • Triggers background tech stack enrichment │
 └──────────────────────────────────────────────┘
```

#### ⚙️ Technical Mechanics:
- **CORS-Enabled Serverless Webhook**: Supports `OPTIONS` preflight and `POST /api/ingest/linkedin` with token authorization (`x-api-key`).
- **Drag-and-Drop Bookmarklet**: Injected with your personal security token right from the Settings Tab.
- **Chrome Extension (Manifest V3)**: Located in `public/extension/`, fully compatible with Google Chrome and Brave.

---

### 7. Multi-Provider SMTP Outbox Engine

#### 💡 In Plain English:
Whether you use a standard **Gmail account**, a **Google Workspace** company email, **Outlook / Office 365**, or **Yahoo**, the engine connects smoothly and delivers your emails directly to the recipient's primary inbox.

#### ⚙️ Technical Mechanics:
- **Smart Port & Security Detection**:
  - `gmail.com` → `smtp.gmail.com:465` (SSL)
  - `outlook.com` / `office365.com` → `smtp.office365.com:587` (STARTTLS)
  - `yahoo.com` → `smtp.mail.yahoo.com:465` (SSL)
- **Live Connection Tester**: A dedicated **"Test SMTP Connection"** button in Settings runs an instant handshake to confirm your 16-character App Password before sending any emails.

---

### 8. Real-Time Open & Click Tracking Telemetry

#### 💡 In Plain English:
Wondering if the recruiter even read your email? Or if they clicked on your resume? Outreach Engine gives you a live **4-step progress bar** for every single contact:

```
 [ Sent ] ───► [ Opened (2x) ] ───► [ Clicked Resume ] ───► [ Replied! ]
```

#### ⚙️ Technical Mechanics:
- **Invisible 1x1 Pixel**: Embeds a zero-byte tracking pixel (`/api/track/open?id=contactId`) that registers the exact timestamp and increment count when the email is viewed.
- **Smart Link Redirector**: Wraps your resume (`docs.google.com`, `drive.google.com`, `.pdf`) and calendar booking links (`calendly.com`, `cal.com`) through `/api/track/click` to differentiate between **Resume Views** (`docClicked`) and **Call Bookings** (`ctaClicked`).

---

### 9. Pre-Send Anti-Spam Heuristic Analyzer

#### 💡 In Plain English:
Before you hit send, the built-in spam doctor reads your email and gives it a **Deliverability Score** (e.g. `95/100 - Excellent`). If you used spammy words like *"100% free"*, *"URGENT"*, or forgot the recruiter's name, it warns you immediately!

#### ⚙️ Technical Mechanics:
- Evaluates 20+ spam trigger rules:
  - Spam keywords list (*risk-free, guarantee, click here, urgent, prize*)
  - ALL-CAPS percentage in subject and body
  - Exclamation mark count
  - Link density ratio (too many links trigger spam filters)
  - Missing greeting or empty recipient names

---

### 10. DNS Deliverability Inspector (SPF, DKIM, DMARC)

#### 💡 In Plain English:
Email providers like Gmail and Yahoo have strict security rules. If your domain's "digital passport" (SPF, DKIM, DMARC) isn't set up, your emails go to spam. The **DNS Inspector** runs a live scan on your domain and gives you the exact copy-paste records to fix it!

```
 ┌──────────────────────────────────────────────┐
 │           Domain DNS Health Report           │
 ├──────────────────────────────────────────────┤
 │  ✅ SPF Record:   v=spf1 include:_spf.google │
 │  ✅ DKIM Key:     google._domainkey (Active) │
 │  ✅ DMARC Policy: v=DMARC1; p=none           │
 └──────────────────────────────────────────────┘
```

#### ⚙️ Technical Mechanics:
- `src/app/api/dns-check/route.ts` runs asynchronous Node.js `dns.promises.resolveTxt` and `resolveCname` queries to verify mailbox configuration against Google Workspace and Microsoft 365 standards.

---

### 11. Bulk Spreadsheet Importer & Deduplicator

#### 💡 In Plain English:
Have a spreadsheet with 200 HR contacts from LinkedIn or a job fair? Just drag and drop your `.csv` or `.xlsx` file. The engine cleans up the names, extracts company names, and **automatically throws away any duplicate emails**!

#### ⚙️ Technical Mechanics:
- Parses files in memory using `PapaParse` and `xlsx`.
- Normalizes all header columns (`Name`, `Full Name`, `Email Address`, `Company`, `Role`).
- Runs a 2-tier memory deduplication check against the database and within the batch.

---

### 12. Autonomous Outreach Scheduler & Hacker Terminal

#### 💡 In Plain English:
You don't want to send 100 emails in 2 seconds because Gmail will ban your account. The **Autonomous Scheduler** sends your emails in safe batches (e.g. 5 emails every 3 minutes) while you watch the live events stream in a cool, dark-mode terminal!

```
 ┌─────────────────────────────────────────────────────────────┐
 │ terminal@outreach-telemetry ~ live feed                     │
 ├─────────────────────────────────────────────────────────────┤
 │ [10:45:01 AM] [INFO] Loaded batch of 5 prospects            │
 │ [10:45:04 AM] [DRAFTING] Generating email for Sarah @ Stripe│
 │ [10:45:07 AM] [DELIVERED] Email sent to sarah@stripe.com    │
 │ [10:45:12 AM] [COOLDOWN] Waiting 45s deliverability delay...│
 │ [10:45:57 AM] [DELIVERED] Follow-up 1 sent to Alex @ Netflix│
 └─────────────────────────────────────────────────────────────┘
```

#### ⚙️ Technical Mechanics:
- Manages an automated execution loop with configurable batch sizes (5, 10, 20, 50) and randomized delay intervals (45s–120s).
- Logs events to Zustand state with localStorage buffer persistence.

---

### 13. Compose Studio with Spintax & AI Refiner

#### 💡 In Plain English:
Want to write an email manually or refine an AI draft? The Compose Studio lets you edit the subject and body, type instructions like *"Make it sound more casual"*, test spintax variations like `{Hi|Hello|Hey}`, and **send a test email to yourself** to verify how it looks on your phone!

---

### 14. Interactive Analytics & Visual Charts Hub

#### 💡 In Plain English:
Your command center shows:
- **Total Leads Ingested**
- **Emails Delivered & Open Rate (%)**
- **Link Clicks & Resume Downloads**
- **Interview Replies & Conversion Rate**
- **Top Companies Breakdown** (Bar chart showing where you've applied most)

---

### 15. CAN-SPAM Suppression & One-Click Unsubscribe

#### 💡 In Plain English:
If a recruiter clicks "Unsubscribe", the system instantly adds them to a permanent blocklist so you never accidentally email them again, keeping your email account in good standing.

---

### 16. Resume Parser & Candidate Profile Customizer

#### 💡 In Plain English:
Upload your PDF resume and fill out your skills, graduation degree, portfolio links, and custom instructions (e.g. *"Always emphasize that I am open to remote roles"*). The AI uses these settings for every email it writes!

---

### 17. Secure Multi-Tenant Authentication System

#### 💡 In Plain English:
Your contacts, emails, and API keys are 100% private to your account. Protected by industry-standard NextAuth login sessions and encrypted database connections.

---

## 🗺️ Complete End-to-End Pipeline Workflow

```
 [1. INGEST RECRUITER] ──► [2. ENRICH TECH STACK] ──► [3. A/B ASSIGNMENT]
 (CSV, Excel, LinkedIn)      (Scrapes Company Web)      (Variant A or B)
                                                               │
                                                               ▼
 [6. TRACK ENGAGEMENT] ◄── [5. MULTI-SMTP SEND]   ◄── [4. AI DRAFT (GROQ)]
 (Opens, Clicks, Pixel)      (Gmail / Outlook / TLS)    (Under 100 Words)
           │
           ├──────────────────────────────┬──────────────────────────────┐
           ▼                              ▼                              ▼
 [RECRUITER DOES NOT REPLY]      [RECRUITER CLICKS LINK]       [RECRUITER REPLIES BACK]
           │                              │                              │
           ▼                              ▼                              ▼
 [AUTO FOLLOW-UP DRIP]           [ENGAGEMENT LOGGED]           [AI REPLY COPILOT]
 (Threaded in same email)        (Doc View / Call Clicked)     (Classifies Intent &
                                                                Drafts 1-Click Reply)
```

---

## 🌐 Live Production Deployment Details

* **Live Application URL:** [https://jobapplicationshit.vercel.app](https://jobapplicationshit.vercel.app)
* **Status:** Verified and live in production with full database synchronization.

---

*Authored for Outreach Engine Production Environment.*
