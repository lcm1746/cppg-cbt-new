from flask import Flask, request, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)

# 사용자 데이터 파일
USERS_FILE = 'users.json'

# 초기 사용자 데이터
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

def load_users():
    global users_data
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                file_data = json.load(f)
                users_data['users'].update(file_data.get('users', {}))
                print(f"파일에서 사용자 데이터 로드: {len(file_data.get('users', {}))}명")
        else:
            save_users_to_file(users_data)
            print("새 파일 생성")
    except Exception as e:
        print(f"파일 로드 오류: {e}")
    
    return users_data

def save_users_to_file(data):
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"파일 저장 성공: {USERS_FILE}")
        return True
    except Exception as e:
        print(f"파일 저장 오류: {e}")
        return False

def create_user(username, password):
    global users_data
    users_data = load_users()
    
    if username in users_data['users']:
        return {"success": False, "message": "이미 존재하는 사용자명입니다."}
    
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
    
    if save_users_to_file(users_data):
        print(f"새 사용자 생성 성공: {username}")
        return {"success": True, "message": "회원가입이 완료되었습니다."}
    else:
        print(f"사용자 저장 실패: {username}")
        return {"success": False, "message": "회원가입 중 오류가 발생했습니다."}

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
            return jsonify({'success': False, 'message': '사용자명과 비밀번호를 모두 입력해주세요.'}), 400
        
        if len(username) < 3:
            return jsonify({'success': False, 'message': '사용자명은 3자 이상이어야 합니다.'}), 400
        
        if len(password) < 4:
            return jsonify({'success': False, 'message': '비밀번호는 4자 이상이어야 합니다.'}), 400
        
        print("사용자 생성 시작...")
        result = create_user(username, password)
        print(f"회원가입 결과: {result}")
        
        # 저장 후 확인
        users_data = load_users()
        print(f"저장된 사용자 목록: {list(users_data['users'].keys())}")
        print(f"새로 가입한 사용자 확인: {username in users_data['users']}")
        
        return jsonify(result)
    except Exception as e:
        print(f"회원가입 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'회원가입 중 오류가 발생했습니다: {str(e)}'}), 400

@app.route('/api/users')
def get_users():
    users_data = load_users()
    users_list = []
    for username, user_data in users_data['users'].items():
        user_info = {
            'username': username,
            'createdAt': user_data.get('createdAt'),
            'role': user_data.get('role', 'user')
        }
        users_list.append(user_info)
    
    return jsonify({'users': users_list})

if __name__ == '__main__':
    print("테스트 서버 시작...")
    load_users()
    app.run(debug=True, host='0.0.0.0', port=5005) 