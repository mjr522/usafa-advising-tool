import re
import json
import pypdf

PDF_PATH = "COI Handbook 2026-2027.pdf"
OUTPUT_PATH = "data/curriculum_data.json"

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def extract_courses():
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
    print(f"Found {len(matches)} course blocks with standard regex.")
    
    for dept_raw, num, title_raw, credits_raw, contact_raw, body in matches:
        dept = clean_text(dept_raw)
        title = clean_text(title_raw).rstrip('.')
        credits = float(credits_raw)
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
        
        course_id = f"{dept} {num}".upper()
        canonical_key = re.sub(r'[^A-Z0-9]', '', course_id)
        
        courses[canonical_key] = {
            "id": course_id,
            "dept": dept,
            "number": num,
            "title": title,
            "credits": credits,
            "contact": contact_raw,
            "prereqs_text": prereqs_str,
            "coreqs_text": coreqs_str,
            "semesters_offered": offerings,
            "even_years_only": is_even_only,
            "odd_years_only": is_odd_only,
            "offering_text": sem_str,
            "description": body_clean[:400] + "..." if len(body_clean) > 400 else body_clean
        }
        
    return courses

if __name__ == "__main__":
    courses = extract_courses()
    print(f"Extracted {len(courses)} courses into catalog.")
    sample_keys = [k for k in courses.keys() if 'MECH' in k or 'SYS' in k or 'MATH' in k][:10]
    for k in sample_keys:
        c = courses[k]
        print(f"{c['id']} - {c['title']} ({c['credits']} cr, Offered: {c['semesters_offered']})")
