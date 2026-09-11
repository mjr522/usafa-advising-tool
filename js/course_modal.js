/**
 * USAFA Advising Tool - Course Details & Advisor Notes Modal
 * Searchable course explorer, handbook description viewer, and interactive advisor note editor.
 */

class CourseModal {
  constructor(curriculumService) {
    this.curriculum = curriculumService;
    this.modalEl = null;
    this.currentCourseCode = null;
  }

  init(modalId) {
    this.modalEl = document.getElementById(modalId);
    if (!this.modalEl) return;

    // Close buttons
    this.modalEl.querySelectorAll('.btn-close-modal, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => this.close());
    });
  }

  open(courseCode) {
    if (!this.modalEl) return;
    this.currentCourseCode = courseCode;
    const course = this.curriculum.getCourse(courseCode);
    if (!course) return;

    const modalContent = this.modalEl.querySelector('.modal-content-body');
    if (!modalContent) return;

    const offerings = (course.semesters_offered || []).join(', ');
    const diffClass = `diff-${(course.difficulty || 'moderate').toLowerCase()}`;
    const terms = (window.sequencer && window.sequencer.plan && window.sequencer.plan.terms) || [];
    
    // Determine optimal term for quick add
    let optimalTermIdx = terms.length > 0 ? terms.length - 1 : 0;
    const courseOfferings = course.semesters_offered || ['Fall', 'Spring'];
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      const season = t.season || (t.name.includes('Fall') ? 'Fall' : 'Spring');
      if (courseOfferings.includes(season)) {
        const load = (t.courses || []).reduce((acc, cur) => acc + (cur.credits || 0), 0);
        if (load < 19.5) {
          optimalTermIdx = i;
          break;
        }
      }
    }

    modalContent.innerHTML = `
      <div class="course-modal-header">
        <div class="header-left">
          <h2 class="modal-course-title">${course.id}: ${course.title}</h2>
          <div class="course-meta-tags">
            <span class="meta-tag credits-tag">${course.credits} Semester Hours</span>
            <span class="meta-tag offering-tag">📅 ${offerings || 'Fall or Spring'}</span>
            <span class="meta-tag diff-tag ${diffClass}">Workload: ${course.difficulty || 'Moderate'}</span>
            ${course.even_years_only ? '<span class="meta-tag alert-tag">Even Years Only</span>' : ''}
            ${course.odd_years_only ? '<span class="meta-tag alert-tag">Odd Years Only</span>' : ''}
          </div>
        </div>
        <div class="header-right-actions">
          <button type="button" class="btn-modal-add-sched" id="btnModalAddToSched" title="Add this course to your academic schedule">
            📅 + Add to Schedule
          </button>
        </div>
      </div>

      <!-- Quick Semester Picker for Direct Scheduling -->
      <div id="modalSchedPicker" class="modal-sched-picker hidden">
        <div class="sched-picker-inner">
          <div class="picker-instruction">
            <span>Select semester to place <strong>${course.id}</strong>:</span>
          </div>
          <div class="picker-controls">
            <select id="modalSchedTermSelect" class="form-control">
              ${terms.map((t, idx) => `
                <option value="${idx}" ${idx === optimalTermIdx ? 'selected' : ''}>
                  ${t.name} (${(t.courses || []).reduce((s, c) => s + (c.credits || 0), 0).toFixed(1)} cr)
                </option>
              `).join('')}
            </select>
            <button type="button" id="btnModalConfirmAdd" class="btn-confirm-add">
              Confirm Add
            </button>
          </div>
          <div id="modalSchedFeedback" class="sched-feedback hidden"></div>
        </div>
      </div>

      <div class="course-modal-sections">
        <!-- Prerequisites & Corequisites -->
        <div class="modal-section prereqs-section">
          <h3>Prerequisites & Corequisites</h3>
          <div class="prereq-block">
            <strong>Prerequisites:</strong> 
            <span>${course.prereqs_text || 'None'}</span>
          </div>
          <div class="prereq-block">
            <strong>Corequisites:</strong> 
            <span>${course.coreqs_text || 'None'}</span>
          </div>
        </div>

        <!-- COI Handbook Description -->
        <div class="modal-section description-section">
          <h3>Course of Instruction (COI) Description</h3>
          <p class="course-desc-text">${course.description || 'No official description available.'}</p>
        </div>

        <!-- Advising Pro-Tips & Workload Warnings -->
        <div class="modal-section advisor-section">
          <div class="section-title-row">
            <h3>Advisor Notes & Course Guidance</h3>
            <button class="btn-toggle-edit" id="btnToggleTipEdit">✏️ Edit Advisor Tips</button>
          </div>

          <!-- Advisor Update Sync Notice (shown after saving) -->
          <div id="advisorSyncNotice" class="advisor-sync-notice hidden"></div>

          <div id="tipViewMode" class="tip-view-mode">
            <div class="tip-box">
              <strong>Advising Pro-Tip:</strong>
              <p id="viewTipText">${course.advisor_tips || 'No specific advisor guidance logged yet. Click edit to add advice for cadets.'}</p>
            </div>
            ${course.pairing_warnings ? `
              <div class="tip-box warning-box" id="viewPairingBox">
                <strong>Course Pairing Caution:</strong>
                <p id="viewPairingText">${course.pairing_warnings}</p>
              </div>
            ` : `<div class="tip-box warning-box hidden" id="viewPairingBox"><strong>Course Pairing Caution:</strong><p id="viewPairingText"></p></div>`}
          </div>

          <div id="tipEditMode" class="tip-edit-mode hidden">
            <div class="form-group">
              <label>Workload & Difficulty Rating:</label>
              <select id="editDifficulty" class="form-control">
                <option value="Light" ${course.difficulty === 'Light' ? 'selected' : ''}>Light (Manageable load, low weekly homework)</option>
                <option value="Moderate" ${course.difficulty === 'Moderate' ? 'selected' : ''}>Moderate (Standard engineering / core pace)</option>
                <option value="Demanding" ${course.difficulty === 'Demanding' ? 'selected' : ''}>Demanding (High homework load, labs, rigorous exam prep)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Advisor Pro-Tip (Advice, recommended study approach, typical semester fit):</label>
              <textarea id="editTips" class="form-control" rows="3">${course.advisor_tips || ''}</textarea>
            </div>

            <div class="form-group">
              <label>Pairing Warnings (Courses to avoid taking concurrently):</label>
              <textarea id="editPairings" class="form-control" rows="2">${course.pairing_warnings || ''}</textarea>
            </div>

            <div class="form-actions">
              <button class="btn-save-tip" id="btnSaveTip">Save Changes</button>
              <button class="btn-cancel-tip" id="btnCancelTip">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindSchedulePickerEvents(course, terms);
    this.bindEditorEvents(course);
    this.modalEl.classList.add('open');
  }

  bindSchedulePickerEvents(course, terms) {
    const btnToggle = document.getElementById('btnModalAddToSched');
    const picker = document.getElementById('modalSchedPicker');
    const btnConfirm = document.getElementById('btnModalConfirmAdd');
    const selectEl = document.getElementById('modalSchedTermSelect');
    const feedbackEl = document.getElementById('modalSchedFeedback');

    if (btnToggle && picker) {
      btnToggle.addEventListener('click', () => {
        picker.classList.toggle('hidden');
      });
    }

    if (btnConfirm && selectEl) {
      btnConfirm.addEventListener('click', () => {
        const termIdx = parseInt(selectEl.value, 10);
        if (isNaN(termIdx) || !terms[termIdx]) return;

        const termName = terms[termIdx].name;
        if (window.sequencer && window.sequencer.addCourseToTerm) {
          window.sequencer.addCourseToTerm(termIdx, course.id, course.credits);
        }

        if (feedbackEl) {
          feedbackEl.innerHTML = `✅ Successfully added <strong>${course.id}</strong> to <strong>${termName}</strong>!`;
          feedbackEl.classList.remove('hidden');
        }

        btnConfirm.innerText = "Added ✓";
        btnConfirm.disabled = true;

        setTimeout(() => {
          if (btnConfirm) {
            btnConfirm.innerText = "Confirm Add";
            btnConfirm.disabled = false;
          }
        }, 2000);
      });
    }
  }

  bindEditorEvents(course) {
    const btnToggle = document.getElementById('btnToggleTipEdit');
    const tipView = document.getElementById('tipViewMode');
    const tipEdit = document.getElementById('tipEditMode');
    const btnSave = document.getElementById('btnSaveTip');
    const btnCancel = document.getElementById('btnCancelTip');
    const syncNotice = document.getElementById('advisorSyncNotice');

    if (btnToggle && tipView && tipEdit) {
      btnToggle.addEventListener('click', () => {
        tipView.classList.toggle('hidden');
        tipEdit.classList.toggle('hidden');
        if (syncNotice) syncNotice.classList.add('hidden');
      });
    }

    if (btnCancel && tipView && tipEdit) {
      btnCancel.addEventListener('click', () => {
        tipEdit.classList.add('hidden');
        tipView.classList.remove('hidden');
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const newDiff = document.getElementById('editDifficulty').value;
        const newTips = document.getElementById('editTips').value.trim();
        const newPairings = document.getElementById('editPairings').value.trim();

        // 1. Save locally to this browser's localStorage
        this.curriculum.saveAdvisorTip(course.id, {
          difficulty: newDiff,
          advisor_tips: newTips,
          pairing_warnings: newPairings
        });

        // 2. Update current in-memory view
        course.difficulty = newDiff;
        course.advisor_tips = newTips;
        course.pairing_warnings = newPairings;

        const viewTipText = document.getElementById('viewTipText');
        if (viewTipText) viewTipText.innerText = newTips || 'No specific advisor guidance logged yet.';

        const viewPairingBox = document.getElementById('viewPairingBox');
        const viewPairingText = document.getElementById('viewPairingText');
        if (viewPairingBox && viewPairingText) {
          if (newPairings) {
            viewPairingText.innerText = newPairings;
            viewPairingBox.classList.remove('hidden');
          } else {
            viewPairingBox.classList.add('hidden');
          }
        }

        tipEdit.classList.add('hidden');
        tipView.classList.remove('hidden');

        // 3. Build email and JSON patch for Dr. Richards (AIC)
        const normKey = this.curriculum.normalizeKey(course.id);
        const patchSnippet = {
          [normKey]: {
            course_id: course.id,
            difficulty: newDiff,
            advisor_tips: newTips,
            pairing_warnings: newPairings
          }
        };
        const patchJsonStr = JSON.stringify(patchSnippet, null, 2);

        const emailRecipient = 'michael.richards@afacademy.af.edu';
        const emailSubject = encodeURIComponent(`[ESME Advising Tool] Advisor Note Update: ${course.id}`);
        const emailBodyText = 
          `USAFA Department of Mechanical Engineering (ESME)\n` +
          `Advisor Course Note Update Submission\n\n` +
          `Course: ${course.id} - ${course.title}\n` +
          `Workload / Difficulty: ${newDiff}\n` +
          `Advisor Pro-Tip: ${newTips || '(None)'}\n` +
          `Pairing Warnings: ${newPairings || '(None)'}\n\n` +
          `--- JSON PATCH (for website catalog update) ---\n` +
          `${patchJsonStr}\n`;
        const mailtoUrl = `mailto:${emailRecipient}?subject=${emailSubject}&body=${encodeURIComponent(emailBodyText)}`;

        // 4. Show sync notice panel
        if (syncNotice) {
          syncNotice.innerHTML = `
            <div class="sync-notice-header">
              <span class="sync-notice-icon">💾</span>
              <div>
                <strong>Saved to Your Local Browser!</strong>
                <p>Because this advising tool runs 100% in-browser to protect cadet privacy, this update is currently saved on your device. To publish this note to the official department website for all cadets, send this update to Dr. Richards (AIC):</p>
              </div>
            </div>
            <div class="sync-notice-actions">
              <a href="${mailtoUrl}" class="btn-email-aic" target="_blank">
                ✉️ Email Update to Dr. Richards (AIC)
              </a>
              <button type="button" class="btn-copy-patch" id="btnCopyNotePatch">
                📋 Copy Update Snippet
              </button>
            </div>
            <div id="copyFeedback" class="copy-feedback-text hidden">✅ Copied to clipboard! Ready to paste into an email or message.</div>
          `;
          syncNotice.classList.remove('hidden');

          const btnCopy = document.getElementById('btnCopyNotePatch');
          const copyFeedback = document.getElementById('copyFeedback');
          if (btnCopy) {
            btnCopy.addEventListener('click', () => {
              navigator.clipboard.writeText(emailBodyText).then(() => {
                if (copyFeedback) copyFeedback.classList.remove('hidden');
                btnCopy.innerText = "Copied ✓";
                setTimeout(() => {
                  btnCopy.innerText = "📋 Copy Update Snippet";
                }, 2500);
              });
            });
          }
        }

        if (window.sequencer) window.sequencer.render();
      });
    }
  }

  close() {
    if (this.modalEl) this.modalEl.classList.remove('open');
  }
}

// Global instance
window.courseModal = new CourseModal(window.curriculumService);
