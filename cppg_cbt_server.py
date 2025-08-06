from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os
import pandas as pd
import random
import json
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# 사용자 데이터 파일
USERS_FILE = 'users.json'

# 메모리 캐시 (빠른 접근용)
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

# 사용자 데이터 로드 (파일에서 로드하고 메모리에 캐시)
def load_users():
    global users_data
    try:
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
        return True
    except Exception as e:
        print(f"파일 저장 오류: {e}")
        return False

# 사용자 데이터 저장 (메모리 + 파일 또는 환경변수)
def save_users(data):
    global users_data
    users_data = data
    print(f"사용자 데이터 저장 완료 (메모리): {len(users_data['users'])}명")
    
    if is_vercel_environment():
        # Vercel 환경에서는 환경변수나 외부 저장소 사용
        print("Vercel 환경: 메모리에서만 유지 (서버 재시작 시 초기화)")
        # TODO: 여기에 외부 데이터베이스 연결 코드 추가
        return True
    else:
        # 로컬 환경에서는 파일 저장
        if save_users_to_file(data):
            print("파일 저장 완료")
        else:
            print("파일 저장 실패, 메모리에서만 유지")
        return True

# 사용자 생성
def create_user(username, password):
    users_data = load_users()
    
    if username in users_data['users']:
        return {"success": False, "message": "이미 존재하는 사용자명입니다."}
    
    users_data['users'][username] = {
        "password": password,
        "createdAt": datetime.now().isoformat(),
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
    
    if save_users(users_data):
        return {"success": True, "message": "회원가입이 완료되었습니다."}
    else:
        return {"success": False, "message": "회원가입 중 오류가 발생했습니다."}

# 사용자 인증
def authenticate_user(username, password):
    users_data = load_users()
    user = users_data['users'].get(username)
    
    if not user:
        return {"success": False, "message": "존재하지 않는 사용자명입니다."}
    
    if user['password'] != password:
        return {"success": False, "message": "비밀번호가 일치하지 않습니다."}
    
    # 관리자 역할 확인
    is_admin = user.get('role') == 'admin'
    
    return {"success": True, "user": {"username": username, "stats": user['stats'], "role": user.get('role', 'user')}, "is_admin": is_admin}

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
                # '보기' 컬럼이 없으면 기본 보기 생성
                options = [f"보기 {i}" for i in range(1, 6)]

            
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
    file_path = "cppg_qa_final.xlsx"
    
    if not os.path.exists(file_path):
        print(f"파일을 찾을 수 없습니다: {file_path}")
        return None
    
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

# 관리자 계정 확인
print("관리자 계정 확인: admin/1234")
users_data = load_users() # load_users()를 다시 호출하여 최신 상태의 users_data를 가져옴
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
        
        result = create_user(username, password)
        print(f"회원가입 결과: {result}")
        
        # 저장 후 확인
        users_data = load_users()
        print(f"저장된 사용자 목록: {list(users_data['users'].keys())}")
        print(f"새로 가입한 사용자 확인: {'admin122' in users_data['users']}")
        
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
    if QUESTIONS_BY_SET is None:
        return render_template('cppg_main.html', error="문제 파일을 로드할 수 없습니다.", username=session['username'])
    return render_template('cppg_main.html', username=session['username'], stats=STATS)

@app.route('/admin')
def admin():
    if 'username' not in session:
        return redirect('/')
    
    users_data = load_users()
    user = users_data['users'].get(session['username'])
    if not user or user.get('role') != 'admin':
        return redirect('/main')
    
    return render_template('admin.html', username=session['username'])

@app.route('/api/users')
def get_users():
    if 'username' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
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