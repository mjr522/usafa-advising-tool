/**
 * USAFA DFEM - Cadet Onboarding & Plan Preparation Wizard
 * 4-Step interactive guided stepper for newly declared cadets:
 * Step 1: Ingest COMPASS APS PDF
 * Step 2: Health & Balance Check (<= 19.5 credits, resolve prereqs -> "Advisor-Ready")
 * Step 3: Elective Pathway Selection (ME Options / SE Depth Tracks)
 * Step 4: Export & Submit Plan (.json) to Assigned Advisor
 */

class CadetWizard {
  constructor() {
    this.modalEl = null;
    this.containerEl = null;
    this.currentStep = 1;
    this.cadetData = {
      name: '',
      email: '',
      year: '2028',
      advisorId: '',
      advisorEmail: ''
    };
  }

  init(modalId = 'cadetWizardModal') {
    this.modalEl = document.getElementById(modalId);
    if (!this.modalEl) return;

    this.containerEl = this.modalEl.querySelector('.modal-content-body');

    // Close buttons
    this.modalEl.querySelectorAll('.btn-close-modal, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    // Close on Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.classList.contains('open')) {
        this.close();
      }
    });
  }

  open(step = 1) {
    if (!this.modalEl) return;
    this.currentStep = step;
    
    // Pre-populate cadet info from existing sequencer plan if available
    if (window.sequencer && window.sequencer.plan && window.sequencer.plan.cadet) {
      const c = window.sequencer.plan.cadet;
      if (c.name && c.name !== 'Cadet Record') this.cadetData.name = c.name;
      if (c.email) this.cadetData.email = c.email;
      if (c.classYear) this.cadetData.year = c.classYear;
      if (c.advisorEmail) this.cadetData.advisorEmail = c.advisorEmail;
    }

    this.render();
    this.modalEl.classList.add('open');
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
  }

  goToStep(step) {
    this.currentStep = Math.max(1, Math.min(4, step));
    this.render();
  }

  /**
   * Health analysis: calculates overloads (> 19.5 cr) and prereq/season issues
   */
  analyzeHealth() {
    const plan = window.sequencer ? window.sequencer.plan : null;
    if (!plan || !plan.terms) {
      return { loaded: false, isReady: false, overloads: [], violations: [], totalTerms: 0 };
    }

    const overloads = [];
    const violations = [];

    // Analyze each semester load
    plan.terms.forEach(t => {
      const isSummer = (t.name || '').includes('Summer');
      const maxLimit = isSummer ? 9.0 : 19.5;
      const totalCr = (t.courses || []).reduce((sum, c) => sum + (c.credits || 0), 0);

      if (totalCr > maxLimit) {
        overloads.push({
          termName: t.name,
          credits: totalCr,
          limit: maxLimit,
          excess: (totalCr - maxLimit).toFixed(1)
        });
      }
    });

    // Check rules engine violations
    if (window.rulesEngine) {
      const issues = window.rulesEngine.validateAll(plan);
      if (issues && issues.length > 0) {
        issues.forEach(iss => violations.push(iss));
      }
    }

    const isReady = overloads.length === 0 && violations.length === 0;

    return {
      loaded: true,
      isReady,
      overloads,
      violations,
      totalTerms: plan.terms.length,
      planCadet: plan.cadet
    };
  }

  render() {
    if (!this.containerEl) return;

    const health = this.analyzeHealth();
    const currentMajor = (window.sequencer && window.sequencer.plan && window.sequencer.plan.cadet?.majorId) || 'ME';

    this.containerEl.innerHTML = `
      <div class="wizard-wrapper">
        <!-- Wizard Header -->
        <div class="wizard-header">
          <div class="wizard-header-top">
            <span class="wizard-icon">🚀</span>
            <div>
              <h2 class="wizard-title">Cadet Degree Plan Onboarding Wizard</h2>
              <p class="wizard-subtitle">Follow these 4 guided steps to prepare your advisor-ready academic plan before your meeting.</p>
            </div>
          </div>

          <!-- Stepper Progress Bar -->
          <div class="wizard-stepper">
            <div class="stepper-step ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}" data-step="1">
              <div class="step-num">${this.currentStep > 1 ? '✓' : '1'}</div>
              <div class="step-label">Upload APS</div>
            </div>
            <div class="stepper-line ${this.currentStep > 1 ? 'completed' : ''}"></div>

            <div class="stepper-step ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''}" data-step="2">
              <div class="step-num">${this.currentStep > 2 ? '✓' : '2'}</div>
              <div class="step-label">Health & Balance</div>
            </div>
            <div class="stepper-line ${this.currentStep > 2 ? 'completed' : ''}"></div>

            <div class="stepper-step ${this.currentStep === 3 ? 'active' : ''} ${this.currentStep > 3 ? 'completed' : ''}" data-step="3">
              <div class="step-num">${this.currentStep > 3 ? '✓' : '3'}</div>
              <div class="step-label">Select Electives</div>
            </div>
            <div class="stepper-line ${this.currentStep > 3 ? 'completed' : ''}"></div>

            <div class="stepper-step ${this.currentStep === 4 ? 'active' : ''}" data-step="4">
              <div class="step-num">4</div>
              <div class="step-label">Export & Submit</div>
            </div>
          </div>
        </div>

        <!-- Wizard Step Body -->
        <div class="wizard-step-body">
          ${this.renderStepContent(health, currentMajor)}
        </div>

        <!-- Wizard Navigation Footer -->
        <div class="wizard-footer">
          <button type="button" id="btnWizardPrev" class="btn-wiz-secondary" ${this.currentStep === 1 ? 'disabled style="visibility: hidden;"' : ''}>
            ← Back
          </button>
          
          <div class="wizard-footer-right">
            ${this.currentStep < 4 ? `
              <button type="button" id="btnWizardNext" class="btn-wiz-primary">
                Next Step →
              </button>
            ` : `
              <button type="button" id="btnWizardFinish" class="btn-wiz-success">
                ✓ Done & View Schedule
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(health);
  }

  renderStepContent(health, currentMajor) {
    switch (this.currentStep) {
      case 1:
        return this.renderStep1(health);
      case 2:
        return this.renderStep2(health);
      case 3:
        return this.renderStep3(currentMajor);
      case 4:
        return this.renderStep4(health, currentMajor);
      default:
        return '';
    }
  }

  renderStep1(health) {
    const isLoaded = health.loaded && health.totalTerms > 0;
    const cadet = health.planCadet || {};

    return `
      <div class="wiz-step-pane">
        <h3 class="wiz-pane-title">Step 1: Upload Your COMPASS Academic Program Summary (APS)</h3>
        <p class="wiz-pane-desc">
          Log into <strong>COMPASS / SIS</strong>, export your latest <strong>Academic Program Summary (APS) PDF</strong>, and drag it below.
          The tool will read your validated course history and future scheduled semesters with 100% in-browser privacy.
        </p>

        <div class="wiz-dropzone" id="wizDropzone">
          <div class="dropzone-icon">📄</div>
          <div class="dropzone-text">
            <strong>Drag & Drop your APS PDF here</strong>, or 
            <span class="dropzone-browse" id="btnWizBrowsePdf">browse from your computer</span>
          </div>
          <div class="dropzone-sub">Accepts COMPASS APS (.pdf) • 100% Client-Side Ingestion</div>
          <input type="file" id="wizPdfFileInput" accept=".pdf" style="display: none;" />
        </div>

        ${isLoaded ? `
          <div class="wiz-status-callout success">
            <div class="callout-icon">✅</div>
            <div class="callout-content">
              <strong>APS Document Successfully Ingested!</strong>
              <div>Cadet: <strong>${cadet.name || 'Cadet Record'}</strong> • Class of <strong>${cadet.classYear || '2028'}</strong> • Major: <strong>${cadet.major || 'Mechanical Engineering'}</strong></div>
              <div>Loaded <strong>${health.totalTerms} semesters</strong> with complete course history and units.</div>
            </div>
          </div>
        ` : `
          <div class="wiz-status-callout info">
            <div class="callout-icon">💡</div>
            <div class="callout-content">
              <strong>Don't have your APS PDF handy?</strong>
              <p>You can still proceed using the standard recommended DFEM major sequence template, then upload your APS later.</p>
              <button type="button" id="btnUseTemplateFallback" class="btn-wiz-link">Load Standard 8-Semester Template</button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  renderStep2(health) {
    const { isReady, overloads, violations } = health;

    return `
      <div class="wiz-step-pane">
        <h3 class="wiz-pane-title">Step 2: Balance Semester Credit Loads & Prerequisite Check</h3>
        <p class="wiz-pane-desc">
          DFEM policy requires that no academic semester exceed <strong>19.5 credit hours</strong> without prior academic waiver, and all course prerequisites must be sequenced correctly.
        </p>

        <!-- Status Banner -->
        <div class="wiz-health-banner ${isReady ? 'ready' : 'attention'}">
          <div class="health-banner-icon">${isReady ? '🟢' : '🟡'}</div>
          <div class="health-banner-details">
            <div class="health-banner-title">
              ${isReady ? 'Status: Advisor-Ready!' : 'Status: Action Required Before Advisor Meeting'}
            </div>
            <div class="health-banner-sub">
              ${isReady 
                ? 'All semester loads are ≤ 19.5 credit hours, and no prerequisite conflicts were detected.'
                : `Found ${overloads.length} overloaded semester(s) and ${violations.length} prerequisite / offering issue(s).`
              }
            </div>
          </div>
        </div>

        <!-- Overload Issues -->
        ${overloads.length > 0 ? `
          <div class="wiz-issue-section">
            <h4 class="wiz-issue-heading">⚠️ Overloaded Terms (> 19.5 Credit Hours):</h4>
            <div class="wiz-issues-list">
              ${overloads.map(o => `
                <div class="wiz-issue-card">
                  <div class="wiz-issue-title"><strong>${o.termName}</strong>: ${o.credits.toFixed(1)} Credit Hours</div>
                  <div class="wiz-issue-detail">Exceeds the 19.5 hour limit by <strong>+${o.excess} hrs</strong>. Shift an academic core or elective course to another semester or summer term.</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="wiz-issue-section">
            <div class="wiz-clean-check">✅ No semester credit overloads detected (all terms ≤ 19.5 hrs).</div>
          </div>
        `}

        <!-- Prerequisite / Offering Issues -->
        ${violations.length > 0 ? `
          <div class="wiz-issue-section">
            <h4 class="wiz-issue-heading">⚠️ Prerequisite & Semester Offering Conflicts:</h4>
            <div class="wiz-issues-list">
              ${violations.map(v => `
                <div class="wiz-issue-card">
                  <div class="wiz-issue-title"><strong>${v.courseCode}</strong> in ${v.termName}</div>
                  <div class="wiz-issue-detail">${v.message || 'Prerequisite or offering semester requirement not satisfied.'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="wiz-issue-section">
            <div class="wiz-clean-check">✅ All course prerequisites and semester offerings are satisfied.</div>
          </div>
        `}

        <div class="wiz-hint-box">
          <strong>Tip for Cadets:</strong> You can drag & drop course cards between semester columns in the <strong>Course Sequencer</strong> to balance your credit load and fix warnings.
        </div>
      </div>
    `;
  }

  renderStep3(currentMajor) {
    const isME = currentMajor === 'ME';

    const mePathways = [
      {
        name: 'Aeronautics & Propulsion',
        icon: '✈️',
        desc: 'Focus on flight aerodynamics, gas turbine engines, and compressible flow.',
        courses: [
          { code: 'AERO ENG 341', title: 'Aeronautical Fluid Dynamics', cr: 3 },
          { code: 'AERO ENG 351', title: 'Aircraft Aerodynamic Design', cr: 3 },
          { code: 'MECH ENG 445', title: 'Failure Analysis & Materials', cr: 3 }
        ]
      },
      {
        name: 'Mechatronics & Robotics',
        icon: '🤖',
        desc: 'Autonomous systems, feedback control, embedded microcontrollers, and automation.',
        courses: [
          { code: 'MECH ENG 440', title: 'Physical Metallurgy', cr: 3 },
          { code: 'ECE 315', title: 'Principles of Air Force Electronic Systems', cr: 3 },
          { code: 'MECH ENG 431', title: 'Tool Design & Manufacturing', cr: 3 }
        ]
      },
      {
        name: 'Thermal-Fluids & Energy',
        icon: '🔥',
        desc: 'Thermodynamic power cycles, heat transfer, CFD, and advanced propulsion.',
        courses: [
          { code: 'MECH ENG 452', title: 'Heat Transfer & Fluid Mechanics Lab', cr: 3 },
          { code: 'MECH ENG 453', title: 'Computational Fluid Dynamics', cr: 3 }
        ]
      },
      {
        name: 'Advanced Materials & Structures',
        icon: '🔬',
        desc: 'Composite materials, fatigue, structural integrity, and experimental mechanics.',
        courses: [
          { code: 'MECH ENG 468', title: 'Aircraft Structural Analysis', cr: 3 },
          { code: 'MECH ENG 460', title: 'Experimental Mechanics', cr: 3 }
        ]
      }
    ];

    const sePathways = [
      {
        name: 'Aeronautical Systems Track',
        icon: '🛩️',
        desc: 'Systems engineering applied to military aircraft platforms and flight test.',
        courses: [
          { code: 'AERO ENG 341', title: 'Aeronautical Fluid Dynamics', cr: 3 },
          { code: 'AERO ENG 351', title: 'Aircraft Aerodynamic Design', cr: 3 }
        ]
      },
      {
        name: 'Robotics & Autonomous Systems',
        icon: '🦾',
        desc: 'Unmanned vehicles, autonomous agents, sensor integration, and digital twin.',
        courses: [
          { code: 'SYS ENG 470', title: 'Human Systems Integration', cr: 3 },
          { code: 'ECE 315', title: 'Electronic Systems', cr: 3 }
        ]
      },
      {
        name: 'Space Systems Track',
        icon: '🛰️',
        desc: 'Orbital mechanics, satellite payloads, satellite operations, and space launch.',
        courses: [
          { code: 'ASTRO ENG 310', title: 'Introduction to Astronautics', cr: 3 },
          { code: 'ASTRO ENG 410', title: 'Astrodynamics', cr: 3 }
        ]
      }
    ];

    const pathways = isME ? mePathways : sePathways;

    return `
      <div class="wiz-step-pane">
        <h3 class="wiz-pane-title">
          Step 3: Choose Your ${isME ? '3 ME Option Electives' : '4 Systems Engineering Depth Electives'}
        </h3>
        <p class="wiz-pane-desc">
          ${isME 
            ? 'Mechanical Engineering majors must select <strong>3 ME Option Electives</strong> (at least one must be a 400-level MECH ENG course). Courses counting towards major core cannot be double-counted.'
            : 'Systems Engineering majors select <strong>4 Focus Track Depth Electives</strong> tailored to their technical specialization.'
          }
        </p>

        <div class="pathway-cards-grid">
          ${pathways.map(p => `
            <div class="pathway-card">
              <div class="pathway-card-header">
                <span class="pathway-icon">${p.icon}</span>
                <div>
                  <div class="pathway-title">${p.name}</div>
                  <div class="pathway-desc">${p.desc}</div>
                </div>
              </div>
              <div class="pathway-courses-list">
                ${p.courses.map(c => `
                  <div class="pathway-course-item">
                    <div class="p-course-left">
                      <strong>${c.code}</strong>: ${c.title} (${c.cr} cr)
                    </div>
                    <div class="p-course-actions">
                      <button type="button" class="btn-p-action btn-add-elective" data-code="${c.code}">+ Add to Senior Year</button>
                      <button type="button" class="btn-p-action-view" data-code="${c.code}">ℹ️</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderStep4(health, currentMajor) {
    const isReady = health.isReady;
    const cadet = health.planCadet || {};
    const advisorEmail = cadet.advisorEmail || this.cadetData.advisorEmail || '';
    const advisorName = cadet.advisor || 'Your Assigned Advisor';

    return `
      <div class="wiz-step-pane">
        <h3 class="wiz-pane-title">Step 4: Export Your Degree Plan & Submit to Advisor</h3>
        <p class="wiz-pane-desc">
          You are ready to export your validated academic plan and email it to your faculty advisor before your scheduled meeting!
        </p>

        <div class="wiz-summary-card">
          <div class="wiz-summary-row">
            <span class="wiz-sum-label">Cadet:</span>
            <span class="wiz-sum-val"><strong>${cadet.name || 'Cadet'}</strong> (Class of ${cadet.classYear || '2028'})</span>
          </div>
          <div class="wiz-summary-row">
            <span class="wiz-sum-label">Major:</span>
            <span class="wiz-sum-val"><strong>${cadet.major || 'Mechanical Engineering'}</strong></span>
          </div>
          <div class="wiz-summary-row">
            <span class="wiz-sum-label">Assigned Advisor:</span>
            <span class="wiz-sum-val"><strong>${advisorName}</strong> (${advisorEmail || 'fairchild hall'})</span>
          </div>
          <div class="wiz-summary-row">
            <span class="wiz-sum-label">Plan Health:</span>
            <span class="wiz-sum-val">
              ${isReady 
                ? '<span class="badge-status-green">🟢 Advisor-Ready</span>' 
                : '<span class="badge-status-yellow">🟡 Needs Final Review</span>'
              }
            </span>
          </div>
        </div>

        <div class="wiz-submission-actions">
          <div class="wiz-sub-step">
            <div class="wiz-sub-num">1</div>
            <div class="wiz-sub-content">
              <strong>Download Your Official Plan JSON:</strong>
              <p>Saves your exact semester-by-semester schedule file to your computer.</p>
              <button type="button" id="btnWizDownloadPlan" class="btn-wiz-cta">
                💾 Download Plan (.json)
              </button>
            </div>
          </div>

          <div class="wiz-sub-step">
            <div class="wiz-sub-num">2</div>
            <div class="wiz-sub-content">
              <strong>Email Degree Plan to Advisor:</strong>
              <p>Opens a pre-addressed email draft in Outlook with instructions to attach your downloaded plan file.</p>
              <div class="advisor-email-input-row" style="margin-bottom: 8px;">
                <label style="font-size: 11px; font-weight: 600; color: #475569;">Advisor Email:</label>
                <input type="email" id="wizAdvisorEmailInput" class="form-control" style="max-width: 320px; display: inline-block; margin-left: 6px;" value="${advisorEmail}" placeholder="advisor@afacademy.af.edu" />
              </div>
              <button type="button" id="btnWizEmailAdvisor" class="btn-wiz-cta">
                ✉️ Open Pre-Addressed Email Draft
              </button>
            </div>
          </div>
        </div>

        <div id="wizFeedbackMessage" class="wiz-feedback hidden"></div>
      </div>
    `;
  }

  bindEvents(health) {
    const btnPrev = document.getElementById('btnWizardPrev');
    const btnNext = document.getElementById('btnWizardNext');
    const btnFinish = document.getElementById('btnWizardFinish');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this.goToStep(this.currentStep - 1);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.goToStep(this.currentStep + 1);
      });
    }

    if (btnFinish) {
      btnFinish.addEventListener('click', () => {
        this.close();
      });
    }

    // Step-specific bindings
    if (this.currentStep === 1) {
      this.bindStep1Events();
    } else if (this.currentStep === 3) {
      this.bindStep3Events();
    } else if (this.currentStep === 4) {
      this.bindStep4Events(health);
    }
  }

  bindStep1Events() {
    const dropzone = document.getElementById('wizDropzone');
    const fileInput = document.getElementById('wizPdfFileInput');
    const btnBrowse = document.getElementById('btnWizBrowsePdf');
    const btnTemplate = document.getElementById('btnUseTemplateFallback');

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.processPdfFile(file);
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.processPdfFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnTemplate) {
      btnTemplate.addEventListener('click', () => {
        if (window.sequencer) {
          window.sequencer.loadDefaultTemplate('ME');
          this.render();
        }
      });
    }
  }

  async processPdfFile(file) {
    try {
      const dropzone = document.getElementById('wizDropzone');
      if (dropzone) {
        dropzone.innerHTML = `<div style="padding: 20px; font-weight: 600; color: var(--primary-navy);">⏳ Ingesting and validating APS PDF...</div>`;
      }

      const result = await window.pdfIngestService.parsePDFReport(file);
      if (result.type === 'APS') {
        const parsed = result.data;
        const majorKey = (parsed.cadet.major || '').toLowerCase().includes('systems') ? 'SE' : 'ME';

        window.sequencer.setPlan({
          cadet: {
            name: parsed.cadet.name || "Cadet Record",
            major: parsed.cadet.major || "Mechanical Engineering",
            majorId: majorKey,
            classYear: parsed.cadet.classYear || "2028",
            emplid: parsed.cadet.emplid || "",
            cumGpa: parsed.cadet.cumGpa || "",
            totalUnits: parsed.cadet.totalUnits || 0
          },
          terms: parsed.terms
        });

        if (window.advisorDiffEngine) {
          window.advisorDiffEngine.setBaselinePlan(parsed);
        }

        // Refresh view
        this.render();
      } else {
        alert('Could not detect standard APS header in PDF.');
        this.render();
      }
    } catch (err) {
      console.error(err);
      alert('Error ingesting PDF: ' + err.message);
      this.render();
    }
  }

  bindStep3Events() {
    this.containerEl.querySelectorAll('.btn-add-elective').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        this.addCourseToPlan(code);
        btn.textContent = '✓ Added!';
        btn.disabled = true;
      });
    });

    this.containerEl.querySelectorAll('.btn-p-action-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (window.courseModal) {
          window.courseModal.open(code);
        }
      });
    });
  }

  addCourseToPlan(courseCode) {
    if (!window.sequencer || !window.sequencer.plan) return;
    const plan = window.sequencer.plan;
    const cData = window.curriculumService.getCourse(courseCode);
    const newCourseObj = {
      code: courseCode,
      credits: cData ? cData.credits : 3,
      title: cData ? cData.title : courseCode,
      category: 'elective'
    };

    // Find the latest open semester (e.g. senior spring or senior fall)
    const terms = plan.terms || [];
    let targetTermIdx = terms.length - 1;

    for (let i = terms.length - 1; i >= 0; i--) {
      const t = terms[i];
      const isSummer = (t.name || '').includes('Summer');
      if (isSummer) continue;
      const load = (t.courses || []).reduce((sum, c) => sum + (c.credits || 0), 0);
      if (load + (newCourseObj.credits || 3) <= 19.5) {
        targetTermIdx = i;
        break;
      }
    }

    if (terms[targetTermIdx]) {
      terms[targetTermIdx].courses = terms[targetTermIdx].courses || [];
      terms[targetTermIdx].courses.push(newCourseObj);
      window.sequencer.render();
      if (window.syncGradCheck) window.syncGradCheck(plan);
    }
  }

  bindStep4Events(health) {
    const btnDownload = document.getElementById('btnWizDownloadPlan');
    const btnEmail = document.getElementById('btnWizEmailAdvisor');
    const emailInput = document.getElementById('wizAdvisorEmailInput');

    if (emailInput) {
      emailInput.addEventListener('input', (e) => {
        this.cadetData.advisorEmail = e.target.value;
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        if (!window.sequencer.plan) return;
        const jsonStr = JSON.stringify(window.sequencer.plan, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cadet = window.sequencer.plan.cadet || {};
        const safeName = (cadet.name || 'Cadet').replace(/[^a-zA-Z0-9]/g, '_');
        a.href = url;
        a.download = `Academic_Plan_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showFeedback('✅ Degree plan downloaded! Remember to attach this file to your email in Step 2.');
      });
    }

    if (btnEmail) {
      btnEmail.addEventListener('click', () => {
        const cadet = window.sequencer.plan ? window.sequencer.plan.cadet || {} : {};
        const emailTo = (emailInput ? emailInput.value : '') || this.cadetData.advisorEmail || '';
        if (!emailTo || !emailTo.includes('@')) {
          alert('Please enter your advisor\'s email address.');
          return;
        }

        const cadetName = cadet.name || 'Cadet';
        const major = cadet.major || 'Mechanical Engineering';
        const classYear = cadet.classYear || '2028';
        const subject = `[DFEM Plan Submission] ${cadetName} ('${classYear.slice(-2)}) Initial Degree Plan`;

        const body = `Good day Advisor,

Here is my initial major degree plan for ${major} (Class of ${classYear}) created using the USAFA Advising Tool.

My plan has been sequenced to resolve prerequisites and maintain semester credit loads below 19.5 credit hours.

Attached is my exported degree plan (.json) file for your review prior to our upcoming major declaration meeting.

Very Respectfully,
${cadetName}
Class of ${classYear}
United States Air Force Academy`;

        const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        this.showFeedback('✅ Email draft opened in your mail client! Make sure to ATTACH the downloaded .json file before sending.');
      });
    }
  }

  showFeedback(msg) {
    const el = document.getElementById('wizFeedbackMessage');
    if (!el) return;
    el.classList.remove('hidden');
    el.textContent = msg;
  }
}

window.cadetWizard = new CadetWizard();

