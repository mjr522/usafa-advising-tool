/**
 * USAFA Advising Tool - Client-Side COMPASS / SIS PDF Ingestion Engine
 * Uses PDF.js to parse Academic Program Summary (APS) and Grad Check Reports in-browser with zero server contact.
 */

class PDFIngestService {
  constructor(curriculumService) {
    this.curriculum = curriculumService;
    // Configure worker src for pdfjs if not file protocol
    if (window.pdfjsLib && window.location.protocol !== 'file:') {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    }
  }

  /**
   * Reads a File object and extracts text from all pages.
   */
  async extractTextFromPDF(file) {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js library is not loaded.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const docOptions = { data: arrayBuffer };
    if (window.location.protocol === 'file:') {
      docOptions.disableWorker = true;
    }
    const loadingTask = window.pdfjsLib.getDocument(docOptions);
    const pdfDoc = await loadingTask.promise;
    
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items || [];

      // Check if page contains multi-column APS term patterns
      const hasTermPattern = items.some(it => /\b20\d{2}\s+(FALL|SPRING|SUMMER)\b/i.test(it.str));
      
      if (hasTermPattern) {
        // Dynamically detect column start positions from term headers on the page
        const termHeaderXs = [];
        items.forEach(it => {
          if (it.str && /\b20\d{2}\s+(FALL|SPRING|SUMMER)\b/i.test(it.str.trim())) {
            const x = it.transform ? it.transform[4] : 0;
            if (!termHeaderXs.some(ex => Math.abs(ex - x) < 25)) {
              termHeaderXs.push(x);
            }
          }
        });
        termHeaderXs.sort((a, b) => a - b);

        // Group items into header (y > 470) and 4 table columns
        const headerItems = [];
        const cols = [[], [], [], []];

        items.forEach(it => {
          if (!it.str || !it.str.trim()) return;
          const x = it.transform ? it.transform[4] : 0;
          const y = it.transform ? it.transform[5] : 0;
          const entry = { text: it.str.trim(), x, y };

          const isTermHeader = /\b20\d{2}\s+(FALL|SPRING|SUMMER)\b/i.test(entry.text);

          if (y > 470 && !isTermHeader) {
            headerItems.push(entry);
          } else {
            let cIdx = 0;
            if (termHeaderXs.length >= 4) {
              if (x < termHeaderXs[1] - 5) cIdx = 0;
              else if (x < termHeaderXs[2] - 5) cIdx = 1;
              else if (x < termHeaderXs[3] - 5) cIdx = 2;
              else cIdx = 3;
            } else {
              // Fallback column boundaries (use 470 for column 2 so right-aligned credits are preserved)
              cIdx = x < 162 ? 0 : (x < 315 ? 1 : (x < 470 ? 2 : 3));
            }
            cols[cIdx].push(entry);
          }
        });

        // Sort header top-to-bottom, left-to-right
        headerItems.sort((a, b) => {
          const yDiff = Math.round(b.y / 5) - Math.round(a.y / 5);
          if (yDiff !== 0) return yDiff;
          return a.x - b.x;
        });
        const headerStr = headerItems.map(it => it.text).join(" ");

        // Process columns top-to-bottom with line grouping (items on same line ordered by x)
        const colStrings = cols.map(cItems => {
          const lines = {};
          cItems.forEach(it => {
            const lineY = Math.round(it.y / 3.5) * 3.5;
            if (!lines[lineY]) lines[lineY] = [];
            lines[lineY].push(it);
          });
          const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
          return sortedYs.map(ly => {
            lines[ly].sort((a, b) => a.x - b.x);
            return lines[ly].map(it => it.text).join(" ");
          }).join("\n");
        });

        fullText += "\n" + headerStr + "\n" + colStrings.join("\n");
      } else {
        // Standard linear extraction for single-column reports (e.g. GradCheck)
        const pageText = items.map(item => item.str).join(" ");
        fullText += "\n" + pageText;
      }
    }
    return fullText;
  }

  /**
   * Determines PDF report type and parses accordingly.
   */
  async parsePDFReport(file) {
    const text = await this.extractTextFromPDF(file);
    
    if (text.includes("Academic Program Summary") || text.includes("AcComp:") || text.includes("Total Sem/Cum:")) {
      return {
        type: "APS",
        data: this.parseAPS(text)
      };
    } else if (text.includes("Grad Check Report") || text.includes("--- = Missing Requirement")) {
      return {
        type: "GRAD_CHECK",
        data: this.parseGradCheck(text)
      };
    } else {
      // Generic fallback parser
      return {
        type: "UNKNOWN",
        data: this.parseAPS(text)
      };
    }
  }

  parseAPS(text) {
    const info = {
      rawText: text,
      cadet: {
        major: "",
        classYear: "",
        emplid: "",
        cumGpa: "",
        coreGpa: "",
        totalUnits: 0
      },
      terms: []
    };

    const majorMatch = text.match(/Major\(s\):\s*([A-Za-z\s]+?)(?:Minors?\(s\)|Advisor|\n|$)/i);
    if (majorMatch) info.cadet.major = majorMatch[1].trim();

    const clMatch = text.match(/CL\s*YR:\s*(\d{4})/i);
    if (clMatch) info.cadet.classYear = clMatch[1].trim();

    const gpaMatch = text.match(/CUM\s*GPA:\s*([\d.]+)/i);
    if (gpaMatch) info.cadet.cumGpa = gpaMatch[1].trim();

    const coreGpaMatch = text.match(/Core\s*GPA:\s*([\d.]+)/i);
    if (coreGpaMatch) info.cadet.coreGpa = coreGpaMatch[1].trim();

    const emplidMatch = text.match(/EMPLID:\s*(\d+)/i);
    if (emplidMatch) info.cadet.emplid = emplidMatch[1].trim();

    const unitsMatch = text.match(/Total Semester Hr \(units\)\s*:\s*([\d.]+)/i);
    if (unitsMatch) info.cadet.totalUnits = parseFloat(unitsMatch[1].trim());

    // Locate term headers like: "2023 FALL", "2024 SPRING", "2023 SUMMER"
    const termRegex = /\b(20\d{2})\s+(FALL|SPRING|SUMMER)\b/gi;
    const termPositions = [];
    let match;
    while ((match = termRegex.exec(text)) !== null) {
      termPositions.push({
        year: parseInt(match[1]),
        season: match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase(),
        index: match.index
      });
    }

    // Sort chronologically
    termPositions.sort((a, b) => a.index - b.index);

    // Extract courses between term sections
    for (let i = 0; i < termPositions.length; i++) {
      const current = termPositions[i];
      const nextIndex = (i + 1 < termPositions.length) ? termPositions[i + 1].index : text.length;
      const termBlock = text.substring(current.index, nextIndex);
      const isSummerTerm = current.season === 'Summer';

      const termId = `${current.year}_${current.season.toLowerCase()}`;
      let termObj = info.terms.find(t => t.id === termId);
      if (!termObj) {
        termObj = {
          id: termId,
          name: `${current.season} ${current.year}`,
          season: current.season,
          year: current.year,
          isSummer: isSummerTerm,
          courses: []
        };
        info.terms.push(termObj);
      }

      // Match course lines: e.g. "MATH 142 V 3" or "AEROENGR 315 (1) 3" or "MECHENGR 325 (1) 3" or "PHYED 112B C+ 0.5" or "CE 300E (1) 0"
      const gradeToken = '(?:[A-Za-z*][+-]?|[A-Za-z*]{1,2}|\\(\\d\\))';
      const courseRegex = new RegExp(
        `\\b([A-Z]{2,10})\\s+(\\d{3}[A-Z\\d]?)(?:\\s+(${gradeToken}))?(?:\\s+(${gradeToken}))?(?:\\s+(\\d+(?:\\.\\d+)?))?`,
        'g'
      );

      let cMatch;
      while ((cMatch = courseRegex.exec(termBlock)) !== null) {
        const dept = cMatch[1];
        const num = cMatch[2];
        const g1 = cMatch[3] ? cMatch[3].trim() : "";
        const g2 = cMatch[4] ? cMatch[4].trim() : "";
        let credits = (cMatch[5] !== undefined && cMatch[5] !== "") ? parseFloat(cMatch[5]) : null;

        // Exclude footer tokens, headers, or statistics
        if (["GPA", "MPA", "PEA", "CUM", "SEM", "SEX", "SQ", "CL", "YR", "TOTAL", "PROG"].includes(dept)) continue;

        let grade = g2 || g1 || "";
        if (/^\(\d\)$/.test(grade)) grade = ""; // Strip session/period indicators like (1) or (2)
        if (/^\(\d\)$/.test(g1) && !g2) grade = "";

        const isPlanned = grade === "*" || !grade || termBlock.includes(`${dept} ${num} *`);
        const isValidated = grade === "V" || grade === "T";

        // Format course display & fallback to curriculum credits if omitted on line
        const courseLookup = this.curriculum.getCourse(`${dept} ${num}`);
        const codeDisplay = courseLookup ? courseLookup.id : `${dept} ${num}`;
        if (credits === null || isNaN(credits)) {
          credits = courseLookup && courseLookup.credits !== undefined ? courseLookup.credits : 3.0;
        }

        // Avoid pushing duplicate courses in the same term
        const normKey = this.curriculum.normalizeKey(codeDisplay);
        const alreadyInTerm = termObj.courses.some(c => this.curriculum.normalizeKey(c.code) === normKey);
        if (!alreadyInTerm) {
          termObj.courses.push({
            code: codeDisplay,
            credits: credits,
            grade: isPlanned ? "" : grade,
            status: isPlanned ? "Planned" : "Completed",
            isValidated: isValidated,
            dept: dept,
            number: num
          });
        }
      }
    }

    // Sort terms strictly chronologically (Spring=1, Summer=2, Fall=3)
    const seasonWeights = { 'spring': 1, 'summer': 2, 'fall': 3 };
    info.terms.sort((a, b) => {
      const valA = (a.year * 10) + (seasonWeights[(a.season || '').toLowerCase()] || 0);
      const valB = (b.year * 10) + (seasonWeights[(b.season || '').toLowerCase()] || 0);
      return valA - valB;
    });

    return info;
  }

  parseGradCheck(text) {
    const missingRequirements = [];
    const satisfiedRequirements = [];

    // Missing requirements pattern: e.g., "/ Socio Adv (H) --- 0.0" or "ME Opt 1 --- 0.0"
    const missingRegex = /[/]?\s*([A-Za-z0-9\s/()\-]+?)\s+---\s+([\d.]+)/g;
    let mMatch;
    while ((mMatch = missingRegex.exec(text)) !== null) {
      missingRequirements.push({
        requirement: mMatch[1].trim(),
        units: parseFloat(mMatch[2]),
        status: "Missing"
      });
    }

    // Satisfied / planned courses pattern: e.g., "/ Math I MATH 141Z C 2228 B 3.0"
    const satRegex = /[/]?\s*([A-Za-z0-9\s/()\-]+?)\s+([A-Z]{2,10})\s+(\d{3}[A-Z\d]?)\s+(C|M1|M2|C,M1)?\s*(\d{4})\s*([A-D][+-]?|P|\*|\s+)?\s*([\d.]+)/g;
    let sMatch;
    while ((sMatch = satRegex.exec(text)) !== null) {
      const isPlanned = sMatch[6] ? sMatch[6].includes("*") : false;
      satisfiedRequirements.push({
        requirement: sMatch[1].trim(),
        course: `${sMatch[2]} ${sMatch[3]}`,
        termCode: sMatch[5],
        grade: isPlanned ? "" : (sMatch[6] ? sMatch[6].trim() : ""),
        units: parseFloat(sMatch[7]),
        status: isPlanned ? "Planned" : "Completed"
      });
    }

    return {
      rawText: text,
      missing: missingRequirements,
      satisfied: satisfiedRequirements
    };
  }
}

// Global instance
window.pdfIngestService = new PDFIngestService(window.curriculumService);
