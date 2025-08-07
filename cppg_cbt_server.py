from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
import pandas as pd
import random
import json
from datetime import datetime
import requests

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# 사용자 데이터 파일
USERS_FILE = 'users.json'

# JSONBin.io를 사용한 외부 데이터 저장 (Vercel 환경용)
JSONBIN_API_KEY = os.environ.get('JSONBIN_API_KEY', '')  # 환경변수에서 가져오기
JSONBIN_BIN_ID = os.environ.get('JSONBIN_BIN_ID', '')    # 환경변수에서 가져오기

# 기본 사용자 데이터 (메모리)
users_data = {
    "users": {
        "admin": {
            "password": "1234",
            "createdAt": "2024-01-01T00:00:00.000000",
            "role": "admin",
            "stats": {
                "totalQuestions": 0,
                "correctAnswers": 0,
                "incorrectAnswers": 0,
                "totalStudyTime": 0,
                "lastPracticeDate": None,
                "practiceHistory": [],
                "wrongQuestions": [],
                "lastSequentialPosition": 0
            }
        }
    }
}

# Vercel 환경 감지
def is_vercel_environment():
    return os.environ.get('VERCEL') == '1'

# JSONBin.io에서 데이터 로드
def load_from_jsonbin():
    if not JSONBIN_API_KEY or not JSONBIN_BIN_ID:
        print("JSONBin API 키 또는 Bin ID가 설정되지 않음")
        return None
    
    try:
        url = f"https://api.jsonbin.io/v3/b/{JSONBIN_BIN_ID}/latest"
        headers = {
            "X-Master-Key": JSONBIN_API_KEY,
            "Content-Type": "application/json"
        }
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("JSONBin에서 데이터 로드 성공")
            return data.get('record', {})
        else:
            print(f"JSONBin 로드 실패: {response.status_code}")
            return None
    except Exception as e:
        print(f"JSONBin 로드 오류: {e}")
        return None

# JSONBin.io에 데이터 저장
def save_to_jsonbin(data):
    if not JSONBIN_API_KEY or not JSONBIN_BIN_ID:
        print("JSONBin API 키 또는 Bin ID가 설정되지 않음")
        return False
    
    try:
        url = f"https://api.jsonbin.io/v3/b/{JSONBIN_BIN_ID}"
        headers = {
            "X-Master-Key": JSONBIN_API_KEY,
            "Content-Type": "application/json"
        }
        response = requests.put(url, headers=headers, json=data)
        
        if response.status_code == 200:
            print("JSONBin에 데이터 저장 성공")
            return True
        else:
            print(f"JSONBin 저장 실패: {response.status_code}")
            return False
    except Exception as e:
        print(f"JSONBin 저장 오류: {e}")
        return False

# 사용자 데이터 로드
def load_users():
    global users_data
    try:
        if is_vercel_environment():
            # Vercel 환경에서는 JSONBin 사용
            jsonbin_data = load_from_jsonbin()
            if jsonbin_data and 'users' in jsonbin_data:
                users_data = jsonbin_data
                print(f"JSONBin에서 사용자 데이터 로드: {len(users_data['users'])}명")
                return users_data
        
        # 로컬 파일에서 로드
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                file_data = json.load(f)
                # 파일 데이터와 메모리 데이터 병합
                users_data['users'].update(file_data.get('users', {}))
                print(f"파일에서 사용자 데이터 로드: {len(file_data.get('users', {}))}명")
        else:
            # 파일이 없으면 메모리 데이터를 파일에 저장
            save_users_to_file(users_data)
            print("새 파일 생성 및 관리자 계정 저장")
    except Exception as e:
        print(f"파일 로드 오류: {e}, 메모리 데이터 사용")
    
    return users_data

# 파일에 저장
def save_users_to_file(data):
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"파일 저장 성공: {USERS_FILE}")
        return True
    except Exception as e:
        print(f"파일 저장 오류: {e}")
        return False

