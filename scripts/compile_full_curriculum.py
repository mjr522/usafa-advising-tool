import re
import json
import pypdf

PDF_PATH = "COI Handbook 2026-2027.pdf"
OUTPUT_PATH = "data/curriculum_data.json"

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def normalize_key(code):
    return re.sub(r'[^A-Z0-9]', '', code.upper())

def extract_all_courses():
    reader = pypdf.PdfReader(PDF_PATH)
    total_pages = len(reader.pages)
    
    app2_start = 297
    app2_end = 472
    
    full_text = ""
    for page_idx in range(app2_start, min(app2_end, total_pages)):
        text = reader.pages[page_idx].extract_text()
        full_text += "\n" + text
        
    course_pattern = re.compile(
        r'(?:^|\n)([A-Z][A-Za-z\s/&]+?)\s+(\d{3}[A-Z]?)\.\s+([^.]+?\.)\s+(\d+(?:\.\d+)?)\s*\(([^)]*)\)\.\s*(.*?)(?=(?:\n[A-Z][A-Za-z\s/&]+?\s+\d{3}[A-Z]?\.\s+[^.]+?\.\s+\d+(?:\.\d+)?\s*\()|\Z)',
        re.DOTALL
    )
    
    courses = {}
    matches = course_pattern.findall(full_text)
    
    for dept_raw, num, title_raw, credits_raw, contact_raw, body in matches:
        dept = clean_text(dept_raw)
        title = clean_text(title_raw).rstrip('.')
        try:
            credits = float(credits_raw)
        except ValueError:
            credits = 3.0
            
        body_clean = clean_text(body)
        
        prereq_match = re.search(r'Pre[rR]eq\s*:\s*([^.]*)', body_clean, re.IGNORECASE)
        prereqs_str = prereq_match.group(1).strip() if prereq_match else ""
        
        coreq_match = re.search(r'Co[rR]eq\s*:\s*([^.]*)', body_clean, re.IGNORECASE)
        coreqs_str = coreq_match.group(1).strip() if coreq_match else ""
        
        sem_match = re.search(r'Sem\s+hrs?\s*:\s*([^.]*)', body_clean, re.IGNORECASE)
        sem_str = sem_match.group(1).strip() if sem_match else ""
        
        sem_lower = sem_str.lower()
        offerings = []
        if 'fall or spring' in sem_lower or ('fall' in sem_lower and 'spring' in sem_lower):
            offerings = ['Fall', 'Spring']
        elif 'fall' in sem_lower:
            offerings = ['Fall']
        elif 'spring' in sem_lower:
            offerings = ['Spring']
        elif 'summer' in sem_lower:
            offerings = ['Summer']
        else:
            offerings = ['Fall', 'Spring']
            
        is_even_only = 'even' in sem_lower
        is_odd_only = 'odd' in sem_lower
        
        # Parse structured prerequisites codes
        # Look for course codes inside prereqs_str
        prereq_codes = []
        for p_match in re.finditer(r'([A-Z][A-Za-z\s]+?)\s+(\d{3}[A-Z]?)', prereqs_str):
            p_dept, p_num = p_match.groups()
            p_key = normalize_key(f"{p_dept} {p_num}")
            if len(p_key) >= 4 and p_key not in prereq_codes:
                prereq_codes.append(p_key)
                
        coreq_codes = []
        for c_match in re.finditer(r'([A-Z][A-Za-z\s]+?)\s+(\d{3}[A-Z]?)', coreqs_str):
            c_dept, c_num = c_match.groups()
            c_key = normalize_key(f"{c_dept} {c_num}")
            if len(c_key) >= 4 and c_key not in coreq_codes:
                coreq_codes.append(c_key)
        
        course_id = f"{dept} {num}".upper()
        canonical_key = normalize_key(course_id)
        
        # Difficulty & Advisor tip defaults
        difficulty = "Moderate"
        advisor_tips = ""
        pairing_warnings = ""
        
        if "MECH" in canonical_key or "ENGR" in canonical_key or "AERO" in canonical_key:
            if num in ["312", "320", "330", "341", "441"]:
                difficulty = "Demanding"
                advisor_tips = "Core engineering science course with rigorous analytical problem sets. Ensure calculus & physics background is strong."
                pairing_warnings = "Avoid taking with more than two other high-workload engineering lab courses in the same semester."
            elif num in ["491", "492"]:
                difficulty = "Demanding"
                advisor_tips = "Senior Capstone Design sequence. Requires sustained team effort, project milestones, and sponsor deliverables. Must be taken in consecutive Fall-Spring terms."
            elif num in ["205", "402"]:
                difficulty = "Light"
                advisor_tips = "Seminar / FE exam prep course. Focus is practical skills and certification."
        elif "MATH" in canonical_key:
            if num in ["141", "142", "243", "245"]:
                difficulty = "Demanding"
                advisor_tips = "Foundational STEM core. Daily problem sets and quizzes."
        elif "PHYSICS" in canonical_key:
            if num in ["110", "215"]:
                difficulty = "Demanding"
                advisor_tips = "Core lab science with significant hands-on lab and recitation workload."
        elif "SYS" in canonical_key:
            if num in ["301", "310", "311", "320"]:
                difficulty = "Moderate"
                advisor_tips = "Core systems methodology and lifecycle modeling. Involves semester-long team design projects."
            elif num in ["491", "492"]:
                difficulty = "Demanding"
                advisor_tips = "Multidisciplinary Capstone Design sequence. Coordinated with domain department host (Aero, Space, Mech, Cyber, or DFSE)."
                
        courses[canonical_key] = {
            "id": course_id,
            "dept": dept,
            "number": num,
            "title": title,
            "credits": credits,
            "contact": contact_raw,
            "prereqs_text": prereqs_str,
            "coreqs_text": coreqs_str,
            "prereq_keys": prereq_codes,
            "coreq_keys": coreq_codes,
            "semesters_offered": offerings,
            "even_years_only": is_even_only,
            "odd_years_only": is_odd_only,
            "offering_text": sem_str,
            "description": body_clean[:600] + ("..." if len(body_clean) > 600 else ""),
            "difficulty": difficulty,
            "advisor_tips": advisor_tips,
            "pairing_warnings": pairing_warnings
        }
        
    return courses

