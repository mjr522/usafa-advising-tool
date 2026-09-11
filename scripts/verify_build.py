import json
import os

def verify():
    with open('data/curriculum_data.json', encoding='utf-8') as f:
        data = json.load(f)

    print('=== DATA VALIDATION ===')
    print('Version:', data.get('version'))
    print('Majors:', list(data.get('majors', {}).keys()))
    print('Total Courses in Catalog:', len(data.get('courses', {})))

    me = data['majors']['ME']
    print(f"ME Total Credits: {me['total_credits']}, Suggested Terms: {len(me['suggested_sequence'])}")

    se = data['majors']['SE']
    print(f"SE Total Credits: {se['total_credits']}, Suggested Terms: {len(se['suggested_sequence'])}")

    required_files = [
        'index.html', 'css/styles.css', 'vercel.json', 'README.md',
        'lib/pdf.min.js', 'lib/pdf.worker.min.js',
        'js/advisors.js', 'js/curriculum.js', 'js/rules_engine.js', 'js/pdf_ingest.js',
        'js/sequencer.js', 'js/grad_check.js', 'js/advisor_diff.js',
        'js/course_modal.js', 'js/add_course_modal.js', 'js/aic_portal.js', 'js/cadet_wizard.js', 'js/app.js'
    ]

    print('\n=== FILE INTEGRITY CHECK ===')
    all_ok = True
    for rf in required_files:
        if os.path.exists(rf) and os.path.getsize(rf) > 0:
            print(f'  [OK] {rf} ({os.path.getsize(rf)} bytes)')
        else:
            print(f'  [FAIL] MISSING OR EMPTY: {rf}')
            all_ok = False
            
    if all_ok:
        print('\nALL REQUIRED FILES VERIFIED AND READY FOR PRODUCTION!')
    else:
        print('\nSOME FILES ARE MISSING')

if __name__ == '__main__':
    verify()
