/**
 * USAFA Advising Tool - Curriculum Data Service
 * Loads curriculum data, majors, courses, and provides normalization and lookup helpers.
 */

class CurriculumService {
  constructor() {
    this.data = null;
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return this.data;
    
    // Check if preloaded via data/curriculum_data.js (works in file:/// mode without CORS restrictions)
    if (window.USAFA_CURRICULUM_DATA) {
      this.data = window.USAFA_CURRICULUM_DATA;
      this.isLoaded = true;
      console.log('Curriculum data loaded from preloaded script:', Object.keys(this.data.courses).length, 'courses.');
      return this.data;
    }

    try {
      const resp = await fetch('data/curriculum_data.json');
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      this.data = await resp.json();
      this.isLoaded = true;
      console.log('Curriculum data loaded successfully from JSON:', Object.keys(this.data.courses).length, 'courses.');
      return this.data;
    } catch (err) {
      console.error('Failed to load curriculum_data.json:', err);
      throw err;
    }
  }

  normalizeKey(code) {
    if (!code) return '';
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  getBaseCourseCode(code) {
    if (!code) return '';
    const norm = this.normalizeKey(code);
    
    // Explicit known USAFA curriculum equivalences
    const equivalences = {
      'MATH253': 'MATH243',
      'MATH152': 'MATH142',
      'MATH141Z': 'MATH141',
      'MATH142Z': 'MATH142',
      'ENGLISH200S': 'ENGLISH211',
      'ENGLISH200': 'ENGLISH211',
      'ENGLISH212': 'ENGLISH211',
      'COMPSCI110S': 'COMPSCI110',
      'COMPSCI206X': 'COMPSCI206',
      'COMPSCI211': 'COMPSCI206',
      'AEROENGR210S': 'AEROENGR315',
      'AEROENGR210': 'AEROENGR315',
      'ASTRENGR310S': 'ASTRENGR310',
      'ECE215S': 'ECE315',
      'PHYSICS110H': 'PHYSICS110',
      'PHYSICS215S': 'PHYSICS215',
      'MECHENGR220S': 'MECHENGR220',
      'BEHSCI110S': 'BEHSCI110',
      'ECON201S': 'ECON201',
      'MSS251S': 'MSS251',
      'HISTORY100S': 'HISTORY100',
      'HISTORY300S': 'HISTORY300',
      'AEROENGR241': 'MECHENGR312'
    };
    if (equivalences[norm]) return equivalences[norm];

    // Strip trailing variant / section suffixes: S (Scholars), H (Honors), Z (Advanced), X (Alternate), or section letters
    // Examples: COMPSCI110S -> COMPSCI110, LDRSHP100E -> LDRSHP100, PHYED110D -> PHYED110, PHYED487H -> PHYED487
    const match = norm.match(/^([A-Z]+?)(\d{3})([A-Z])$/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }

    return norm;
  }

  getCourse(code) {
    if (!this.data) return null;
    const key = this.normalizeKey(code);
    
    // 1. Check direct match
    if (this.data.courses[key]) {
      return this.data.courses[key];
    }
    
    // 2. Check base course equivalence
    const baseKey = this.getBaseCourseCode(code);
    if (baseKey !== key && this.data.courses[baseKey]) {
      return this.data.courses[baseKey];
    }

    // 3. Check aliases
    if (this.data.aliases && this.data.aliases[key]) {
      const aliasedKey = this.normalizeKey(this.data.aliases[key]);
      if (this.data.courses[aliasedKey]) {
        return this.data.courses[aliasedKey];
      }
    }
    
    // 4. Fallback search by matching dept + exact number, then prefix
    const match = code.trim().match(/^([A-Za-z\s]+?)\s*(\d{3}[A-Za-z\d]?)$/);
    if (match) {
      const deptPart = this.normalizeKey(match[1]);
      const numPart = match[2].toUpperCase();
      
      // Exact number match first
      for (const [k, c] of Object.entries(this.data.courses)) {
        if (this.normalizeKey(c.dept) === deptPart && c.number.toUpperCase() === numPart) {
          return c;
        }
      }
      // Base 3-digit number match
      const baseNum = numPart.substring(0, 3);
      for (const [k, c] of Object.entries(this.data.courses)) {
        if (this.normalizeKey(c.dept) === deptPart && c.number.toUpperCase().substring(0, 3) === baseNum) {
          return c;
        }
      }
    }

    // Default placeholder for unknown courses
    return {
      id: code.toUpperCase(),
      dept: code.split(' ')[0] || 'GEN',
      number: code.split(' ')[1] || '100',
      title: code.toUpperCase(),
      credits: 3.0,
      contact: '3(1)',
      prereqs_text: '',
      coreqs_text: '',
      prereq_keys: [],
      coreq_keys: [],
      semesters_offered: ['Fall', 'Spring'],
      even_years_only: false,
      odd_years_only: false,
      offering_text: 'Fall or Spring',
      description: 'Course information not listed in COI appendix.',
      difficulty: 'Moderate',
      advisor_tips: '',
      pairing_warnings: ''
    };
  }

  getMajor(majorId) {
    if (!this.data || !this.data.majors) return null;
    return this.data.majors[majorId] || null;
  }

  getAllMajors() {
    if (!this.data || !this.data.majors) return [];
    return Object.values(this.data.majors);
  }

  getCore() {
    return this.data ? this.data.core : null;
  }

  saveAdvisorTip(courseCode, tipData) {
    const key = this.normalizeKey(courseCode);
    const course = this.getCourse(courseCode);
    if (course) {
      if (tipData.advisor_tips !== undefined) course.advisor_tips = tipData.advisor_tips;
      if (tipData.difficulty !== undefined) course.difficulty = tipData.difficulty;
      if (tipData.pairing_warnings !== undefined) course.pairing_warnings = tipData.pairing_warnings;
      
      // Persist advisor customizations in localStorage
      const customTips = JSON.parse(localStorage.getItem('usafa_advisor_tips') || '{}');
      customTips[key] = {
        advisor_tips: course.advisor_tips,
        difficulty: course.difficulty,
        pairing_warnings: course.pairing_warnings
      };
      localStorage.setItem('usafa_advisor_tips', JSON.stringify(customTips));
    }
  }

  applyCustomAdvisorTips() {
    const customTips = JSON.parse(localStorage.getItem('usafa_advisor_tips') || '{}');
    for (const [key, tips] of Object.entries(customTips)) {
      if (this.data && this.data.courses[key]) {
        Object.assign(this.data.courses[key], tips);
      }
    }
  }
}

// Global singleton instance
window.curriculumService = new CurriculumService();
