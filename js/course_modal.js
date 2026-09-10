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

          <div id="tipViewMode" class="tip-view-mode">
            <div class="tip-box">
              <strong>Advising Pro-Tip:</strong>
              <p>${course.advisor_tips || 'No specific advisor guidance logged yet. Click edit to add advice for cadets.'}</p>
            </div>
            ${course.pairing_warnings ? `
              <div class="tip-box warning-box">
                <strong>Course Pairing Caution:</strong>
                <p>${course.pairing_warnings}</p>
              </div>
            ` : ''}
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

    this.bindEditorEvents(course);
    this.modalEl.classList.add('open');
  }

  bindEditorEvents(course) {
    const btnToggle = document.getElementById('btnToggleTipEdit');
    const tipView = document.getElementById('tipViewMode');
    const tipEdit = document.getElementById('tipEditMode');
    const btnSave = document.getElementById('btnSaveTip');
    const btnCancel = document.getElementById('btnCancelTip');

    if (btnToggle && tipView && tipEdit) {
      btnToggle.addEventListener('click', () => {
        tipView.classList.toggle('hidden');
        tipEdit.classList.toggle('hidden');
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
        const newTips = document.getElementById('editTips').value;
        const newPairings = document.getElementById('editPairings').value;

        this.curriculum.saveAdvisorTip(course.id, {
          difficulty: newDiff,
          advisor_tips: newTips,
          pairing_warnings: newPairings
        });

        // Re-open / refresh view
        this.open(course.id);
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
