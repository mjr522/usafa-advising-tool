/**
 * USAFA Advising Tool - Autocomplete Course Search & Add Modal
 * Fast, real-time typeahead filter over 760+ USAFA courses with term offering checks,
 * keyboard navigation, and duplicate detection.
 */

class AddCourseModal {
  constructor(curriculumService) {
    this.curriculum = curriculumService;
    this.modalEl = null;
    this.targetTermIndex = null;
    this.targetTerm = null;
    this.activeMatches = [];
    this.selectedIndex = 0;
    this.showCustomMode = false;
  }

  init(modalId = 'addCourseModal') {
    this.modalEl = document.getElementById(modalId);
    if (!this.modalEl) return;

    // Close on backdrop click or close button
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

  open(targetTermIndex, prefillCode = '') {
    if (!this.modalEl) {
      this.init('addCourseModal');
    }
    if (!this.modalEl) return;

    this.targetTermIndex = targetTermIndex;
    const plan = window.sequencer ? window.sequencer.plan : null;
    this.targetTerm = plan && plan.terms ? plan.terms[targetTermIndex] : null;
    this.selectedIndex = 0;
    this.showCustomMode = false;

    this.render();
    this.modalEl.classList.add('open');

    const searchInput = document.getElementById('addCourseSearchInput');
    if (searchInput) {
      searchInput.value = prefillCode || '';
      searchInput.focus();
      this.filterCourses(prefillCode || '');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  render() {
    const termName = this.targetTerm ? this.targetTerm.name : `Term ${this.targetTermIndex + 1}`;
    const modalContent = this.modalEl.querySelector('.modal-content-body');
    if (!modalContent) return;

    modalContent.innerHTML = `
      <div class="add-course-modal-wrap">
        <div class="add-course-header">
          <div class="add-course-title-wrap">
            <span class="header-icon">🔍</span>
            <div>
              <h2 class="add-course-title">Add Course to ${termName}</h2>
              <p class="add-course-subtitle">Search by course code, title, or department from 760+ USAFA COI courses.</p>
            </div>
          </div>
        </div>

        <div class="add-course-search-bar">
          <input 
            type="text" 
            id="addCourseSearchInput" 
            class="form-control form-control-search" 
            placeholder="Type code or keyword (e.g. MECH ENGR 341, thermo, 243, econ)..." 
            autocomplete="off" 
            spellcheck="false"
          />
          <button type="button" id="btnClearSearch" class="btn-clear-search" title="Clear search">×</button>
        </div>

        <!-- Autocomplete Results Container -->
        <div class="add-course-results-list" id="addCourseResultsList">
          <div class="results-loading-hint">Type above to search USAFA courses...</div>
        </div>

        <!-- Custom Course Toggle Footer -->
        <div class="add-course-footer">
          <button type="button" id="btnToggleCustomCourse" class="btn-toggle-custom">
            ✏️ Course not in catalog? Add custom course / transfer credit
          </button>

          <div id="customCoursePanel" class="custom-course-panel hidden">
            <div class="custom-course-inputs">
              <input type="text" id="customCourseCode" class="form-control" placeholder="Course Code (e.g. ENGR 499X)" />
              <input type="number" id="customCourseCredits" class="form-control input-credits" placeholder="Credits" value="3.0" step="0.5" min="0" max="12" />
              <button type="button" id="btnAddCustomConfirm" class="btn-add-confirm">Add Custom</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const searchInput = document.getElementById('addCourseSearchInput');
    const clearBtn = document.getElementById('btnClearSearch');
    const btnToggleCustom = document.getElementById('btnToggleCustomCourse');
    const customPanel = document.getElementById('customCoursePanel');
    const btnAddCustom = document.getElementById('btnAddCustomConfirm');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterCourses(e.target.value);
      });

      searchInput.addEventListener('keydown', (e) => {
        this.handleKeydown(e);
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        this.filterCourses('');
      });
    }

    if (btnToggleCustom && customPanel) {
      btnToggleCustom.addEventListener('click', () => {
        this.showCustomMode = !this.showCustomMode;
        customPanel.classList.toggle('hidden', !this.showCustomMode);
        if (this.showCustomMode) {
          const codeInput = document.getElementById('customCourseCode');
          if (codeInput) codeInput.focus();
        }
      });
    }

    if (btnAddCustom) {
      btnAddCustom.addEventListener('click', () => {
        const codeInput = document.getElementById('customCourseCode');
        const creditsInput = document.getElementById('customCourseCredits');
        const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
        const credits = creditsInput ? parseFloat(creditsInput.value) || 3.0 : 3.0;

        if (!code) {
          alert('Please enter a course code.');
          return;
        }

        this.selectCourse({ id: code, credits: credits });
      });
    }
  }

  handleKeydown(e) {
    if (this.activeMatches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.activeMatches.length - 1);
      this.updateActiveItemVisual();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateActiveItemVisual();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.activeMatches[this.selectedIndex]) {
        this.selectCourse(this.activeMatches[this.selectedIndex]);
      }
    }
  }

  updateActiveItemVisual() {
    const listEl = document.getElementById('addCourseResultsList');
    if (!listEl) return;

    const items = listEl.querySelectorAll('.course-match-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  filterCourses(query) {
    const listEl = document.getElementById('addCourseResultsList');
    if (!listEl) return;

    const allCourses = window.curriculumService && window.curriculumService.data
      ? Object.values(window.curriculumService.data.courses)
      : [];

    const q = (query || '').toUpperCase().trim();
    const cleanQ = q.replace(/[^A-Z0-9]/g, '');

    // Existing courses in cadet plan for duplicate detection
    const planCoursesMap = new Map();
    if (window.sequencer && window.sequencer.plan && window.sequencer.plan.terms) {
      window.sequencer.plan.terms.forEach(t => {
        (t.courses || []).forEach(c => {
          const k = window.curriculumService.normalizeKey(c.code);
          const bk = window.curriculumService.getBaseCourseCode(c.code);
          planCoursesMap.set(k, t.name);
          planCoursesMap.set(bk, t.name);
        });
      });
    }

    if (!cleanQ) {
      // Suggest common foundational / major courses not yet in plan
      const commonCodes = ['MECH ENGR 341', 'MECH ENGR 320', 'MECH ENGR 312', 'MATH 243', 'MATH 245', 'PHYSICS 215', 'ECON 201', 'ENGLISH 211'];
      this.activeMatches = allCourses.filter(c => commonCodes.includes(c.id)).slice(0, 8);
      this.selectedIndex = 0;
      this.renderResults(listEl, planCoursesMap, true);
      return;
    }

    // Score and filter courses
    const matches = [];
    allCourses.forEach(c => {
      const idNorm = (c.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const titleUpper = (c.title || '').toUpperCase();
      const deptUpper = (c.dept || '').toUpperCase();
      const numStr = (c.number || '').toString();

      let score = 0;

      if (idNorm === cleanQ) score += 100;
      else if (idNorm.startsWith(cleanQ)) score += 60;
      else if (idNorm.includes(cleanQ)) score += 40;
      else if (numStr.startsWith(cleanQ)) score += 35;
      else if (numStr.includes(cleanQ)) score += 20;

      if (titleUpper.startsWith(q)) score += 50;
      else if (titleUpper.includes(q)) score += 25;

      if (deptUpper.includes(q)) score += 15;

      if (score > 0) {
        matches.push({ course: c, score });
      }
    });

    matches.sort((a, b) => b.score - a.score);
    this.activeMatches = matches.slice(0, 30).map(m => m.course);
    this.selectedIndex = 0;

    this.renderResults(listEl, planCoursesMap, false);
  }

  renderResults(listEl, planCoursesMap, isDefaultRecommendation = false) {
    if (this.activeMatches.length === 0) {
      listEl.innerHTML = `
        <div class="results-empty-state">
          <p>No courses found matching your search.</p>
          <p class="hint">Check spelling or use the custom course option below.</p>
        </div>
      `;
      return;
    }

    const targetSeason = this.targetTerm
      ? (this.targetTerm.season || (this.targetTerm.name.includes('Fall') ? 'Fall' : 'Spring'))
      : 'Fall';

    let html = '';
    if (isDefaultRecommendation) {
      html += `<div class="results-group-header">Recommended Major & Core Courses</div>`;
    }

    html += this.activeMatches.map((c, idx) => {
      const normKey = window.curriculumService.normalizeKey(c.id);
      const scheduledInTerm = planCoursesMap.get(normKey);
      const offerings = c.semesters_offered || ['Fall', 'Spring'];
      const isOfferedInTarget = offerings.includes(targetSeason);
      const isSelected = idx === this.selectedIndex;

      return `
        <div class="course-match-item ${isSelected ? 'selected' : ''}" data-idx="${idx}">
          <div class="match-left">
            <div class="match-code-row">
              <span class="match-code">${c.id}</span>
              <span class="match-credits">${c.credits} cr</span>
              ${!isOfferedInTarget && targetSeason !== 'Summer' ? `
                <span class="badge-offering-mismatch" title="${c.id} is typically offered in ${offerings.join('/')} only">
                  ⚠️ ${offerings.join('/')} only
                </span>
              ` : `
                <span class="badge-offering-ok">${offerings.join('/')}</span>
              `}
              ${c.difficulty ? `<span class="badge-diff diff-${c.difficulty.toLowerCase()}">${c.difficulty}</span>` : ''}
            </div>
            <div class="match-title">${c.title}</div>
            ${c.prereqs_text ? `<div class="match-prereqs"><strong>Prereq:</strong> ${c.prereqs_text}</div>` : ''}
          </div>

          <div class="match-right">
            ${scheduledInTerm ? `
              <span class="badge-in-plan" title="Already scheduled in ${scheduledInTerm}">In ${scheduledInTerm}</span>
            ` : ''}
            <button type="button" class="btn-select-course" data-idx="${idx}">
              + Add
            </button>
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = html;

    // Attach click events
    listEl.querySelectorAll('.course-match-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(el.dataset.idx, 10);
        if (!isNaN(idx) && this.activeMatches[idx]) {
          this.selectCourse(this.activeMatches[idx]);
        }
      });

      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.dataset.idx, 10);
        if (!isNaN(idx)) {
          this.selectedIndex = idx;
          this.updateActiveItemVisual();
        }
      });
    });
  }

  selectCourse(course) {
    if (!course || this.targetTermIndex === null) return;
    this.close();

    if (window.sequencer && window.sequencer.addCourseToTerm) {
      window.sequencer.addCourseToTerm(this.targetTermIndex, course.id, course.credits);
    }
  }
}

// Global singleton instance
window.addCourseModal = new AddCourseModal(window.curriculumService);
