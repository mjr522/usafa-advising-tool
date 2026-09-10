/**
 * USAFA Advising Tool - Graduation Check & Degree Audit Engine
 * Evaluates degree progress, checks all core/major/track/PE requirements, and renders the audit drawer.
 */

class GradCheckEngine {
  constructor(curriculumService) {
    this.curriculum = curriculumService;
    this.container = null;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
  }

  /**
   * Helper to normalize and check if course matches one of the target codes/equivalences
   */
  matchesAny(courseCode, validCodes) {
    if (!courseCode) return false;
    const norm = this.curriculum.normalizeKey(courseCode);
    const base = this.curriculum.getBaseCourseCode(courseCode);

    for (const vc of validCodes) {
      const vNorm = this.curriculum.normalizeKey(vc);
      const vBase = this.curriculum.getBaseCourseCode(vc);
      if (norm === vNorm || base === vNorm || norm === vBase || base === vBase) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluates degree fulfillment against the active major and plan.
   */
  auditPlan(plan) {
    if (!plan || !this.curriculum.data) return null;

    const majorId = (plan.cadet && plan.cadet.majorId) || 'ME';
    const major = this.curriculum.getMajor(majorId);
    if (!major) return null;

    const trackId = (plan.cadet && plan.cadet.track) || Object.keys(major.tracks || {})[0];
    const trackData = (major.tracks && major.tracks[trackId]) || null;

    // Collect all course instances from the plan
    const courseInventory = [];
    let totalCredits = 0;
    let completedCredits = 0;

    (plan.terms || []).forEach((term, tIdx) => {
      (term.courses || []).forEach((c, cIdx) => {
        const cr = Number(c.credits) || 0;
        totalCredits += cr;
        const isComp = c.status === 'Completed' || c.isValidated || (c.grade && c.grade !== '*' && c.grade !== 'F');
        if (isComp) completedCredits += cr;

        const normKey = this.curriculum.normalizeKey(c.code);
        const baseKey = this.curriculum.getBaseCourseCode(c.code);
        const cData = this.curriculum.getCourse(c.code);

        courseInventory.push({
          uid: `${tIdx}_${cIdx}_${normKey}`,
          code: c.code,
          credits: cr,
          termName: term.name,
          isCompleted: isComp,
          normKey: normKey,
          baseKey: baseKey,
          courseData: cData
        });
      });
    });

    const claimedUids = new Set();

    const claimCourse = (matcherFn) => {
      for (const item of courseInventory) {
        if (!claimedUids.has(item.uid) && matcherFn(item)) {
          claimedUids.add(item.uid);
          return item;
        }
      }
      return null;
    };

    // =========================================================================
    // 1. USAFA Academic Core Requirements (88.75 semester hours)
    // =========================================================================
    const coreDefinitions = [
      { id: 'MATH141', name: 'Math I (Calc I)', credits: 3.0, codes: ['MATH 141', 'MATH 141Z'] },
      { id: 'MATH142', name: 'Math II (Calc II)', credits: 3.0, codes: ['MATH 142', 'MATH 142Z', 'MATH 152'] },
      { id: 'MATH243', name: 'Calculus III (STEM Adv)', credits: 3.0, codes: ['MATH 243', 'MATH 253'] },
      { id: 'CHEM100', name: 'General Chemistry I', credits: 4.0, codes: ['CHEM 100', 'CHEM 110'] },
      { id: 'PHYSICS110', name: 'General Physics I', credits: 4.0, codes: ['PHYSICS 110', 'PHYSICS 110H'] },
      { id: 'COMPSCI110', name: 'Introduction to Computing', credits: 3.0, codes: ['COMP SCI 110', 'COMP SCI 110S'] },
      { id: 'ENGLISH111', name: 'Intro to Composition', credits: 3.0, codes: ['ENGLISH 111', 'ENGLISH 109'] },
      { id: 'ENGLISH211', name: 'Literature and Intermediate Comp', credits: 3.0, codes: ['ENGLISH 211', 'ENGLISH 200', 'ENGLISH 200S', 'ENGLISH 212'] },
      { id: 'HISTORY100', name: 'Intro to Military History', credits: 3.0, codes: ['HISTORY 100', 'HISTORY 100S'] },
      { id: 'HISTORY300', name: 'World History', credits: 3.0, codes: ['HISTORY 300', 'HISTORY 300S'] },
      { id: 'BEHSCI110', name: 'Intro to Behavioral Science', credits: 3.0, codes: ['BEH SCI 110', 'BEH SCI 110S'] },
      { id: 'ECON201', name: 'Intro to Economics', credits: 3.5, codes: ['ECON 201', 'ECON 201S'] },
      { id: 'LAW220', name: 'Law for Air Force Officers', credits: 3.0, codes: ['LAW 220'] },
      { id: 'PHILOS210', name: 'Ethics', credits: 3.0, codes: ['PHILOS 210'] },
      { id: 'POLSCI211', name: 'Politics for Air Force Officers', credits: 3.0, codes: ['POL SCI 211'] },
      { id: 'SOCSCI311', name: 'International Security Studies', credits: 3.0, codes: ['SOC SCI 311', 'SOC SCI 211', 'SOC SCI 212'] },
      { id: 'MSS251', name: 'Airpower and Joint Warfare', credits: 4.5, codes: ['MSS 251', 'MSS 251S'] },
      { id: 'ECE315', name: 'Principles of Air Force Cyber Systems', credits: 3.0, codes: ['ECE 315', 'ECE 215S'] },
      { id: 'AEROENGR315', name: 'Fundamentals of Aeronautics', credits: 3.0, codes: ['AERO ENGR 315', 'AERO ENGR 210', 'AERO ENGR 210S'] },
      { id: 'ASTRENGR310', name: 'Intro to Astronautics', credits: 3.0, codes: ['ASTR ENGR 310', 'ASTR ENGR 310S'] },
      { id: 'DATASCI220', name: 'Data Science / Statistics (Math 356)', credits: 3.0, codes: ['DATA SCI 220', 'DATASCI 220', 'MATH 356', 'MATH 356S', 'MATH 300', 'MATH 377'] },
      { id: 'PCB_OPT_1', name: 'P/C/B Option 1 (Chem 200 / Bio 215)', credits: 4.0, codes: ['CHEM 200', 'BIOLOGY 215', 'BIO 215'] },
      { id: 'PCB_OPT_2', name: 'P/C/B Option 2 (Phys 215)', credits: 4.0, codes: ['PHYSICS 215', 'PHYSICS 215S'] },
      { 
        id: 'FORLANG131', 
        name: 'Foreign Language I (131/101)', 
        credits: 3.0, 
        customMatcher: (item) => {
          const k = item.normKey;
          return (k.includes('131') || k.includes('101') || k === 'CHINESE221') && 
            ['FRENCH', 'SPANISH', 'GERMAN', 'JAPANESE', 'CHINESE', 'RUSSIAN', 'ARABIC', 'PORTUGUESE', 'FORLANG'].some(l => k.startsWith(l));
        }
      },
      { 
        id: 'FORLANG132', 
        name: 'Foreign Language II (132/102)', 
        credits: 3.0, 
        customMatcher: (item) => {
          const k = item.normKey;
          return (k.includes('132') || k.includes('102') || k === 'CHINESE222') && 
            ['FRENCH', 'SPANISH', 'GERMAN', 'JAPANESE', 'CHINESE', 'RUSSIAN', 'ARABIC', 'PORTUGUESE', 'FORLANG'].some(l => k.startsWith(l));
        }
      },
      { 
        id: 'LDRSHP100', 
        name: 'Leadership 100', 
        credits: 1.5, 
        codes: ['LDRSHP 100', 'LDRSHP 100A', 'LDRSHP 100C', 'LDRSHP 100E'] 
      },
      { 
        id: 'LDRSHP200', 
        name: 'Leadership 200', 
        credits: 0.75, 
        codes: ['LDRSHP 200', 'LDRSHP 200A', 'LDRSHP 200D', 'LDRSHP 200E'] 
      },
      { 
        id: 'LDRSHP300', 
        name: 'Leadership 300', 
        credits: 0.75, 
        codes: ['LDRSHP 300', 'LDRSHP 300A', 'LDRSHP 300C', 'LDRSHP 300E'] 
      },
      { 
        id: 'LDRSHP400', 
        name: 'Leadership 400', 
        credits: 0.75, 
        codes: ['LDRSHP 400', 'LDRSHP 400X'] 
      }
    ];

    if (majorId === 'ME') {
      coreDefinitions.push({
        id: 'MATH245',
        name: 'Differential Equations (Core Adv Option 2)',
        credits: 3.0,
        codes: ['MATH 245']
      });
    }

    const academicCoreStatus = [];
    let coreSatisfied = 0;

    coreDefinitions.forEach(req => {
      let matched = null;
      if (req.customMatcher) {
        matched = claimCourse(req.customMatcher);
      } else {
        matched = claimCourse(item => this.matchesAny(item.code, req.codes));
      }

      const isSatisfied = !!matched;
      if (isSatisfied) coreSatisfied++;

      academicCoreStatus.push({
        name: req.name,
        code: matched ? matched.code : (req.codes ? req.codes[0] : req.id),
        credits: req.credits,
        isSatisfied: isSatisfied,
        status: matched ? (matched.isCompleted ? 'Completed' : 'Planned') : 'Missing',
        termName: matched ? matched.termName : null
      });
    });

    // =========================================================================
    // 2. Major Core Requirements
    // =========================================================================
    const majorCoreStatus = [];
    let majorSatisfied = 0;
    let majorCoreDefs = [];

    if (majorId === 'ME') {
      majorCoreDefs = [
        { id: 'MECHENGR205', name: 'Engineering Tools Seminar', credits: 1.0, codes: ['MECH ENGR 205', 'MECH ENGR 305'] },
        { id: 'MECHENGR220', name: 'Fundamentals of Mechanics', credits: 3.0, codes: ['MECH ENGR 220', 'MECH ENGR 220S'] },
        { id: 'MECHENGR312', name: 'Thermodynamics', credits: 3.0, codes: ['MECH ENGR 312'] },
        { id: 'MECHENGR320', name: 'Dynamics', credits: 3.0, codes: ['MECH ENGR 320'] },
        { id: 'MECHENGR325', name: 'Engineering System Dynamics', credits: 3.0, codes: ['MECH ENGR 325'] },
        { id: 'MECHENGR330', name: 'Mechanics of Deformable Bodies', credits: 3.0, codes: ['MECH ENGR 330'] },
        { id: 'MECHENGR341', name: 'Fluid Mechanics', credits: 3.0, codes: ['MECH ENGR 341'] },
        { id: 'MECHENGR350', name: 'Mechanical Behavior of Materials', credits: 3.0, codes: ['MECH ENGR 350'] },
        { id: 'MECHENGR370', name: 'Introduction to Machine Design', credits: 3.0, codes: ['MECH ENGR 370'] },
        { id: 'MECHENGR441', name: 'Heat Transfer', credits: 3.0, codes: ['MECH ENGR 441'] },
        { id: 'MECHENGR460', name: 'Experimental Mechanics', credits: 3.0, codes: ['MECH ENGR 460'] },
        { id: 'MECHENGR491', name: 'Capstone Design Project I', credits: 3.0, codes: ['MECH ENGR 491'] },
        { id: 'MECHENGR492', name: 'Capstone Design Project II', credits: 3.0, codes: ['MECH ENGR 492'] },
        { id: 'COMPSCI206', name: 'Programming for Engineers', credits: 1.0, codes: ['COMP SCI 206', 'COMP SCI 206X', 'COMP SCI 211'] },
        { id: 'ENGR346', name: 'Advanced Math Option', credits: 3.0, codes: ['ENGR 346', 'MATH 346', 'MATH 342', 'MATH 344'] }
      ];
    } else {
      majorCoreDefs = [
        { id: 'SYSENGR310', name: 'Intro to Systems Engineering', credits: 3.0, codes: ['SYS ENGR 310'] },
        { id: 'SYSENGR301', name: 'Project Engineering', credits: 3.0, codes: ['SYS ENGR 301'] },
        { id: 'SYSENGR311', name: 'Intermediate Systems Engineering', credits: 3.0, codes: ['SYS ENGR 311'] },
        { id: 'SYSENGR320', name: 'Optimization Theory with Design', credits: 3.0, codes: ['SYS ENGR 320'] },
        { id: 'SYSENGR336', name: 'Engineering Economics', credits: 3.0, codes: ['SYS ENGR 336'] },
        { id: 'COMPSCI211', name: 'Intro to Programming for Scientists', credits: 4.0, codes: ['COMP SCI 211', 'COMP SCI 210'] },
        { id: 'OPSRSCH312', name: 'Probabilistic Models (Ops Rsch)', credits: 3.0, codes: ['OPS RSCH 312', 'OPS RSCH 310', 'OPS RSCH 311'] },
        { id: 'BEHSCI373', name: 'Human Factors Engineering', credits: 3.0, codes: ['BEH SCI 373'] },
        { id: 'SEMATHOPT', name: 'SE Math Option (Math 245/340/344/359)', credits: 3.0, codes: ['MATH 245', 'MATH 340', 'MATH 344', 'MATH 359', 'ECE 245'] },
        { 
          id: 'SYSENGR491', 
          name: 'SE Capstone Design I', 
          credits: 3.0, 
          customMatcher: (item) => item.normKey.startsWith('SYSENGR491') 
        },
        { 
          id: 'SYSENGR492', 
          name: 'SE Capstone Design II', 
          credits: 3.0, 
          customMatcher: (item) => item.normKey.startsWith('SYSENGR492') 
        },
        { id: 'SYSENGR405', name: 'Systems Engineering Colloquium I', credits: 0.0, codes: ['SYS ENGR 405'] },
        { id: 'SYSENGR406', name: 'Systems Engineering Colloquium II', credits: 0.0, codes: ['SYS ENGR 406'] }
      ];
    }

    majorCoreDefs.forEach(req => {
      let matched = null;
      if (req.customMatcher) {
        matched = claimCourse(req.customMatcher);
      } else {
        matched = claimCourse(item => this.matchesAny(item.code, req.codes));
      }

      const isSatisfied = !!matched;
      if (isSatisfied) majorSatisfied++;

      majorCoreStatus.push({
        name: req.name,
        code: matched ? matched.code : (req.codes ? req.codes[0] : req.id),
        credits: req.credits,
        isSatisfied: isSatisfied,
        status: matched ? (matched.isCompleted ? 'Completed' : 'Planned') : 'Missing',
        termName: matched ? matched.termName : null
      });
    });

    // =========================================================================
    // 3. Option Electives / Depth Track Auditing
    // =========================================================================
    const electiveStatus = [];
    let electiveSatisfied = 0;
    let electiveTotal = 0;
    let trackRecommendations = [];

    if (majorId === 'ME') {
      electiveTotal = 3;

      // Disallow all Required Major Courses and USAFA Academic Core courses from satisfying Option Electives
      const meDisallowedKeys = new Set([
        'MECHENGR205', 'MECHENGR220', 'MECHENGR220S', 'MECHENGR312', 'MECHENGR320',
        'MECHENGR325', 'MECHENGR330', 'MECHENGR341', 'MECHENGR350', 'MECHENGR370',
        'MECHENGR441', 'MECHENGR460', 'MECHENGR491', 'MECHENGR492', 'COMPSCI206',
        'COMPSCI206X', 'COMPSCI211', 'ENGR346', 'MATH346', 'MATH342', 'MATH344',
        'MATH141', 'MATH141Z', 'MATH142', 'MATH142Z', 'MATH152', 'MATH243', 'MATH253', 'MATH245',
        'CHEM100', 'CHEM110', 'CHEM200', 'BIOLOGY215', 'BIO215', 'PHYSICS110', 'PHYSICS110H',
        'PHYSICS215', 'PHYSICS215S', 'COMPSCI110', 'COMPSCI110S', 'ENGLISH111', 'ENGLISH109',
        'ENGLISH211', 'ENGLISH200', 'ENGLISH200S', 'ENGLISH212', 'HISTORY100', 'HISTORY100S',
        'HISTORY300', 'HISTORY300S', 'BEHSCI110', 'BEHSCI110S', 'ECON201', 'ECON201S',
        'LAW220', 'PHILOS210', 'POLSCI211', 'SOCSCI311', 'SOCSCI211', 'SOCSCI212',
        'MSS251', 'MSS251S', 'ECE315', 'ECE215S', 'AEROENGR315', 'AEROENGR210', 'AEROENGR210S',
        'ASTRENGR310', 'ASTRENGR310S', 'DATASCI220', 'MATH356', 'MATH356S', 'MATH300', 'MATH377',
        'ENGR402'
      ]);

      const meTableCodes = [
        'MECH ENGR 332', 'MECH ENGR 340', 'MECH ENGR 396', 'MECH ENGR 421', 'MECH ENGR 431',
        'MECH ENGR 440', 'MECH ENGR 445', 'MECH ENGR 450', 'MECH ENGR 468', 'MECH ENGR 490',
        'ENGR 341', 'AERO ENGR 341', 'AERO ENGR 361'
      ];

      const isMeOption1or2 = (item) => {
        if (meDisallowedKeys.has(item.normKey) || meDisallowedKeys.has(item.baseKey)) return false;
        if (this.matchesAny(item.code, meTableCodes)) return true;
        if (item.normKey.startsWith('MECHENGR') && item.credits >= 3.0) {
          const num = parseInt(item.normKey.replace(/[^0-9]/g, '').slice(0, 3), 10);
          return num >= 300;
        }
        return false;
      };

      const isMeOption3 = (item) => {
        if (meDisallowedKeys.has(item.normKey) || meDisallowedKeys.has(item.baseKey)) return false;
        if (isMeOption1or2(item)) return true;
        if (this.matchesAny(item.code, ['SYS ENGR 310', 'SYS ENGR 311', 'MECH ENGR 495'])) return true;
        const depts = ['AEROENGR', 'ASTRENGR', 'CIVENGR', 'COMPSCI', 'ECE', 'ENGR', 'OPSRSCH', 'SYSENGR'];
        if (depts.some(d => item.normKey.startsWith(d)) && item.credits >= 3.0) {
          const num = parseInt(item.normKey.replace(/[^0-9]/g, '').slice(0, 3), 10);
          return num >= 300;
        }
        return false;
      };

      const opt1 = claimCourse(isMeOption1or2);
      if (opt1) electiveSatisfied++;
      electiveStatus.push({
        name: 'ME Option Elective I',
        code: opt1 ? opt1.code : 'ME Option I',
        credits: 3.0,
        isSatisfied: !!opt1,
        status: opt1 ? (opt1.isCompleted ? 'Completed' : 'Planned') : 'Missing',
        termName: opt1 ? opt1.termName : null,
        hint: 'Any 3-sem-hr course from ME Electives table'
      });

      const opt2 = claimCourse(isMeOption1or2);
      if (opt2) electiveSatisfied++;
      electiveStatus.push({
        name: 'ME Option Elective II',
        code: opt2 ? opt2.code : 'ME Option II',
        credits: 3.0,
        isSatisfied: !!opt2,
        status: opt2 ? (opt2.isCompleted ? 'Completed' : 'Planned') : 'Missing',
        termName: opt2 ? opt2.termName : null,
        hint: 'Any 3-sem-hr course from ME Electives table'
      });

      const opt3 = claimCourse(isMeOption3);
      if (opt3) electiveSatisfied++;
      electiveStatus.push({
        name: 'ME Option Elective III',
        code: opt3 ? opt3.code : 'ME Option III',
        credits: 3.0,
        isSatisfied: !!opt3,
        status: opt3 ? (opt3.isCompleted ? 'Completed' : 'Planned') : 'Missing',
        termName: opt3 ? opt3.termName : null,
        hint: 'ME elective, SE 310/311, or 300/400-level engineering course'
      });

      if (trackData && trackData.courses) {
        trackRecommendations = trackData.courses.map(code => {
          const cData = this.curriculum.getCourse(code);
          const taken = courseInventory.find(i => this.matchesAny(i.code, [code]));
          return {
            code: cData ? cData.id : code,
            name: cData ? cData.title : code,
            isTaken: !!taken,
            status: taken ? (taken.isCompleted ? 'Completed' : 'Planned') : 'Not Scheduled'
          };
        });
      }

    } else {
      // Systems Engineering: 4 Depth Option Courses
      electiveTotal = 4;

      const seDisallowedKeys = new Set([
        'SYSENGR310', 'SYSENGR301', 'SYSENGR311', 'SYSENGR320', 'SYSENGR336',
        'COMPSCI211', 'COMPSCI210', 'OPSRSCH312', 'OPSRSCH310', 'OPSRSCH311',
        'BEHSCI373', 'MATH245', 'SYSENGR491', 'SYSENGR492', 'SYSENGR405', 'SYSENGR406',
        'MATH141', 'MATH141Z', 'MATH142', 'MATH142Z', 'MATH152', 'MATH243', 'MATH253',
        'CHEM100', 'CHEM110', 'CHEM200', 'BIOLOGY215', 'BIO215', 'PHYSICS110', 'PHYSICS110H',
        'PHYSICS215', 'PHYSICS215S', 'COMPSCI110', 'COMPSCI110S', 'ENGLISH111', 'ENGLISH109',
        'ENGLISH211', 'ENGLISH200', 'ENGLISH200S', 'ENGLISH212', 'HISTORY100', 'HISTORY100S',
        'HISTORY300', 'HISTORY300S', 'BEHSCI110', 'BEHSCI110S', 'ECON201', 'ECON201S',
        'LAW220', 'PHILOS210', 'POLSCI211', 'SOCSCI311', 'SOCSCI211', 'SOCSCI212',
        'MSS251', 'MSS251S', 'ECE315', 'ECE215S', 'AEROENGR315', 'AEROENGR210', 'AEROENGR210S',
        'ASTRENGR310', 'ASTRENGR310S', 'DATASCI220', 'MATH356', 'MATH356S', 'MATH300', 'MATH377',
        'ENGR402'
      ]);

      const trackCourses = (trackData && trackData.courses) || [];
      const isTrackCourse = (item) => {
        if (seDisallowedKeys.has(item.normKey) || seDisallowedKeys.has(item.baseKey)) return false;
        return this.matchesAny(item.code, trackCourses);
      };
      const isEngrDepth = (item) => {
        if (seDisallowedKeys.has(item.normKey) || seDisallowedKeys.has(item.baseKey)) return false;
        const depts = ['AEROENGR', 'ASTRENGR', 'CIVENGR', 'COMPSCI', 'ECE', 'ENGR', 'MECHENGR', 'OPSRSCH', 'SYSENGR'];
        if (depts.some(d => item.normKey.startsWith(d)) && item.credits >= 3.0) {
          const num = parseInt(item.normKey.replace(/[^0-9]/g, '').slice(0, 3), 10);
          return num >= 300;
        }
        return false;
      };

      for (let i = 1; i <= 4; i++) {
        let matched = claimCourse(isTrackCourse) || claimCourse(isEngrDepth);
        if (matched) electiveSatisfied++;

        electiveStatus.push({
          name: `SE Depth Option ${i}`,
          code: matched ? matched.code : `SE Depth ${i}`,
          credits: 3.0,
          isSatisfied: !!matched,
          status: matched ? (matched.isCompleted ? 'Completed' : 'Planned') : 'Missing',
          termName: matched ? matched.termName : null,
          hint: `Course from ${trackData ? trackData.name : 'Depth Option table'}`
        });
      }

      trackRecommendations = trackCourses.map(code => {
        const cData = this.curriculum.getCourse(code);
        const taken = courseInventory.find(i => this.matchesAny(i.code, [code]));
        return {
          code: cData ? cData.id : code,
          name: cData ? cData.title : code,
          isTaken: !!taken,
          status: taken ? (taken.isCompleted ? 'Completed' : 'Planned') : 'Not Scheduled'
        };
      });
    }

    // =========================================================================
    // 4. Physical Education & Athletics (5.0 credits / 10 courses)
    // =========================================================================
    const peDefinitions = [
      { id: 'PHYED100', name: 'Basic Physical Training', credits: 0.0, prefix: 'PHYED100' },
      { id: 'PHYED110', name: 'Boxing', credits: 0.5, prefix: 'PHYED110' },
      { id: 'PHYED111', name: 'Swimming', credits: 0.5, prefix: 'PHYED111' },
      { id: 'PHYED112', name: 'Physical Development', credits: 0.5, prefix: 'PHYED112' },
      { id: 'PHYED215', name: 'Combatives I', credits: 0.5, prefix: 'PHYED215' },
      { id: 'PHYED222', name: 'Water Survival', credits: 0.5, prefix: 'PHYED222' },
      { id: 'PHYED315', name: 'Combatives II', credits: 0.5, prefix: 'PHYED315' },
      { id: 'PHYED342', name: 'Individual Sport Elective', credits: 0.5, prefix: 'PHYED342', altPrefixes: ['PHYED490', 'PHYED343'] },
      { id: 'PHYED488', name: 'Team Sport Elective', credits: 0.5, prefix: 'PHYED488', altPrefixes: ['PHYED484', 'PHYED486'] },
      { id: 'PHYED_OPEN', name: 'PhyEd Open Elective', credits: 0.5, customMatcher: (item) => item.normKey.startsWith('PHYED') && !claimedUids.has(item.uid) }
    ];

    const peStatus = [];
    let peSatisfied = 0;

    peDefinitions.forEach(req => {
      let matched = null;
      if (req.customMatcher) {
        matched = claimCourse(req.customMatcher);
      } else {
        matched = claimCourse(item => {
          if (item.normKey.startsWith(req.prefix)) return true;
          if (req.altPrefixes && req.altPrefixes.some(p => item.normKey.startsWith(p))) return true;
          return false;
        });
      }

      const isSatisfied = !!matched;
      if (isSatisfied) peSatisfied++;

      peStatus.push({
        name: req.name,
        code: matched ? matched.code : req.id,
        credits: req.credits,
        isSatisfied: isSatisfied,
        status: matched ? (matched.isCompleted ? 'Completed' : 'Planned') : 'Missing',
        termName: matched ? matched.termName : null
      });
    });

    const totalRequiredCourses = academicCoreStatus.length + majorCoreStatus.length + electiveStatus.length + peStatus.length;
    const totalFulfilled = coreSatisfied + majorSatisfied + electiveSatisfied + peSatisfied;
    const percentFulfill = totalRequiredCourses > 0 ? Math.round((totalFulfilled / totalRequiredCourses) * 100) : 0;

    return {
      major,
      trackName: trackData ? trackData.name : 'None',
      trackId: trackId,
      totalCredits,
      completedCredits,
      requiredCredits: major.total_credits,
      percentFulfill,
      core: { list: academicCoreStatus, satisfied: coreSatisfied, total: academicCoreStatus.length },
      majorCore: { list: majorCoreStatus, satisfied: majorSatisfied, total: majorCoreStatus.length },
      electives: { 
        list: electiveStatus, 
        satisfied: electiveSatisfied, 
        total: electiveTotal, 
        recommendations: trackRecommendations,
        sectionTitle: majorId === 'ME' ? 'Mechanical Engineering Option Electives (3 Required)' : 'Systems Engineering Depth Options (4 Required)',
        subtitle: majorId === 'ME' ? 'Requires 3 courses from ME Electives table. Track courses provide recommended depth.' : 'Requires 4 courses in chosen depth area.'
      },
      pe: { list: peStatus, satisfied: peSatisfied, total: peStatus.length }
    };
  }

  renderDrawer(plan, onAddMissingCourse) {
    if (!this.container) return;

    const audit = this.auditPlan(plan);
    if (!audit) return;

    this.container.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-row">
          <h2>Graduation Degree Audit</h2>
          <button class="btn-close-drawer" id="btnCloseGradCheck">×</button>
        </div>
        <p class="drawer-subtitle">${audit.major.name} • ${audit.trackName}</p>

        <div class="audit-summary-box">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${audit.percentFulfill}%"></div>
          </div>
          <div class="progress-labels">
            <span class="progress-pct">${audit.percentFulfill}% Requirements Satisfied</span>
            <span class="progress-credits">${audit.totalCredits.toFixed(1)} / ${audit.requiredCredits} Sem Hrs</span>
          </div>
        </div>
      </div>

      <div class="drawer-body">
        <div class="audit-section">
          <div class="audit-sec-header">
            <h3>Major Core Requirements</h3>
            <span class="sec-badge">${audit.majorCore.satisfied}/${audit.majorCore.total}</span>
          </div>
          <div class="audit-req-list">
            ${this.renderReqList(audit.majorCore.list)}
          </div>
        </div>

        <div class="audit-section">
          <div class="audit-sec-header">
            <div>
              <h3>${audit.electives.sectionTitle}</h3>
              <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${audit.electives.subtitle}</p>
            </div>
            <span class="sec-badge">${audit.electives.satisfied}/${audit.electives.total}</span>
          </div>
          <div class="audit-req-list">
            ${this.renderReqList(audit.electives.list)}
          </div>

          ${audit.electives.recommendations && audit.electives.recommendations.length > 0 ? `
            <div style="margin-top: 10px; padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: var(--radius-sm);">
              <div style="font-size: 11px; font-weight: 700; color: var(--primary-navy); margin-bottom: 6px;">
                🎯 Recommended Courses for ${audit.trackName}:
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${audit.electives.recommendations.map(r => `
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 3px 6px; background: #ffffff; border-radius: 3px;">
                    <div>
                      <strong style="color: var(--primary-blue);">${r.code}:</strong> <span style="color: var(--text-muted);">${r.name}</span>
                    </div>
                    <div>
                      ${r.isTaken 
                        ? `<span class="req-badge badge-${r.status.toLowerCase()}">${r.status}</span>`
                        : `<button class="btn-add-missing" data-code="${r.code}">+ Add</button>`
                      }
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="audit-section">
          <div class="audit-sec-header">
            <h3>USAFA Academic Core</h3>
            <span class="sec-badge">${audit.core.satisfied}/${audit.core.total}</span>
          </div>
          <div class="audit-req-list">
            ${this.renderReqList(audit.core.list)}
          </div>
        </div>

        <div class="audit-section">
          <div class="audit-sec-header">
            <h3>Physical Education & Athletics</h3>
            <span class="sec-badge">${audit.pe.satisfied}/${audit.pe.total}</span>
          </div>
          <div class="audit-req-list">
            ${this.renderReqList(audit.pe.list)}
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('btnCloseGradCheck');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.container.classList.remove('open');
      });
    }

    this.container.querySelectorAll('.btn-add-missing').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (onAddMissingCourse) onAddMissingCourse(code);
      });
    });
  }

  renderReqList(list) {
    return list.map(item => `
      <div class="audit-req-item status-${item.status.toLowerCase()}">
        <div class="req-info">
          <span class="req-status-dot ${item.status.toLowerCase()}" title="${item.status}"></span>
          <div class="req-details">
            <span class="req-code">${item.code}</span>
            <span class="req-name">${item.name}</span>
            ${item.hint ? `<span class="req-hint">${item.hint}</span>` : ''}
          </div>
        </div>
        <div class="req-right">
          ${item.termName ? `<span class="req-term">${item.termName}</span>` : ''}
          ${item.status === 'Missing' ? `<button class="btn-add-missing" data-code="${item.code}">+ Schedule</button>` : `<span class="req-badge badge-${item.status.toLowerCase()}">${item.status}</span>`}
        </div>
      </div>
    `).join('');
  }

  open() {
    if (this.container) this.container.classList.add('open');
    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) backdrop.classList.add('open');
  }

  close() {
    if (this.container) this.container.classList.remove('open');
    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  }
}

// Global instance
window.gradCheckEngine = new GradCheckEngine(window.curriculumService);
