#!/usr/bin/env python3
import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET

BASE_DIR = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/extracted/Final Question Bank /CPS 8502 '
OUTPUT_FILE = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/cps_all.json'

SPECIALTY_MAPPING = {
    'Cardiovascular Medicine 495': {
        'title': 'Cardiovascular Medicine',
        'slug': 'cardiovascular',
        'description': 'Comprehensive question bank covering coronary artery disease, heart failure, arrhythmias, valvular disorders, and cardiology emergencies.'
    },
    'Dermatology 402': {
        'title': 'Dermatology',
        'slug': 'dermatology',
        'description': 'Comprehensive question bank covering inflammatory dermatoses, cutaneous infections, skin malignancies, and dermatological emergencies.'
    },
    'Ear, Nose and Throat 313': {
        'title': 'ENT',
        'slug': 'ent',
        'description': 'Comprehensive question bank covering otological, rhinological, head & neck, and ENT emergency management.'
    },
    'Endocrinology 469': {
        'title': 'Endocrinology & Diabetes',
        'slug': 'endocrinology',
        'description': 'Comprehensive question bank covering diabetes management, thyroid and parathyroid disorders, adrenal conditions, and pituitary disease.'
    },
    'Gastroenterology and Hepatology 595 ': {
        'title': 'Gastroenterology & Hepatology',
        'slug': 'gastroenterology',
        'description': 'Comprehensive question bank covering luminal gastroenterology, chronic liver disease, pancreaticobiliary pathology, and acute GI emergencies.'
    },
    'Genetics and Immunology 204': {
        'title': 'Genetics & Immunology',
        'slug': 'immunology',
        'description': 'Comprehensive question bank covering single-gene disorders, chromosomal abnormalities, immunodeficiency, and allergy.'
    },
    'Haematology and Oncology 468': {
        'title': 'Haematology & Oncology',
        'slug': 'haematology',
        'description': 'Comprehensive question bank covering anaemias, haematological malignancies, coagulopathies, and oncological emergencies.'
    },
    'Infectious diseases 241': {
        'title': 'Infectious Diseases',
        'slug': 'infectious',
        'description': 'Comprehensive question bank covering bacterial, viral, fungal, and tropical infections, sepsis, and antimicrobial stewardship.'
    },
    'Neurology 462': {
        'title': 'Neurology',
        'slug': 'neurology',
        'description': 'Comprehensive question bank covering stroke, headache, epilepsy, movement disorders, demyelinating disease, and neuromuscular conditions.'
    },
    'Ophthalmology 276': {
        'title': 'Ophthalmology',
        'slug': 'ophthalmology',
        'description': 'Comprehensive question bank covering acute eye conditions, glaucoma, retinal pathology, neuro-ophthalmology, and ocular trauma.'
    },
    'Paediatrics 605': {
        'title': 'Paediatrics',
        'slug': 'paediatrics',
        'description': 'Comprehensive question bank covering neonatology, developmental assessment, paediatric infections, respiratory emergencies, and safeguarding.'
    },
    'Pharmacology 758 ': {
        'title': 'Pharmacology',
        'slug': 'pharmacology',
        'description': 'Comprehensive question bank covering prescribing safety, therapeutic drug monitoring, adverse drug reactions, and toxicology.'
    },
    'Psychiatry 365': {
        'title': 'Psychiatry',
        'slug': 'psychiatry',
        'description': 'Comprehensive question bank covering mood disorders, psychosis, anxiety, substance misuse, eating disorders, and psychiatric emergencies.'
    },
    'Renal Medicine and Urology 588': {
        'title': 'Renal Medicine & Urology',
        'slug': 'renal',
        'description': 'Comprehensive question bank covering acute and chronic kidney disease, electrolyte disturbances, glomerular disease, and urology.'
    },
    'Reproductive Medicine 788': {
        'title': 'Reproductive Medicine',
        'slug': 'reproductive',
        'description': 'Comprehensive question bank covering antenatal and postnatal care, obstetric emergencies, gynaecology, and sexual health.'
    },
    'Respiratory Medicine 754': {
        'title': 'Respiratory Medicine',
        'slug': 'respiratory',
        'description': 'Comprehensive question bank covering airways disease, pleural disease, lung cancer, interstitial disorders, and respiratory failure.'
    },
    'Rheumatology and Musculoskeletal Medicine 597': {
        'title': 'Rheumatology & Musculoskeletal Medicine',
        'slug': 'musculoskeletal',
        'description': 'Comprehensive question bank covering inflammatory arthritides, connective tissue disease, osteoporosis, and soft tissue disorders.'
    },
    'Surgery and Orthopaedics 123': {
        'title': 'Surgery & Orthopaedics',
        'slug': 'surgery',
        'description': 'Comprehensive question bank covering acute abdomen, fractures, vascular and perioperative management, and surgical emergencies.'
    }
}

