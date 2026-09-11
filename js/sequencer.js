/**
 * USAFA Advising Tool - Interactive Course Sequencer
 * Manages term columns, drag-and-drop course reordering, validation badges, credit counters, and card actions.
 */

class Sequencer {
  constructor(curriculumService, rulesEngine) {
    this.curriculum = curriculumService;
    this.rules = rulesEngine;
    this.container = null;
    this.currentMajorId = 'ME';
    this.currentTrackId = null;
    this.includeSummer = false;
    this.plan = null;
    this.draggedItem = null;
    this.onPlanChanged = null; // Callback for state updates
  }

  init(containerId, planChangedCallback) {
    this.container = document.getElementById(containerId);
    this.onPlanChanged = planChangedCallback;
    this.loadDefaultTemplate('ME');
  }

  loadDefaultTemplate(majorId) {
    this.currentMajorId = majorId;
    const major = this.curriculum.getMajor(majorId);
    if (!major) return;

    // Set default track
    const trackKeys = Object.keys(major.tracks || {});
    this.currentTrackId = trackKeys.length > 0 ? trackKeys[0] : null;

    // Build standard terms from suggested sequence
    const terms = [];
    const seq = major.suggested_sequence || [];

    seq.forEach((sTerm, idx) => {
      const year = 2023 + Math.floor(idx / 2);
      const season = sTerm.term_name.includes('Fall') ? 'Fall' : 'Spring';
      terms.push({
        id: sTerm.term_id,
        name: sTerm.term_name,
        season: season,
        year: year,
        courses: JSON.parse(JSON.stringify(sTerm.courses))
      });
    });

    this.plan = {
      cadet: {
        name: "Cadet User",
        major: major.name,
        majorId: majorId,
        track: this.currentTrackId,
        classYear: "2027",
        totalUnits: major.total_credits
      },
      terms: terms
    };

    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);
  }

  setPlan(newPlan) {
    this.plan = newPlan;
    if (newPlan.cadet && newPlan.cadet.majorId) {
      this.currentMajorId = newPlan.cadet.majorId;
      this.currentTrackId = newPlan.cadet.track;
    }
    // Guarantee strict chronological sorting of terms
    if (this.plan.terms) {
      const seasonWeights = { 'spring': 1, 'summer': 2, 'fall': 3 };
      this.plan.terms.sort((a, b) => {
        const keyA = (a.year || 2020) * 10 + (seasonWeights[(a.season || '').toLowerCase()] || 0);
        const keyB = (b.year || 2020) * 10 + (seasonWeights[(b.season || '').toLowerCase()] || 0);
        return keyA - keyB;
      });

      // Auto-enable summer view if plan contains summer courses (e.g. transfer/validation)
      const hasSummerCourses = this.plan.terms.some(t => 
        (t.isSummer || (t.season || '').toLowerCase() === 'summer') && t.courses && t.courses.length > 0
      );
      if (hasSummerCourses) {
        this.includeSummer = true;
        const toggleBtn = document.getElementById('btnToggleSummer');
        if (toggleBtn) {
          toggleBtn.innerText = '☀️ Hide Summer Terms';
          toggleBtn.classList.add('active');
        }
      }
    }
    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);
  }

  switchMajor(majorId) {
    this.currentMajorId = majorId;
    const major = this.curriculum.getMajor(majorId);
    if (!major) return;

    // Select default track for new major
    const trackKeys = Object.keys(major.tracks || {});
    this.currentTrackId = trackKeys.length > 0 ? trackKeys[0] : null;

    if (this.plan) {
      if (!this.plan.cadet) this.plan.cadet = {};
      this.plan.cadet.majorId = majorId;
      this.plan.cadet.major = major.name;
      this.plan.cadet.track = this.currentTrackId;
      this.plan.cadet.totalUnits = major.total_credits;
      this.render();
      if (this.onPlanChanged) this.onPlanChanged(this.plan);
    } else {
      this.loadDefaultTemplate(majorId);
    }
  }

  setTrack(trackId) {
    this.currentTrackId = trackId;
    if (this.plan && this.plan.cadet) {
      this.plan.cadet.track = trackId;
    }
    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);
  }

  toggleSummer(enable) {
    this.includeSummer = enable;
    // If enabling summer, insert summer terms if missing
    if (enable) {
      this.ensureSummerTerms();
    }
    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);
  }

  ensureSummerTerms() {
    if (!this.plan || !this.plan.terms) return;
    const newTerms = [];
    this.plan.terms.forEach(term => {
      newTerms.push(term);
      if (term.season === 'Spring') {
        const summerId = `summer_${term.year}`;
        const hasSummer = this.plan.terms.some(t => t.id === summerId);
        if (!hasSummer) {
          newTerms.push({
            id: summerId,
            name: `Summer ${term.year}`,
            season: 'Summer',
            year: term.year,
            isSummer: true,
            courses: []
          });
        }
      }
    });
    this.plan.terms = newTerms;
  }

  render() {
    if (!this.container || !this.plan) return;

    // Capture current scroll positions before replacing DOM
    const existingGrid = this.container.querySelector('.sequencer-grid');
    const savedGridScroll = existingGrid ? existingGrid.scrollLeft : 0;
    const mainContainer = document.querySelector('.main-view-container');
    const savedMainScroll = mainContainer ? mainContainer.scrollLeft : 0;
    const savedContainerScroll = this.container.scrollLeft || 0;
    const savedWindowX = window.scrollX || window.pageXOffset || 0;
    const savedWindowY = window.scrollY || window.pageYOffset || 0;

    // Run validation across all terms
    const validation = this.rules.validatePlan(this.plan.terms);

    this.container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sequencer-grid';

    const visibleTerms = this.plan.terms.filter(t => !t.isSummer || this.includeSummer);

    visibleTerms.forEach((term, termIndex) => {
      const col = document.createElement('div');
      col.className = 'term-column';
      col.dataset.termId = term.id;
      col.dataset.termIndex = termIndex;

      const stats = validation.termStats[term.id] || { totalCredits: 0, isOverloaded: false };

      // Header
      const header = document.createElement('div');
      header.className = `term-header ${stats.isOverloaded ? 'overloaded' : ''}`;
      header.innerHTML = `
        <div class="term-title-wrap">
          <h3 class="term-title">${term.name}</h3>
          <span class="credit-badge ${stats.isOverloaded ? (stats.overloadSeverity === 'severe' ? 'badge-severe' : 'badge-warning') : 'badge-normal'}">
            ${stats.totalCredits.toFixed(1)} sem hrs
          </span>
        </div>
        ${stats.isOverloaded ? `<div class="overload-flag"><i class="icon-warning"></i> +${stats.creditsOver} hrs Overload</div>` : ''}
      `;
      col.appendChild(header);

      // Drop Zone
      const cardList = document.createElement('div');
      cardList.className = 'card-list';
      cardList.dataset.termId = term.id;
      cardList.dataset.termIndex = termIndex;

      // Drag and Drop listeners on drop zone
      cardList.addEventListener('dragover', (e) => {
        this.handleDragOver(e);
        cardList.classList.add('drag-over');
      });
      cardList.addEventListener('dragleave', (e) => {
        if (!cardList.contains(e.relatedTarget)) {
          cardList.classList.remove('drag-over');
        }
      });
      cardList.addEventListener('drop', (e) => {
        cardList.classList.remove('drag-over');
        this.handleDrop(e, termIndex);
      });

      (term.courses || []).forEach((course, courseIndex) => {
        const card = this.createCourseCard(course, term, termIndex, courseIndex, validation);
        cardList.appendChild(card);
      });

      col.appendChild(cardList);

      // Add Course Button
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-add-course';
      addBtn.innerHTML = `<span>+ Add Course</span>`;
      addBtn.addEventListener('click', () => this.promptAddCourse(termIndex));
      col.appendChild(addBtn);

      grid.appendChild(col);
    });

    this.container.appendChild(grid);

    // Immediate scroll restoration
    if (savedGridScroll > 0) grid.scrollLeft = savedGridScroll;
    if (savedMainScroll > 0 && mainContainer) mainContainer.scrollLeft = savedMainScroll;
    if (savedContainerScroll > 0) this.container.scrollLeft = savedContainerScroll;
    window.scrollTo(savedWindowX, savedWindowY);

    // Frame-aligned restoration to ensure layout stabilization
    requestAnimationFrame(() => {
      if (savedGridScroll > 0) grid.scrollLeft = savedGridScroll;
      if (savedMainScroll > 0 && mainContainer) mainContainer.scrollLeft = savedMainScroll;
      if (savedContainerScroll > 0) this.container.scrollLeft = savedContainerScroll;
      window.scrollTo(savedWindowX, savedWindowY);
    });
  }

  createCourseCard(course, term, termIndex, courseIndex, validation) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.draggable = true;
    card.dataset.termIndex = termIndex;
    card.dataset.courseIndex = courseIndex;
    card.dataset.code = course.code;

    const key = this.curriculum.normalizeKey(course.code);
    const courseData = this.curriculum.getCourse(course.code);
    const issues = validation.courseIssues[`${term.id}_${key}`] || [];

    // Determine card category styling
    const coreDepts = ['MATH', 'PHYSICS', 'CHEM', 'ENGLISH', 'HISTORY', 'BEHSCI', 'ECON', 'LAW', 'PHILOS', 'POLSCI', 'SOCSCI', 'MSS', 'LDRSHP', 'FORLANG'];
    let catClass = 'cat-major';
    if (course.category === 'Core' || (courseData && coreDepts.includes(courseData.dept))) {
      catClass = 'cat-core';
    } else if (course.category === 'PE' || (courseData && courseData.dept === 'PHYED')) {
      catClass = 'cat-pe';
    } else if (course.category === 'Elective') {
      catClass = 'cat-elective';
    }

    card.className = `course-card ${catClass}`;

    // Header with code, credits, and remove button
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = `
      <div class="code-title-row">
        <span class="card-code">${course.code}</span>
        <span class="card-credits">${course.credits} cr</span>
        ${courseData && courseData.difficulty ? `<span class="badge-diff diff-${courseData.difficulty.toLowerCase()}">${courseData.difficulty}</span>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn-info" title="View Course Details & Advising Notes">ℹ️</button>
        <button class="btn-delete" title="Delete Course">×</button>
      </div>
    `;

    // Title
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    cardBody.innerHTML = `
      <div class="card-title">${courseData ? courseData.title : course.code}</div>
      ${course.grade ? `<span class="badge-grade">Grd: ${course.grade}</span>` : ''}
    `;

    card.appendChild(cardHeader);
    card.appendChild(cardBody);

    // Issues alert box if any (displayed at the bottom of the card)
    if (issues.length > 0) {
      const issueBox = document.createElement('div');
      issueBox.className = 'card-issues';
      issues.forEach(iss => {
        const issItem = document.createElement('div');
        issItem.className = `issue-pill ${iss.severity}`;
        issItem.innerText = iss.message;
        issueBox.appendChild(issItem);
      });
      card.appendChild(issueBox);
    }

    // Event listeners
    cardHeader.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.promptDeleteCourse(termIndex, courseIndex, course.code);
    });

    cardHeader.querySelector('.btn-info').addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.courseModal) window.courseModal.open(course.code);
    });

    // Dependency highlighting on hover
    card.addEventListener('mouseenter', () => this.highlightDependencies(course.code, true));
    card.addEventListener('mouseleave', () => this.highlightDependencies(course.code, false));

    // Drag events
    card.addEventListener('dragstart', (e) => this.handleDragStart(e, termIndex, courseIndex, course));
    card.addEventListener('dragend', () => this.handleDragEnd());

    return card;
  }

  handleDragStart(e, termIndex, courseIndex, course) {
    this.draggedItem = { termIndex, courseIndex, course };
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
  }

  handleDragEnd() {
    if (this.draggedItem) {
      const draggingEl = document.querySelector('.course-card.dragging');
      if (draggingEl) draggingEl.classList.remove('dragging');
      this.draggedItem = null;
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleDrop(e, targetTermIndex) {
    e.preventDefault();
    if (!this.draggedItem) return;

    const { termIndex: sourceTermIndex, courseIndex: sourceCourseIndex, course } = this.draggedItem;
    if (sourceTermIndex === targetTermIndex) return;

    // Remove from source term
    const [movedCourse] = this.plan.terms[sourceTermIndex].courses.splice(sourceCourseIndex, 1);
    
    // Add to target term
    this.plan.terms[targetTermIndex].courses.push(movedCourse);

    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);

    // Check if moving caused downstream issues
    const validation = this.rules.validatePlan(this.plan.terms);
    if (validation.totalIssues > 0) {
      // Notification toast or banner
      console.warn('Course moved with sequence alerts:', validation);
    }
  }

  addCourseToTerm(targetTermIndex, courseCode, customCredits = null) {
    if (!courseCode || !courseCode.trim() || targetTermIndex === undefined) return;
    const trimmed = courseCode.trim();
    const courseData = this.curriculum.getCourse(trimmed);
    const targetTerm = this.plan.terms[targetTermIndex];
    const targetTermName = targetTerm ? targetTerm.name : `Term ${targetTermIndex + 1}`;

    // 1. Check for existing duplicates across all terms in the schedule
    const normKey = this.curriculum.normalizeKey(trimmed);
    const baseKey = this.curriculum.getBaseCourseCode(trimmed);

    // Filter out repeatable military/co-op/colloquium/research courses
    const repeatablePrefixes = ['MILTNG', 'ARMNSHP', 'CLUBINTR', 'CE100', 'CE200', 'CE300', 'CE400', 'SMRRSCH'];
    const isRepeatable = repeatablePrefixes.some(p => normKey.startsWith(p)) || normKey.includes('499');

    if (!isRepeatable) {
      const existingInstances = [];
      (this.plan.terms || []).forEach((term, tIdx) => {
        (term.courses || []).forEach(c => {
          const cNorm = this.curriculum.normalizeKey(c.code);
          const cBase = this.curriculum.getBaseCourseCode(c.code);
          if (cNorm === normKey || (baseKey && (cNorm === baseKey || cBase === baseKey))) {
            existingInstances.push({
              code: c.code,
              termName: term.name,
              termIndex: tIdx
            });
          }
        });
      });

      if (existingInstances.length > 0) {
        const locationsStr = existingInstances.map(inst => `${inst.code} in ${inst.termName}`).join(', ');
        const isSameTerm = existingInstances.some(inst => inst.termIndex === targetTermIndex);

        const warningMsg = isSameTerm
          ? `Duplicate Course Warning:\n\n` +
            `You already have ${locationsStr}.\n\n` +
            `Are you sure you want to add another copy of ${courseData ? courseData.id : trimmed} to ${targetTermName}?\n\n` +
            `(Note: If you'd rather reschedule this class instead of taking it multiple times, click Cancel and simply drag and drop the existing card in the schedule.)`
          : `Duplicate Course Warning:\n\n` +
            `You already have ${locationsStr}.\n\n` +
            `Are you sure you want to add ${courseData ? courseData.id : trimmed} to ${targetTermName}, too?\n\n` +
            `(Note: If you'd rather reschedule this class instead of having two of them in your schedule, click Cancel and simply drag and drop the existing card to ${targetTermName}.)`;

        if (!confirm(warningMsg)) {
          return; // Abort addition
        }
      }
    }

    // 2. Check for missing prerequisites
    const prereqAnalysis = this.rules.analyzePrerequisitesForAddition(trimmed, targetTermIndex, this.plan.terms);

    if (prereqAnalysis.missingPrereqs.length > 0) {
      const prereqNames = prereqAnalysis.missingPrereqs.map(p => p.id).join(', ');
      const suggestionText = prereqAnalysis.suggestions.map(s => `• ${s.course.id} into ${s.suggestedTermName}`).join('\n');

      const confirmAdd = confirm(
        `Prerequisite Notice for ${courseData ? courseData.id : trimmed}:\n\n` +
        `This course requires: ${prereqNames} which are not yet scheduled in earlier terms.\n\n` +
        `Suggested Placement:\n${suggestionText}\n\n` +
        `Click OK to automatically add the prerequisites to prior terms and proceed, or CANCEL to place the course without adding prerequisites.`
      );

      if (confirmAdd) {
        // Auto-add prerequisites
        prereqAnalysis.suggestions.forEach(s => {
          this.plan.terms[s.suggestedTermIndex].courses.push({
            code: s.course.id,
            credits: s.course.credits,
            category: 'Major'
          });
        });
      }
    }

    // Add target course
    const credits = (customCredits !== null && !isNaN(customCredits)) 
      ? Number(customCredits) 
      : (courseData ? courseData.credits : 3.0);

    const category = (courseData && courseData.dept === 'PHYED') 
      ? 'PE' 
      : ((courseData && ['MATH','PHYSICS','CHEM','ENGLISH','HISTORY','BEHSCI','ECON','LAW','PHILOS','POLSCI','SOCSCI','MSS','LDRSHP','FORLANG'].includes(courseData.dept)) ? 'Core' : 'Major');

    this.plan.terms[targetTermIndex].courses.push({
      code: courseData ? courseData.id : trimmed.toUpperCase(),
      credits: credits,
      category: category
    });

    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);
  }

  promptAddCourse(targetTermIndex, prefillCode) {
    if (window.addCourseModal) {
      window.addCourseModal.open(targetTermIndex, prefillCode);
      return;
    }

    // Fallback if modal not yet loaded
    let courseCode = prefillCode;
    if (!courseCode || courseCode.toLowerCase().includes('option') || courseCode.toLowerCase().includes('depth')) {
      courseCode = prompt("Enter course code (e.g. MECH ENGR 341, MATH 243, ECON 201):", courseCode || "");
    }
    if (!courseCode || !courseCode.trim()) return;
    this.addCourseToTerm(targetTermIndex, courseCode);
  }

  promptDeleteCourse(termIndex, courseIndex, courseCode) {
    // Check if downstream courses depend on this
    const dependents = this.rules.findDownstreamDependents(courseCode, termIndex, this.plan.terms);

    if (dependents.length > 0) {
      const depList = dependents.map(d => `• ${d.course.id} (${d.termName}) [${d.relation}]`).join('\n');
      const confirmDelete = confirm(
        `Dependency Warning:\n\n` +
        `Deleting ${courseCode} will break prerequisites for downstream courses in your plan:\n${depList}\n\n` +
        `Are you sure you want to remove this course?`
      );
      if (!confirmDelete) return;
    }

    // Perform removal
    this.plan.terms[termIndex].courses.splice(courseIndex, 1);
    this.render();
    if (this.onPlanChanged) this.onPlanChanged(this.plan);
  }

  highlightDependencies(courseCode, highlight) {
    const key = this.curriculum.normalizeKey(courseCode);
    const courseData = this.curriculum.getCourse(courseCode);
    if (!courseData) return;

    const prereqKeys = new Set(courseData.prereq_keys || []);

    document.querySelectorAll('.course-card').forEach(card => {
      const cardKey = this.curriculum.normalizeKey(card.dataset.code);
      if (highlight) {
        if (prereqKeys.has(cardKey)) {
          card.classList.add('highlight-prereq');
        }
      } else {
        card.classList.remove('highlight-prereq');
      }
    });
  }
}

// Global instance
window.sequencer = new Sequencer(window.curriculumService, window.rulesEngine);
