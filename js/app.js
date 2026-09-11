/**
 * USAFA Advising Tool - Main Application Controller
 * Coordinates UI views, event bindings, PDF uploads, plan export/import, and major/track selection.
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing USAFA Advising Tool...');

  try {
    // 1. Load curriculum data
    await window.curriculumService.load();
    window.curriculumService.applyCustomAdvisorTips();

    // 2. Initialize components
    window.sequencer.init('sequencerContainer', onPlanChanged);
    window.gradCheckEngine.init('gradCheckDrawer');
    window.advisorDiffEngine.init('diffViewContainer');
    window.courseModal.init('courseDetailsModal');
    if (window.addCourseModal) window.addCourseModal.init('addCourseModal');
    if (window.aicPortal) window.aicPortal.init('aicDeclarationModal');
    if (window.cadetWizard) window.cadetWizard.init('cadetWizardModal');

    // 3. Setup UI Controls & Event Listeners
    setupHeaderControls();
    setupIngestAndExport();
    setupNavigationTabs();

    // Initial audit sync
    syncGradCheck(window.sequencer.plan);

  } catch (err) {
    console.error('Fatal initialization error:', err);
    alert('Failed to load curriculum data. Please ensure curriculum_data.json exists.');
  }
});

function onPlanChanged(plan) {
  syncGradCheck(plan);
}

function syncGradCheck(plan) {
  window.syncGradCheck = syncGradCheck;
  if (!plan) return;
  const audit = window.gradCheckEngine.auditPlan(plan);
  if (!audit) return;

  // Update top banner indicator
  const gradSummaryBtn = document.getElementById('btnOpenGradCheck');
  if (gradSummaryBtn) {
    gradSummaryBtn.innerHTML = `
      <span>🎓 Grad Check: <strong>${audit.percentFulfill}%</strong> (${audit.totalCredits.toFixed(1)} / ${audit.requiredCredits} hrs)</span>
    `;
  }

  // Update drawer content
  window.gradCheckEngine.renderDrawer(plan, (courseCode) => {
    // 1-Click Add Missing Course to Schedule
    const optimalTerm = findOptimalTermForCourse(courseCode, plan.terms);
    window.sequencer.promptAddCourse(optimalTerm, courseCode);
  });
}

function findOptimalTermForCourse(courseCode, terms) {
  const cData = window.curriculumService.getCourse(courseCode);
  const offerings = cData ? cData.semesters_offered || ['Fall', 'Spring'] : ['Fall', 'Spring'];

  // Find the earliest term matching offering that has reasonable load
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const season = t.season || (t.name.includes('Fall') ? 'Fall' : 'Spring');
    if (offerings.includes(season)) {
      const load = (t.courses || []).reduce((acc, cur) => acc + (cur.credits || 0), 0);
      if (load < 19.5) return i;
    }
  }
  return terms.length - 1; // default to senior spring
}

function setupHeaderControls() {
  const majorSelect = document.getElementById('majorSelector');
  const trackSelect = document.getElementById('trackSelector');
  const toggleSummerBtn = document.getElementById('btnToggleSummer');
  const resetTemplateBtn = document.getElementById('btnResetTemplate');

  // Populate Tracks for active major
  function updateTracks(majorId) {
    const major = window.curriculumService.getMajor(majorId);
    if (!major || !major.tracks) {
      trackSelect.innerHTML = '<option value="">None / No Track</option>';
      return;
    }

    let optionsHtml = '';
    if (majorId === 'ME') {
      optionsHtml += '<option value="none">None / General ME (No Track)</option>';
    }

    optionsHtml += Object.entries(major.tracks).map(([k, t]) => `
      <option value="${k}">${t.name}${majorId === 'ME' ? ' (Advisory)' : ''}</option>
    `).join('');

    trackSelect.innerHTML = optionsHtml;

    const defaultTrack = majorId === 'ME' ? 'none' : Object.keys(major.tracks)[0];
    trackSelect.value = defaultTrack;
    window.sequencer.setTrack(defaultTrack);
  }

  if (majorSelect) {
    majorSelect.addEventListener('change', (e) => {
      const newMajor = e.target.value;
      window.sequencer.switchMajor(newMajor);
      updateTracks(newMajor);
    });
    // Init tracks
    window.updateTracks = updateTracks;
    updateTracks(majorSelect.value);
  }

  if (trackSelect) {
    trackSelect.addEventListener('change', (e) => {
      window.sequencer.setTrack(e.target.value);
    });
  }

  if (toggleSummerBtn) {
    let summerOn = false;
    toggleSummerBtn.addEventListener('click', () => {
      summerOn = !summerOn;
      toggleSummerBtn.classList.toggle('active', summerOn);
      toggleSummerBtn.innerText = summerOn ? '☀️ Hide Summer Terms' : '☀️ Show Summer Terms';
      window.sequencer.toggleSummer(summerOn);
    });
  }

  if (resetTemplateBtn) {
    resetTemplateBtn.addEventListener('click', () => {
      if (confirm('Reset schedule to standard recommended major sequence? All custom changes will be overwritten.')) {
        window.sequencer.loadDefaultTemplate(majorSelect.value);
        updateTracks(majorSelect.value);
      }
    });
  }

  // AIC Portal & Cadet Wizard Open
  const btnOpenAic = document.getElementById('btnOpenAicPortal');
  if (btnOpenAic) {
    btnOpenAic.addEventListener('click', () => {
      if (window.aicPortal) window.aicPortal.open();
    });
  }

  const btnOpenCadetWiz = document.getElementById('btnOpenCadetWizard');
  if (btnOpenCadetWiz) {
    btnOpenCadetWiz.addEventListener('click', () => {
      if (window.cadetWizard) window.cadetWizard.open(1);
    });
  }

  // Grad Check Drawer Open/Close
  const btnOpenGrad = document.getElementById('btnOpenGradCheck');
  if (btnOpenGrad) {
    btnOpenGrad.addEventListener('click', () => {
      window.gradCheckEngine.open();
    });
  }

  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', () => {
      window.gradCheckEngine.close();
    });
  }
}

function setupIngestAndExport() {
  const filePdfInput = document.getElementById('pdfFileInput');
  const btnUploadPdf = document.getElementById('btnUploadPdf');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnImportJson = document.getElementById('btnImportJson');
  const fileJsonInput = document.getElementById('jsonFileInput');

  if (btnUploadPdf && filePdfInput) {
    btnUploadPdf.addEventListener('click', () => filePdfInput.click());

    filePdfInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      btnUploadPdf.innerText = "⏳ Ingesting PDF...";
      btnUploadPdf.disabled = true;

      try {
        const result = await window.pdfIngestService.parsePDFReport(file);
        
        if (result.type === 'APS') {
          const parsed = result.data;
          
          // Map to sequencer plan
          const majorKey = (parsed.cadet.major || '').toLowerCase().includes('systems') ? 'SE' : 'ME';
          const majorSelect = document.getElementById('majorSelector');
          if (majorSelect) majorSelect.value = majorKey;
          if (window.updateTracks) window.updateTracks(majorKey);

          window.sequencer.setPlan({
            cadet: {
              name: "Cadet Record",
              major: parsed.cadet.major || "Mechanical Engineering",
              majorId: majorKey,
              classYear: parsed.cadet.classYear || "2027",
              emplid: parsed.cadet.emplid || "",
              cumGpa: parsed.cadet.cumGpa || "",
              totalUnits: parsed.cadet.totalUnits || 0
            },
            terms: parsed.terms
          });

          // Also set as baseline in advisor diff engine
          window.advisorDiffEngine.setBaselinePlan(parsed);

          alert(`Successfully ingested APS for Class of ${parsed.cadet.classYear}!\nFound ${parsed.terms.length} academic & summer terms with ${parsed.cadet.totalUnits} credit hours.`);
        } else if (result.type === 'GRAD_CHECK') {
          alert(`Ingested GradCheck Report!\nSatisfied Requirements: ${result.data.satisfied.length}\nMissing Requirements: ${result.data.missing.length}`);
          window.gradCheckEngine.open();
        } else {
          alert("Parsed PDF document but could not determine standard COMPASS header.");
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse PDF report: ' + err.message);
      } finally {
        btnUploadPdf.innerText = "📄 Ingest COMPASS PDF";
        btnUploadPdf.disabled = false;
        filePdfInput.value = '';
      }
    });
  }

  // Export JSON
  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      if (!window.sequencer.plan) return;
      const jsonStr = JSON.stringify(window.sequencer.plan, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const major = window.sequencer.plan.cadet?.majorId || 'USAFA';
      a.href = url;
      a.download = `Academic_Plan_${major}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Import JSON
  if (btnImportJson && fileJsonInput) {
    btnImportJson.addEventListener('click', () => fileJsonInput.click());

    fileJsonInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const loadedPlan = JSON.parse(evt.target.result);
          window.sequencer.setPlan(loadedPlan);
          const majorSelect = document.getElementById('majorSelector');
          if (majorSelect && loadedPlan.cadet && loadedPlan.cadet.majorId) {
            majorSelect.value = loadedPlan.cadet.majorId;
            if (window.updateTracks) window.updateTracks(loadedPlan.cadet.majorId);
          }
          alert('Academic plan loaded successfully!');
        } catch (err) {
          alert('Failed to parse JSON plan file.');
        }
      };
      reader.readAsText(file);
      fileJsonInput.value = '';
    });
  }
}

function setupNavigationTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const viewSequencer = document.getElementById('viewSequencer');
  const viewAdvisorDiff = document.getElementById('viewAdvisorDiff');
  const viewCatalog = document.getElementById('viewCatalog');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.view;
      if (target === 'sequencer') {
        viewSequencer.classList.remove('hidden');
        viewAdvisorDiff.classList.add('hidden');
        viewCatalog.classList.add('hidden');
      } else if (target === 'diff') {
        viewSequencer.classList.add('hidden');
        viewAdvisorDiff.classList.remove('hidden');
        viewCatalog.classList.add('hidden');
        // If proposed plan not loaded, use sequencer's current plan
        if (!window.advisorDiffEngine.proposedPlan && window.sequencer.plan) {
          window.advisorDiffEngine.setProposedPlan(JSON.parse(JSON.stringify(window.sequencer.plan)));
        } else {
          window.advisorDiffEngine.render();
        }
      } else if (target === 'catalog') {
        viewSequencer.classList.add('hidden');
        viewAdvisorDiff.classList.add('hidden');
        viewCatalog.classList.remove('hidden');
        renderCourseCatalogExplorer();
      }
    });
  });
}

function renderCourseCatalogExplorer() {
  const container = document.getElementById('catalogContent');
  if (!container || !window.curriculumService.data) return;

  const courses = Object.values(window.curriculumService.data.courses);
  
  container.innerHTML = `
    <div class="catalog-header-bar">
      <div class="cat-header-top-row">
        <div>
          <h2>USAFA Course of Instruction (COI) Catalog</h2>
          <p class="catalog-subhead">Search and explore 760+ courses, review advising pro-tips, and add courses directly to your schedule.</p>
        </div>
        <div class="catalog-advisor-actions">
          <button id="btnExportAllNotes" class="btn-cat-action" title="Export all custom advisor notes to a JSON file">📤 Export Notes</button>
          <button id="btnImportAllNotes" class="btn-cat-action" title="Import advisor notes from a JSON file">📥 Import Notes</button>
          <button id="btnEmailAllNotes" class="btn-cat-action" title="Email all custom advisor notes to Dr. Richards">✉️ Email All to AIC</button>
          <input type="file" id="importNotesFileInput" accept=".json" style="display: none;" />
        </div>
      </div>
      <div class="catalog-search-wrap">
        <input type="text" id="catalogSearchInput" class="form-control" placeholder="Search by course code, title, department, or keyword (e.g. MECH ENGR 341, thermo, 243, econ)..." />
      </div>
    </div>
    <div class="catalog-grid" id="catalogCardsContainer"></div>
  `;

  const cardsContainer = document.getElementById('catalogCardsContainer');
  const searchInput = document.getElementById('catalogSearchInput');

  function filterCards(query) {
    const q = query.toLowerCase().trim();
    const filtered = courses.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.dept.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    ).slice(0, 60); // top 60 matches

    cardsContainer.innerHTML = filtered.map(c => `
      <div class="catalog-card" data-code="${c.id}">
        <div class="cat-card-header">
          <span class="cat-code">${c.id}</span>
          <span class="cat-credits">${c.credits} cr</span>
        </div>
        <div class="cat-title">${c.title}</div>
        <div class="cat-meta">
          <span>📅 ${(c.semesters_offered || []).join('/')}</span>
          <span class="badge-diff diff-${(c.difficulty || 'moderate').toLowerCase()}">${c.difficulty || 'Moderate'}</span>
        </div>
        <p class="cat-desc">${c.description ? c.description.slice(0, 160) + '...' : ''}</p>
        <div class="cat-card-btn-row">
          <button class="btn-catalog-view" data-code="${c.id}">ℹ️ Details & Notes</button>
          <button class="btn-catalog-schedule" data-code="${c.id}">📅 + Schedule</button>
        </div>
      </div>
    `).join('');

    cardsContainer.querySelectorAll('.btn-catalog-view').forEach(btn => {
      btn.addEventListener('click', () => {
        window.courseModal.open(btn.dataset.code);
      });
    });

    cardsContainer.querySelectorAll('.btn-catalog-schedule').forEach(btn => {
      btn.addEventListener('click', () => {
        window.courseModal.open(btn.dataset.code);
        // Automatically reveal schedule picker in modal
        const picker = document.getElementById('modalSchedPicker');
        if (picker) picker.classList.remove('hidden');
      });
    });
  }

  filterCards('');

  searchInput.addEventListener('input', (e) => {
    filterCards(e.target.value);
  });

  // Wire up Bulk Advisor Notes Tools
  const btnExport = document.getElementById('btnExportAllNotes');
  const btnImport = document.getElementById('btnImportAllNotes');
  const btnEmail = document.getElementById('btnEmailAllNotes');
  const fileInput = document.getElementById('importNotesFileInput');

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const customTips = localStorage.getItem('usafa_advisor_tips') || '{}';
      const blob = new Blob([customTips], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usafa_advisor_notes_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid format');
          
          const existing = JSON.parse(localStorage.getItem('usafa_advisor_tips') || '{}');
          const merged = { ...existing, ...parsed };
          localStorage.setItem('usafa_advisor_tips', JSON.stringify(merged));
          
          window.curriculumService.applyCustomAdvisorTips();
          filterCards(searchInput.value);
          if (window.sequencer) window.sequencer.render();
          
          alert(`Successfully imported advisor notes for ${Object.keys(parsed).length} course(s)!`);
        } catch (err) {
          alert('Failed to parse advisor notes file. Ensure it is valid JSON.');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  if (btnEmail) {
    btnEmail.addEventListener('click', () => {
      const customTips = localStorage.getItem('usafa_advisor_tips') || '{}';
      const parsed = JSON.parse(customTips);
      const count = Object.keys(parsed).length;

      if (count === 0) {
        alert('No custom advisor notes found in your local browser storage to email. Edit notes on course cards first.');
        return;
      }

      const emailRecipient = 'michael.richards@afacademy.af.edu';
      const emailSubject = encodeURIComponent(`[ESME Advising Tool] Bulk Advisor Notes Submission (${count} courses)`);
      const emailBody = encodeURIComponent(
        `USAFA Department of Mechanical Engineering (ESME)\n` +
        `Bulk Advisor Notes Submission\n\n` +
        `Total courses updated: ${count}\n\n` +
        `--- JSON EXPORT ---\n` +
        `${JSON.stringify(parsed, null, 2)}\n`
      );

      window.open(`mailto:${emailRecipient}?subject=${emailSubject}&body=${emailBody}`, '_blank');
    });
  }
}
