#!/usr/bin/env python3
import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET

BASE_DIR = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/extracted/Final Question Bank /Free sample'
OUTPUT_FILE = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/free_sample_all.json'

def get_lines(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read('word/document.xml')
        tree = ET.fromstring(xml)
        lines = []
        for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            t = ''.join(n.text for n in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if n.text).strip()
            if t: lines.append(t)
        return lines

def parse_sba(docx_path, specialty):
    lines = get_lines(docx_path)
    question_lines, options = [], []
    correct_letter = ''
    explanation_lines = []
    references_lines = []
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if 'single best answer' in lower or lower.startswith('case ') or lower == 'case':
            continue
        elif lower in ('question', 'clinical stem', 'stem'):
            section = 'question'
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            continue
        elif lower in ('answer', 'correct answer', 'answer:'):
            section = 'answer'
            continue
        elif lower in ('explanation', 'explanation:'):
            section = 'explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue

        if section in ('header', 'question'):
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
        elif section == 'answer':
            if not correct_letter:
                m = re.match(r'^([A-E])[\.\s]', line.strip())
                if m:
                    correct_letter = m.group(1)
        elif section == 'explanation':
            explanation_lines.append(line)
        elif section == 'references':
            references_lines.append(line)

    corr_idx = 0
    if correct_letter:
        corr_idx = ord(correct_letter.upper()) - ord('A')

    return {
        'questionType': 'SBA',
        'specialty': specialty,
        'questionText': '\n\n'.join(question_lines).strip(),
        'options': options,
        'correctAnswer': corr_idx,
        'correctOption': correct_letter,
        'explanation': '\n\n'.join(explanation_lines).strip(),
        'references': '\n'.join(references_lines).strip(),
        'isFree': True
    }

def parse_emq(docx_path, specialty):
    lines = get_lines(docx_path)
    theme_title = ''
    instruction = ''
    options = []
    cases = []
    current_case = None
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if 'extended matching question' in lower or lower.startswith('emq theme'):
            continue
        elif lower in ('theme', 'theme:'):
            section = 'theme'
            continue
        elif lower in ('instructions', 'instruction', 'instructions:'):
            section = 'instruction'
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            continue
        elif re.match(r'^question\s+\d+', lower):
            if current_case:
                cases.append(current_case)
            case_num_m = re.search(r'\d+', lower)
            case_num = int(case_num_m.group(0)) if case_num_m else len(cases) + 1
            current_case = {
                'id': f"case_{case_num}",
                'caseNumber': case_num,
                'vignette': '',
                'question': '',
                'correctOption': '',
                'explanation': '',
                'explanation_lines': [],
                'vignette_lines': []
            }
            section = 'case_vignette'
            continue
        elif lower in ('answer', 'correct answer', 'answer:'):
            section = 'case_answer'
            continue
        elif lower in ('explanation', 'explanation:'):
            section = 'case_explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue

        if section == 'theme':
            theme_title += (' ' if theme_title else '') + line
        elif section == 'instruction':
            instruction += (' ' if instruction else '') + line
        elif section == 'options':
            if re.match(r'^[A-H]\.\s*', line):
                options.append(line)
            elif options:
                options[-1] += ' ' + line
        elif section == 'case_vignette' and current_case:
            if re.match(r'^[A-H]\.\s*', line):
                section = 'options'
                options.append(line)
            else:
                current_case['vignette_lines'].append(line)
        elif section == 'case_answer' and current_case:
            m = re.match(r'^([A-H])[\.\s]', line.strip())
            if m and not current_case['correctOption']:
                current_case['correctOption'] = m.group(1)
        elif section == 'case_explanation' and current_case:
            current_case['explanation_lines'].append(line)

    if current_case:
        cases.append(current_case)

    # Format case fields
    for c in cases:
        lines_v = c.pop('vignette_lines', [])
        lines_e = c.pop('explanation_lines', [])
        c['explanation'] = '\n\n'.join(lines_e).strip()
        if len(lines_v) > 1 and '?' in lines_v[-1]:
            c['question'] = lines_v[-1]
            c['vignette'] = '\n\n'.join(lines_v[:-1]).strip()
        else:
            c['vignette'] = '\n\n'.join(lines_v).strip()
            c['question'] = 'Which is the single most likely diagnosis / appropriate management?'

    return {
        'questionType': 'EMQ',
        'specialty': specialty,
        'questionText': f"{theme_title}\n\n{instruction}".strip(),
        'themeTitle': theme_title,
        'options': options,
        'cases': cases,
        'correctAnswer': 0,
        'explanation': '',
        'isFree': True
    }

def parse_ranking(docx_path, specialty):
    lines = get_lines(docx_path)
    question_lines, options = [], []
    ideal_order = []
    explanation_lines = []
    references_lines = []
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if 'ranking' in lower and section == 'header':
            continue
        elif lower.startswith('case ') and section == 'header':
            continue
        elif lower in ('question', 'vignette'):
            section = 'question'
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            continue
        elif lower in ('answer', 'correct answer', 'answer:'):
            section = 'answer'
            continue
        elif lower in ('explanation', 'explanation:'):
            section = 'explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue

        if section in ('header', 'question'):
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
        elif section == 'answer':
            letters = re.findall(r'[A-E]', line.upper())
            if letters and not ideal_order:
                ideal_order = letters
        elif section == 'explanation':
            explanation_lines.append(line)
        elif section == 'references':
            references_lines.append(line)

    opt_keys = ['A', 'B', 'C', 'D', 'E']
    opt_dict = {}
    for o in options:
        m = re.match(r'^([A-E])\.\s*(.*)', o)
        if m:
            opt_dict[m.group(1)] = m.group(2)

    return {
        'questionType': 'RANKING',
        'specialty': specialty,
        'questionText': '\n\n'.join(question_lines).strip(),
        'options': options,
        'idealOrder': ideal_order,
        'cases': {
            'idealOrder': ideal_order,
            'optionsDict': opt_dict,
            'instruction': 'Rank in order the following actions in response to this situation (1= Most appropriate; 5= Least appropriate):',
            'references': '\n'.join(references_lines).strip()
        },
        'correctAnswer': 0,
        'explanation': '\n\n'.join(explanation_lines).strip(),
        'references': '\n'.join(references_lines).strip(),
        'isFree': True
    }

def parse_select_three(docx_path, specialty):
    lines = get_lines(docx_path)
    question_lines, options = [], []
    correct_letters = []
    explanation_lines = []
    references_lines = []
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if 'select three' in lower and section == 'header':
            continue
        elif lower.startswith('case ') and section == 'header':
            continue
        elif lower in ('question', 'vignette'):
            section = 'question'
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            continue
        elif lower in ('answer', 'correct answer', 'answer:'):
            section = 'answer'
            continue
        elif lower in ('explanation', 'explanation:'):
            section = 'explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue

        if section in ('header', 'question'):
            if re.match(r'^[A-H]\.\s*', line):
                section = 'options'
                options.append(line)
            else:
                question_lines.append(line)
        elif section == 'options':
            if re.match(r'^[A-H]\.\s*', line):
                options.append(line)
            elif options and not lower.startswith('answer'):
                options[-1] += ' ' + line
        elif section == 'answer':
            letters = re.findall(r'[A-H]', line.upper())
            if letters and not correct_letters:
                correct_letters = list(dict.fromkeys(letters))
        elif section == 'explanation':
            explanation_lines.append(line)
        elif section == 'references':
            references_lines.append(line)

    opt_dict = {}
    for o in options:
        m = re.match(r'^([A-H])\.\s*(.*)', o)
        if m:
            opt_dict[m.group(1)] = m.group(2)

    return {
        'questionType': 'SELECT_3',
        'specialty': specialty,
        'questionText': '\n\n'.join(question_lines).strip(),
        'options': options,
        'correctAnswers': correct_letters,
        'cases': {
            'correctAnswers': correct_letters,
            'optionsDict': opt_dict,
            'instruction': 'Choose the THREE most appropriate actions to take in this situation:',
            'references': '\n'.join(references_lines).strip()
        },
        'correctAnswer': 0,
        'explanation': '\n\n'.join(explanation_lines).strip(),
        'references': '\n'.join(references_lines).strip(),
        'isFree': True
    }

def main():
    all_data = {
        'Cardiovascular Medicine': [],
        'Neurology': [],
        'Gastroenterology & Hepatology': [],
        'Professionalism & Integrity': []
    }

    # 1. Cardiovascular
    cardio_dir = os.path.join(BASE_DIR, '01_Cardiovascular_Medicine')
    sba_dir = os.path.join(cardio_dir, '01_SBA_Cases')
    emq_dir = os.path.join(cardio_dir, '02_EMQ_Themes')
    for f in sorted(os.listdir(sba_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Cardiovascular Medicine'].append(parse_sba(os.path.join(sba_dir, f), 'Cardiovascular Medicine'))
    for f in sorted(os.listdir(emq_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Cardiovascular Medicine'].append(parse_emq(os.path.join(emq_dir, f), 'Cardiovascular Medicine'))

    # 2. Neurology
    neuro_dir = os.path.join(BASE_DIR, '02_Neurology')
    sba_dir = os.path.join(neuro_dir, '01_SBA_Cases')
    emq_dir = os.path.join(neuro_dir, '02_EMQ_Themes')
    for f in sorted(os.listdir(sba_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Neurology'].append(parse_sba(os.path.join(sba_dir, f), 'Neurology'))
    for f in sorted(os.listdir(emq_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Neurology'].append(parse_emq(os.path.join(emq_dir, f), 'Neurology'))

    # 3. Gastroenterology & Hepatology
    gastro_dir = os.path.join(BASE_DIR, '03_Gastroenterology_and_Hepatology')
    sba_dir = os.path.join(gastro_dir, '01_SBA_Cases')
    emq_dir = os.path.join(gastro_dir, '02_EMQ_Themes')
    for f in sorted(os.listdir(sba_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Gastroenterology & Hepatology'].append(parse_sba(os.path.join(sba_dir, f), 'Gastroenterology & Hepatology'))
    for f in sorted(os.listdir(emq_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Gastroenterology & Hepatology'].append(parse_emq(os.path.join(emq_dir, f), 'Gastroenterology & Hepatology'))

    # 4. Professionalism & Integrity
    pd_dir = os.path.join(BASE_DIR, '04_Professional_Dilemmas_Professional_Integrity')
    rank_dir = os.path.join(pd_dir, '01_Ranking_Cases')
    s3_dir = os.path.join(pd_dir, '02_Select_Three_Cases')
    for f in sorted(os.listdir(rank_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Professionalism & Integrity'].append(parse_ranking(os.path.join(rank_dir, f), 'Professionalism & Integrity'))
    for f in sorted(os.listdir(s3_dir)):
        if f.endswith('.docx') and not f.startswith('.'):
            all_data['Professionalism & Integrity'].append(parse_select_three(os.path.join(s3_dir, f), 'Professionalism & Integrity'))

    # Assign orders
    for spec, qlist in all_data.items():
        for i, q in enumerate(qlist):
            q['order'] = i + 1

    total = sum(len(v) for v in all_data.values())
    print(f"Parsed {total} Free Sample items:")
    for k, v in all_data.items():
        print(f"  - {k}: {len(v)} items")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)
    print(f"Successfully saved to {OUTPUT_FILE}!")

if __name__ == '__main__':
    main()
