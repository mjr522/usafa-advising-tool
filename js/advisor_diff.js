/**
 * USAFA Advising Tool - Advisor Plan Diff & COMPASS Action Item Generator
 * Compares on-record baseline plan (from COMPASS PDF) against cadet proposed plan,
 * rendering side-by-side visual diffs and copyable COMPASS registrar action checklists.
 */

class AdvisorDiffEngine {
  constructor(curriculumService, rulesEngine) {
    this.curriculum = curriculumService;
    this.rules = rulesEngine;
    this.baselinePlan = null;
    this.proposedPlan = null;
    this.container = null;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
  }

  setBaselinePlan(plan) {
    this.baselinePlan = plan;
    this.render();
  }

  setProposedPlan(plan) {
    this.proposedPlan = plan;
    this.render();
  }

  /**
   * Calculates detailed differences between baseline and proposed plans.
   */
  computeDiff() {
    if (!this.baselinePlan || !this.proposedPlan) return null;

    // Map: courseKey -> { termId, termName, course }
    const baselineMap = new Map();
    (this.baselinePlan.terms || []).forEach(term => {
      (term.courses || []).forEach(c => {
        const key = this.curriculum.normalizeKey(c.code);
        baselineMap.set(key, { termId: term.id, termName: term.name, course: c });
      });
    });

    const proposedMap = new Map();
    (this.proposedPlan.terms || []).forEach(term => {
      (term.courses || []).forEach(c => {
        const key = this.curriculum.normalizeKey(c.code);
        proposedMap.set(key, { termId: term.id, termName: term.name, course: c });
      });
    });

    const added = [];
    const dropped = [];
    const moved = [];
    const unchanged = [];

    // Find added or moved courses
    proposedMap.forEach((pVal, key) => {
      if (!baselineMap.has(key)) {
        added.push({
          code: pVal.course.code,
          credits: pVal.course.credits,
          toTerm: pVal.termName
        });
      } else {
        const bVal = baselineMap.get(key);
        if (bVal.termName !== pVal.termName) {
          moved.push({
            code: pVal.course.code,
            credits: pVal.course.credits,
            fromTerm: bVal.termName,
            toTerm: pVal.termName
          });
        } else {
          unchanged.push(pVal.course.code);
        }
      }
    });

    // Find dropped courses
    baselineMap.forEach((bVal, key) => {
      if (!proposedMap.has(key)) {
        dropped.push({
          code: bVal.course.code,
          credits: bVal.course.credits,
          fromTerm: bVal.termName
        });
      }
    });

    // Validate proposed plan to ensure no new errors are introduced
    const proposedValidation = this.rules.validatePlan(this.proposedPlan.terms);

    return {
      added,
      dropped,
      moved,
      unchanged,
      totalChanges: added.length + dropped.length + moved.length,
      validation: proposedValidation
    };
  }

  generateActionItemsText(diff) {
    if (!diff || diff.totalChanges === 0) {
      return "No changes detected between baseline and proposed plans.";
    }

    const lines = [
      `==================================================`,
      `USAFA ACADEMIC ADVISING - COMPASS ACTION ITEMS`,
      `Cadet: ${this.proposedPlan.cadet?.name || 'Cadet'} | Major: ${this.proposedPlan.cadet?.major || 'ME'}`,
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      `Total Changes: ${diff.totalChanges} (${diff.moved.length} Moved, ${diff.added.length} Added, ${diff.dropped.length} Dropped)`,
      `==================================================\n`
    ];

    let itemNum = 1;

    if (diff.moved.length > 0) {
      lines.push(`--- COURSE RESCHEDULING / MOVES ---`);
      diff.moved.forEach(m => {
        lines.push(`${itemNum++}. [MOVE] ${m.code} (${m.credits} cr) FROM ${m.fromTerm} TO ${m.toTerm}`);
      });
      lines.push("");
    }

    if (diff.added.length > 0) {
      lines.push(`--- COURSES TO ADD ---`);
      diff.added.forEach(a => {
        lines.push(`${itemNum++}. [ADD]  ${a.code} (${a.credits} cr) TO ${a.toTerm}`);
      });
      lines.push("");
    }

    if (diff.dropped.length > 0) {
      lines.push(`--- COURSES TO DROP / REMOVE ---`);
      diff.dropped.forEach(d => {
        lines.push(`${itemNum++}. [DROP] ${d.code} (${d.credits} cr) FROM ${d.fromTerm}`);
      });
      lines.push("");
    }

    if (diff.validation.totalIssues > 0) {
      lines.push(`--- ADVISOR ATTENTION REQUIRED ---`);
      lines.push(`* Note: Proposed plan contains ${diff.validation.totalIssues} warning/overload alert(s) that should be reviewed.`);
    }

    return lines.join("\n");
  }