# 사용자 데이터 저장
def save_users(data):
    global users_data
    try:
        users_data = data
        print(f"사용자 데이터 저장 시작: {len(users_data['users'])}명")
        
        if is_vercel_environment():
            # Vercel 환경에서는 JSONBin 사용
            if save_to_jsonbin(data):
                print("JSONBin 저장 완료")
                return True
            else:
                print("JSONBin 저장 실패, 메모리에서만 유지")
                return False
        else:
            if save_users_to_file(data):
                print("파일 저장 완료")
                return True
            else:
                print("파일 저장 실패, 메모리에서만 유지")
                return False
    except Exception as e:
        print(f"사용자 데이터 저장 중 오류: {e}")
        return False

# 사용자 통계 업데이트 (오답 문제 저장 포함)
def update_user_stats(username, question_data, is_correct, study_time=0, mode='practice'):
    global users_data
    if username in users_data['users']:
        user = users_data['users'][username]
        stats = user.get('stats', {})
        
        # 기본 통계 업데이트
        stats['totalQuestions'] = stats.get('totalQuestions', 0) + 1
        if is_correct:
            stats['correctAnswers'] = stats.get('correctAnswers', 0) + 1
        else:
            stats['incorrectAnswers'] = stats.get('incorrectAnswers', 0) + 1
            
            # 오답 문제에 추가 (중복 방지)
            wrong_questions = stats.get('wrongQuestions', [])
            
            # 이미 있는지 확인
            exists = False
            for wq in wrong_questions:
                if (wq.get('set') == question_data.get('set') and 
                    wq.get('number') == question_data.get('number')):
                    exists = True
                    break
            
            if not exists:
                # 문제 데이터 복사본 생성
                question_copy = {
                    'set': question_data.get('set'),
                    'number': question_data.get('number'),
                    'text': question_data.get('text'),
                    'options': question_data.get('options', []),
                    'correct': question_data.get('correct'),
                    'answer': question_data.get('answer')
                }
                wrong_questions.append(question_copy)
                stats['wrongQuestions'] = wrong_questions
                print(f"오답 문제 추가됨: 세트 {question_data.get('set')} 문제 {question_data.get('number')}")
        
        # 순차 풀이 위치 업데이트
        if mode == 'sequential':
            stats['lastSequentialPosition'] = stats.get('lastSequentialPosition', 0) + 1
        
        # 학습 시간 업데이트
        stats['totalStudyTime'] = stats.get('totalStudyTime', 0) + study_time
        stats['lastPracticeDate'] = datetime.now().isoformat()
        
        # 연습 기록 추가
        practice_history = stats.get('practiceHistory', [])
        practice_record = {
            'date': datetime.now().isoformat(),
            'question': question_data,
            'correct': is_correct,
            'studyTime': study_time,
            'mode': mode
        }
        practice_history.append(practice_record)
        stats['practiceHistory'] = practice_history[-100:]  # 최근 100개만 유지
        
        user['stats'] = stats
        save_users(users_data)
        print(f"사용자 {username} 통계 업데이트 완료 - 오답 문제 수: {len(stats.get('wrongQuestions', []))}")

# 사용자 생성
def create_user(username, password):
    global users_data
    users_data = load_users()
    
    if username in users_data['users']:
        return {"success": False, "message": "이미 존재하는 사용자명입니다."}
    
    # 새 사용자 생성
    new_user = {
        "password": password,
        "createdAt": datetime.now().isoformat(),
        "role": "user",
        "stats": {
            "totalQuestions": 0,
            "correctAnswers": 0,
            "incorrectAnswers": 0,
            "totalStudyTime": 0,
            "lastPracticeDate": None,
            "practiceHistory": [],
            "wrongQuestions": [],
            "lastSequentialPosition": 0
        }
    }
    
    users_data['users'][username] = new_user
    
    try:
        if save_users(users_data):
            print(f"새 사용자 생성 성공: {username}")
            return {"success": True, "message": "회원가입이 완료되었습니다."}
        else:
            print(f"사용자 저장 실패: {username}")
            return {"success": False, "message": "회원가입 중 오류가 발생했습니다."}
    except Exception as e:
        print(f"사용자 생성 중 예외 발생: {e}")
        return {"success": False, "message": f"회원가입 중 오류가 발생했습니다: {str(e)}"}