def clean_subtopic_name(raw):
    # Strictly strip all numbers, count brackets (e.g. (36), (45:15), 60-20), and unicode escapes
    cleaned = re.sub(r'(#U[0-9a-fA-F]{4})+', ' - ', raw)
    # Remove any brackets with numbers
    cleaned = re.sub(r'\s*\(\s*\d+.*?\)', '', cleaned)
    # Remove trailing numbers like " 495", " 60-20"
    cleaned = re.sub(r'\s+\d+.*$', '', cleaned)
    # Remove any standalone numbers
    cleaned = re.sub(r'\b\d+\b', '', cleaned)
    # Clean up spaces around dashes
    cleaned = re.sub(r'\s*-\s*', ' - ', cleaned)
    cleaned = re.sub(r'\bAcid\s*-\s*Base\b', 'Acid-Base', cleaned)
    cleaned = re.sub(r'\bNeuro\s*-\s*ophthalmology\b', 'Neuro-ophthalmology', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' -_')
    return cleaned

def get_docx_lines(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        lines = []
        for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            t = ''.join(node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text).strip()
            if t:
                lines.append(t)
    return lines

def parse_sba(docx_path, subtopic):
    lines = get_docx_lines(docx_path)
    stem_lines, question_lines, options = [], [], []
    correct_answer, explanation_lines = '', []
    section = 'header'
    
    for line in lines:
        lower = line.lower().strip()
        if lower in ('clinical stem', 'stem'):
            section = 'stem'
            continue
        elif lower == 'question':
            section = 'question'
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            continue
        elif lower in ('correct answer', 'answer', 'correct answer:'):
            section = 'correct'
            continue
        elif lower in ('explanation', 'explanation:'):
            section = 'explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue
            
        if section == 'stem':
            stem_lines.append(line)
        elif section == 'question':
            if re.match(r'^[A-E]\.\s*', line):
                section = 'options'
                options.append(line)
            else:
                question_lines.append(line)
        elif section == 'options':
            if re.match(r'^[A-E]\.\s*', line):
                options.append(line)
            elif options and not lower.startswith('answer'):
                options[-1] += ' ' + line
        elif section == 'correct':
            if not correct_answer:
                correct_answer = line
        elif section == 'explanation':
            explanation_lines.append(line)
            
    corr_idx = 0
    if correct_answer:
        m = re.match(r'^([A-E])[\.\s]', correct_answer.strip())
        if m:
            corr_idx = ord(m.group(1).upper()) - ord('A')
            
    vignette = ' '.join(stem_lines).strip()
    q_text = ' '.join(question_lines).strip()
    if not vignette and q_text:
        vignette = q_text
        
    return {
        'vignette': vignette,
        'questionText': q_text,
        'options': options,
        'correctAnswer': corr_idx,
        'explanation': ' '.join(explanation_lines).strip(),
        'subTopic': clean_subtopic_name(subtopic)
    }

def parse_emq(docx_path, subtopic):
    lines = get_docx_lines(docx_path)
    theme_title = ''
    instruction = ''
    options = []
    cases = []
    current_case = None
    case_section = None
    section = 'header'
    
    for line in lines:
        lower = line.lower().strip()
        if lower.startswith('theme'):
            theme_parts = line.split(':', 1)
            if len(theme_parts) > 1 and theme_parts[1].strip():
                theme_title = theme_parts[1].strip()
            section = 'theme_header'
            continue
        elif lower.startswith('instruction'):
            instruction = line
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            continue
        elif re.match(r'^(case|question)\s+\d+', lower):
            if current_case:
                cases.append(current_case)
            case_num_match = re.match(r'^(case|question)\s+(\d+)', lower)
            case_num = int(case_num_match.group(2)) if case_num_match else len(cases) + 1
            current_case = {
                'caseNumber': case_num,
                'vignette': '',
                'question': '',
                'answer': '',
                'explanation': ''
            }
            section = 'case'
            case_section = 'vignette'
            continue
        elif lower in ('answer', 'correct answer', 'answer:') and section == 'case':
            case_section = 'answer'
            continue
        elif lower in ('explanation', 'explanation:') and section == 'case':
            case_section = 'explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue
            
        if section in ('header', 'theme_header'):
            if not theme_title and not lower.startswith('for each') and not lower.startswith('case'):
                theme_title = line
            elif lower.startswith('for each'):
                instruction = line
        elif section == 'options':
            if re.match(r'^[A-Z]\.\s*', line):
                options.append(line)
            elif options and not re.match(r'^(case|question)\s+\d+', lower):
                options[-1] += ' ' + line
        elif section == 'case' and current_case:
            if case_section == 'vignette':
                if current_case['vignette']:
                    current_case['vignette'] += ' ' + line
                else:
                    current_case['vignette'] = line
            elif case_section == 'answer':
                if not current_case['answer']:
                    current_case['answer'] = line
            elif case_section == 'explanation':
                if current_case['explanation']:
                    current_case['explanation'] += ' ' + line
                else:
                    current_case['explanation'] = line
                    
    if current_case:
        cases.append(current_case)
        
    formatted_cases = []
    for c in cases:
        corr_opt = 'A'
        m = re.match(r'^([A-Z])[\.\s]', c['answer'].strip())
        if m:
            corr_opt = m.group(1).upper()
        formatted_cases.append({
            'caseNumber': c['caseNumber'],
            'vignette': c['vignette'],
            'question': c['question'] or c['vignette'],
            'correctOption': corr_opt,
            'explanation': c['explanation']
        })
        
    if not theme_title:
        base_f = os.path.basename(docx_path).replace('.docx', '')
        theme_title = re.sub(r'^(Theme_|EMQ\s*\d+\s*-?\s*|Case\s*\d+\s*-?\s*)', '', base_f).replace('_', ' ').strip()
        
    return {
        'title': theme_title,
        'instruction': instruction or 'For each case, select the single most appropriate answer from the option list.',
        'options': options,
        'cases': formatted_cases,
        'subTopic': clean_subtopic_name(subtopic)
    }

def main():
    print("Starting full extraction of 18 CPS specialties...")
    all_banks = []

    for folder_name, meta in SPECIALTY_MAPPING.items():
        spec_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.isdir(spec_path):
            print(f"Warning: Directory not found for {folder_name}")
            continue

        print(f"\nProcessing: {meta['title']} ({folder_name})...")
        sba_list = []
        emq_list = []

        for root, dirs, files in os.walk(spec_path):
            subtopic = os.path.basename(root)
            for f in sorted(files):
                if f.endswith('.docx') and not f.startswith('._'):
                    full_path = os.path.join(root, f)
                    if 'emq' in root.lower():
                        try:
                            emq = parse_emq(full_path, subtopic)
                            # Theme number extraction if present
                            m_num = re.search(r'\d+', f)
                            emq['themeNumber'] = int(m_num.group(0)) if m_num else len(emq_list) + 1
                            emq_list.append(emq)
                        except Exception as e:
                            print(f"Error parsing EMQ {f}: {e}")
                    else:
                        try:
                            sba = parse_sba(full_path, subtopic)
                            sba_list.append(sba)
                        except Exception as e:
                            print(f"Error parsing SBA {f}: {e}")

        # Collect distinct subtopics with counts
        subtopics_map = {}
        for s in sba_list:
            st = s['subTopic']
            subtopics_map[st] = subtopics_map.get(st, 0) + 1
        for e in emq_list:
            st = e['subTopic']
            subtopics_map[st] = subtopics_map.get(st, 0) + len(e.get('cases', []))

        subtopics_list = sorted(list(subtopics_map.keys()))

        bank_data = {
            'title': meta['title'],
            'specialty': meta['title'],
            'slug': meta['slug'],
            'description': meta['description'],
            'totalSba': len(sba_list),
            'totalEmqThemes': len(emq_list),
            'totalEmqCases': sum(len(e.get('cases', [])) for e in emq_list),
            'subTopics': subtopics_list,
            'sba': sba_list,
            'emq': emq_list
        }
        all_banks.append(bank_data)
        print(f"  -> {meta['title']}: {len(sba_list)} SBA, {len(emq_list)} EMQ Themes ({sum(len(e['cases']) for e in emq_list)} cases). Distinct Subtopics: {len(subtopics_list)}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out:
        json.dump(all_banks, out, indent=2, ensure_ascii=False)

    print(f"\nAll 18 specialties parsed successfully and saved to {OUTPUT_FILE}!")
    print(f"Total specialties: {len(all_banks)}")
    total_all_sba = sum(b['totalSba'] for b in all_banks)
    total_all_emq = sum(b['totalEmqThemes'] for b in all_banks)
    total_all_cases = sum(b['totalEmqCases'] for b in all_banks)
    print(f"Grand Total: {total_all_sba} SBA questions + {total_all_emq} EMQ themes ({total_all_cases} cases) = {total_all_sba + total_all_cases} total questions.")

if __name__ == '__main__':
    main()