def build_curriculum():
    courses = extract_all_courses()
    
    # Add common standard USAFA abbreviations/aliases if not already in catalog
    alias_dict = {
        "MATH141Z": "MATH 141",
        "MATH142Z": "MATH 142",
        "PHYSICS110H": "PHYSICS 110",
        "PHYSICS215S": "PHYSICS 215",
        "MECHENGR220S": "MECH ENGR 220",
        "BEHSCI110S": "BEH SCI 110",
        "ECON201S": "ECON 201",
        "MSS251S": "MSS 251",
        "ENGLISH200S": "ENGLISH 211",
        "COMPSCI206X": "COMP SCI 206",
        "LDRSHP100E": "LDRSHP 100",
        "LDRSHP200E": "LDRSHP 200",
        "LDRSHP300E": "LDRSHP 300",
        "LDRSHP100A": "LDRSHP 100",
        "LDRSHP200D": "LDRSHP 200",
        "LDRSHP300A": "LDRSHP 300",
        "LDRSHP400X": "LDRSHP 400"
    }
    
    # Ensure critical courses exist in catalog
    core_stubs = [
        ("MECHENGR205", "MECH ENGR 205", "Engineering Tools Seminar", 1.0, ["Fall", "Spring"]),
        ("MECHENGR220", "MECH ENGR 220", "Fundamentals of Mechanics", 3.0, ["Fall", "Spring"]),
        ("MECHENGR312", "MECH ENGR 312", "Thermodynamics", 3.0, ["Fall"]),
        ("MECHENGR320", "MECH ENGR 320", "Dynamics", 3.0, ["Fall", "Spring"]),
        ("MECHENGR325", "MECH ENGR 325", "Engineering System Dynamics", 3.0, ["Spring"]),
        ("MECHENGR330", "MECH ENGR 330", "Mechanics of Deformable Bodies", 3.0, ["Fall", "Spring"]),
        ("MECHENGR341", "MECH ENGR 341", "Fluid Mechanics", 3.0, ["Spring"]),
        ("MECHENGR350", "MECH ENGR 350", "Mechanical Behavior of Materials", 3.0, ["Fall"]),
        ("MECHENGR370", "MECH ENGR 370", "Introduction to Machine Design", 3.0, ["Spring"]),
        ("MECHENGR441", "MECH ENGR 441", "Heat Transfer", 3.0, ["Spring"]),
        ("MECHENGR460", "MECH ENGR 460", "Experimental Mechanics", 3.0, ["Fall"]),
        ("MECHENGR491", "MECH ENGR 491", "Capstone Design Project I", 3.0, ["Fall"]),
        ("MECHENGR492", "MECH ENGR 492", "Capstone Design Project II", 3.0, ["Spring"]),
        ("SYSENGR301", "SYS ENGR 301", "Project Engineering", 3.0, ["Fall"]),
        ("SYSENGR310", "SYS ENGR 310", "Introduction to Systems Engineering", 3.0, ["Fall", "Spring"]),
        ("SYSENGR311", "SYS ENGR 311", "Intermediate Systems Engineering Methods", 3.0, ["Fall"]),
        ("SYSENGR320", "SYS ENGR 320", "Optimization Theory with Design Applications", 3.0, ["Spring"]),
        ("SYSENGR336", "SYS ENGR 336", "Engineering Economics and Financial Management", 3.0, ["Spring"]),
        ("SYSENGR405", "SYS ENGR 405", "Systems Engineering Colloquium I", 0.0, ["Fall"]),
        ("SYSENGR406", "SYS ENGR 406", "Systems Engineering Colloquium II", 0.0, ["Spring"]),
        ("SYSENGR491", "SYS ENGR 491", "Systems Engineering Capstone Design I", 3.0, ["Fall"]),
        ("SYSENGR492", "SYS ENGR 492", "Systems Engineering Capstone Design II", 3.0, ["Spring"]),
        ("OPSRSC312", "OPS RSCH 312", "Probabilistic Models", 3.0, ["Spring"]),
        ("BEHSCI373", "BEH SCI 373", "Human Factors Engineering", 3.0, ["Fall"]),
        ("ENGR346", "ENGR 346", "Engineering Mathematics", 3.0, ["Fall", "Spring"]),
        ("ENGR402", "ENGR 402", "Professional Engineering Development", 0.5, ["Spring"]),
        ("COMPSCI110", "COMP SCI 110", "Introduction to Computing", 3.0, ["Fall", "Spring"]),
        ("COMPSCI110S", "COMP SCI 110S", "Introduction to Computing for Scholars", 3.0, ["Fall", "Spring"]),
        ("COMPSCI206", "COMP SCI 206", "Fundamentals of Programming for Engineers", 1.0, ["Fall", "Spring"]),
        ("COMPSCI211", "COMP SCI 211", "Intro to Programming for Scientists & Engineers", 4.0, ["Spring"]),
        ("MATH141", "MATH 141", "Calculus I", 3.0, ["Fall", "Spring"]),
        ("MATH142", "MATH 142", "Calculus II", 3.0, ["Fall", "Spring"]),
        ("MATH243", "MATH 243", "Multivariate Calculus", 3.0, ["Fall", "Spring"]),
        ("MATH253", "MATH 253", "Advanced Placed Calculus III", 3.0, ["Fall", "Spring"]),
        ("MATH245", "MATH 245", "Differential Equations", 3.0, ["Fall", "Spring"]),
        ("MATH356", "MATH 356", "Probability and Statistics for Engineers and Scientists", 3.0, ["Fall", "Spring"]),
        ("PHYSICS110", "PHYSICS 110", "General Physics I", 4.0, ["Fall", "Spring"]),
        ("PHYSICS215", "PHYSICS 215", "General Physics II with Calculus", 4.0, ["Fall", "Spring"]),
        ("CHEM100", "CHEM 100", "General Chemistry I", 4.0, ["Fall", "Spring"]),
        ("CHEM200", "CHEM 200", "General Chemistry II", 4.0, ["Fall", "Spring"]),
        ("BIOLOGY215", "BIOLOGY 215", "Introductory Biology with Lab", 4.0, ["Fall", "Spring"]),
        ("AEROENGR315", "AERO ENGR 315", "Fundamentals of Aeronautics", 3.0, ["Fall", "Spring"]),
        ("ASTRENGR310", "ASTR ENGR 310", "Introduction to Astronautics", 3.0, ["Fall", "Spring"]),
        ("ECE315", "ECE 315", "Principles of Air Force Electronic Systems", 3.0, ["Fall", "Spring"]),
        ("MSS251", "MSS 251", "Airpower and Joint Operations Strategy", 4.5, ["Fall", "Spring"]),
        ("HISTORY100", "HISTORY 100", "Introduction to Military History", 3.0, ["Fall", "Spring"]),
        ("HISTORY300", "HISTORY 300", "World History of Warfare", 3.0, ["Fall", "Spring"]),
        ("ENGLISH111", "ENGLISH 111", "Introductory Composition and Speech", 3.0, ["Fall", "Spring"]),
        ("ENGLISH211", "ENGLISH 211", "Literature and Intermediate Composition", 3.0, ["Fall", "Spring"]),
        ("BEHSCI110", "BEH SCI 110", "Introduction to Behavioral Sciences", 3.0, ["Fall", "Spring"]),
        ("ECON201", "ECON 201", "Economics and National Security", 3.5, ["Fall", "Spring"]),
        ("LAW220", "LAW 220", "Law for Air Force Officers", 3.0, ["Fall", "Spring"]),
        ("PHILOS210", "PHILOS 210", "Ethics and the Military Profession", 3.0, ["Fall", "Spring"]),
        ("POLSCI211", "POL SCI 211", "Politics, American Government and National Security", 3.0, ["Fall", "Spring"]),
        ("SOCSCI311", "SOC SCI 311", "International Security Studies", 3.0, ["Fall", "Spring"]),
        ("DATASCI220", "DATA SCI 220", "Introduction to Data Science", 3.0, ["Fall", "Spring"]),
        ("LDRSHP100", "LDRSHP 100", "Foundations of Leadership", 1.5, ["Spring"]),
        ("LDRSHP200", "LDRSHP 200", "Interpersonal Leadership", 0.75, ["Spring"]),
        ("LDRSHP300", "LDRSHP 300", "Organizational Leadership", 0.75, ["Spring"]),
        ("LDRSHP400", "LDRSHP 400", "Executive Leadership", 0.75, ["Spring"])
    ]
    
    for key, cid, title, cr, off in core_stubs:
        if key not in courses:
            courses[key] = {
                "id": cid,
                "dept": cid.split()[0],
                "number": cid.split()[-1],
                "title": title,
                "credits": cr,
                "contact": "3(1)",
                "prereqs_text": "",
                "coreqs_text": "",
                "prereq_keys": [],
                "coreq_keys": [],
                "semesters_offered": off,
                "even_years_only": False,
                "odd_years_only": False,
                "offering_text": f"{cr} {' or '.join(off).lower()}.",
                "description": f"Standard USAFA curriculum course: {title}.",
                "difficulty": "Moderate",
                "advisor_tips": "",
                "pairing_warnings": ""
            }

    # Add specific prerequisites that are known for ME and SE
    prereq_map = {
        "MATH142": ["MATH141"],
        "MATH243": ["MATH142"],
        "MATH253": ["MATH142"],
        "MATH245": ["MATH142"],
        "MATH356": ["MATH142"],
        "ENGR346": ["MATH245"],
        "PHYSICS110": ["MATH141"],
        "PHYSICS215": ["PHYSICS110", "MATH142"],
        "MECHENGR220": ["PHYSICS110", "MATH142"],
        "MECHENGR312": ["PHYSICS110", "MATH142"],
        "MECHENGR320": ["MECHENGR220"],
        "MECHENGR325": ["MECHENGR320", "MATH245"],
        "MECHENGR330": ["MECHENGR220"],
        "MECHENGR341": ["MECHENGR312", "MATH245"],
        "MECHENGR350": ["MECHENGR330"],
        "MECHENGR370": ["MECHENGR330"],
        "MECHENGR441": ["MECHENGR312", "MECHENGR341"],
        "MECHENGR460": ["MECHENGR330", "MECHENGR350"],
        "MECHENGR491": ["MECHENGR370"],
        "MECHENGR492": ["MECHENGR491"],
        "SYSENGR301": [],
        "SYSENGR310": [],
        "SYSENGR311": ["SYSENGR310"],
        "SYSENGR320": ["SYSENGR310", "MATH142"],
        "SYSENGR336": ["SYSENGR310"],
        "SYSENGR491": ["SYSENGR301", "SYSENGR311"],
        "SYSENGR492": ["SYSENGR491"],
        "OPSRSC312": ["MATH142"]
    }
    
    for ckey, pkeys in prereq_map.items():
        if ckey in courses:
            courses[ckey]["prereq_keys"] = pkeys

    # Build Mechanical Engineering Curriculum Definition
    me_curriculum = {
        "id": "ME",
        "name": "Mechanical Engineering",
        "degree": "Bachelor of Science in Mechanical Engineering",
        "total_credits": 140.75,
        "core_credits": 88.75,
        "major_credits": 47.0,
        "pe_credits": 5.0,
        "suggested_sequence": [
            {
                "term_id": "4_fall",
                "term_name": "4° Fall (Freshman)",
                "courses": [
                    {"code": "FORLANG 131", "credits": 3.0, "category": "Core"},
                    {"code": "BEH SCI 110", "credits": 3.0, "category": "Core"},
                    {"code": "ENGLISH 111", "credits": 3.0, "category": "Core"},
                    {"code": "COMP SCI 110", "credits": 3.0, "category": "Core"},
                    {"code": "MATH 141", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 112", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "4_spring",
                "term_name": "4° Spring (Freshman)",
                "courses": [
                    {"code": "FORLANG 132", "credits": 3.0, "category": "Core"},
                    {"code": "CHEM 100", "credits": 4.0, "category": "Core"},
                    {"code": "HISTORY 100", "credits": 3.0, "category": "Core"},
                    {"code": "MATH 142", "credits": 3.0, "category": "Core"},
                    {"code": "PHYSICS 110", "credits": 4.0, "category": "Core"},
                    {"code": "LDRSHP 100", "credits": 1.5, "category": "Core"},
                    {"code": "PHYED 110", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "3_fall",
                "term_name": "3° Fall (Sophomore)",
                "courses": [
                    {"code": "MATH 243", "credits": 3.0, "category": "Core"},
                    {"code": "ECON 201", "credits": 3.0, "category": "Core"},
                    {"code": "MECH ENGR 220", "credits": 3.0, "category": "Major"},
                    {"code": "PHYSICS 215", "credits": 4.0, "category": "Core"},
                    {"code": "ENGLISH 211", "credits": 3.0, "category": "Core"},
                    {"code": "POL SCI 211", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 215", "credits": 1.0, "category": "PE"}
                ]
            },
            {
                "term_id": "3_spring",
                "term_name": "3° Spring (Sophomore)",
                "courses": [
                    {"code": "MECH ENGR 320", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 330", "credits": 3.0, "category": "Major"},
                    {"code": "COMP SCI 206", "credits": 1.0, "category": "Major"},
                    {"code": "MATH 245", "credits": 3.0, "category": "Core"},
                    {"code": "CHEM 200", "credits": 4.0, "category": "Core"},
                    {"code": "MSS 251", "credits": 4.5, "category": "Core"},
                    {"code": "PHYED 111", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "2_fall",
                "term_name": "2° Fall (Junior)",
                "courses": [
                    {"code": "MECH ENGR 312", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 350", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 205", "credits": 1.0, "category": "Major"},
                    {"code": "ENGR 346", "credits": 3.0, "category": "Major"},
                    {"code": "LAW 220", "credits": 3.0, "category": "Core"},
                    {"code": "SOC SCI 311", "credits": 3.0, "category": "Core"},
                    {"code": "ECE 315", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 222", "credits": 1.0, "category": "PE"}
                ]
            },
            {
                "term_id": "2_spring",
                "term_name": "2° Spring (Junior)",
                "courses": [
                    {"code": "MECH ENGR 325", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 341", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 370", "credits": 3.0, "category": "Major"},
                    {"code": "DATA SCI 220", "credits": 3.0, "category": "Core"},
                    {"code": "PHILOS 210", "credits": 3.0, "category": "Core"},
                    {"code": "LDRSHP 300", "credits": 0.75, "category": "Core"},
                    {"code": "PHYED 315", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "1_fall",
                "term_name": "1° Fall (Senior)",
                "courses": [
                    {"code": "MECH ENGR 491", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 460", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 431", "credits": 3.0, "category": "Elective"},
                    {"code": "MECH ENGR 440", "credits": 3.0, "category": "Elective"},
                    {"code": "HISTORY 300", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 342", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "1_spring",
                "term_name": "1° Spring (Senior)",
                "courses": [
                    {"code": "MECH ENGR 492", "credits": 3.0, "category": "Major"},
                    {"code": "MECH ENGR 441", "credits": 3.0, "category": "Major"},
                    {"code": "AERO ENGR 315", "credits": 3.0, "category": "Core"},
                    {"code": "ASTR ENGR 310", "credits": 3.0, "category": "Core"},
                    {"code": "MECH ENGR 450", "credits": 3.0, "category": "Elective"},
                    {"code": "PHYED 488", "credits": 0.5, "category": "PE"}
                ]
            }
        ],
        "tracks": {
            "Structures": {
                "name": "Structures Track",
                "description": "Focuses on aerospace structures, structural dynamics, finite elements, and advanced materials.",
                "courses": ["MECH ENGR 332", "MECH ENGR 421", "MECH ENGR 431", "MECH ENGR 450"]
            },
            "Materials": {
                "name": "Materials Track",
                "description": "Focuses on material science, physical metallurgy, failure analysis, and composite materials.",
                "courses": ["MECH ENGR 340", "MECH ENGR 440", "MECH ENGR 445", "MECH ENGR 450"]
            },
            "Thermal-Fluid Science": {
                "name": "Thermal-Fluid Science Track",
                "description": "Focuses on applied heat transfer, computational fluid dynamics, sustainable energy, and automotive systems.",
                "courses": ["MECH ENGR 468", "MECH ENGR 490", "AERO ENGR 341", "AERO ENGR 361"]
            },
            "Dynamic Systems": {
                "name": "Dynamic Systems Track",
                "description": "Focuses on linear systems analysis, mechatronics, vibrations, and automotive systems.",
                "courses": ["ENGR 341", "MECH ENGR 396", "MECH ENGR 421", "MECH ENGR 490"]
            }
        },
        "required_major_courses": [
            "MECHENGR205", "MECHENGR220", "MECHENGR312", "MECHENGR320",
            "MECHENGR325", "MECHENGR330", "MECHENGR341", "MECHENGR350",
            "MECHENGR370", "MECHENGR441", "MECHENGR460", "MECHENGR491", "MECHENGR492",
            "COMPSCI206", "ENGR346"
        ]
    }
    
    # Build Systems Engineering Curriculum Definition
    se_curriculum = {
        "id": "SE",
        "name": "Systems Engineering",
        "degree": "Bachelor of Science in Systems Engineering",
        "total_credits": 139.75,
        "core_credits": 88.75,
        "major_credits": 46.0,
        "pe_credits": 5.0,
        "suggested_sequence": [
            {
                "term_id": "4_fall",
                "term_name": "4° Fall (Freshman)",
                "courses": [
                    {"code": "FORLANG 131", "credits": 3.0, "category": "Core"},
                    {"code": "BEH SCI 110", "credits": 3.0, "category": "Core"},
                    {"code": "CHEM 100", "credits": 4.0, "category": "Core"},
                    {"code": "COMP SCI 110", "credits": 3.0, "category": "Core"},
                    {"code": "MATH 141", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 112", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "4_spring",
                "term_name": "4° Spring (Freshman)",
                "courses": [
                    {"code": "FORLANG 132", "credits": 3.0, "category": "Core"},
                    {"code": "ENGLISH 111", "credits": 3.0, "category": "Core"},
                    {"code": "HISTORY 100", "credits": 3.0, "category": "Core"},
                    {"code": "MATH 142", "credits": 3.0, "category": "Core"},
                    {"code": "PHYSICS 110", "credits": 4.0, "category": "Core"},
                    {"code": "LDRSHP 100", "credits": 1.5, "category": "Core"},
                    {"code": "PHYED 110", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "3_fall",
                "term_name": "3° Fall (Sophomore)",
                "courses": [
                    {"code": "MATH 243", "credits": 3.0, "category": "Core"},
                    {"code": "PHYSICS 215", "credits": 4.0, "category": "Core"},
                    {"code": "LAW 220", "credits": 3.0, "category": "Core"},
                    {"code": "MECH ENGR 220", "credits": 3.0, "category": "Major"},
                    {"code": "ENGLISH 211", "credits": 3.0, "category": "Core"},
                    {"code": "ECON 201", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 215", "credits": 1.0, "category": "PE"}
                ]
            },
            {
                "term_id": "3_spring",
                "term_name": "3° Spring (Sophomore)",
                "courses": [
                    {"code": "MATH 245", "credits": 3.0, "category": "Major"},
                    {"code": "SYS ENGR 310", "credits": 3.0, "category": "Major"},
                    {"code": "COMP SCI 211", "credits": 4.0, "category": "Major"},
                    {"code": "OPS RSCH 310", "credits": 3.0, "category": "Major"},
                    {"code": "PHILOS 210", "credits": 3.0, "category": "Core"},
                    {"code": "POL SCI 211", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 111", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "2_fall",
                "term_name": "2° Fall (Junior)",
                "courses": [
                    {"code": "SYS ENGR 301", "credits": 3.0, "category": "Major"},
                    {"code": "SYS ENGR 311", "credits": 3.0, "category": "Major"},
                    {"code": "AERO ENGR 241", "credits": 3.0, "category": "Elective"},
                    {"code": "DATA SCI 220", "credits": 3.0, "category": "Core"},
                    {"code": "MSS 251", "credits": 4.5, "category": "Core"},
                    {"code": "PHYED 222", "credits": 1.0, "category": "PE"}
                ]
            },
            {
                "term_id": "2_spring",
                "term_name": "2° Spring (Junior)",
                "courses": [
                    {"code": "SYS ENGR 320", "credits": 3.0, "category": "Major"},
                    {"code": "SYS ENGR 336", "credits": 3.0, "category": "Major"},
                    {"code": "OPS RSCH 312", "credits": 3.0, "category": "Major"},
                    {"code": "AERO ENGR 341", "credits": 3.0, "category": "Elective"},
                    {"code": "CHEM 200", "credits": 4.0, "category": "Core"},
                    {"code": "LDRSHP 300", "credits": 0.75, "category": "Core"},
                    {"code": "PHYED 315", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "1_fall",
                "term_name": "1° Fall (Senior)",
                "courses": [
                    {"code": "BEH SCI 373", "credits": 3.0, "category": "Major"},
                    {"code": "AERO ENGR 351", "credits": 3.0, "category": "Elective"},
                    {"code": "SYS ENGR 491", "credits": 3.0, "category": "Major"},
                    {"code": "SYS ENGR 405", "credits": 0.0, "category": "Major"},
                    {"code": "ECE 315", "credits": 3.0, "category": "Core"},
                    {"code": "HISTORY 300", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 342", "credits": 0.5, "category": "PE"}
                ]
            },
            {
                "term_id": "1_spring",
                "term_name": "1° Spring (Senior)",
                "courses": [
                    {"code": "AERO ENGR 352", "credits": 3.0, "category": "Elective"},
                    {"code": "SYS ENGR 492", "credits": 3.0, "category": "Major"},
                    {"code": "SYS ENGR 406", "credits": 0.0, "category": "Major"},
                    {"code": "ASTR ENGR 310", "credits": 3.0, "category": "Core"},
                    {"code": "AERO ENGR 315", "credits": 3.0, "category": "Core"},
                    {"code": "SOC SCI 311", "credits": 3.0, "category": "Core"},
                    {"code": "PHYED 488", "credits": 0.5, "category": "PE"}
                ]
            }
        ],
        "tracks": {
            "Aeronautical": {
                "name": "Aeronautical Systems Track",
                "description": "Focuses on flight vehicles, aerodynamics, propulsion, flight test, and stability & control.",
                "courses": ["MECH ENGR 320", "AERO ENGR 241", "AERO ENGR 341", "AERO ENGR 342", "AERO ENGR 351", "AERO ENGR 352", "AERO ENGR 361", "AERO ENGR 446", "AERO ENGR 456"]
            },
            "Astronautical": {
                "name": "Astronautical Systems Track",
                "description": "Focuses on spacecraft dynamics, satellite communications, rocket propulsion, and space warfighting mission design.",
                "courses": ["MECH ENGR 320", "AERO ENGR 241", "ASTR ENGR 321", "ASTR ENGR 331", "ASTR ENGR 332", "ASTR ENGR 351", "ASTR ENGR 422", "ASTR ENGR 423", "ASTR ENGR 431"]
            },
            "Computer Science": {
                "name": "Computer Systems Track",
                "description": "Focuses on data structures, software architecture, agile software engineering, and computer organization.",
                "courses": ["COMP SCI 210", "COMP SCI 220", "COMP SCI 330", "COMP SCI 350", "COMP SCI 351"]
            },
            "Electrical": {
                "name": "Electrical Systems Track",
                "description": "Focuses on digital design, embedded computer systems, robotics, power electronics, and signal processing.",
                "courses": ["ECE 281", "ECE 332", "ECE 382", "ECE 383", "ECE 387", "ECE 423", "ECE 434", "ECE 485"]
            },
            "Environmental": {
                "name": "Environmental Systems Track",
                "description": "Focuses on hydraulics, environmental engineering, sustainability, and site assessment.",
                "courses": ["CIV ENGR 361", "CIV ENGR 362", "CIV ENGR 351", "CIV ENGR 356", "CIV ENGR 363", "CIV ENGR 461", "CIV ENGR 462", "CIV ENGR 463"]
            },
            "Mechanical": {
                "name": "Mechanical Systems Track",
                "description": "Focuses on deformable bodies, thermodynamics, dynamics, fluid mechanics, machine design, and heat transfer.",
                "courses": ["MECH ENGR 330", "MECH ENGR 312", "MECH ENGR 320", "MECH ENGR 341", "MECH ENGR 350", "MECH ENGR 370", "MECH ENGR 441"]
            }
        },
        "required_major_courses": [
            "SYSENGR301", "SYSENGR310", "SYSENGR311", "SYSENGR320",
            "SYSENGR336", "SYSENGR405", "SYSENGR406", "SYSENGR491", "SYSENGR492",
            "COMPSCI211", "OPSRSCH312", "BEHSCI373", "MATH245"
        ]
    }
    
    # Core Curriculum Definition
    core_curriculum = {
        "academic_core": [
            {"name": "Math I", "code": "MATH 141", "credits": 3.0},
            {"name": "Math II", "code": "MATH 142", "credits": 3.0},
            {"name": "Multivariate Calculus", "code": "MATH 243", "credits": 3.0},
            {"name": "Chemistry I", "code": "CHEM 100", "credits": 4.0},
            {"name": "Physics I", "code": "PHYSICS 110", "credits": 4.0},
            {"name": "Physics II / Chem II", "code": "PHYSICS 215", "credits": 4.0},
            {"name": "Comp Sci I", "code": "COMP SCI 110", "credits": 3.0},
            {"name": "English I", "code": "ENGLISH 111", "credits": 3.0},
            {"name": "English II", "code": "ENGLISH 211", "credits": 3.0},
            {"name": "History 100", "code": "HISTORY 100", "credits": 3.0},
            {"name": "History 300", "code": "HISTORY 300", "credits": 3.0},
            {"name": "Beh Sci 110", "code": "BEH SCI 110", "credits": 3.0},
            {"name": "Econ 201", "code": "ECON 201", "credits": 3.5},
            {"name": "Law 220", "code": "LAW 220", "credits": 3.0},
            {"name": "Philos 210", "code": "PHILOS 210", "credits": 3.0},
            {"name": "Pol Sci 211", "code": "POL SCI 211", "credits": 3.0},
            {"name": "Soc Sci 311", "code": "SOC SCI 311", "credits": 3.0},
            {"name": "Data Sci 220", "code": "DATA SCI 220", "credits": 3.0},
            {"name": "MSS 251", "code": "MSS 251", "credits": 4.5},
            {"name": "ECE 315", "code": "ECE 315", "credits": 3.0},
            {"name": "Aero Engr 315", "code": "AERO ENGR 315", "credits": 3.0},
            {"name": "Astr Engr 310", "code": "ASTR ENGR 310", "credits": 3.0},
            {"name": "Foreign Lang I", "code": "FORLANG 131", "credits": 3.0},
            {"name": "Foreign Lang II", "code": "FORLANG 132", "credits": 3.0},
            {"name": "Ldrshp 100", "code": "LDRSHP 100", "credits": 1.5},
            {"name": "Ldrshp 200", "code": "LDRSHP 200", "credits": 0.75},
            {"name": "Ldrshp 300", "code": "LDRSHP 300", "credits": 0.75},
            {"name": "Ldrshp 400", "code": "LDRSHP 400", "credits": 0.75}
        ],
        "pe_core": [
            {"name": "Basic Physical Training", "code": "PHYED 100", "credits": 0.0},
            {"name": "Boxing", "code": "PHYED 110", "credits": 0.5},
            {"name": "Swimming", "code": "PHYED 111", "credits": 0.5},
            {"name": "Physical Development", "code": "PHYED 112", "credits": 0.5},
            {"name": "Water Survival", "code": "PHYED 222", "credits": 0.5},
            {"name": "Combatives I", "code": "PHYED 215", "credits": 0.5},
            {"name": "Combatives II", "code": "PHYED 315", "credits": 0.5},
            {"name": "Individual Sport", "code": "PHYED 342", "credits": 0.5},
            {"name": "Team Sport", "code": "PHYED 488", "credits": 0.5},
            {"name": "PhyEd Elective", "code": "PHYED 348", "credits": 0.5}
        ]
    }
    
    final_data = {
        "version": "1.0",
        "academic_year": "2026-2027",
        "majors": {
            "ME": me_curriculum,
            "SE": se_curriculum
        },
        "core": core_curriculum,
        "courses": courses,
        "aliases": alias_dict
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2)
        
    js_output_path = "data/curriculum_data.js"
    with open(js_output_path, "w", encoding="utf-8") as f:
        f.write("window.USAFA_CURRICULUM_DATA = " + json.dumps(final_data) + ";\n")

    print(f"Successfully compiled curriculum into {OUTPUT_PATH} and {js_output_path}")
    print(f"Total courses: {len(courses)}")

if __name__ == "__main__":
    build_curriculum()
