/**
 * USAFA Advising Tool - Rules & Validation Engine
 * Evaluates prerequisites, corequisites, term offerings, credit overloads, and downstream dependencies.
 */

class RulesEngine {
  constructor(curriculumService) {
    this.curriculum = curriculumService;
    this.standardOverloadLimit = 19.5; // Normal semester limit
    this.maxOverloadLimit = 21.5;      // Hard cap requiring approval
  }

  setOverloadLimits(standardLimit, maxLimit) {
    if (standardLimit) this.standardOverloadLimit = standardLimit;
    if (maxLimit) this.maxOverloadLimit = maxLimit;
  }

  /**
   * Evaluates the entire plan and returns issues per semester and per course.
   * @param {Array} terms - Array of term objects [{id, name, season, year, courses: [{code, credits, ...}]}]
   */
  validatePlan(terms) {
    const results = {
      termStats: {},
      courseIssues: {},
      totalIssues: 0,
      overloadCount: 0,
      prereqViolations: 0,
      offeringViolations: 0
    };

    // Track course placements by key across all terms
    // Map: courseKey -> [{termIndex, termId, courseObj}]
    const courseLocations = new Map();

    terms.forEach((term, tIdx) => {
      let termCredits = 0;
      (term.courses || []).forEach(course => {
        const key = this.curriculum.normalizeKey(course.code);
        const baseKey = this.curriculum.getBaseCourseCode(course.code);
        termCredits += (course.credits || 0);

        // Record under both the exact key and the base equivalent key
        new Set([key, baseKey]).forEach(k => {
          if (!courseLocations.has(k)) {
            courseLocations.set(k, []);
          }
          courseLocations.get(k).push({ termIndex: tIdx, termId: term.id, course });
        });
      });

      // Check credit overload
      let isOverloaded = false;
      let overloadSeverity = 'normal'; // 'normal', 'warning', 'severe'
      if (termCredits > this.maxOverloadLimit) {
        isOverloaded = true;
        overloadSeverity = 'severe';
        results.overloadCount++;
      } else if (termCredits > this.standardOverloadLimit) {
        isOverloaded = true;
        overloadSeverity = 'warning';
        results.overloadCount++;
      }

      results.termStats[term.id] = {
        totalCredits: termCredits,
        isOverloaded,
        overloadSeverity,
        creditsOver: isOverloaded ? (termCredits - this.standardOverloadLimit).toFixed(1) : 0
      };
    });

    // Check each course's prerequisites, corequisites, and offering term
    terms.forEach((term, tIdx) => {
      const season = term.season || (term.name.toLowerCase().includes('fall') ? 'Fall' : (term.name.toLowerCase().includes('spring') ? 'Spring' : 'Summer'));
      const year = term.year || 2026;

      (term.courses || []).forEach(cItem => {
        const key = this.curriculum.normalizeKey(cItem.code);
        const courseData = this.curriculum.getCourse(cItem.code);
        const issues = [];

        if (courseData) {
          // 1. Offering Term Check (Only check planned courses that have not been completed)
          const isCompleted = cItem.status === 'Completed' || cItem.isValidated || (cItem.grade && cItem.grade !== '*' && cItem.grade !== 'F');
          if (season !== 'Summer' && !isCompleted) {
            let offered = courseData.semesters_offered || ['Fall', 'Spring'];
            const baseData = this.curriculum.getCourse(this.curriculum.getBaseCourseCode(cItem.code));
            if (baseData && baseData.semesters_offered) {
              offered = Array.from(new Set([...offered, ...baseData.semesters_offered]));
            }
            if (!offered.includes(season)) {
              issues.push({
                type: 'offering',
                severity: 'warning',
                message: `${courseData.id} ${offered.map(s => s.toLowerCase()).join('/')} only`
              });
              results.offeringViolations++;
            }
          }

          // Even / Odd year check for specialized electives (planned courses only)
          if (!isCompleted) {
            if (courseData.even_years_only && year % 2 !== 0) {
              issues.push({
                type: 'offering_year',
                severity: 'warning',
                message: `${courseData.id} even years only`
              });
            } else if (courseData.odd_years_only && year % 2 === 0) {
              issues.push({
                type: 'offering_year',
                severity: 'warning',
                message: `${courseData.id} odd years only`
              });
            }
          }

          // 2. Prerequisite Check (Supports course equivalences e.g. CS 110S satisfies CS 110, Math 253 satisfies Math 243)
          const prereqKeys = courseData.prereq_keys || [];
          prereqKeys.forEach(pKey => {
            const basePKey = this.curriculum.getBaseCourseCode(pKey);
            const locs = courseLocations.get(pKey) || courseLocations.get(basePKey);
            if (!locs || locs.length === 0) {
              const pCourse = this.curriculum.getCourse(pKey);
              const pTitle = pCourse ? pCourse.id : pKey;
              issues.push({
                type: 'missing_prereq',
                severity: 'error',
                prereqKey: pKey,
                message: `prereq: ${pTitle}`
              });
              results.prereqViolations++;
            } else {
              // Check if all instances are in earlier terms
              const earliestLoc = Math.min(...locs.map(l => l.termIndex));
              if (earliestLoc >= tIdx) {
                const pCourse = this.curriculum.getCourse(pKey);
                const pTitle = pCourse ? pCourse.id : pKey;
                issues.push({
                  type: 'out_of_sequence',
                  severity: 'error',
                  prereqKey: pKey,
                  message: `prereq: ${pTitle} (${earliestLoc === tIdx ? 'same sem' : 'scheduled later'})`
                });
                results.prereqViolations++;
              }
            }
          });

          // 3. Corequisite Check
          const coreqKeys = courseData.coreq_keys || [];
          coreqKeys.forEach(cKey => {
            const baseCKey = this.curriculum.getBaseCourseCode(cKey);
            const locs = courseLocations.get(cKey) || courseLocations.get(baseCKey);
            if (!locs || locs.length === 0) {
              const cCourse = this.curriculum.getCourse(cKey);
              const cTitle = cCourse ? cCourse.id : cKey;
              issues.push({
                type: 'missing_coreq',
                severity: 'warning',
                coreqKey: cKey,
                message: `coreq: ${cTitle}`
              });
            } else {
              const earliestLoc = Math.min(...locs.map(l => l.termIndex));
              if (earliestLoc > tIdx) {
                const cCourse = this.curriculum.getCourse(cKey);
                const cTitle = cCourse ? cCourse.id : cKey;
                issues.push({
                  type: 'coreq_out_of_sequence',
                  severity: 'warning',
                  coreqKey: cKey,
                  message: `coreq: ${cTitle} (scheduled later)`
                });
              }
            }
          });
        }

        if (issues.length > 0) {
          results.courseIssues[`${term.id}_${key}`] = issues;
          results.totalIssues += issues.length;
        }
      });
    });

    return results;
  }