# 사용자 인증
def authenticate_user(username, password):
    global users_data
    users_data = load_users()
    user = users_data['users'].get(username)
    
    if not user:
        return {"success": False, "message": "존재하지 않는 사용자명입니다."}
    
    if user['password'] != password:
        return {"success": False, "message": "비밀번호가 일치하지 않습니다."}
    
    is_admin = user.get('role') == 'admin'
    return {"success": True, "user": {"username": username, "stats": user['stats'], "role": user.get('role', 'user')}, "is_admin": is_admin}

def extract_questions_from_excel(file_path):
    """엑셀 파일에서 문제 추출"""
    try:
        df = pd.read_excel(file_path)
        print(f"엑셀 파일 읽기 완료: {len(df)} 행")
        
        questions_by_set = {}
        
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
                options = []
                for i in range(1, 6):
                    option_pattern = f'{chr(9311 + i)}'
                    if option_pattern in options_text:
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
                
                while len(options) < 5:
                    options.append(f"보기 {len(options) + 1}")
            else:
                options = [f"보기 {i}" for i in range(1, 6)]

            question['options'] = options[:5]
            
            # 정답 처리
            if '답안' in df.columns:
                answer = str(row.get('답안', '1'))
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
    exam_questions = []
    
    # 현재 사용 가능한 세트 확인
    available_sets = list(questions_by_set.keys())
    print(f"사용 가능한 세트: {available_sets}")
    
    # 세트가 부족한 경우 기존 세트를 재사용
    set_requirements = {
        1: 10,  # 1과목
        2: 20,  # 2과목  
        3: 25,  # 3과목
        4: 30,  # 4과목
        5: 15   # 5과목
    }
    
    for set_num, required_count in set_requirements.items():
        # 해당 세트가 없으면 기존 세트에서 문제 가져오기
        if set_num not in questions_by_set:
            # 기존 세트 중에서 문제 가져오기
            available_questions = []
            for existing_set in available_sets:
                available_questions.extend(questions_by_set[existing_set])
            
            if len(available_questions) >= required_count:
                selected = random.sample(available_questions, required_count)
            else:
                selected = available_questions
        else:
            available_questions = questions_by_set[set_num]
            if len(available_questions) >= required_count:
                selected = random.sample(available_questions, required_count)
            else:
                selected = available_questions
        
        for i, question in enumerate(selected):
            question_copy = question.copy()
            question_copy['exam_number'] = len(exam_questions) + 1
            question_copy['set'] = set_num
            exam_questions.append(question_copy)
    
    return exam_questions

def load_questions_from_file():
    """CPPG 파일들에서 문제 로드"""
    file_paths = ["cppg_qa_final.xlsx", "cppg2.xlsx"]
    all_questions_by_set = {}
    
    for file_path in file_paths:
        if not os.path.exists(file_path):
            print(f"파일을 찾을 수 없습니다: {file_path}")
            continue
        
        print(f"파일 로드 중: {file_path}")
        questions_by_set = extract_questions_from_excel(file_path)
        
        if questions_by_set:
            for set_num, questions in questions_by_set.items():
                if set_num not in all_questions_by_set:
                    all_questions_by_set[set_num] = []
                all_questions_by_set[set_num].extend(questions)
                print(f"  세트 {set_num}: {len(questions)}개 문제 추가됨")
    
    if all_questions_by_set:
        stats = {}
        total_questions = 0
        for set_num, questions in all_questions_by_set.items():
            stats[f'세트{set_num}'] = len(questions)
            total_questions += len(questions)
        stats['총문제수'] = total_questions
        
        print(f"총 {total_questions}개 문제 로드 완료")
        return all_questions_by_set, stats
    
    return None, None

# 서버 시작 시 문제 로드
print("CPPG 문제 로드 중...")
QUESTIONS_BY_SET, STATS = load_questions_from_file()

# 관리자 계정 확인
print("관리자 계정 확인: admin/1234")
users_data = load_users()
print(f"현재 사용자 목록: {list(users_data['users'].keys())}")

@app.route('/')
def index():
    if 'username' in session:
        return redirect('/main')
    return render_template('login.html')

@app.route('/practice')
def practice():
    return render_template('cppg_practice.html')

@app.route('/exam')
def exam():
    return render_template('cppg_exam.html')

@app.route('/wrong-questions')
def wrong_questions():
    if 'username' not in session:
        return redirect('/')
    return render_template('wrong_questions.html')

