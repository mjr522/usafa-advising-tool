/**
 * USAFA DFEM Faculty Advisor Directory Service
 * Manages faculty advisor roster, office locations, emails, and major affiliations (ME, SE, Both).
 * Supports localStorage persistence so departments can customize their roster in-browser.
 */

(function () {
  const STORAGE_KEY = 'usafa_dfem_advisors_v1';

  // Default roster of DFEM faculty advisors (will be updated when department roster is supplied)
  const DEFAULT_ADVISORS = [
    {
      id: 'richards_m',
      name: 'Dr. Michael Richards',
      title: 'Advisor-in-Charge (AIC) & Assoc Professor',
      email: 'michael.richards@afacademy.af.edu',
      office: 'Fairchild Hall 2F42',
      major: 'Both',
      isAic: true,
      notes: 'DFEM Advisor-in-Charge for Mechanical & Systems Engineering'
    },
    {
      id: 'wright_d',
      name: 'Col David Wright',
      title: 'Professor of Mechanical Engineering',
      email: 'david.wright@afacademy.af.edu',
      office: 'Fairchild Hall 2F38',
      major: 'ME',
      isAic: false,
      notes: 'Aerospace structures, materials'
    },
    {
      id: 'jenkins_s',
      name: 'Lt Col Sarah Jenkins',
      title: 'Associate Professor of Mechanical Engineering',
      email: 'sarah.jenkins@afacademy.af.edu',
      office: 'Fairchild Hall 2F40',
      major: 'ME',
      isAic: false,
      notes: 'Thermodynamics, propulsion'
    },
    {
      id: 'miller_r',
      name: 'Dr. Robert Miller',
      title: 'Professor & Systems Engineering Lead',
      email: 'robert.miller@afacademy.af.edu',
      office: 'Fairchild Hall 2F44',
      major: 'SE',
      isAic: false,
      notes: 'Systems architecting, robotics'
    },
    {
      id: 'chen_a',
      name: 'Maj Amanda Chen',
      title: 'Assistant Professor of Systems Engineering',
      email: 'amanda.chen@afacademy.af.edu',
      office: 'Fairchild Hall 2F46',
      major: 'SE',
      isAic: false,
      notes: 'Human systems integration, operations'
    },
    {
      id: 'wilson_j',
      name: 'Capt James Wilson',
      title: 'Instructor of Mechanical Engineering',
      email: 'james.wilson@afacademy.af.edu',
      office: 'Fairchild Hall 2F50',
      major: 'ME',
      isAic: false,
      notes: 'Mechatronics, CAD/CAM'
    }
  ];

  class AdvisorsService {
    constructor() {
      this.advisors = this.load();
    }

    load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Could not load advisors from localStorage:', e);
      }
      return JSON.parse(JSON.stringify(DEFAULT_ADVISORS));
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.advisors));
      } catch (e) {
        console.warn('Could not save advisors to localStorage:', e);
      }
    }

    getAll() {
      return [...this.advisors];
    }

    getByMajor(major) {
      if (!major) return this.getAll();
      const m = major.toUpperCase();
      return this.advisors.filter(a => a.major === 'Both' || a.major === m);
    }

    getById(id) {
      return this.advisors.find(a => a.id === id) || null;
    }

    getAIC() {
      return this.advisors.find(a => a.isAic) || this.advisors[0];
    }

    add(advisor) {
      if (!advisor.id) {
        advisor.id = 'adv_' + Date.now();
      }
      this.advisors.push(advisor);
      this.save();
      return advisor;
    }

    update(id, data) {
      const idx = this.advisors.findIndex(a => a.id === id);
      if (idx !== -1) {
        this.advisors[idx] = { ...this.advisors[idx], ...data };
        this.save();
        return this.advisors[idx];
      }
      return null;
    }

    delete(id) {
      this.advisors = this.advisors.filter(a => a.id !== id);
      this.save();
    }

    reset() {
      this.advisors = JSON.parse(JSON.stringify(DEFAULT_ADVISORS));
      this.save();
      return this.getAll();
    }
  }

  window.advisorsService = new AdvisorsService();
})();
