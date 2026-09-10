import os
import re
import json
import pypdf

def parse_aps_text(text):
    """
    Parses an Academic Program Summary (APS) text from COMPASS/SIS into structured term data.
    """
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Cadet Info
    info = {
        "major": "",
        "class_year": "",
        "emplid": "",
        "cum_gpa": "",
        "total_units": "",
        "terms": []
    }
    
    major_match = re.search(r'Major\(s\):\s*([^\n]+)', text)
    if major_match:
        info["major"] = major_match.group(1).strip()
        
    cl_match = re.search(r'CL YR:\s*(\d{4})', text)
    if cl_match:
        info["class_year"] = cl_match.group(1).strip()
        
    gpa_match = re.search(r'CUM GPA:\s*([\d.]+)', text)
    if gpa_match:
        info["cum_gpa"] = gpa_match.group(1).strip()
        
    units_match = re.search(r'Total Semester Hr \(units\)\s*:\s*([\d.]+)', text)
    if units_match:
        info["total_units"] = units_match.group(1).strip()

    # Find term sections: e.g. "2022 SUMMER", "2022 FALL", "2023 SPRING"
    term_header_pattern = re.compile(r'^(20\d{2})\s+(FALL|SPRING|SUMMER)\b', re.IGNORECASE)
    
    current_term = None
    
    # Course line regex:
    # e.g.: MATH 141Z B B 3
    # or: MECHENGR 312 3
    # or: PHYED 112B C+ 0.5
    # or: MILTNG 100 P 0
    course_pattern = re.compile(
        r'^([A-Z]{2,10})\s+(\d{3}[A-Z\d]?)\s+([A-D][+-]?|P|W|T|\*|\s+)?\s*([A-D][+-]?|P|W|T|\*|\s+)?\s*(\d+(?:\.\d+)?)$'
    )
    
    for line in lines:
        term_match = term_header_pattern.match(line)
        if term_match:
            year, season = term_match.groups()
            current_term = {
                "term_name": f"{season.capitalize()} {year}",
                "year": int(year),
                "season": season.capitalize(),
                "courses": []
            }
            info["terms"].append(current_term)
            continue
            
        if current_term is not None:
            # Check for end of term or summary stats
            if "Total Sem/Cum:" in line or "GPA MPA PEA" in line or "Honors:" in line:
                continue
            
            c_match = course_pattern.match(line)
            if c_match:
                dept, num, g1, g2, credits = c_match.groups()
                grade = g2 if g2 else (g1 if g1 else "")
                is_planned = "*" in line or not grade or grade == "*"
                current_term["courses"].append({
                    "dept": dept,
                    "number": num,
                    "code": f"{dept} {num}",
                    "credits": float(credits),
                    "grade": "" if is_planned else grade.strip(),
                    "status": "Planned" if is_planned else ("Completed" if grade != "F" else "Failed")
                })
            else:
                # Try more permissive course match: [DEPT] [NUM] ... [CREDITS]
                parts = line.split()
                if len(parts) >= 2 and re.match(r'^[A-Z]{2,10}$', parts[0]) and re.match(r'^\d{3}[A-Z\d]?$', parts[1]):
                    # Last element might be credit
                    try:
                        cr = float(parts[-1])
                        grade = parts[2] if len(parts) >= 4 and parts[2] in ['A','A-','B+','B','B-','C+','C','C-','D','F','P','W'] else ""
                        is_planned = not grade or grade == "*"
                        current_term["courses"].append({
                            "dept": parts[0],
                            "number": parts[1],
                            "code": f"{parts[0]} {parts[1]}",
                            "credits": cr,
                            "grade": grade,
                            "status": "Planned" if is_planned else "Completed"
                        })
                    except ValueError:
                        pass

    return info

def parse_gradcheck_text(text):
    """
    Parses a Grad Check Report from COMPASS/SIS into structured requirement audit data.
    """
    missing_requirements = []
    satisfied_requirements = []
    
    # Missing pattern: e.g. "/ Socio Adv (H) --- 0.0" or "ME Opt 1 --- 0.0"
    missing_pattern = re.compile(r'[/]?\s*([A-Za-z0-9\s/()\-]+?)\s+---\s+([\d.]+)')
    
    # Satisfied pattern:
    # e.g.: / Math I MATH 141Z C 2228 B 3.0
    # or: MechEngr 312 MECHENGR 312 M1 2248 3.0
    satisfied_pattern = re.compile(
        r'[/]?\s*([A-Za-z0-9\s/()\-]+?)\s+([A-Z]{2,10})\s+(\d{3}[A-Z\d]?)\s+(C|M1|M2|C,M1)?\s*(\d{4})\s*([A-D][+-]?|P|\*|\s+)?\s*([\d.]+)'
    )
    
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
            
        m_match = missing_pattern.search(line)
        if m_match and "---" in line:
            req_name, units = m_match.groups()
            missing_requirements.append({
                "requirement": req_name.strip(),
                "units": float(units),
                "status": "Missing"
            })
            continue
            
        s_match = satisfied_pattern.search(line)
        if s_match:
            req_name, dept, num, gpa_type, term_code, grade, units = s_match.groups()
            is_planned = "*" in line
            satisfied_requirements.append({
                "requirement": req_name.strip(),
                "course": f"{dept} {num}",
                "term_code": term_code,
                "grade": grade.strip() if grade else "",
                "units": float(units),
                "status": "Planned" if is_planned else "Completed"
            })
            
    return {
        "missing": missing_requirements,
        "satisfied": satisfied_requirements
    }

if __name__ == "__main__":
    folder = "Redacted Graduation Checks and Plans"
    for filename in os.listdir(folder):
        if not filename.endswith(".pdf"):
            continue
        filepath = os.path.join(folder, filename)
        reader = pypdf.PdfReader(filepath)
        full_text = "\n".join([p.extract_text() for p in reader.pages])
        
        print(f"\n==================== {filename} ====================")
        if "APS" in filename:
            parsed = parse_aps_text(full_text)
            print(f"Major: {parsed['major']}, Class: {parsed['class_year']}, GPA: {parsed['cum_gpa']}, Total Terms: {len(parsed['terms'])}")
            for t in parsed['terms']:
                total_cr = sum(c['credits'] for c in t['courses'])
                courses_str = ", ".join([f"{c['code']} ({c['credits']} cr)" for c in t['courses']])
                print(f"  {t['term_name']} [{total_cr} cr]: {courses_str}")
        else:
            parsed = parse_gradcheck_text(full_text)
            print(f"Satisfied Requirements: {len(parsed['satisfied'])}, Missing Requirements: {len(parsed['missing'])}")
            print("  Missing:")
            for m in parsed['missing']:
                print(f"    - {m['requirement']}")