@app.route('/api/questions')
def get_questions():
    if not QUESTIONS_BY_SET:
        return jsonify({'error': '문제가 로드되지 않았습니다.'}), 400
    
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
    
    all_questions = []
    for set_num, questions in QUESTIONS_BY_SET.items():
        for question in questions:
            question_copy = question.copy()
            question_copy['set'] = set_num
            all_questions.append(question_copy)
    
    random.shuffle(all_questions)
    return jsonify({'questions': all_questions})

@app.route('/api/wrong-questions')
def get_wrong_questions():
    if 'username' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    global users_data
    users_data = load_users()
    user = users_data['users'].get(session['username'])
    if not user:
        return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 404
    
    wrong_questions = user.get('stats', {}).get('wrongQuestions', [])
    print(f"사용자 {session['username']}의 오답 문제: {len(wrong_questions)}개")
    
    for i, q in enumerate(wrong_questions):
        print(f"  오답 {i+1}: 세트 {q.get('set')} 문제 {q.get('number')} - {q.get('text', '')[:50]}...")
    
    return jsonify({'questions': wrong_questions})

@app.route('/api/sequential-questions')
def get_sequential_questions():
    if 'username' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    if not QUESTIONS_BY_SET:
        return jsonify({'error': '문제가 로드되지 않았습니다.'}), 400
    
    global users_data
    users_data = load_users()
    user = users_data['users'].get(session['username'])
    if not user:
        return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 404
    
    # 사용자의 마지막 순차 풀이 위치 가져오기
    last_position = user.get('stats', {}).get('lastSequentialPosition', 0)
    
    # 모든 문제를 순서대로 정렬
    all_questions = []
    for set_num in sorted(QUESTIONS_BY_SET.keys()):
        for question in QUESTIONS_BY_SET[set_num]:
            question_copy = question.copy()
            question_copy['set'] = set_num
            all_questions.append(question_copy)
    
    # 마지막 위치부터 문제 반환
    remaining_questions = all_questions[last_position:]
    
    return jsonify({
        'questions': remaining_questions,
        'lastPosition': last_position,
        'totalQuestions': len(all_questions),
        'remainingQuestions': len(remaining_questions)
    })

@app.route('/api/submit-answer', methods=['POST'])
def submit_answer():
    if 'username' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    try:
        data = request.get_json()
        question_data = data.get('question')
        user_answer = data.get('answer')
        study_time = data.get('studyTime', 0)
        mode = data.get('mode', 'practice')  # 모드 정보 추가
        
        print(f"답안 제출: 사용자 {session['username']}, 문제 세트 {question_data.get('set')} 문제 {question_data.get('number')}")
        print(f"사용자 답안: {user_answer}, 정답: {question_data.get('correct')}, 모드: {mode}")
        
        # 정답 확인
        correct_answer = question_data.get('correct', 0)
        is_correct = user_answer == correct_answer
        
        print(f"정답 여부: {'맞음' if is_correct else '틀림'}")
        
        # 사용자 통계 업데이트 (모드 정보 포함)
        update_user_stats(session['username'], question_data, is_correct, study_time, mode)
        
        return jsonify({
            'success': True,
            'correct': is_correct,
            'correctAnswer': correct_answer,
            'explanation': question_data.get('answer', '')
        })
    except Exception as e:
        print(f"답안 제출 오류: {e}")
        return jsonify({'error': '답안 제출 중 오류가 발생했습니다.'}), 400

