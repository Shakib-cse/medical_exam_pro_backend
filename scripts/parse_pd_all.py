#!/usr/bin/env python3
import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET
import random

BASE_DIR = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/extracted/Final Question Bank /Professional Dilemmas 2505'
OUTPUT_FILE = '/home/shakib/Documents/projects/kawanf/kawan-backend/data/pd_all.json'

DOMAIN_MAPPING = {
    'Coping with Pressure (399)': {
        'title': 'Coping with Pressure',
        'slug': 'coping-with-pressure',
        'description': 'Professional dilemmas question bank covering prioritisation under stress, fatigue, handover, escalation, and safety under acute pressure.'
    },
    'Empathy & Sensitivity (1072)': {
        'title': 'Empathy & Sensitivity',
        'slug': 'empathy-and-sensitivity',
        'description': 'Professional dilemmas question bank covering patient-centred communication, breaking bad news, autonomy, consent, cultural needs, and safeguarding.'
    },
    'Professionalism & Integrity (1034)': {
        'title': 'Professionalism & Integrity',
        'slug': 'professional-integrity',
        'description': 'Professional dilemmas question bank covering probity, GMC standards, confidentiality, speaking up, record keeping, and conflicts of interest.'
    }
}

def clean_subtopic_name(folder_name):
    # Remove count like ' (74)'
    return re.sub(r'\s*\(\d+\)\s*$', '', folder_name).strip()

