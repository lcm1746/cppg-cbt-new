from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import pandas as pd
import re
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# 업로드 폴더 생성
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 허용된 파일 확장자
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_questions_from_excel(file_path):
    """엑셀 파일에서 문제 추출"""
    try:
        # 엑셀 파일 읽기
        df = pd.read_excel(file_path)
        print(f"엑셀 파일 읽기 완료: {len(df)} 행")
        print(f"컬럼: {list(df.columns)}")
        
        questions = []
        
        # 다양한 엑셀 형식 지원
        for index, row in df.iterrows():
            question = {}
            
            # 컬럼명 매핑 (다양한 형식 지원)
            if '번호' in df.columns or '문제번호' in df.columns or 'No' in df.columns:
                question['number'] = int(row.get('번호', row.get('문제번호', row.get('No', index + 1))))
            else:
                question['number'] = index + 1
                
            if '문제' in df.columns or '내용' in df.columns or 'Question' in df.columns:
                question['text'] = str(row.get('문제', row.get('내용', row.get('Question', ''))))
            else:
                question['text'] = str(row.iloc[0]) if len(row) > 0 else ''
                
            # 보기 처리
            options = []
            for i in range(1, 5):  # A, B, C, D 보기
                option_key = f'보기{i}' if f'보기{i}' in df.columns else f'보기{chr(64+i)}' if f'보기{chr(64+i)}' in df.columns else f'Option{i}' if f'Option{i}' in df.columns else None
                if option_key and option_key in df.columns:
                    options.append(str(row[option_key]))
                else:
                    # 개별 보기 컬럼이 없으면 기본값
                    options.append(f"보기 {chr(64+i)}")
            
            # 보기가 없으면 기본값 생성
            if not options or all(opt == f"보기 {chr(65+i)}" for i, opt in enumerate(options)):
                options = ["보기 A", "보기 B", "보기 C", "보기 D"]
            
            question['options'] = options
            
            # 정답 처리
            if '정답' in df.columns or 'Answer' in df.columns or '답' in df.columns:
                answer = str(row.get('정답', row.get('Answer', row.get('답', 'A'))))
                # A, B, C, D를 0, 1, 2, 3으로 변환
                answer_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3}
                question['correct'] = answer_map.get(answer.upper(), 0)
            else:
                question['correct'] = 0
                
            # 해설 처리
            if '해설' in df.columns or 'Explanation' in df.columns or '설명' in df.columns:
                question['answer'] = str(row.get('해설', row.get('Explanation', row.get('설명', ''))))
            else:
                question['answer'] = f"문제 {question['number']}의 정답은 {question['options'][question['correct']]}입니다."
            
            # 빈 문제 제외
            if question['text'].strip():
                questions.append(question)
        
        print(f"총 {len(questions)}개 문제 추출 완료")
        return questions
        
    except Exception as e:
        print(f"엑셀 파일 처리 오류: {e}")
        return None

@app.route('/')
def index():
    return render_template('excel_upload.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        print(f"파일 업로드: {filename}")
        
        # 엑셀 파일에서 문제 추출
        questions = extract_questions_from_excel(filepath)
        if questions is None:
            return jsonify({'error': '엑셀 파일을 읽을 수 없습니다.'}), 400
        
        if not questions:
            return jsonify({
                'error': '문제를 찾을 수 없습니다. 엑셀 파일 형식을 확인해주세요.',
            }), 400
        
        # 임시 파일 삭제
        try:
            os.remove(filepath)
        except:
            pass
        
        return jsonify({
            'success': True,
            'questions': questions,
            'total_questions': len(questions),
        })
    
    return jsonify({'error': '지원하지 않는 파일 형식입니다. XLSX, XLS 파일만 업로드 가능합니다.'}), 400

@app.route('/practice')
def practice():
    return render_template('cppg_practice.html')

@app.route('/sample')
def sample():
    return render_template('excel_sample.html')

@app.route('/api/questions')
def get_questions():
    return jsonify([])

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5003) 