  render() {
    if (!this.container) return;

    if (!this.baselinePlan || !this.proposedPlan) {
      this.container.innerHTML = `
        <div class="diff-empty-state">
          <div class="diff-card-prompt">
            <h3>Advisor Plan Comparison & Diff Engine</h3>
            <p>Compare the on-record COMPASS plan against the cadet's proposed course sequence to produce an instant registrar change checklist.</p>
            <div class="diff-setup-grid">
              <div class="diff-setup-box">
                <h4>1. On-Record Baseline</h4>
                <p>${this.baselinePlan ? `✅ Loaded: ${this.baselinePlan.cadet?.major || 'Plan'}` : 'Not loaded yet'}</p>
                <button class="btn-diff-action" id="btnLoadBaselinePDF">Upload COMPASS PDF</button>
              </div>
              <div class="diff-setup-box">
                <h4>2. Proposed Cadet Plan</h4>
                <p>${this.proposedPlan ? `✅ Loaded: ${this.proposedPlan.cadet?.major || 'Plan'}` : 'Active planner plan loaded'}</p>
                <button class="btn-diff-action" id="btnUseCurrentPlanner">Use Current Planner Plan</button>
                <button class="btn-diff-action secondary" id="btnLoadProposedJSON">Import Cadet JSON</button>
              </div>
            </div>
          </div>
        </div>
      `;
      this.bindEmptyStateButtons();
      return;
    }

    const diff = this.computeDiff();
    const actionText = this.generateActionItemsText(diff);

    this.container.innerHTML = `
      <div class="diff-view-header">
        <div class="diff-header-left">
          <h2>Advisor Plan Comparison</h2>
          <span class="diff-summary-badge ${diff.totalChanges > 0 ? 'badge-changes' : 'badge-clean'}">
            ${diff.totalChanges} Changes Requested
          </span>
        </div>
        <div class="diff-header-actions">
          <button class="btn-copy-actions" id="btnCopyActions">📋 Copy COMPASS Action Items</button>
          <button class="btn-reset-diff" id="btnResetDiff">Reset Comparison</button>
        </div>
      </div>

      <!-- Action Items Punch-List Box -->
      <div class="action-items-panel">
        <div class="panel-header">
          <h3>COMPASS Registrar Action Items Checklist</h3>
          <span class="panel-subtitle">Copy and execute these steps directly in COMPASS / SIS</span>
        </div>
        <pre class="action-items-pre" id="actionItemsPre">${actionText}</pre>
      </div>

      <!-- Visual Breakdown Cards -->
      <div class="diff-breakdown-grid">
        <!-- Moved Courses -->
        <div class="diff-category-card card-moved">
          <div class="cat-header">
            <h4>Rescheduled / Moved Courses (${diff.moved.length})</h4>
          </div>
          <div class="diff-item-list">
            ${diff.moved.length === 0 ? '<div class="diff-empty">No courses moved</div>' : diff.moved.map(m => `
              <div class="diff-row moved">
                <span class="diff-code">${m.code}</span>
                <span class="diff-path">${m.fromTerm} ➔ <strong class="to-term">${m.toTerm}</strong></span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Added Courses -->
        <div class="diff-category-card card-added">
          <div class="cat-header">
            <h4>Added Courses (${diff.added.length})</h4>
          </div>
          <div class="diff-item-list">
            ${diff.added.length === 0 ? '<div class="diff-empty">No new courses added</div>' : diff.added.map(a => `
              <div class="diff-row added">
                <span class="diff-code">+ ${a.code}</span>
                <span class="diff-path">Scheduled in <strong>${a.toTerm}</strong> (${a.credits} cr)</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Dropped Courses -->
        <div class="diff-category-card card-dropped">
          <div class="cat-header">
            <h4>Dropped Courses (${diff.dropped.length})</h4>
          </div>
          <div class="diff-item-list">
            ${diff.dropped.length === 0 ? '<div class="diff-empty">No courses dropped</div>' : diff.dropped.map(d => `
              <div class="diff-row dropped">
                <span class="diff-code">- ${d.code}</span>
                <span class="diff-path">Removed from <strong>${d.fromTerm}</strong> (${d.credits} cr)</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Hook up copy button
    const copyBtn = document.getElementById('btnCopyActions');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(actionText).then(() => {
          copyBtn.innerText = "✅ Copied to Clipboard!";
          setTimeout(() => { copyBtn.innerText = "📋 Copy COMPASS Action Items"; }, 2500);
        });
      });
    }

    const resetBtn = document.getElementById('btnResetDiff');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.baselinePlan = null;
        this.proposedPlan = null;
        this.render();
      });
    }
  }

  bindEmptyStateButtons() {
    const btnUseCurrent = document.getElementById('btnUseCurrentPlanner');
    if (btnUseCurrent && window.sequencer) {
      btnUseCurrent.addEventListener('click', () => {
        this.proposedPlan = JSON.parse(JSON.stringify(window.sequencer.plan));
        this.render();
      });
    }

    const btnLoadBaseline = document.getElementById('btnLoadBaselinePDF');
    if (btnLoadBaseline) {
      btnLoadBaseline.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf';
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (file && window.pdfIngestService) {
            try {
              const res = await window.pdfIngestService.parsePDFReport(file);
              if (res.type === 'APS') {
                this.baselinePlan = res.data;
                this.render();
              } else {
                alert('Uploaded PDF is not an Academic Program Summary (APS).');
              }
            } catch (err) {
              alert('Error reading PDF: ' + err.message);
            }
          }
        };
        fileInput.click();
      });
    }

    const btnLoadProposed = document.getElementById('btnLoadProposedJSON');
    if (btnLoadProposed) {
      btnLoadProposed.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              try {
                this.proposedPlan = JSON.parse(evt.target.result);
                this.render();
              } catch (err) {
                alert('Invalid JSON plan file.');
              }
            };
            reader.readAsText(file);
          }
        };
        fileInput.click();
      });
    }
  }
}

// Global instance
window.advisorDiffEngine = new AdvisorDiffEngine(window.curriculumService, window.rulesEngine);