def read_docx(path):
    try:
        with zipfile.ZipFile(path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            texts = []
            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                t_elems = [t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]
                if t_elems:
                    texts.append(''.join(t_elems).strip())
            return [t for t in texts if t]
    except Exception as e:
        print(f"Error reading {path}: {e}")
        return []

def generate_peer_stats(all_options, correct_answers, seed_key):
    # Deterministic pseudo-random seed based on question text/id
    rnd = random.Random(seed_key)
    stats = {}
    
    # Correct options: between 68% and 92%
    for opt in correct_answers:
        stats[opt] = rnd.randint(68, 92)
        
    # Distractor options: plausible distractors get 25-58%, weaker get 8-28%
    distractors = [opt for opt in all_options if opt not in correct_answers]
    rnd.shuffle(distractors)
    for i, opt in enumerate(distractors):
        if i < 2:
            stats[opt] = rnd.randint(35, 60)
        else:
            stats[opt] = rnd.randint(8, 30)
            
    return stats

def parse_pd_file(lines, is_mcq, file_path):
    section = 'header'
    vignette_parts = []
    question_text = ''
    options_dict = {}
    current_opt = None
    current_opt_text = ''
    answer_raw = ''
    explanation_parts = []
    references_parts = []
    
    for l in lines:
        lower = l.lower().strip()
        if lower in ('options', 'options:'):
            if current_opt:
                options_dict[current_opt] = current_opt_text.strip()
                current_opt = None
            section = 'options'
            continue
        elif lower in ('answer', 'correct answer', 'answer:'):
            if current_opt:
                options_dict[current_opt] = current_opt_text.strip()
                current_opt = None
            section = 'answer'
            continue
        elif lower in ('explanation', 'explanation:'):
            section = 'explanation'
            continue
        elif lower.startswith('reference'):
            section = 'references'
            continue
            
        if section == 'header':
            if lower.startswith('case ') or lower == 'question':
                continue
            if lower.startswith('choose the 3') or lower.startswith('select exactly the three') or lower.startswith('select the 3') or lower.startswith('rank the following'):
                question_text = l
            else:
                vignette_parts.append(l)
        elif section == 'options':
            m_full = re.match(r'^([A-H])\.\s+(.*)$', l)
            m_letter_only = re.match(r'^([A-H])\.?$', l)
            if m_full:
                if current_opt:
                    options_dict[current_opt] = current_opt_text.strip()
                current_opt = m_full.group(1)
                current_opt_text = m_full.group(2)
            elif m_letter_only:
                if current_opt:
                    options_dict[current_opt] = current_opt_text.strip()
                current_opt = m_letter_only.group(1)
                current_opt_text = ''
            else:
                if current_opt:
                    current_opt_text += (' ' if current_opt_text else '') + l
        elif section == 'answer':
            answer_raw += ' ' + l
        elif section == 'explanation':
            explanation_parts.append(l)
        elif section == 'references':
            references_parts.append(l)
            
    if current_opt:
        options_dict[current_opt] = current_opt_text.strip()
        
    vignette = ' '.join(vignette_parts).strip()
    explanation = '\n\n'.join(explanation_parts).strip()
    references = '\n'.join(references_parts).strip()
    
    # Extract case number from filename, e.g. Case_047.docx -> 47
    base_name = os.path.basename(file_path)
    case_match = re.search(r'(\d+)', base_name)
    case_num = int(case_match.group(1)) if case_match else 1
    
    if is_mcq:
        q_type = 'SELECT_3'
        correct_letters = list(dict.fromkeys(re.findall(r'[A-H]', answer_raw)))
        if not question_text:
            question_text = 'Select the 3 most appropriate actions to take in this situation.'
        # Options list in order A to H
        opt_keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        options_list = [f"{k}. {options_dict.get(k, '')}" for k in opt_keys if k in options_dict]
        peer_stats = {}
        ideal_order = []
    else:
        q_type = 'RANKING'
        correct_letters = re.findall(r'[A-E]', answer_raw)
        if not question_text:
            question_text = 'Rank the following actions from most appropriate (1) to least appropriate (5).'
        # Options list in order A to E
        opt_keys = ['A', 'B', 'C', 'D', 'E']
        options_list = [f"{k}. {options_dict.get(k, '')}" for k in opt_keys if k in options_dict]
        peer_stats = {}
        ideal_order = correct_letters
        
    return {
        'caseNumber': case_num,
        'questionType': q_type,
        'vignette': vignette,
        'question': question_text,
        'options': options_list,
        'optionsDict': options_dict,
        'correctAnswers': correct_letters if is_mcq else [],
        'idealOrder': ideal_order,
        'peerStats': peer_stats,
        'explanation': explanation,
        'references': references
    }

def main():
    print(f"Starting Professional Dilemmas parser from: {BASE_DIR}")
    domains_data = {}
    
    for folder_name, meta in DOMAIN_MAPPING.items():
        domain_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.isdir(domain_path):
            print(f"WARNING: Directory not found: {domain_path}")
            continue
            
        print(f"\nProcessing domain: {meta['title']}...")
        questions = []
        
        for modal_dir in sorted(os.listdir(domain_path)):
            modal_path = os.path.join(domain_path, modal_dir)
            if not os.path.isdir(modal_path):
                continue
                
            is_mcq = 'mcq' in modal_dir.lower()
            modal_name = 'SELECT_3' if is_mcq else 'RANKING'
            
            for subtopic_dir in sorted(os.listdir(modal_path)):
                subtopic_path = os.path.join(modal_path, subtopic_dir)
                if not os.path.isdir(subtopic_path):
                    continue
                    
                subtopic_name = clean_subtopic_name(subtopic_dir)
                docx_files = [f for f in os.listdir(subtopic_path) if f.endswith('.docx') and not f.startswith('.')]
                
                # Sort files numerically by case number if present
                def sort_key(fn):
                    m = re.search(r'(\d+)', fn)
                    return int(m.group(1)) if m else 9999
                docx_files.sort(key=sort_key)
                
                for f in docx_files:
                    fp = os.path.join(subtopic_path, f)
                    lines = read_docx(fp)
                    q_data = parse_pd_file(lines, is_mcq, fp)
                    q_data['domain'] = meta['title']
                    q_data['subTopic'] = subtopic_name
                    q_data['sourceFile'] = f"{folder_name}/{modal_dir}/{subtopic_dir}/{f}"
                    questions.append(q_data)
                    
        ranking_cnt = sum(1 for q in questions if q['questionType'] == 'RANKING')
        select3_cnt = sum(1 for q in questions if q['questionType'] == 'SELECT_3')
        
        domains_data[meta['slug']] = {
            'title': meta['title'],
            'slug': meta['slug'],
            'description': meta['description'],
            'questionCount': len(questions),
            'rankingCount': ranking_cnt,
            'select3Count': select3_cnt,
            'questions': questions
        }
        
        print(f"  -> Total: {len(questions)} (Ranking: {ranking_cnt}, Select 3: {select3_cnt})")
        
    total_q = sum(d['questionCount'] for d in domains_data.values())
    total_ranking = sum(d['rankingCount'] for d in domains_data.values())
    total_select3 = sum(d['select3Count'] for d in domains_data.values())
    
    print("\n=======================================================")
    print(f"Grand Total Questions Parsed: {total_q}")
    print(f"Total Ranking: {total_ranking}")
    print(f"Total Select 3: {total_select3}")
    print("=======================================================")
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(domains_data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
