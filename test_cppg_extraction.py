import pdfplumber
import re
import os

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

def main():
    # PDF 파일 경로들 시도
    pdf_paths = [
        "CPPG 300제_2025년.pdf",
        "C:/Users/sds/Documents/카카오톡 받은 파일/CPPG 300제_2025년.pdf",
        "./CPPG 300제_2025년.pdf"
    ]
    
    pdf_path = None
    for path in pdf_paths:
        if os.path.exists(path):
            pdf_path = path
            print(f"PDF 파일 발견: {path}")
            break
    
    if not pdf_path:
        print("PDF 파일을 찾을 수 없습니다.")
        print("현재 디렉토리 파일들:")
        for file in os.listdir('.'):
            if file.endswith('.pdf'):
                print(f"  - {file}")
        return
    
    # PDF에서 텍스트 추출
    text = extract_text_from_pdf(pdf_path)
    if text is None:
        print("PDF 파일을 읽을 수 없습니다.")
        return
    
    # 문제 파싱
    questions = parse_cppg_questions(text)
    
    if not questions:
        print("문제를 찾을 수 없습니다.")
        print("추출된 텍스트 샘플:")
        print(text[:500])
        return
    
    # 결과 출력
    print(f"\n=== 추출된 문제 {len(questions)}개 ===")
    for i, question in enumerate(questions[:3]):  # 처음 3개만 출력
        print(f"\n문제 {question['number']}:")
        print(f"내용: {question['text'][:100]}...")
        print(f"보기: {question['options']}")
    
    # JSON으로 저장
    import json
    with open('extracted_questions.json', 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    
    print(f"\n문제 데이터가 'extracted_questions.json' 파일로 저장되었습니다.")

if __name__ == "__main__":
    main() 