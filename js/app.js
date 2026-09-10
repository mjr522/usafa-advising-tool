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
      trackSelect.innerHTML = '<option value="">No Specialization Tracks</option>';
      return;
    }

    trackSelect.innerHTML = Object.entries(major.tracks).map(([k, t]) => `
      <option value="${k}">${t.name}</option>
    `).join('');

    const defaultTrack = Object.keys(major.tracks)[0];
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
      <h2>USAFA Course of Instruction (COI) Catalog</h2>
      <div class="catalog-search-wrap">
        <input type="text" id="catalogSearchInput" class="form-control" placeholder="Search by course code, title, department, or keyword..." />
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
        <button class="btn-catalog-view" data-code="${c.id}">View Details & Advising Notes</button>
      </div>
    `).join('');

    cardsContainer.querySelectorAll('.btn-catalog-view').forEach(btn => {
      btn.addEventListener('click', () => {
        window.courseModal.open(btn.dataset.code);
      });
    });
  }

  filterCards('');

  searchInput.addEventListener('input', (e) => {
    filterCards(e.target.value);
  });
}
