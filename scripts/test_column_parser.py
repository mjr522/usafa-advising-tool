import pypdf
import re

def parse_aps_pdf(path):
    r = pypdf.PdfReader(path)
    page = r.pages[0]
    items = []
    def visitor(text, cm, tm, font_dict, font_size):
        if text.strip():
            items.append({'text': text.strip(), 'x': tm[4], 'y': tm[5]})
    page.extract_text(visitor_text=visitor)
    
    header_items = [it for it in items if it['y'] > 470]
    header_items.sort(key=lambda it: (-it['y'], it['x']))
    header_text = ' '.join([it['text'] for it in header_items])
    
    table_items = [it for it in items if it['y'] <= 470]
    cols = [[], [], [], []]
    for it in table_items:
        x = it['x']
        if x < 155:
            cols[0].append(it)
        elif x < 305:
            cols[1].append(it)
        elif x < 455:
            cols[2].append(it)
        else:
            cols[3].append(it)
            
    full_text = header_text + '\n'
    for c in cols:
        c.sort(key=lambda it: -it['y'])
        full_text += '\n' + ' '.join([it['text'] for it in c])
        
    term_regex = re.compile(r'\b(20\d{2})\s+(FALL|SPRING|SUMMER)\b', re.IGNORECASE)
    term_matches = list(term_regex.finditer(full_text))
    
    grade_token = r'(?:[A-Za-z*][+-]?|[A-Za-z*]{1,2})'
    course_pattern = re.compile(rf'\b([A-Z]{{2,10}})\s+(\d{{3}}[A-Z\d]?)(?:\s+({grade_token}))?(?:\s+({grade_token}))?\s+(\d+(?:\.\d+)?)\b')
    
    terms = []
    for i in range(len(term_matches)):
        m = term_matches[i]
        year = int(m.group(1))
        season = m.group(2).capitalize()
        start = m.start()
        end = term_matches[i+1].start() if i+1 < len(term_matches) else len(full_text)
        block = full_text[start:end]
        
        c_matches = course_pattern.findall(block)
        courses = []
        for dept, num, g1, g2, cr in c_matches:
            if dept in ['GPA', 'MPA', 'PEA', 'CUM', 'SEM']:
                continue
            grade = g2 if g2 else (g1 if g1 else '')
            courses.append((f"{dept} {num}", grade, float(cr)))
            
        terms.append({
            'year': year,
            'season': season,
            'name': f"{season} {year}",
            'courses': courses
        })
        
    # Sort chronologically
    season_weights = {'Spring': 1, 'Summer': 2, 'Fall': 3}
    terms.sort(key=lambda t: t['year'] * 10 + season_weights.get(t['season'], 0))
    
    print(f"\n==================== {path} ====================")
    for t in terms:
        c_list = [f"{c[0]} [{c[1] if c[1] else 'Plan'}, {c[2]}cr]" for c in t['courses']]
        print(f"  {t['name']} ({len(t['courses'])} courses): {', '.join(c_list)}")

if __name__ == '__main__':
    for f in ['20240822_APS_redacted.pdf', '20250403 APS_Redacted.pdf', '20260806_APS_Redacted.pdf']:
        parse_aps_pdf(f"Redacted Graduation Checks and Plans/{f}")
