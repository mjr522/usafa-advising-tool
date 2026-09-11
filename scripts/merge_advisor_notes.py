#!/usr/bin/env python3
"""
USAFA Advising Tool - Advisor Notes Compiler / Merger
Merges advisor notes submissions into data/curriculum_data.json and mirrors to data/curriculum_data.js.

Usage:
    python scripts/merge_advisor_notes.py <notes_file.json>
    python scripts/merge_advisor_notes.py --text '<json_string>'
"""

import sys
import os
import json
import re

DATA_JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'curriculum_data.json')
DATA_JS_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'curriculum_data.js')

def normalize_key(code):
    if not code:
        return ''
    return re.sub(r'[^A-Z0-9]', '', code.upper())

def merge_notes(notes_dict):
    if not os.path.exists(DATA_JSON_PATH):
        print(f"Error: Could not find {DATA_JSON_PATH}")
        sys.exit(1)

    with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
        curr_data = json.load(f)

    courses = curr_data.get('courses', {})
    updated_count = 0

    for raw_key, tip_data in notes_dict.items():
        key = normalize_key(raw_key)

        # Match course key
        matched_course = courses.get(key)
        if not matched_course:
            # Fallback search by ID
            for c_key, c_val in courses.items():
                if normalize_key(c_val.get('id', '')) == key:
                    matched_course = c_val
                    key = c_key
                    break

        if matched_course:
            if 'difficulty' in tip_data and tip_data['difficulty']:
                matched_course['difficulty'] = tip_data['difficulty']
            if 'advisor_tips' in tip_data:
                matched_course['advisor_tips'] = tip_data['advisor_tips']
            if 'pairing_warnings' in tip_data:
                matched_course['pairing_warnings'] = tip_data['pairing_warnings']

            updated_count += 1
            print(f"  [UPDATED] {matched_course['id']}: difficulty='{matched_course.get('difficulty')}', tips={len(matched_course.get('advisor_tips', ''))} chars")
        else:
            print(f"  [WARN] Course key '{raw_key}' (normalized: '{key}') not found in catalog. Skipping.")

    if updated_count > 0:
        # Save JSON
        with open(DATA_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(curr_data, f, indent=2)
        print(f"\nSaved updated {DATA_JSON_PATH}")

        # Mirror to JS
        with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
            f.write(f"window.USAFA_CURRICULUM_DATA = {json.dumps(curr_data)};\n")
        print(f"Saved updated {DATA_JS_PATH}")
        print(f"\nSuccessfully merged advisor notes for {updated_count} course(s) into production curriculum!")
    else:
        print("\nNo matching courses were updated.")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    arg = sys.argv[1]

    if arg == '--text' and len(sys.argv) > 2:
        content = sys.argv[2]
        try:
            data = json.loads(content)
        except Exception as e:
            print(f"Error parsing JSON string: {e}")
            sys.exit(1)
    elif os.path.exists(arg):
        with open(arg, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error reading JSON file: {e}")
                sys.exit(1)
    else:
        # Try parsing directly as JSON
        try:
            data = json.loads(arg)
        except Exception:
            print(f"Error: Argument '{arg}' is neither an existing file nor valid JSON.")
            sys.exit(1)

    merge_notes(data)

if __name__ == '__main__':
    main()
