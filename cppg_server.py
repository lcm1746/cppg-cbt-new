from flask import Flask, render_template, jsonify, request
import json
import os

app = Flask(__name__)

# CPPG 문제 데이터
QUESTIONS = [
    {
        "number": 1,
        "text": "다음 중 C++에서 동적 메모리 할당을 위해 사용되는 키워드는?",
        "options": ["new", "malloc", "alloc", "create"],
        "correct": 0,
        "answer": "new 키워드를 사용하여 동적으로 메모리를 할당할 수 있습니다. malloc은 C언어의 함수입니다."
    },
    {
        "number": 2,
        "text": "C++에서 클래스의 멤버 함수를 가상 함수로 선언하는 키워드는?",
        "options": ["virtual", "abstract", "override", "final"],
        "correct": 0,
        "answer": "virtual 키워드를 사용하여 가상 함수를 선언합니다. 이를 통해 다형성을 구현할 수 있습니다."
    },
    {
        "number": 3,
        "text": "다음 중 STL 컨테이너가 아닌 것은?",
        "options": ["vector", "list", "array", "string"],
        "correct": 2,
        "answer": "array는 C++11에서 추가된 표준 라이브러리이지만, STL 컨테이너는 아닙니다. vector, list, string은 STL 컨테이너입니다."
    },
    {
        "number": 4,
        "text": "C++에서 예외 처리를 위해 사용되는 키워드 조합은?",
        "options": ["try-catch", "if-else", "switch-case", "for-while"],
        "correct": 0,
        "answer": "try-catch 키워드를 사용하여 예외를 처리합니다. try 블록에서 예외가 발생하면 catch 블록에서 처리합니다."
    },
    {
        "number": 5,
        "text": "다음 중 C++에서 함수 템플릿을 선언하는 키워드는?",
        "options": ["template", "typename", "class", "generic"],
        "correct": 0,
        "answer": "template 키워드를 사용하여 함수 템플릿을 선언합니다. 이를 통해 다양한 타입에 대해 동일한 함수를 사용할 수 있습니다."
    },
    {
        "number": 6,
        "text": "C++에서 스마트 포인터 중 RAII를 지원하는 것은?",
        "options": ["unique_ptr", "raw pointer", "void pointer", "null pointer"],
        "correct": 0,
        "answer": "unique_ptr는 RAII(Resource Acquisition Is Initialization)를 지원하는 스마트 포인터입니다. 자동으로 메모리를 해제합니다."
    },
    {
        "number": 7,
        "text": "다음 중 C++에서 람다 표현식의 캡처 리스트에 포함될 수 없는 것은?",
        "options": ["[=]", "[&]", "[this]", "[static]"],
        "correct": 3,
        "answer": "[static]은 유효하지 않은 캡처 리스트입니다. [=], [&], [this]는 모두 유효한 캡처 리스트입니다."
    },
    {
        "number": 8,
        "text": "C++에서 constexpr 함수의 특징이 아닌 것은?",
        "options": ["컴파일 타임에 실행 가능", "런타임에 실행 가능", "반환값이 상수", "매개변수가 상수여야 함"],
        "correct": 3,
        "answer": "constexpr 함수의 매개변수는 반드시 상수일 필요는 없습니다. 컴파일 타임과 런타임 모두에서 실행 가능합니다."
    },
    {
        "number": 9,
        "text": "다음 중 C++에서 이동 의미론과 관련된 키워드는?",
        "options": ["move", "copy", "assign", "transfer"],
        "correct": 0,
        "answer": "std::move는 이동 의미론을 구현하기 위한 키워드입니다. 불필요한 복사를 방지하여 성능을 향상시킵니다."
    },
    {
        "number": 10,
        "text": "C++에서 std::thread를 사용할 때 주의해야 할 점은?",
        "options": ["join() 또는 detach() 호출 필수", "자동으로 종료됨", "메모리 누수 없음", "예외 안전"],
        "correct": 0,
        "answer": "std::thread 객체는 소멸자에서 join() 또는 detach()가 호출되지 않으면 std::terminate가 호출됩니다."
    }
]

@app.route('/')
def index():
    return render_template('cppg_practice.html', questions=QUESTIONS)

@app.route('/api/questions')
def get_questions():
    return jsonify(QUESTIONS)

@app.route('/api/submit-answer', methods=['POST'])
def submit_answer():
    data = request.json
    question_index = data.get('questionIndex')
    selected_answer = data.get('selectedAnswer')
    time_taken = data.get('timeTaken')
    
    if question_index < len(QUESTIONS):
        question = QUESTIONS[question_index]
        is_correct = selected_answer == question['correct']
        
        return jsonify({
            'correct': is_correct,
            'correctAnswer': question['correct'],
            'explanation': question['answer']
        })
    
    return jsonify({'error': 'Invalid question index'}), 400

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'CPPG 문제 연습 서버가 정상 동작 중입니다!',
        'total_questions': len(QUESTIONS)
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 