  /**
   * When user wants to add courseCode to targetTermIndex:
   * Finds any missing prerequisites and recommends valid prior terms to insert them.
   */
  analyzePrerequisitesForAddition(courseCode, targetTermIndex, terms) {
    const courseData = this.curriculum.getCourse(courseCode);
    if (!courseData) return { missingPrereqs: [], suggestions: [] };

    const prereqKeys = courseData.prereq_keys || [];
    if (prereqKeys.length === 0) return { missingPrereqs: [], suggestions: [] };

    // Identify courses currently scheduled before targetTermIndex
    const scheduledPriorKeys = new Set();
    for (let i = 0; i < targetTermIndex; i++) {
      (terms[i].courses || []).forEach(c => {
        scheduledPriorKeys.add(this.curriculum.normalizeKey(c.code));
        scheduledPriorKeys.add(this.curriculum.getBaseCourseCode(c.code));
      });
    }

    const missingPrereqs = [];
    const suggestions = [];

    prereqKeys.forEach(pKey => {
      const basePKey = this.curriculum.getBaseCourseCode(pKey);
      if (!scheduledPriorKeys.has(pKey) && !scheduledPriorKeys.has(basePKey)) {
        const pData = this.curriculum.getCourse(pKey);
        if (pData) {
          missingPrereqs.push(pData);

          // Find optimal prior term (one offering the course with lowest credit load)
          let bestTermIndex = -1;
          let lowestCredits = 999;

          for (let i = targetTermIndex - 1; i >= 0; i--) {
            const t = terms[i];
            const season = t.season || (t.name.toLowerCase().includes('fall') ? 'Fall' : (t.name.toLowerCase().includes('spring') ? 'Spring' : 'Summer'));
            const offered = pData.semesters_offered || ['Fall', 'Spring'];

            if (offered.includes(season)) {
              const currentLoad = (t.courses || []).reduce((sum, item) => sum + (item.credits || 0), 0);
              if (currentLoad < lowestCredits) {
                lowestCredits = currentLoad;
                bestTermIndex = i;
              }
            }
          }

          if (bestTermIndex >= 0) {
            suggestions.push({
              course: pData,
              suggestedTermIndex: bestTermIndex,
              suggestedTermName: terms[bestTermIndex].name
            });
          }
        }
      }
    });

    return { missingPrereqs, suggestions };
  }

  /**
   * When user wants to delete courseCode from termIndex:
   * Checks if any downstream courses in subsequent terms depend on it.
   */
  findDownstreamDependents(courseCode, termIndex, terms) {
    const targetKey = this.curriculum.normalizeKey(courseCode);
    const targetBaseKey = this.curriculum.getBaseCourseCode(courseCode);
    const dependents = [];

    for (let i = termIndex; i < terms.length; i++) {
      const term = terms[i];
      (term.courses || []).forEach(c => {
        const cKey = this.curriculum.normalizeKey(c.code);
        if (cKey === targetKey && i === termIndex) return; // Ignore the item being deleted itself

        const cData = this.curriculum.getCourse(c.code);
        if (cData) {
          const prereqs = cData.prereq_keys || [];
          const coreqs = cData.coreq_keys || [];
          const hasPrereq = prereqs.includes(targetKey) || prereqs.includes(targetBaseKey);
          const hasCoreq = coreqs.includes(targetKey) || coreqs.includes(targetBaseKey);

          if (hasPrereq) {
            dependents.push({
              course: cData,
              termIndex: i,
              termName: term.name,
              relation: 'Prerequisite'
            });
          } else if (hasCoreq) {
            dependents.push({
              course: cData,
              termIndex: i,
              termName: term.name,
              relation: 'Corequisite'
            });
          }
        }
      });
    }

    return dependents;
  }
}

// Global instance
window.rulesEngine = new RulesEngine(window.curriculumService);
