/**
 * USAFA DFEM - Advisor-in-Charge (AIC) Major Declaration & Onboarding Portal
 * Orchestrates major declaration, advisor assignment, calendar invite generation (.ics),
 * and automated email dispatch to both advisor and cadet.
 */

class AicPortal {
  constructor() {
    this.modalEl = null;
    this.containerEl = null;
    this.currentData = {
      cadetName: '',
      cadetYear: '2028',
      cadetEmail: '',
      major: 'ME',
      track: '',
      advisorId: ''
    };
  }

  init(modalId = 'aicDeclarationModal') {
    this.modalEl = document.getElementById(modalId);
    if (!this.modalEl) return;

    this.containerEl = this.modalEl.querySelector('.modal-content-body');
    
    // Close events
    this.modalEl.querySelectorAll('.btn-close-modal, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.classList.contains('open')) {
        this.close();
      }
    });
  }

  open() {
    if (!this.modalEl) return;
    this.render();
    this.modalEl.classList.add('open');
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
  }

  /**
   * Computes initial meeting schedule: exactly +7 days from today, 12:30 PM - 1:00 PM
   */
  calculateMeetingSchedule() {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    start.setHours(12, 30, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30); // 30-minute block

    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeStr = '12:30 PM – 1:00 PM MT';

    return { start, end, dateStr, timeStr };
  }

  render() {
    if (!this.containerEl) return;

    const currentMajor = this.currentData.major || 'ME';
    const advisors = window.advisorsService ? window.advisorsService.getByMajor(currentMajor) : [];
    const meeting = this.calculateMeetingSchedule();

    // Default advisor selection
    if (!this.currentData.advisorId && advisors.length > 0) {
      // Pick first non-AIC advisor if available, or first advisor
      const nonAic = advisors.find(a => !a.isAic) || advisors[0];
      this.currentData.advisorId = nonAic.id;
    }

    const selectedAdvisor = window.advisorsService ? window.advisorsService.getById(this.currentData.advisorId) : null;
    const majorData = window.curriculumService ? window.curriculumService.getMajor(currentMajor) : null;
    const tracks = majorData && majorData.tracks ? Object.entries(majorData.tracks) : [];

    this.containerEl.innerHTML = `
      <div class="aic-portal-wrapper">
        <div class="aic-portal-header">
          <div class="aic-badge-title">
            <span class="aic-badge-icon">🎖️</span>
            <div>
              <h2 class="aic-modal-title">AIC Major Declaration & Onboarding Portal</h2>
              <p class="aic-modal-subtitle">
                USAFA Department of Engineering Mechanics • 1-Click Major Declaration, Calendar Scheduling & Student Onboarding
              </p>
            </div>
          </div>
        </div>

        <div class="aic-grid-layout">
          <!-- Left Column: Declaration Form -->
          <div class="aic-form-card">
            <h3 class="aic-section-title">1. Cadet Declaration Information</h3>
            
            <div class="form-row-2col">
              <div class="form-group">
                <label for="aicCadetName">Cadet Full Name</label>
                <input type="text" id="aicCadetName" class="form-control" placeholder="e.g., C2C Jane Doe" value="${this.escapeHtml(this.currentData.cadetName)}" />
              </div>
              <div class="form-group">
                <label for="aicCadetYear">Graduation Class</label>
                <select id="aicCadetYear" class="form-control">
                  <option value="2027" ${this.currentData.cadetYear === '2027' ? 'selected' : ''}>Class of 2027 (Firsties)</option>
                  <option value="2028" ${this.currentData.cadetYear === '2028' ? 'selected' : ''}>Class of 2028 (Secondies / 2-Deg)</option>
                  <option value="2029" ${this.currentData.cadetYear === '2029' ? 'selected' : ''}>Class of 2029 (Thirdies / 3-Deg)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="aicCadetEmail">Cadet USAFA Email</label>
              <div class="input-with-action">
                <input type="email" id="aicCadetEmail" class="form-control" placeholder="e.g., c28jane.doe@afacademy.af.edu" value="${this.escapeHtml(this.currentData.cadetEmail)}" />
                <button type="button" id="btnAutoSuggestEmail" class="btn-input-addon" title="Auto-generate email from Cadet Name and Class">Auto-Fill</button>
              </div>
            </div>

            <div class="form-row-2col">
              <div class="form-group">
                <label for="aicMajorSelect">Declared Major</label>
                <select id="aicMajorSelect" class="form-control">
                  <option value="ME" ${currentMajor === 'ME' ? 'selected' : ''}>Mechanical Engineering (ME)</option>
                  <option value="SE" ${currentMajor === 'SE' ? 'selected' : ''}>Systems Engineering (SE)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="aicTrackSelect">Specialization Track</label>
                <select id="aicTrackSelect" class="form-control">
                  ${tracks.map(([k, t]) => `
                    <option value="${k}" ${this.currentData.track === k ? 'selected' : ''}>${t.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <h3 class="aic-section-title" style="margin-top: 14px;">2. Assign Faculty Advisor</h3>
            <div class="form-group">
              <label for="aicAdvisorSelect">Select Department Advisor</label>
              <select id="aicAdvisorSelect" class="form-control">
                ${advisors.map(a => `
                  <option value="${a.id}" ${a.id === this.currentData.advisorId ? 'selected' : ''}>
                    ${a.name} (${a.title}) — ${a.office}
                  </option>
                `).join('')}
              </select>
            </div>

            ${selectedAdvisor ? `
              <div class="advisor-info-chip">
                <div class="advisor-chip-avatar">👨‍🏫</div>
                <div class="advisor-chip-details">
                  <div class="advisor-chip-name">${selectedAdvisor.name}</div>
                  <div class="advisor-chip-meta">
                    <span>📍 <strong>${selectedAdvisor.office}</strong></span> • 
                    <span>✉️ ${selectedAdvisor.email}</span>
                  </div>
                  ${selectedAdvisor.notes ? `<div class="advisor-chip-note">${selectedAdvisor.notes}</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Right Column: Scheduled Initial Meeting & Dispatch Panel -->
          <div class="aic-dispatch-card">
            <h3 class="aic-section-title">3. Scheduled Initial Meeting</h3>
            
            <div class="meeting-schedule-box">
              <div class="meeting-schedule-row">
                <span class="sched-label">📅 Date:</span>
                <span class="sched-value"><strong>${meeting.dateStr}</strong> (+7 days)</span>
              </div>
              <div class="meeting-schedule-row">
                <span class="sched-label">⏰ Time:</span>
                <span class="sched-value"><strong>${meeting.timeStr}</strong> (30 min block)</span>
              </div>
              <div class="meeting-schedule-row">
                <span class="sched-label">📍 Location:</span>
                <span class="sched-value">${selectedAdvisor ? selectedAdvisor.office : 'Advisor Office'}</span>
              </div>
              <div class="meeting-reschedule-note">
                ℹ️ <em>"If this doesn't work for you, please work with one another to find a time that does work as soon as possible."</em>
              </div>
            </div>

            <h3 class="aic-section-title" style="margin-top: 14px;">4. Dispatch & Notifications</h3>
            <p class="aic-help-text">
              Execute actions to notify the faculty advisor, instruct the cadet with pre-meeting expectations, and deliver calendar invites.
            </p>

            <div class="aic-actions-stack">
              <!-- Master 1-Click Button -->
              <button type="button" id="btnMasterDispatch" class="btn-dispatch-master">
                🚀 Complete Declaration & Dispatch All
              </button>

              <div class="dispatch-individual-actions">
                <!-- Action 1: ICS Invite -->
                <div class="action-item">
                  <button type="button" id="btnDownloadIcs" class="btn-action-outline">
                    📅 Download Calendar Invite (.ics)
                  </button>
                  <span class="action-desc">Outlook 30-min invite (+7 days @ 12:30 PM)</span>
                </div>

                <!-- Action 2: Email Advisor -->
                <div class="action-item">
                  <button type="button" id="btnNotifyAdvisor" class="btn-action-outline">
                    ✉️ Send Advisor Notice Email
                  </button>
                  <span class="action-desc">Opens pre-filled email to ${selectedAdvisor ? selectedAdvisor.name : 'advisor'}</span>
                </div>

                <!-- Action 3: Email Cadet -->
                <div class="action-item">
                  <button type="button" id="btnSendCadetDirective" class="btn-action-outline">
                    ✉️ Send Cadet Directive Email
                  </button>
                  <span class="action-desc">Sends onboarding instructions & prep checklist</span>
                </div>
              </div>

              <!-- Dispatch Status Feedback -->
              <div id="dispatchStatusMessage" class="dispatch-status-message hidden"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const nameInput = document.getElementById('aicCadetName');
    const yearSelect = document.getElementById('aicCadetYear');
    const emailInput = document.getElementById('aicCadetEmail');
    const btnAutoEmail = document.getElementById('btnAutoSuggestEmail');
    const majorSelect = document.getElementById('aicMajorSelect');
    const trackSelect = document.getElementById('aicTrackSelect');
    const advisorSelect = document.getElementById('aicAdvisorSelect');

    const btnMasterDispatch = document.getElementById('btnMasterDispatch');
    const btnDownloadIcs = document.getElementById('btnDownloadIcs');
    const btnNotifyAdvisor = document.getElementById('btnNotifyAdvisor');
    const btnSendCadetDirective = document.getElementById('btnSendCadetDirective');

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.currentData.cadetName = e.target.value;
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        this.currentData.cadetYear = e.target.value;
      });
    }

    if (emailInput) {
      emailInput.addEventListener('input', (e) => {
        this.currentData.cadetEmail = e.target.value;
      });
    }

    if (btnAutoEmail) {
      btnAutoEmail.addEventListener('click', () => {
        const suggested = this.suggestCadetEmail(this.currentData.cadetName, this.currentData.cadetYear);
        if (suggested) {
          this.currentData.cadetEmail = suggested;
          if (emailInput) emailInput.value = suggested;
        } else {
          alert('Please enter a cadet name first (e.g., Jane Doe).');
        }
      });
    }

    if (majorSelect) {
      majorSelect.addEventListener('change', (e) => {
        this.currentData.major = e.target.value;
        this.currentData.advisorId = ''; // reset advisor to match new major
        this.render();
      });
    }

    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        this.currentData.track = e.target.value;
      });
    }

    if (advisorSelect) {
      advisorSelect.addEventListener('change', (e) => {
        this.currentData.advisorId = e.target.value;
        this.render();
      });
    }

    if (btnDownloadIcs) {
      btnDownloadIcs.addEventListener('click', () => {
        this.handleDownloadIcs();
      });
    }

    if (btnNotifyAdvisor) {
      btnNotifyAdvisor.addEventListener('click', () => {
        this.handleNotifyAdvisor();
      });
    }

    if (btnSendCadetDirective) {
      btnSendCadetDirective.addEventListener('click', () => {
        this.handleSendCadetDirective();
      });
    }

    if (btnMasterDispatch) {
      btnMasterDispatch.addEventListener('click', () => {
        this.handleMasterDispatch();
      });
    }
  }

  suggestCadetEmail(name, year) {
    if (!name || !name.trim()) return '';
    // Strip military rank like C1C, C2C, C3C, Cadet
    const clean = name.replace(/^(C[1234]C|Cadet)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 0) return '';
    const firstName = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    const yearShort = (year || '2028').slice(-2);
    return `c${yearShort}${firstName}.${lastName}@afacademy.af.edu`;
  }

  validateForm() {
    if (!this.currentData.cadetName || !this.currentData.cadetName.trim()) {
      alert('Please enter the cadet name.');
      return false;
    }
    if (!this.currentData.cadetEmail || !this.currentData.cadetEmail.includes('@')) {
      alert('Please enter a valid cadet email address.');
      return false;
    }
    if (!this.currentData.advisorId) {
      alert('Please select an assigned faculty advisor.');
      return false;
    }
    return true;
  }

  handleDownloadIcs() {
    if (!this.validateForm()) return;
    const advisor = window.advisorsService.getById(this.currentData.advisorId);
    const meeting = this.calculateMeetingSchedule();
    this.downloadIcsFile(this.currentData, advisor, meeting);
    this.showStatus('✅ Calendar invite (.ics) downloaded. Open it to add to Outlook!');
  }

  handleNotifyAdvisor() {
    if (!this.validateForm()) return;
    const advisor = window.advisorsService.getById(this.currentData.advisorId);
    const meeting = this.calculateMeetingSchedule();
    const mail = this.buildAdvisorEmail(this.currentData, advisor, meeting);
    window.location.href = mail.mailtoUrl;
    this.showStatus(`✅ Advisor notice opened for ${advisor.name}.`);
  }

  handleSendCadetDirective() {
    if (!this.validateForm()) return;
    const advisor = window.advisorsService.getById(this.currentData.advisorId);
    const meeting = this.calculateMeetingSchedule();
    const mail = this.buildCadetEmail(this.currentData, advisor, meeting);
    window.location.href = mail.mailtoUrl;
    this.showStatus(`✅ Cadet directive opened for ${this.currentData.cadetName}.`);
  }

  handleMasterDispatch() {
    if (!this.validateForm()) return;
    const advisor = window.advisorsService.getById(this.currentData.advisorId);
    const meeting = this.calculateMeetingSchedule();

    // 1. Download Calendar Invite (.ics)
    this.downloadIcsFile(this.currentData, advisor, meeting);

    // 2. Open Cadet Directive email (with CC to advisor)
    const cadetMail = this.buildCadetEmail(this.currentData, advisor, meeting);
    
    // 3. Open Advisor Notice
    const advisorMail = this.buildAdvisorEmail(this.currentData, advisor, meeting);

    // Provide feedback with manual launch buttons if popups/mail client limits multi-mailto
    this.showStatus(`
      <div class="dispatch-success-box">
        <strong>🎉 Major Declaration Complete!</strong>
        <p>1. Calendar invite (.ics) downloaded to your machine.</p>
        <p>2. Launch emails below (or click individual buttons):</p>
        <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
          <a href="${cadetMail.mailtoUrl}" class="btn-dispatch-link">✉️ Launch Cadet Directive</a>
          <a href="${advisorMail.mailtoUrl}" class="btn-dispatch-link">✉️ Launch Advisor Notice</a>
        </div>
      </div>
    `, true);

    // Update sequencer plan with newly declared cadet
    if (window.sequencer && window.sequencer.plan) {
      window.sequencer.plan.cadet = {
        name: this.currentData.cadetName,
        major: this.currentData.major === 'ME' ? 'Mechanical Engineering' : 'Systems Engineering',
        majorId: this.currentData.major,
        classYear: this.currentData.cadetYear,
        advisor: advisor.name,
        advisorEmail: advisor.email,
        advisorOffice: advisor.office
      };
      // Trigger update
      if (document.getElementById('majorSelector')) {
        document.getElementById('majorSelector').value = this.currentData.major;
      }
      if (window.updateTracks) {
        window.updateTracks(this.currentData.major);
      }
    }

    // Trigger Cadet mailto directly
    setTimeout(() => {
      window.location.href = cadetMail.mailtoUrl;
    }, 400);
  }

  showStatus(msgHtml, isRaw = false) {
    const el = document.getElementById('dispatchStatusMessage');
    if (!el) return;
    el.classList.remove('hidden');
    if (isRaw) {
      el.innerHTML = msgHtml;
    } else {
      el.textContent = msgHtml;
    }
  }

  /**
   * RFC 5545 iCalendar (.ics) Generator
   */
  generateIcs(cadet, advisor, meeting) {
    const pad = (n) => String(n).padStart(2, '0');
    const formatIcsTime = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    const now = new Date();
    const dtstamp = formatIcsTime(now) + 'Z';
    const dtstart = formatIcsTime(meeting.start);
    const dtend = formatIcsTime(meeting.end);
    const uid = `dfem-advising-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@afacademy.af.edu`;

    const majorName = cadet.major === 'ME' ? 'Mechanical Engineering' : 'Systems Engineering';
    const summary = `DFEM Major Declaration Advising: ${cadet.cadetName} & ${advisor.name}`;
    const location = `${advisor.office}, Fairchild Hall, USAF Academy, CO`;

    const description = [
      `DFEM Major Declaration Advising Meeting`,
      `======================================`,
      `Cadet: ${cadet.cadetName} (Class of ${cadet.cadetYear})`,
      `Major: ${majorName}`,
      `Advisor: ${advisor.name} (${advisor.office})`,
      ``,
      `*NOTE: If this doesn't work for you, please work with one another to find a time that does work as soon as possible.*`,
      ``,
      `CADET PREPARATION CHECKLIST (REQUIRED PRIOR TO MEETING):`,
      `1. Navigate to the USAFA Advising Tool:`,
      `   https://mjr522.github.io/usafa-advising-tool/`,
      `2. Ingest your COMPASS Academic Program Summary (APS) PDF.`,
      `3. Resolve any prerequisite warnings and ensure no semester exceeds 19.5 credit hours until the audit displays "Advisor-Ready".`,
      `4. Select your 3 ME Option Electives / 4 SE Depth courses.`,
      `5. Click "Export Plan (.json)" and email your degree plan to ${advisor.email} before this scheduled meeting.`,
      `6. Bring your laptop to the meeting.`
    ].join('\\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//USAFA DFEM//Advising Tool//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      `ORGANIZER;CN="DFEM Advisor-in-Charge":mailto:michael.richards@afacademy.af.edu`,
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${cadet.cadetName}":mailto:${cadet.cadetEmail}`,
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${advisor.name}":mailto:${advisor.email}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: DFEM Advising Meeting in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  downloadIcsFile(cadet, advisor, meeting) {
    const icsContent = this.generateIcs(cadet, advisor, meeting);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCadet = (cadet.cadetName || 'Cadet').replace(/[^a-zA-Z0-9]/g, '_');
    a.href = url;
    a.download = `Advising_Meeting_${safeCadet}_${meeting.start.toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  buildAdvisorEmail(cadet, advisor, meeting) {
    const majorName = cadet.major === 'ME' ? 'Mechanical Engineering' : 'Systems Engineering';
    const subject = `[DFEM Advising] New Advisee Assigned: ${cadet.cadetName} ('${cadet.cadetYear.slice(-2)})`;
    
    const body = `Good day ${advisor.name},

${cadet.cadetName} (Class of ${cadet.cadetYear}) has officially declared the ${majorName} major and has been assigned to you as their academic advisor.

An initial 30-minute major declaration advising meeting has been scheduled:
• Date: ${meeting.dateStr}
• Time: ${meeting.timeStr}
• Location: Your office (${advisor.office})
• Advisee Email: ${cadet.cadetEmail}

If this doesn't work for you, please work with one another to find a time that does work as soon as possible.

The cadet has been directed to use the USAFA Advising Tool (https://mjr522.github.io/usafa-advising-tool/) to upload their COMPASS APS, resolve prerequisite conflicts, balance term credit loads to <= 19.5 credits, select their elective sequence, and email you their exported plan (.json) prior to your meeting.

A calendar invitation (.ics) file has been generated for your convenience.

Very Respectfully,
Advisor-in-Charge (AIC)
Department of Engineering Mechanics (DFEM)
US Air Force Academy`;

    const mailtoUrl = `mailto:${encodeURIComponent(advisor.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { to: advisor.email, subject, body, mailtoUrl };
  }

  buildCadetEmail(cadet, advisor, meeting) {
    const majorName = cadet.major === 'ME' ? 'Mechanical Engineering' : 'Systems Engineering';
    const electiveReq = cadet.major === 'ME' ? '3 Mechanical Engineering Option Electives' : '4 Systems Engineering Depth / Focus Track courses';
    const subject = `[USAFA DFEM] Welcome to ${majorName} - Action Required Before Advisor Meeting`;

    const body = `Good day ${cadet.cadetName},

Congratulations on declaring your major in ${majorName}! You have been officially assigned to ${advisor.name} as your academic advisor.

Your initial major declaration advising meeting is scheduled for:
• Date: ${meeting.dateStr}
• Time: ${meeting.timeStr}
• Location: ${advisor.office}
• Advisor Email: ${advisor.email}

If this doesn't work for you, please work with one another to find a time that does work as soon as possible.

REQUIRED ACTIONS BEFORE YOUR MEETING:
You are expected to arrive at your meeting with an Advisor-Ready academic sequence:
1. Open the USAFA Advising Tool:
   https://mjr522.github.io/usafa-advising-tool/
2. Click "🚀 Cadet Wizard" or "📄 Ingest COMPASS PDF" to upload your Academic Program Summary (APS) PDF from COMPASS/SIS.
3. Balance semester course loads so no term exceeds 19.5 credit hours, and clear any prerequisite warnings until the audit shows "Advisor-Ready".
4. Select your ${electiveReq} aligned with your career goals.
5. Click "💾 Export Plan (.json)" and email your degree plan file to ${advisor.email} prior to your meeting.

Remember to bring your laptop to your meeting with ${advisor.name}.

Very Respectfully,
Department of Engineering Mechanics (DFEM)
US Air Force Academy`;

    const mailtoUrl = `mailto:${encodeURIComponent(cadet.cadetEmail)}?cc=${encodeURIComponent(advisor.email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { to: cadet.cadetEmail, cc: advisor.email, subject, body, mailtoUrl };
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.aicPortal = new AicPortal();

