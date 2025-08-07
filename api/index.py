from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import pandas as pd
import random
import json
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# 허용된 파일 확장자
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

def extract_questions_from_excel(file_path):
    """엑셀 파일에서 문제 추출 (세트별로 분류)"""
    try:
        # 엑셀 파일 읽기
        df = pd.read_excel(file_path)
        print(f"엑셀 파일 읽기 완료: {len(df)} 행")
        print(f"컬럼: {list(df.columns)}")
        
        questions_by_set = {}
        
        # 다양한 엑셀 형식 지원
        for index, row in df.iterrows():
            question = {}
            
            # 세트 처리
            if '세트' in df.columns:
                set_num = int(row.get('세트', 1))
            else:
                set_num = 1
                
            # 문제 번호 처리
            if '문제번호' in df.columns:
                question['number'] = int(row.get('문제번호', index + 1))
            else:
                question['number'] = index + 1
                
            # 문제 내용 처리
            if '문제' in df.columns:
                question['text'] = str(row.get('문제', ''))
            else:
                question['text'] = str(row.iloc[0]) if len(row) > 0 else ''
                
            # 보기 처리
            if '보기' in df.columns:
                options_text = str(row.get('보기', ''))
                # 보기 텍스트에서 ①, ②, ③, ④, ⑤로 분리
                options = []
                for i in range(1, 6):  # 1~5번 보기까지 지원
                    option_pattern = f'{chr(9311 + i)}'  # ①, ②, ③, ④, ⑤
                    if option_pattern in options_text:
                        # 해당 보기 다음부터 다음 보기 전까지 추출
                        start = options_text.find(option_pattern)
                        if i < 5:
                            end = options_text.find(f'{chr(9311 + i + 1)}')
                            if end == -1:
                                end = len(options_text)
                        else:
                            end = len(options_text)
                        option_text = options_text[start+1:end].strip()
                        options.append(option_text)
                    else:
                        options.append(f"보기 {i}")
                
                # 보기가 5개가 아니면 기본값으로 채움
                while len(options) < 5:
                    options.append(f"보기 {len(options) + 1}")
            else:
                options = ["보기 1", "보기 2", "보기 3", "보기 4", "보기 5"]
            
            question['options'] = options[:5]  # 최대 5개까지
            
            # 정답 처리
            if '답안' in df.columns:
                answer = str(row.get('답안', '1'))
                # ①, ②, ③, ④, ⑤를 0, 1, 2, 3, 4로 변환
                answer_map = {'①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4}
                question['correct'] = answer_map.get(answer, 0)
            else:
                question['correct'] = 0
                
            # 해설 처리
            if '해설' in df.columns:
                question['answer'] = str(row.get('해설', ''))
            else:
                question['answer'] = f"문제 {question['number']}의 정답은 {question['options'][question['correct']]}입니다."
            
            # 세트별로 문제 분류
            if set_num not in questions_by_set:
                questions_by_set[set_num] = []
            
            # 빈 문제 제외
            if question['text'].strip():
                questions_by_set[set_num].append(question)
        
        print(f"세트별 문제 분류 완료:")
        for set_num, questions in questions_by_set.items():
            print(f"  세트 {set_num}: {len(questions)}개 문제")
        
        return questions_by_set
        
    except Exception as e:
        print(f"엑셀 파일 처리 오류: {e}")
        return None

def get_exam_questions(questions_by_set):
    """실제 CPPG 시험 형식에 맞춰 문제 선택"""
    # CPPG 시험 문제 수: 총 100문제
    # 1과목(개인정보보호의 이해): 10문제
    # 2과목(개인정보보호 제도): 20문제  
    # 3과목(개인정보 라이프사이클 관리): 25문제
    # 4과목(개인정보의 보호조치): 30문제
    # 5과목(개인정보 관리체계): 15문제
    
    exam_questions = []
    
    # 각 세트별로 필요한 문제 수
    set_requirements = {
        1: 10,  # 1과목
        2: 20,  # 2과목
        3: 25,  # 3과목
        4: 30,  # 4과목
        5: 15   # 5과목
    }
    
    for set_num, required_count in set_requirements.items():
        if set_num in questions_by_set:
            available_questions = questions_by_set[set_num]
            if len(available_questions) >= required_count:
                # 랜덤으로 선택
                selected = random.sample(available_questions, required_count)
            else:
                # 부족하면 전체 사용
                selected = available_questions
            
            # 문제 번호 재정렬 및 세트 정보 추가
            for i, question in enumerate(selected):
                question_copy = question.copy()
                question_copy['exam_number'] = len(exam_questions) + 1
                question_copy['set'] = set_num  # 세트 정보 명시적으로 추가
                exam_questions.append(question_copy)
    
    return exam_questions

def load_questions_from_file():
    """CPPG 파일에서 문제 로드"""
    # Vercel 환경에서는 상위 디렉토리의 파일을 읽어야 함
    file_paths = [
        "cppg_qa_final.xlsx",
        "../cppg_qa_final.xlsx",
        "./cppg_qa_final.xlsx"
    ]
    
    file_path = None
    for path in file_paths:
        if os.path.exists(path):
            file_path = path
            break
    
    if not file_path:
        print(f"파일을 찾을 수 없습니다. 시도한 경로: {file_paths}")
        return None, None
    
    print(f"파일 로드 중: {file_path}")
    questions_by_set = extract_questions_from_excel(file_path)
    
    if questions_by_set:
        # 통계 정보 생성
        stats = {}
        total_questions = 0
        for set_num, questions in questions_by_set.items():
            stats[f'세트{set_num}'] = len(questions)
            total_questions += len(questions)
        stats['총문제수'] = total_questions
        
        print(f"총 {total_questions}개 문제 로드 완료")
        return questions_by_set, stats
    
    return None, None

# 서버 시작 시 문제 로드
print("CPPG 문제 로드 중...")
QUESTIONS_BY_SET, STATS = load_questions_from_file()

@app.route('/')
def index():
    if QUESTIONS_BY_SET is None:
        return render_template('cppg_main.html', error="문제 파일을 로드할 수 없습니다.")
    return render_template('cppg_main.html', stats=STATS)

@app.route('/practice')
def practice():
    return render_template('cppg_practice.html')

@app.route('/exam')
def exam():
    return render_template('cppg_exam.html')

@app.route('/api/questions')
def get_questions():
    if not QUESTIONS_BY_SET:
        return jsonify({'error': '문제가 로드되지 않았습니다.'}), 400
    
    # 모든 문제를 하나의 리스트로 합치기
    all_questions = []
    for set_num, questions in QUESTIONS_BY_SET.items():
        for question in questions:
            question_copy = question.copy()
            question_copy['set'] = set_num
            all_questions.append(question_copy)
    
    return jsonify({'questions': all_questions})

@app.route('/api/exam-questions')
def get_exam_questions_api():
    if not QUESTIONS_BY_SET:
        return jsonify({'error': '문제가 로드되지 않았습니다.'}), 400
    
    exam_questions = get_exam_questions(QUESTIONS_BY_SET)
    return jsonify({'questions': exam_questions})

@app.route('/api/random-questions')
def get_random_questions():
    if not QUESTIONS_BY_SET:
        return jsonify({'error': '문제가 로드되지 않았습니다.'}), 400
    
    # 모든 문제를 하나의 리스트로 합치기
    all_questions = []
    for set_num, questions in QUESTIONS_BY_SET.items():
        for question in questions:
            question_copy = question.copy()
            question_copy['set'] = set_num
            all_questions.append(question_copy)
    
    # 랜덤으로 섞기
    random.shuffle(all_questions)
    
    return jsonify({'questions': all_questions})

# Vercel 서버리스 함수
def handler(request, context):
    return app(request, context)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5004) 