@app.route('/api/register', methods=['POST'])
def register():
    try:
        print("=== 회원가입 API 호출됨 ===")
        data = request.get_json()
        print(f"받은 데이터: {data}")
        
        username = data.get('username')
        password = data.get('password')
        
        print(f"회원가입 요청: {username}")
        
        if not username or not password:
            print('사용자명 또는 비밀번호 누락')
            return jsonify({'success': False, 'message': '사용자명과 비밀번호를 모두 입력해주세요.'}), 400
        
        if len(username) < 3:
            print('사용자명이 너무 짧음')
            return jsonify({'success': False, 'message': '사용자명은 3자 이상이어야 합니다.'}), 400
        
        if len(password) < 4:
            print('비밀번호가 너무 짧음')
            return jsonify({'success': False, 'message': '비밀번호는 4자 이상이어야 합니다.'}), 400
        
        print("사용자 생성 시작...")
        result = create_user(username, password)
        print(f"회원가입 결과: {result}")
        
        # 저장 후 확인
        print("저장 후 사용자 목록 확인...")
        users_data = load_users()
        print(f"저장된 사용자 목록: {list(users_data['users'].keys())}")
        print(f"새로 가입한 사용자 확인: {username in users_data['users']}")
        
        if result['success']:
            print(f"회원가입 성공: {username}")
        else:
            print(f"회원가입 실패: {result['message']}")
        
        return jsonify(result)
    except Exception as e:
        print(f"회원가입 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'회원가입 중 오류가 발생했습니다: {str(e)}'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    try:
        print("=== 로그인 API 호출됨 ===")
        data = request.get_json()
        print(f"받은 데이터: {data}")
        
        username = data.get('username')
        password = data.get('password')
        
        print(f"로그인 시도: {username}")
        
        if not username or not password:
            print('사용자명 또는 비밀번호 누락')
            return jsonify({'success': False, 'message': '사용자명과 비밀번호를 모두 입력해주세요.'}), 400
        
        # 현재 저장된 사용자 목록 확인
        users_data = load_users()
        print(f"현재 저장된 사용자 목록: {list(users_data['users'].keys())}")
        print(f"로그인 시도한 사용자 존재 여부: {username in users_data['users']}")
        
        result = authenticate_user(username, password)
        print(f"로그인 결과: {result}")
        
        if result['success']:
            session['username'] = username
            print(f"세션에 사용자 저장: {username}")
        
        return jsonify(result)
    except Exception as e:
        print(f"로그인 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'로그인 중 오류가 발생했습니다: {str(e)}'}), 400

@app.route('/main')
def main():
    if 'username' not in session:
        return redirect('/')
    
    global users_data
    users_data = load_users()
    user = users_data['users'].get(session['username'])
    
    if QUESTIONS_BY_SET is None:
        return render_template('cppg_main.html', error="문제 파일을 로드할 수 없습니다.", username=session['username'])
    
    # 사용자 통계 전달
    user_stats = user.get('stats', {}) if user else {}
    return render_template('cppg_main.html', username=session['username'], stats=STATS, user_stats=user_stats)

@app.route('/admin')
def admin():
    if 'username' not in session:
        return redirect('/')
    
    global users_data
    users_data = load_users()
    user = users_data['users'].get(session['username'])
    if not user or user.get('role') != 'admin':
        return redirect('/main')
    
    return render_template('admin.html', username=session['username'])

@app.route('/api/users')
def get_users():
    if 'username' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    global users_data
    users_data = load_users()
    user = users_data['users'].get(session['username'])
    if not user or user.get('role') != 'admin':
        return jsonify({'error': '관리자 권한이 필요합니다.'}), 403
    
    # 비밀번호 제외하고 사용자 목록 반환
    users_list = []
    for username, user_data in users_data['users'].items():
        user_info = {
            'username': username,
            'createdAt': user_data.get('createdAt'),
            'role': user_data.get('role', 'user'),
            'stats': user_data.get('stats', {})
        }
        users_list.append(user_info)
    
    return jsonify({'users': users_list})

@app.route('/api/users/<username>', methods=['DELETE'])
def delete_user(username):
    if 'username' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    global users_data
    users_data = load_users()
    current_user = users_data['users'].get(session['username'])
    if not current_user or current_user.get('role') != 'admin':
        return jsonify({'error': '관리자 권한이 필요합니다.'}), 403
    
    if username == 'admin':
        return jsonify({'error': '관리자 계정은 삭제할 수 없습니다.'}), 400
    
    if username not in users_data['users']:
        return jsonify({'error': '존재하지 않는 사용자입니다.'}), 404
    
    del users_data['users'][username]
    if save_users(users_data):
        return jsonify({'success': True, 'message': f'사용자 {username}이(가) 삭제되었습니다.'})
    else:
        return jsonify({'error': '사용자 삭제 중 오류가 발생했습니다.'}), 500

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect('/')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5004) 