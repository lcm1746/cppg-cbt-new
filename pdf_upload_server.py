from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import pdfplumber
import re
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# 업로드 폴더 생성
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 허용된 파일 확장자
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(pdf_path):
    """PDF에서 텍스트 추출"""
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                print(f"페이지 {page_num + 1} 텍스트 길이: {len(page_text) if page_text else 0}")
                
    except Exception as e:
        print(f"PDF 텍스트 추출 오류: {e}")
        return None
    
    print(f"총 추출된 텍스트 길이: {len(text)}")
    return text

def parse_cppg_questions(text):
    """텍스트에서 CPPG 문제만 파싱 (문제 번호 + 문제 내용만)"""
    questions = []
    
    print("=== 문제 파싱 시작 ===")
    print(f"입력 텍스트 길이: {len(text)}")
    
    # 문제 패턴들 (문제 번호 + 문제 내용만 추출)
    patterns = [
        # 패턴 1: "1. 문제내용" (다음 문제 번호까지)
        r'(\d+)\.\s*([^A-D\n]+?)(?=\d+\.|$)',
        # 패턴 2: "문제 1. 문제내용"
        r'문제\s*(\d+)\.\s*([^A-D\n]+?)(?=문제\s*\d+\.|$)',
        # 패턴 3: "Q1. 문제내용"
        r'Q(\d+)\.\s*([^A-D\n]+?)(?=Q\d+\.|$)',
        # 패턴 4: "1) 문제내용"
        r'(\d+)\)\s*([^A-D\n]+?)(?=\d+\)|$)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            print(f"패턴 '{pattern}'으로 {len(matches)}개 매치 발견")
            break
    else:
        # 기본 패턴으로 다시 시도
        matches = re.findall(r'(\d+)\.\s*([^A-D\n]+?)(?=\d+\.|$)', text, re.DOTALL)
        print(f"기본 패턴으로 {len(matches)}개 매치 발견")
    
    for i, (number, content) in enumerate(matches[:10]):  # 최대 10문제
        print(f"\n=== 문제 {number} 파싱 ===")
        
        # 문제 텍스트 정리 (보기 제거)
        question_text = clean_question_text(content)
        
        print(f"문제 텍스트: {question_text[:100]}...")
        
        # 기본 보기 4개 생성
        options = [
            "보기 A",
            "보기 B", 
            "보기 C",
            "보기 D"
        ]
        
        questions.append({
            "number": int(number),
            "text": question_text,
            "options": options,
            "correct": 0,  # 임시 정답
            "answer": f"문제 {number}의 정답입니다. (자동 추출된 답안입니다.)"
        })
    
    print(f"\n=== 총 {len(questions)}개 문제 파싱 완료 ===")
    return questions

def clean_question_text(text):
    """문제 텍스트 정리 (보기, 답안 등 제거)"""
    if not text:
        return ""
    
    # 보기 패턴 제거 (A., B., C., D. 로 시작하는 부분)
    text = re.sub(r'[A-D]\.\s*[^A-D\n]*', '', text)
    text = re.sub(r'[A-D]\)\s*[^A-D\n]*', '', text)
    
    # 답안 패턴 제거 (정답:, 답:, 등)
    text = re.sub(r'정답[:\s]*[A-D]', '', text)
    text = re.sub(r'답[:\s]*[A-D]', '', text)
    text = re.sub(r'해설[:\s]*.*', '', text)
    
    # 불필요한 공백 제거
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    # 빈 줄 제거
    text = re.sub(r'\n\s*\n', '\n', text)
    
    return text

@app.route('/')
def index():
    return render_template('pdf_upload.html')

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
        
        # PDF에서 텍스트 추출
        text = extract_text_from_pdf(filepath)
        if text is None:
            return jsonify({'error': 'PDF 파일을 읽을 수 없습니다.'}), 400
        
        # 문제 파싱
        questions = parse_cppg_questions(text)
        
        if not questions:
            return jsonify({
                'error': '문제를 찾을 수 없습니다. PDF 형식을 확인해주세요.',
                'extracted_text': text[:1000] + "..." if len(text) > 1000 else text
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
            'extracted_text': text[:1000] + "..." if len(text) > 1000 else text
        })
    
    return jsonify({'error': '지원하지 않는 파일 형식입니다. PDF 파일만 업로드 가능합니다.'}), 400

@app.route('/practice')
def practice():
    return render_template('cppg_practice.html')

@app.route('/api/questions')
def get_questions():
    # 세션에서 문제 데이터 가져오기 (실제로는 데이터베이스나 세션 사용)
    return jsonify([])

@app.route('/test')
def test():
    return render_template('test_sample.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) 