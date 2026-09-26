#!/usr/bin/env python3
import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET

BASE_DIR = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/extracted/Final Question Bank /Mock exams '
OUTPUT_FILE = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/mock_exams_all.json'

def get_docx_lines(path):
    try:
        with zipfile.ZipFile(path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            lines = []
            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                t = ''.join(node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text).strip()
                if t:
                    lines.append(t)
            return lines
    except Exception as e:
        print(f"Error reading {path}: {e}")
        return []

def parse_sba(docx_path, exam_num, q_num):
    lines = get_docx_lines(docx_path)
    stem_lines, question_lines, options = [], [], []
    correct_answer, explanation_lines, references_lines = '', [], []
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if lower.startswith('case ') or lower == 'case':
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
            if not correct_answer:
                correct_answer = line
        elif section == 'explanation':
            explanation_lines.append(line)
        elif section == 'references':
            references_lines.append(line)

    corr_idx = 0
    corr_opt = 'A'
    if correct_answer:
        m = re.match(r'^([A-E])[\.\s]', correct_answer.strip())
        if m:
            corr_opt = m.group(1).upper()
            corr_idx = ord(corr_opt) - ord('A')
        else:
            m2 = re.search(r'\b([A-E])\b', correct_answer.strip())
            if m2:
                corr_opt = m2.group(1).upper()
                corr_idx = ord(corr_opt) - ord('A')

    full_question = ' '.join(question_lines).strip()
    explanation = '\n\n'.join(explanation_lines).strip()
    references = '\n'.join(references_lines).strip()

    # Extract options dict
    options_dict = {}
    for opt in options:
        m = re.match(r'^([A-E])\.\s*(.*)$', opt)
        if m:
            options_dict[m.group(1)] = m.group(2).strip()

    return {
        'section': 'CPS',
        'questionType': 'SBA',
        'questionText': full_question,
        'vignette': full_question,
        'options': options,
        'optionsDict': options_dict,
        'correctAnswer': corr_idx,
        'correctOption': corr_opt,
        'explanation': explanation,
        'references': references,
        'subTopic': f"SBA Question {q_num}",
        'sourceFile': os.path.basename(docx_path)
    }

def parse_emq(docx_path, exam_num, theme_num):
    lines = get_docx_lines(docx_path)
    theme_title = ''
    options = []
    cases = []
    current_case = None
    case_section = None
    section = 'header'
    saw_options = False

    for line in lines:
        lower = line.lower().strip()
        if lower.startswith('emq theme'):
            continue
        elif lower.startswith('theme'):
            theme_parts = line.split(':', 1)
            if len(theme_parts) > 1 and theme_parts[1].strip():
                theme_title = theme_parts[1].strip()
            section = 'theme_header'
            continue
        elif lower.startswith('instruction') or lower.startswith('each option may be selected'):
            continue
        elif lower in ('options', 'options:'):
            section = 'options'
            saw_options = True
            continue
        elif saw_options and (re.match(r'^(case|question)\s+\d+', lower) or (lower.startswith('question') and len(lower) < 20)):
            if current_case:
                cases.append(current_case)
            case_num_match = re.search(r'\d+', lower)
            case_num = int(case_num_match.group(0)) if case_num_match else len(cases) + 1
            current_case = {
                'caseNumber': case_num,
                'vignette': '',
                'question': '',
                'answer': '',
                'correctOption': '',
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
            if not theme_title and not lower.startswith('options'):
                theme_title = line
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
                current_case['question'] = current_case['vignette']
            elif case_section == 'answer':
                if current_case['answer']:
                    current_case['answer'] += ' ' + line
                else:
                    current_case['answer'] = line
            elif case_section == 'explanation':
                if current_case['explanation']:
                    current_case['explanation'] += '\n\n' + line
                else:
                    current_case['explanation'] = line

    if current_case:
        cases.append(current_case)

    # Process correctOption for each case
    for c in cases:
        m = re.match(r'^([A-Z])[\.\s]', c['answer'].strip())
        if m:
            c['correctOption'] = m.group(1).upper()
        else:
            m2 = re.search(r'\b([A-Z])\b', c['answer'].strip())
            c['correctOption'] = m2.group(1).upper() if m2 else 'A'

    options_dict = {}
    for opt in options:
        m = re.match(r'^([A-Z])\.\s*(.*)$', opt)
        if m:
            options_dict[m.group(1)] = m.group(2).strip()

    return {
        'section': 'CPS',
        'questionType': 'EMQ',
        'themeNumber': theme_num,
        'themeTitle': theme_title or f"EMQ Theme {theme_num}",
        'questionText': f"EMQ Theme {theme_num}: {theme_title}",
        'vignette': f"Each option may be selected once, more than once or not at all.",
        'options': options,
        'optionsDict': options_dict,
        'cases': cases,
        'subTopic': f"EMQ Theme {theme_num}",
        'sourceFile': os.path.basename(docx_path)
    }

def parse_pd_select_three(docx_path, exam_num, case_num):
    lines = get_docx_lines(docx_path)
    vignette_lines = []
    question_lines = []
    options = []
    answer_raw = ''
    explanation_lines = []
    references_lines = []
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if lower.startswith('case ') or lower == 'case':
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
            answer_raw += ' ' + line
        elif section == 'explanation':
            explanation_lines.append(line)
        elif section == 'references':
            references_lines.append(line)

    full_text = ' '.join(question_lines).strip()
    explanation = '\n\n'.join(explanation_lines).strip()
    references = '\n'.join(references_lines).strip()

    # Extract chosen letters cleanly ignoring words like 'and', 'or'
    cleaned = re.sub(r'\b(and|or|options?|answers?)\b', ' ', answer_raw, flags=re.IGNORECASE)
    letters = re.findall(r'\b([A-H])\b', cleaned.upper())
    correct_letters = sorted(list(dict.fromkeys(letters)))

    options_dict = {}
    for opt in options:
        m = re.match(r'^([A-H])\.\s*(.*)$', opt)
        if m:
            options_dict[m.group(1)] = m.group(2).strip()

    return {
        'section': 'PD',
        'questionType': 'SELECT_3',
        'questionText': full_text,
        'vignette': full_text,
        'options': options,
        'optionsDict': options_dict,
        'correctAnswers': correct_letters,
        'explanation': explanation,
        'references': references,
        'subTopic': f"Select 3 Case {case_num}",
        'sourceFile': os.path.basename(docx_path)
    }

def parse_pd_ranking(docx_path, exam_num, case_num):
    lines = get_docx_lines(docx_path)
    question_lines = []
    options = []
    answer_raw = ''
    explanation_lines = []
    references_lines = []
    section = 'header'

    for line in lines:
        lower = line.lower().strip()
        if lower.startswith('case ') or lower == 'case':
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
            answer_raw += ' ' + line
        elif section == 'explanation':
            explanation_lines.append(line)
        elif section == 'references':
            references_lines.append(line)

    full_text = ' '.join(question_lines).strip()
    explanation = '\n\n'.join(explanation_lines).strip()
    references = '\n'.join(references_lines).strip()

    # Ideal order: e.g. C → D → E → A → B -> ["C", "D", "E", "A", "B"]
    cleaned = re.sub(r'\b(and|or|options?|answers?)\b', ' ', answer_raw, flags=re.IGNORECASE)
    letters = re.findall(r'\b([A-E])\b', cleaned.upper())
    ideal_order = []
    for l in letters:
        if l not in ideal_order and len(ideal_order) < 5:
            ideal_order.append(l)

    options_dict = {}
    for opt in options:
        m = re.match(r'^([A-E])\.\s*(.*)$', opt)
        if m:
            options_dict[m.group(1)] = m.group(2).strip()

    return {
        'section': 'PD',
        'questionType': 'RANKING',
        'questionText': full_text,
        'vignette': full_text,
        'options': options,
        'optionsDict': options_dict,
        'idealOrder': ideal_order,
        'explanation': explanation,
        'references': references,
        'subTopic': f"Ranking Case {case_num}",
        'sourceFile': os.path.basename(docx_path)
    }

def main():
    print(f"Starting parsing of all Mock Exams from: {BASE_DIR}")
    mock_folders = sorted(os.listdir(BASE_DIR), key=lambda x: int(re.search(r'\d+', x).group(0)) if re.search(r'\d+', x) else 99)

    all_mock_exams = []

    for mock_folder in mock_folders:
        m_match = re.search(r'(\d+)', mock_folder)
        if not m_match:
            continue
        mock_num = int(m_match.group(1))
        mock_path = os.path.join(BASE_DIR, mock_folder)
        if not os.path.isdir(mock_path):
            continue

        print(f"\n==========================================")
        print(f"Parsing Mock Exam {mock_num} ({mock_folder})...")

        questions = []
        global_order = 1

        # 1. CPS Section
        cps_dir = None
        pd_dir = None
        for sub in os.listdir(mock_path):
            if 'cps' in sub.lower():
                cps_dir = os.path.join(mock_path, sub)
            elif 'pd' in sub.lower():
                pd_dir = os.path.join(mock_path, sub)

        if not cps_dir or not pd_dir:
            print(f"Warning: Missing CPS or PD directory in {mock_path}")
            continue

        # Find SBA folder and EMQ folder in CPS
        sba_dir = None
        emq_dir = None
        for sub in os.listdir(cps_dir):
            if 'sba' in sub.lower():
                sba_dir = os.path.join(cps_dir, sub)
            elif 'emq' in sub.lower():
                emq_dir = os.path.join(cps_dir, sub)

        # A. Parse SBA questions (1 to 48)
        if sba_dir and os.path.isdir(sba_dir):
            sba_files = [f for f in os.listdir(sba_dir) if f.endswith('.docx') and not f.startswith('.')]
            sba_files.sort(key=lambda fn: int(re.search(r'\d+', fn).group(0)) if re.search(r'\d+', fn) else 99)
            print(f"  Found {len(sba_files)} SBA files")
            for sf in sba_files:
                q_num_match = re.search(r'\d+', sf)
                q_num = int(q_num_match.group(0)) if q_num_match else global_order
                q_data = parse_sba(os.path.join(sba_dir, sf), mock_num, q_num)
                q_data['order'] = global_order
                questions.append(q_data)
                global_order += 1

        # B. Parse EMQ questions (17 themes)
        if emq_dir and os.path.isdir(emq_dir):
            emq_files = [f for f in os.listdir(emq_dir) if f.endswith('.docx') and not f.startswith('.')]
            emq_files.sort(key=lambda fn: int(re.search(r'\d+', fn).group(0)) if re.search(r'\d+', fn) else 99)
            print(f"  Found {len(emq_files)} EMQ files")
            for ef in emq_files:
                t_num_match = re.search(r'\d+', ef)
                t_num = int(t_num_match.group(0)) if t_num_match else global_order
                q_data = parse_emq(os.path.join(emq_dir, ef), mock_num, t_num)
                q_data['order'] = global_order
                questions.append(q_data)
                global_order += 1

        # 2. PD Section
        # Find MCQ folder and RANKING folder in PD
        mcq_dir = None
        ranking_dir = None
        for sub in os.listdir(pd_dir):
            if 'mcq' in sub.lower():
                mcq_dir = os.path.join(pd_dir, sub)
            elif 'ranking' in sub.lower():
                ranking_dir = os.path.join(pd_dir, sub)

        # C. Parse PD MCQ (Select 3) questions (25 files)
        if mcq_dir and os.path.isdir(mcq_dir):
            mcq_files = [f for f in os.listdir(mcq_dir) if f.endswith('.docx') and not f.startswith('.')]
            mcq_files.sort(key=lambda fn: int(re.search(r'\d+', fn).group(0)) if re.search(r'\d+', fn) else 99)
            print(f"  Found {len(mcq_files)} PD Select 3 files")
            for mf in mcq_files:
                c_num_match = re.search(r'\d+', mf)
                c_num = int(c_num_match.group(0)) if c_num_match else global_order
                q_data = parse_pd_select_three(os.path.join(mcq_dir, mf), mock_num, c_num)
                q_data['order'] = global_order
                questions.append(q_data)
                global_order += 1

        # D. Parse PD Ranking questions (25 files)
        if ranking_dir and os.path.isdir(ranking_dir):
            ranking_files = [f for f in os.listdir(ranking_dir) if f.endswith('.docx') and not f.startswith('.')]
            ranking_files.sort(key=lambda fn: int(re.search(r'\d+', fn).group(0)) if re.search(r'\d+', fn) else 99)
            print(f"  Found {len(ranking_files)} PD Ranking files")
            for rf in ranking_files:
                c_num_match = re.search(r'\d+', rf)
                c_num = int(c_num_match.group(0)) if c_num_match else global_order
                q_data = parse_pd_ranking(os.path.join(ranking_dir, rf), mock_num, c_num)
                q_data['order'] = global_order
                questions.append(q_data)
                global_order += 1

        cps_count = sum(1 for q in questions if q['section'] == 'CPS')
        pd_count = sum(1 for q in questions if q['section'] == 'PD')
        # Total questions counting EMQ cases
        total_effective = 0
        for q in questions:
            if q['questionType'] == 'EMQ':
                total_effective += len(q.get('cases', []))
            else:
                total_effective += 1

        print(f"Mock {mock_num} parsed: {len(questions)} question items (CPS items: {cps_count}, PD items: {pd_count}, Total effective questions: {total_effective})")

        exam_data = {
            'examNumber': mock_num,
            'title': f"Mock Exam {mock_num}",
            'description': f"Full-length MSRA Mock Exam {mock_num} replicating the official multi-stage exam format: Clinical Problem Solving (SBA & EMQ), optional 5-minute break, followed by Professional Dilemmas (Select 3 & Ranking).",
            'difficultyBadge': 'MODERATE' if mock_num <= 4 else ('ADVANCED' if mock_num <= 8 else 'STANDARD'),
            'difficultyType': 'moderate' if mock_num <= 4 else ('advanced' if mock_num <= 8 else 'standard'),
            'durationMinutes': 120,
            'cpsDurationMinutes': 75,
            'pdDurationMinutes': 45,
            'breakDurationMinutes': 5,
            'questionCount': total_effective,
            'cpsQuestionCount': 86,
            'pdQuestionCount': 50,
            'category': 'MSRA Mock',
            'questions': questions
        }
        all_mock_exams.append(exam_data)

    print(f"\nWriting all {len(all_mock_exams)} mock exams to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_mock_exams, f, indent=2, ensure_ascii=False)

    print("Finished parsing all mock exams successfully!")

if __name__ == '__main__':
    main()
