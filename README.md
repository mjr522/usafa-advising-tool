# USAFA Academic Advising Tool (Mechanical & Systems Engineering)

An interactive, visual, client-side academic advising and degree planning web application designed for the **United States Air Force Academy (USAFA)** Department of Mechanical Engineering and Systems Engineering.

The tool enables cadets to take ownership of their academic plan, experiment with course movements, and verify prerequisites and credit limits in real time—while providing academic advisors with instant plan diffing, COMPASS/SIS action checklists, and graduation audit verification.

---

## 🔒 100% In-Browser Privacy (FERPA & OPSEC Compliant)

- **Zero-Server Data Processing**: All PDF parsing (using bundled `pdf.js`), course scheduling, and advisor comparisons occur **strictly inside your local browser memory**.
- **No Online Database**: Cadet records, GPAs, EMPLIDs, and course histories are never transmitted to any external server, cloud database, or third party.
- **Works 100% Offline**: Can be run locally on military and government laptops without an active internet connection.

---

## 🎯 Key Features

### 1. Visual Course Sequencer (8 Semesters + Summer)
- Displays standard 8 semesters (4° Fall through 1° Spring) plus optional summer sessions.
- **Drag-and-Drop / Move**: Effortlessly move courses between terms with automatic recalculation of semester credits and sequence validation.
- **Real-Time Overload Alerts**: Flags warning when semester credits exceed standard caps (e.g. >19.5 sem hrs) or hard limits (>21.5 sem hrs).
- **Term Offering Checks**: Automatically alerts if a course is placed in an off semester (e.g., Spring-only course placed in Fall) or violates odd/even year rotation.
- **Prerequisite Dependency Highlighting**: Hover over any course to visually highlight all of its prerequisite courses across prior terms.

### 2. Smart Prerequisite & Dependency Automation
- **Adding a Course**: Detects missing prerequisites and opens a smart confirmation dialog suggesting valid earlier terms based on course offerings, allowing 1-click auto-insertion.
- **Deleting a Course**: Checks if future planned courses depend on the course as a prerequisite or corequisite, warning the cadet before removal.
- **Moving a Course**: Re-evaluates prerequisite ordering (prerequisites must precede; corequisites must be concurrent or precede).

### 3. COMPASS / SIS PDF Ingestion
- **Academic Program Summary (APS)**: Drag-and-drop or upload a cadet APS PDF. The tool parses all completed and planned terms, courses, credits, and grades, rendering them immediately on the sequencer grid.
- **Grad Check Report**: Ingests official COMPASS graduation check reports, cross-referencing satisfied and missing degree requirements.

### 4. Live Graduation Check Drawer
- Slide-out audit drawer with progress gauges (% Requirements Satisfied, Total Semester Hours vs Required).
- Categorized audit checklists:
  - **Major Core Requirements** (ME / SE required course sequence)
  - **USAFA Academic Core** (Math, Physics, Chemistry, Humanities, Social Sciences, MSS)
  - **Specialization Tracks / Depth Options** (e.g., ME Structures, Materials, Thermal-Fluid; SE Aero, Astro, Cyber, Electrical, Environmental, Mechanical)
  - **Physical Education & Athletics Core**
- **1-Click Scheduling**: Click `+ Schedule` next to any missing requirement to immediately insert it into an appropriate open semester.

### 5. Advisor Plan Diff & COMPASS Action Generator
- Compare an on-record baseline plan (from a COMPASS PDF) against a cadet's proposed plan (from an exported `.json` file or active board).
- **Visual Diff**: Color-coded breakdown of Moved courses, Added courses, and Dropped courses.
- **Copyable 'COMPASS Action Items' Checklist**: Generates an unambiguous, numbered registrar punch-list (e.g., *"1. [MOVE] MECH ENGR 341 from Fall 2026 to Spring 2027"*) with 1-click copy to clipboard for rapid data entry into COMPASS.

### 6. Enriched Course Catalog & Advisor Pro-Tips
- Comprehensive catalog of 760+ USAFA courses extracted directly from the **2026-2027 Course of Instruction (COI) Handbook**.
- Includes course descriptions, prerequisites, corequisites, credit hours, and offering terms.
- **In-App Advisor Notes Editor**: Advisors can log workload/difficulty ratings (*Light*, *Moderate*, *Demanding*), study advice, and pairing cautions. Changes persist locally and can be exported as a shared JSON catalog.

---

## 💻 Running Locally

This application requires **zero build steps, zero npm installs, and zero external runtimes**.

### Option A: Direct Browser Opening
Simply double-click [`index.html`](file:///index.html) in any modern web browser (Edge, Chrome, Firefox, Safari).

### Option B: Local Python HTTP Server
To test full PDF.js worker capabilities:
```powershell
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

---

## 🌐 Deploying to Vercel (100% Free)

Vercel provides free static site hosting with instant global CDN delivery, automated HTTPS, and zero server management.

### Method 1: Deploy via GitHub (Recommended)
1. Push this directory to a GitHub repository (public or private).
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **"Add New..."** > **"Project"**.
4. Select your repository and click **"Deploy"**.
5. Vercel will detect the static site and deploy it in seconds. Your app will be live at:
   ```
   https://<your-project-name>.vercel.app
   ```

### Method 2: Deploy via Vercel CLI
If you have Vercel CLI installed:
```powershell
vercel
```

---

## 🌐 Deploying to GitHub Pages (Alternative Free Host)

1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Branch**, select `main` (or `master`) and `/ (root)`.
4. Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/`.
