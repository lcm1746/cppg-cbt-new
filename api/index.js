const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 전역 변수로 문제 저장
let questionsBySet = null;
let stats = null;

// 엑셀 파일에서 문제 로드
function loadQuestionsFromExcel() {
  try {
    const filePaths = [
      'cppg_qa_final.xlsx',
      'cppg_qa_final.csv',
      '../cppg_qa_final.xlsx',
      '../cppg_qa_final.csv',
      './cppg_qa_final.xlsx',
      './cppg_qa_final.csv',
      '../../cppg_qa_final.xlsx',
      '../../cppg_qa_final.csv',
      '../../../cppg_qa_final.xlsx',
      '../../../cppg_qa_final.csv',
      '/tmp/cppg_qa_final.xlsx',
      '/tmp/cppg_qa_final.csv',
      path.join(__dirname, 'cppg_qa_final.xlsx'),
      path.join(__dirname, 'cppg_qa_final.csv'),
      path.join(__dirname, '..', 'cppg_qa_final.xlsx'),
      path.join(__dirname, '..', 'cppg_qa_final.csv'),
      path.join(__dirname, '..', '..', 'cppg_qa_final.xlsx'),
      path.join(__dirname, '..', '..', 'cppg_qa_final.csv'),
      path.join(process.cwd(), 'cppg_qa_final.xlsx'),
      path.join(process.cwd(), 'cppg_qa_final.csv'),
      path.join(process.cwd(), 'api', 'cppg_qa_final.xlsx'),
      path.join(process.cwd(), 'api', 'cppg_qa_final.csv')
    ];

    let filePath = null;
    for (const testPath of filePaths) {
      console.log(`파일 경로 확인 중: ${testPath}`);
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        console.log(`파일 발견: ${filePath}`);
        break;
      }
    }

    if (!filePath) {
      console.log('엑셀/CSV 파일을 찾을 수 없습니다. 시도한 경로들:');
      filePaths.forEach(p => console.log(`  - ${p}`));
      
      // 현재 디렉토리 파일 목록 출력
      try {
        console.log('현재 디렉토리 파일들:');
        const files = fs.readdirSync('.');
        files.forEach(file => console.log(`  - ${file}`));
      } catch (e) {
        console.log('현재 디렉토리 읽기 실패:', e.message);
      }
      
      return null;
    }

    console.log(`파일 로드 중: ${filePath}`);
    
    let data;
    if (filePath.endsWith('.csv')) {
      // CSV 파일 읽기
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      
      data = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',');
          const row = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
          });
          data.push(row);
        }
      }
    } else {
      // Excel 파일 읽기
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    console.log(`총 ${data.length}개 행 읽기 완료`);

    const questionsBySet = {};
    
    data.forEach((row, index) => {
      const question = {};
      
      // 세트 처리
      const setNum = row['세트'] ? parseInt(row['세트']) : 1;
      
      // 문제 번호 처리
      question.number = row['문제번호'] ? parseInt(row['문제번호']) : index + 1;
      
      // 문제 내용 처리
      question.text = row['문제'] ? String(row['문제']) : '';
      
      // 보기 처리
      if (row['보기']) {
        const optionsText = String(row['보기']);
        const options = [];
        
        for (let i = 1; i <= 5; i++) {
          const optionPattern = String.fromCharCode(9311 + i); // ①, ②, ③, ④, ⑤
          if (optionsText.includes(optionPattern)) {
            const start = optionsText.indexOf(optionPattern);
            let end;
            if (i < 5) {
              end = optionsText.indexOf(String.fromCharCode(9311 + i + 1));
              if (end === -1) end = optionsText.length;
            } else {
              end = optionsText.length;
            }
            const optionText = optionsText.substring(start + 1, end).trim();
            options.push(optionText);
          } else {
            options.push(`보기 ${i}`);
          }
        }
        
        while (options.length < 5) {
          options.push(`보기 ${options.length + 1}`);
        }
        question.options = options.slice(0, 5);
      } else {
        question.options = ["보기 1", "보기 2", "보기 3", "보기 4", "보기 5"];
      }
      
      // 정답 처리
      if (row['답안']) {
        const answer = String(row['답안']);
        const answerMap = {
          '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4,
          '1': 0, '2': 1, '3': 2, '4': 3, '5': 4
        };
        question.correct = answerMap[answer] || 0;
      } else {
        question.correct = 0;
      }
      
      // 해설 처리
      question.answer = row['해설'] ? String(row['해설']) : `문제 ${question.number}의 정답은 ${question.options[question.correct]}입니다.`;
      
      // 세트별로 분류
      if (!questionsBySet[setNum]) {
        questionsBySet[setNum] = [];
      }
      
      if (question.text.trim()) {
        questionsBySet[setNum].push(question);
      }
    });

    // 통계 생성
    const stats = {};
    let totalQuestions = 0;
    for (const [setNum, questions] of Object.entries(questionsBySet)) {
      stats[`세트${setNum}`] = questions.length;
      totalQuestions += questions.length;
    }
    stats['총문제수'] = totalQuestions;

    console.log('문제 로드 완료:', stats);
    return { questionsBySet, stats };
  } catch (error) {
    console.error('파일 처리 오류:', error);
    return null;
  }
}

// 시험 문제 생성 (CPPG 시험 형식)
function generateExamQuestions(questionsBySet) {
  const examRequirements = {
    1: 10,  // 1과목: 10문제
    2: 20,  // 2과목: 20문제
    3: 25,  // 3과목: 25문제
    4: 30,  // 4과목: 30문제
    5: 15   // 5과목: 15문제
  };

  const examQuestions = [];
  
  for (const [setNum, requiredCount] of Object.entries(examRequirements)) {
    const setQuestions = questionsBySet[setNum] || [];
    if (setQuestions.length > 0) {
      const selected = setQuestions.length >= requiredCount 
        ? shuffleArray(setQuestions).slice(0, requiredCount)
        : shuffleArray(setQuestions);
      
      selected.forEach((question, index) => {
        examQuestions.push({
          ...question,
          exam_number: examQuestions.length + 1,
          set: parseInt(setNum)
        });
      });
    }
  }
  
  return examQuestions;
}

// 배열 섞기 함수
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 문제 로드 (한 번만)
if (!questionsBySet) {
  const result = loadQuestionsFromExcel();
  if (result) {
    questionsBySet = result.questionsBySet;
    stats = result.stats;
  }
}

module.exports = (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (pathname === '/' && req.method === 'GET') {
      // 메인 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG CBT 시스템</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .btn { display: inline-block; padding: 15px 30px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; font-weight: bold; transition: background 0.3s; }
            .btn:hover { background: #0056b3; }
            .stats { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
            h1 { color: #333; text-align: center; }
            .stats h3 { color: #007bff; margin-top: 0; }
            .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG CBT 시스템</h1>
            ${!stats ? '<div class="error">⚠️ 문제 파일을 로드할 수 없습니다.</div>' : `
              <div class="stats">
                <h3>📊 문제 통계</h3>
                <p><strong>총 문제수:</strong> ${stats['총문제수'] || 0}개</p>
                <p><strong>세트1:</strong> ${stats['세트1'] || 0}개</p>
                <p><strong>세트2:</strong> ${stats['세트2'] || 0}개</p>
                <p><strong>세트3:</strong> ${stats['세트3'] || 0}개</p>
                <p><strong>세트4:</strong> ${stats['세트4'] || 0}개</p>
                <p><strong>세트5:</strong> ${stats['세트5'] || 0}개</p>
              </div>
              <div style="text-align: center;">
                <a href="/practice" class="btn">📚 순차 연습</a>
                <a href="/random" class="btn">🎲 랜덤 연습</a>
                <a href="/exam" class="btn">📝 시험 모드</a>
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <h3>📖 세트별 연습</h3>
                ${Object.keys(stats).filter(key => key.startsWith('세트')).map(setKey => {
                  const setNum = setKey.replace('세트', '');
                  const questionCount = stats[setKey];
                  return `<a href="/set/${setNum}" class="btn" style="margin: 5px;">세트${setNum} (${questionCount}문제)</a>`;
                }).join('')}
              </div>
            `}
          </div>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname === '/api/questions' && req.method === 'GET') {
      // 순차 문제 API
      if (!questionsBySet) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '문제가 로드되지 않았습니다.' }));
        return;
      }

      const allQuestions = [];
      for (const [setNum, questions] of Object.entries(questionsBySet)) {
        questions.forEach(question => {
          allQuestions.push({
            ...question,
            set: parseInt(setNum)
          });
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ questions: allQuestions }));
    }
    else if (pathname === '/api/random-questions' && req.method === 'GET') {
      // 랜덤 문제 API
      if (!questionsBySet) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '문제가 로드되지 않았습니다.' }));
        return;
      }

      const allQuestions = [];
      for (const [setNum, questions] of Object.entries(questionsBySet)) {
        questions.forEach(question => {
          allQuestions.push({
            ...question,
            set: parseInt(setNum)
          });
        });
      }

      const shuffledQuestions = shuffleArray(allQuestions);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ questions: shuffledQuestions }));
    }
    else if (pathname === '/api/exam-questions' && req.method === 'GET') {
      // 시험 문제 API
      if (!questionsBySet) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '문제가 로드되지 않았습니다.' }));
        return;
      }

      const examQuestions = generateExamQuestions(questionsBySet);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ questions: examQuestions }));
    }
    else if (pathname.startsWith('/api/set-questions/') && req.method === 'GET') {
      // 세트별 문제 API
      if (!questionsBySet) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '문제가 로드되지 않았습니다.' }));
        return;
      }

      const setNum = parseInt(pathname.split('/').pop());
      const setQuestions = questionsBySet[setNum] || [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        questions: setQuestions.map(q => ({ ...q, set: setNum })),
        setNumber: setNum
      }));
    }
    else if (pathname === '/practice' && req.method === 'GET') {
      // 순차 연습 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 순차 연습</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .question { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .option { margin: 10px 0; padding: 15px; border: 1px solid #eee; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
            .option:hover { background: #f8f9fa; }
            .option.selected { background: #007bff; color: white; }
            .option.correct { background: #28a745; color: white; }
            .option.incorrect { background: #dc3545; color: white; }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; cursor: pointer; border: none; }
            .btn:disabled { background: #6c757d; cursor: not-allowed; }
            .answer { margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 5px; border-left: 4px solid #007bff; }
            .timer { text-align: center; font-size: 18px; margin: 20px 0; }
            .progress { text-align: center; margin: 20px 0; }
            .controls { text-align: center; margin: 20px 0; }
            .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .stats span { margin: 0 15px; font-weight: bold; }
            .correct-count { color: #28a745; }
            .incorrect-count { color: #dc3545; }
            .unanswered-count { color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 순차 연습</h1>
            <div class="timer" id="timer">시간: 00:00</div>
            <div class="progress" id="progress">문제 1 / 0</div>
            <div class="stats" id="stats">
              <span class="correct-count">정답: 0</span>
              <span class="incorrect-count">오답: 0</span>
              <span class="unanswered-count">미답: 0</span>
            </div>
            <div id="question-container">
              <p>문제를 불러오는 중...</p>
            </div>
            <div class="controls">
              <button class="btn" id="prevBtn" onclick="prevQuestion()" disabled>이전</button>
              <button class="btn" id="nextBtn" onclick="nextQuestion()" disabled>다음</button>
              <button class="btn" id="submitBtn" onclick="submitAnswer()" disabled>정답 확인</button>
            </div>
            <div id="answer-container"></div>
            <a href="/" class="btn">메인으로 돌아가기</a>
          </div>
          <script>
            let questions = [];
            let currentQuestionIndex = 0;
            let selectedAnswer = null;
            let startTime = Date.now();
            let timerInterval;
            let answers = {}; // 답안 기록
            let correctCount = 0;
            let incorrectCount = 0;

            // 타이머 시작
            function startTimer() {
              timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('timer').textContent = \`시간: \${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
              }, 1000);
            }

            // 통계 업데이트
            function updateStats() {
              const answeredCount = Object.keys(answers).length;
              const unansweredCount = questions.length - answeredCount;
              document.getElementById('stats').innerHTML = \`
                <span class="correct-count">정답: \${correctCount}</span>
                <span class="incorrect-count">오답: \${incorrectCount}</span>
                <span class="unanswered-count">미답: \${unansweredCount}</span>
              \`;
            }

            // 문제 로드
            fetch('/api/questions')
              .then(response => response.json())
              .then(data => {
                if (data.questions && data.questions.length > 0) {
                  questions = data.questions;
                  displayQuestion();
                  startTimer();
                  updateStats();
                } else {
                  document.getElementById('question-container').innerHTML = '<p>문제를 불러올 수 없습니다.</p>';
                }
              });

            function displayQuestion() {
              const question = questions[currentQuestionIndex];
              const container = document.getElementById('question-container');
              const previousAnswer = answers[currentQuestionIndex];
              
              container.innerHTML = \`
                <div class="question">
                  <h3>문제 \${question.number} (세트\${question.set})</h3>
                  <p>\${question.text}</p>
                  <div class="options">
                    \${question.options.map((option, index) => {
                      let className = 'option';
                      if (previousAnswer !== undefined) {
                        if (index === question.correct) {
                          className += ' correct';
                        } else if (index === previousAnswer && previousAnswer !== question.correct) {
                          className += ' incorrect';
                        }
                      } else if (index === selectedAnswer) {
                        className += ' selected';
                      }
                      return \`<div class="\${className}" onclick="selectOption(\${index})">\${index + 1}. \${option}</div>\`;
                    }).join('')}
                  </div>
                </div>
              \`;
              
              document.getElementById('progress').textContent = \`문제 \${currentQuestionIndex + 1} / \${questions.length}\`;
              updateButtons();
            }

            function selectOption(index) {
              if (answers[currentQuestionIndex] !== undefined) return; // 이미 답한 문제는 변경 불가
              
              selectedAnswer = index;
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected');
                if (i === index) opt.classList.add('selected');
              });
              document.getElementById('submitBtn').disabled = false;
            }

            function submitAnswer() {
              if (selectedAnswer === null) return;
              
              const question = questions[currentQuestionIndex];
              const isCorrect = selectedAnswer === question.correct;
              
              // 답안 기록
              answers[currentQuestionIndex] = selectedAnswer;
              
              // 정답/오답 카운트 업데이트
              if (isCorrect) {
                correctCount++;
              } else {
                incorrectCount++;
              }
              
              // 정답/오답 표시
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected', 'correct', 'incorrect');
                if (i === question.correct) {
                  opt.classList.add('correct');
                } else if (i === selectedAnswer && !isCorrect) {
                  opt.classList.add('incorrect');
                }
              });
              
              // 모범답안 표시
              const answerContainer = document.getElementById('answer-container');
              answerContainer.innerHTML = \`
                <div class="answer">
                  <h4>\${isCorrect ? '✅ 정답입니다!' : '❌ 틀렸습니다.'}</h4>
                  <p><strong>정답:</strong> \${question.correct + 1}. \${question.options[question.correct]}</p>
                  <p><strong>해설:</strong> \${question.answer}</p>
                </div>
              \`;
              
              document.getElementById('submitBtn').disabled = true;
              document.getElementById('nextBtn').disabled = false;
              updateStats();
            }

            function nextQuestion() {
              if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                selectedAnswer = null;
                document.getElementById('answer-container').innerHTML = '';
                displayQuestion();
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('nextBtn').disabled = true;
              }
            }

            function prevQuestion() {
              if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                selectedAnswer = null;
                document.getElementById('answer-container').innerHTML = '';
                displayQuestion();
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('nextBtn').disabled = true;
              }
            }

            function updateButtons() {
              document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
              document.getElementById('nextBtn').disabled = currentQuestionIndex === questions.length - 1;
            }
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname === '/random' && req.method === 'GET') {
      // 랜덤 연습 페이지 (틀린 문제만 다시 나오는 기능 포함)
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 랜덤 연습</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .question { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .option { margin: 10px 0; padding: 15px; border: 1px solid #eee; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
            .option:hover { background: #f8f9fa; }
            .option.selected { background: #007bff; color: white; }
            .option.correct { background: #28a745; color: white; }
            .option.incorrect { background: #dc3545; color: white; }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; cursor: pointer; border: none; }
            .btn:disabled { background: #6c757d; cursor: not-allowed; }
            .answer { margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 5px; border-left: 4px solid #007bff; }
            .timer { text-align: center; font-size: 18px; margin: 20px 0; }
            .progress { text-align: center; margin: 20px 0; }
            .controls { text-align: center; margin: 20px 0; }
            .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .stats span { margin: 0 15px; font-weight: bold; }
            .correct-count { color: #28a745; }
            .incorrect-count { color: #dc3545; }
            .unanswered-count { color: #6c757d; }
            .mode-switch { text-align: center; margin: 20px 0; }
            .mode-btn { background: #6c757d; }
            .mode-btn.active { background: #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 랜덤 연습</h1>
            <div class="timer" id="timer">시간: 00:00</div>
            <div class="progress" id="progress">문제 1 / 0</div>
            <div class="stats" id="stats">
              <span class="correct-count">정답: 0</span>
              <span class="incorrect-count">오답: 0</span>
              <span class="unanswered-count">미답: 0</span>
            </div>
            <div class="mode-switch">
              <button class="btn mode-btn active" id="allMode" onclick="switchMode('all')">전체 문제</button>
              <button class="btn mode-btn" id="wrongMode" onclick="switchMode('wrong')">틀린 문제만</button>
            </div>
            <div id="question-container">
              <p>문제를 불러오는 중...</p>
            </div>
            <div class="controls">
              <button class="btn" id="prevBtn" onclick="prevQuestion()" disabled>이전</button>
              <button class="btn" id="nextBtn" onclick="nextQuestion()" disabled>다음</button>
              <button class="btn" id="submitBtn" onclick="submitAnswer()" disabled>정답 확인</button>
            </div>
            <div id="answer-container"></div>
            <a href="/" class="btn">메인으로 돌아가기</a>
          </div>
          <script>
            let allQuestions = [];
            let currentQuestions = [];
            let currentQuestionIndex = 0;
            let selectedAnswer = null;
            let startTime = Date.now();
            let timerInterval;
            let answers = {}; // 답안 기록
            let correctCount = 0;
            let incorrectCount = 0;
            let currentMode = 'all';

            function startTimer() {
              timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('timer').textContent = \`시간: \${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
              }, 1000);
            }

            function updateStats() {
              const answeredCount = Object.keys(answers).length;
              const unansweredCount = allQuestions.length - answeredCount;
              document.getElementById('stats').innerHTML = \`
                <span class="correct-count">정답: \${correctCount}</span>
                <span class="incorrect-count">오답: \${incorrectCount}</span>
                <span class="unanswered-count">미답: \${unansweredCount}</span>
              \`;
            }

            function switchMode(mode) {
              currentMode = mode;
              document.getElementById('allMode').classList.toggle('active', mode === 'all');
              document.getElementById('wrongMode').classList.toggle('active', mode === 'wrong');
              
              if (mode === 'all') {
                currentQuestions = [...allQuestions];
              } else {
                // 틀린 문제만 필터링
                currentQuestions = allQuestions.filter((q, index) => {
                  const answer = answers[index];
                  return answer !== undefined && answer !== q.correct;
                });
              }
              
              if (currentQuestions.length === 0) {
                document.getElementById('question-container').innerHTML = '<p>해당하는 문제가 없습니다.</p>';
                return;
              }
              
              currentQuestionIndex = 0;
              selectedAnswer = null;
              document.getElementById('answer-container').innerHTML = '';
              displayQuestion();
              document.getElementById('submitBtn').disabled = true;
              document.getElementById('nextBtn').disabled = true;
            }

            fetch('/api/random-questions')
              .then(response => response.json())
              .then(data => {
                if (data.questions && data.questions.length > 0) {
                  allQuestions = data.questions;
                  currentQuestions = [...allQuestions];
                  displayQuestion();
                  startTimer();
                  updateStats();
                } else {
                  document.getElementById('question-container').innerHTML = '<p>문제를 불러올 수 없습니다.</p>';
                }
              });

            function displayQuestion() {
              if (currentQuestions.length === 0) return;
              
              const question = currentQuestions[currentQuestionIndex];
              const container = document.getElementById('question-container');
              const originalIndex = allQuestions.indexOf(question);
              const previousAnswer = answers[originalIndex];
              
              container.innerHTML = \`
                <div class="question">
                  <h3>문제 \${question.number} (세트\${question.set})</h3>
                  <p>\${question.text}</p>
                  <div class="options">
                    \${question.options.map((option, index) => {
                      let className = 'option';
                      if (previousAnswer !== undefined) {
                        if (index === question.correct) {
                          className += ' correct';
                        } else if (index === previousAnswer && previousAnswer !== question.correct) {
                          className += ' incorrect';
                        }
                      } else if (index === selectedAnswer) {
                        className += ' selected';
                      }
                      return \`<div class="\${className}" onclick="selectOption(\${index})">\${index + 1}. \${option}</div>\`;
                    }).join('')}
                  </div>
                </div>
              \`;
              
              document.getElementById('progress').textContent = \`문제 \${currentQuestionIndex + 1} / \${currentQuestions.length}\`;
              updateButtons();
            }

            function selectOption(index) {
              const question = currentQuestions[currentQuestionIndex];
              const originalIndex = allQuestions.indexOf(question);
              if (answers[originalIndex] !== undefined) return; // 이미 답한 문제는 변경 불가
              
              selectedAnswer = index;
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected');
                if (i === index) opt.classList.add('selected');
              });
              document.getElementById('submitBtn').disabled = false;
            }

            function submitAnswer() {
              if (selectedAnswer === null) return;
              
              const question = currentQuestions[currentQuestionIndex];
              const originalIndex = allQuestions.indexOf(question);
              const isCorrect = selectedAnswer === question.correct;
              
              // 답안 기록
              answers[originalIndex] = selectedAnswer;
              
              // 정답/오답 카운트 업데이트
              if (isCorrect) {
                correctCount++;
              } else {
                incorrectCount++;
              }
              
              // 정답/오답 표시
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected', 'correct', 'incorrect');
                if (i === question.correct) {
                  opt.classList.add('correct');
                } else if (i === selectedAnswer && !isCorrect) {
                  opt.classList.add('incorrect');
                }
              });
              
              // 모범답안 표시
              const answerContainer = document.getElementById('answer-container');
              answerContainer.innerHTML = \`
                <div class="answer">
                  <h4>\${isCorrect ? '✅ 정답입니다!' : '❌ 틀렸습니다.'}</h4>
                  <p><strong>정답:</strong> \${question.correct + 1}. \${question.options[question.correct]}</p>
                  <p><strong>해설:</strong> \${question.answer}</p>
                </div>
              \`;
              
              document.getElementById('submitBtn').disabled = true;
              document.getElementById('nextBtn').disabled = false;
              updateStats();
            }

            function nextQuestion() {
              if (currentQuestionIndex < currentQuestions.length - 1) {
                currentQuestionIndex++;
                selectedAnswer = null;
                document.getElementById('answer-container').innerHTML = '';
                displayQuestion();
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('nextBtn').disabled = true;
              }
            }

            function prevQuestion() {
              if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                selectedAnswer = null;
                document.getElementById('answer-container').innerHTML = '';
                displayQuestion();
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('nextBtn').disabled = true;
              }
            }

            function updateButtons() {
              document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
              document.getElementById('nextBtn').disabled = currentQuestionIndex === currentQuestions.length - 1;
            }
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname === '/exam' && req.method === 'GET') {
      // 시험 모드 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 시험 모드</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .question { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .option { margin: 10px 0; padding: 15px; border: 1px solid #eee; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
            .option:hover { background: #f8f9fa; }
            .option.selected { background: #007bff; color: white; }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; cursor: pointer; border: none; }
            .btn:disabled { background: #6c757d; cursor: not-allowed; }
            .timer { text-align: center; font-size: 24px; margin: 20px 0; font-weight: bold; color: #dc3545; }
            .progress { text-align: center; margin: 20px 0; }
            .controls { text-align: center; margin: 20px 0; }
            .results { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px; }
            .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 시험 모드</h1>
            <div class="warning">
              <strong>⚠️ 시험 모드 안내:</strong><br>
              • 총 100문제 (1과목 10문제, 2과목 20문제, 3과목 25문제, 4과목 30문제, 5과목 15문제)<br>
              • 시간 제한: 120분<br>
              • 모든 문제를 풀고 "시험 제출" 버튼을 눌러주세요
            </div>
            <div class="timer" id="timer">남은 시간: 120:00</div>
            <div class="progress" id="progress">문제 1 / 100</div>
            <div id="question-container">
              <p>문제를 불러오는 중...</p>
            </div>
            <div class="controls">
              <button class="btn" id="prevBtn" onclick="prevQuestion()" disabled>이전</button>
              <button class="btn" id="nextBtn" onclick="nextQuestion()" disabled>다음</button>
              <button class="btn" id="submitBtn" onclick="submitExam()" style="background: #dc3545;">시험 제출</button>
            </div>
            <div id="results-container"></div>
            <a href="/" class="btn">메인으로 돌아가기</a>
          </div>
          <script>
            let questions = [];
            let currentQuestionIndex = 0;
            let answers = {};
            let startTime = Date.now();
            let timerInterval;
            let examSubmitted = false;

            function startTimer() {
              const examDuration = 120 * 60 * 1000; // 120분
              timerInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = examDuration - elapsed;
                
                if (remaining <= 0) {
                  clearInterval(timerInterval);
                  submitExam();
                  return;
                }
                
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                document.getElementById('timer').textContent = \`남은 시간: \${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
                
                if (remaining < 300000) { // 5분 남았을 때
                  document.getElementById('timer').style.color = '#dc3545';
                }
              }, 1000);
            }

            fetch('/api/exam-questions')
              .then(response => response.json())
              .then(data => {
                if (data.questions && data.questions.length > 0) {
                  questions = data.questions;
                  displayQuestion();
                  startTimer();
                } else {
                  document.getElementById('question-container').innerHTML = '<p>문제를 불러올 수 없습니다.</p>';
                }
              });

            function displayQuestion() {
              const question = questions[currentQuestionIndex];
              const container = document.getElementById('question-container');
              const selectedAnswer = answers[currentQuestionIndex];
              
              container.innerHTML = \`
                <div class="question">
                  <h3>문제 \${question.exam_number} (세트\${question.set})</h3>
                  <p>\${question.text}</p>
                  <div class="options">
                    \${question.options.map((option, index) => 
                      \`<div class="option \${selectedAnswer === index ? 'selected' : ''}" onclick="selectOption(\${index})">\${index + 1}. \${option}</div>\`
                    ).join('')}
                  </div>
                </div>
              \`;
              
              document.getElementById('progress').textContent = \`문제 \${currentQuestionIndex + 1} / \${questions.length}\`;
              updateButtons();
            }

            function selectOption(index) {
              answers[currentQuestionIndex] = index;
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected');
                if (i === index) opt.classList.add('selected');
              });
            }

            function nextQuestion() {
              if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                displayQuestion();
              }
            }

            function prevQuestion() {
              if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                displayQuestion();
              }
            }

            function updateButtons() {
              document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
              document.getElementById('nextBtn').disabled = currentQuestionIndex === questions.length - 1;
            }

            function submitExam() {
              if (examSubmitted) return;
              examSubmitted = true;
              clearInterval(timerInterval);
              
              const totalTime = Math.floor((Date.now() - startTime) / 1000);
              const minutes = Math.floor(totalTime / 60);
              const seconds = totalTime % 60;
              
              let correctCount = 0;
              const results = [];
              
              questions.forEach((question, index) => {
                const userAnswer = answers[index];
                const isCorrect = userAnswer === question.correct;
                if (isCorrect) correctCount++;
                
                results.push({
                  question: question.exam_number,
                  userAnswer: userAnswer !== undefined ? userAnswer + 1 : '미답',
                  correctAnswer: question.correct + 1,
                  isCorrect: isCorrect,
                  text: question.text
                });
              });
              
              const accuracy = ((correctCount / questions.length) * 100).toFixed(1);
              const score = Math.round((correctCount / questions.length) * 100);
              
              const resultsContainer = document.getElementById('results-container');
              resultsContainer.innerHTML = \`
                <div class="results">
                  <h2>📊 시험 결과</h2>
                  <p><strong>소요 시간:</strong> \${minutes}분 \${seconds}초</p>
                  <p><strong>정답 수:</strong> \${correctCount} / \${questions.length}</p>
                  <p><strong>정답률:</strong> \${accuracy}%</p>
                  <p><strong>점수:</strong> \${score}점</p>
                  <h3>문제별 결과:</h3>
                  <div style="max-height: 400px; overflow-y: auto;">
                    \${results.map(result => \`
                      <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 3px; \${result.isCorrect ? 'background: #d4edda;' : 'background: #f8d7da;'}">
                        <strong>문제 \${result.question}:</strong> \${result.isCorrect ? '✅' : '❌'} 
                        (답안: \${result.userAnswer}, 정답: \${result.correctAnswer})
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \`;
              
              document.getElementById('submitBtn').disabled = true;
              document.getElementById('timer').textContent = '시험 완료';
            }
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname.startsWith('/set/') && req.method === 'GET') {
      // 세트별 문제 풀이 페이지
      const setNum = pathname.split('/').pop();
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 세트${setNum} 연습</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .question { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .option { margin: 10px 0; padding: 15px; border: 1px solid #eee; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
            .option:hover { background: #f8f9fa; }
            .option.selected { background: #007bff; color: white; }
            .option.correct { background: #28a745; color: white; }
            .option.incorrect { background: #dc3545; color: white; }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; cursor: pointer; border: none; }
            .btn:disabled { background: #6c757d; cursor: not-allowed; }
            .answer { margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 5px; border-left: 4px solid #007bff; }
            .timer { text-align: center; font-size: 18px; margin: 20px 0; }
            .progress { text-align: center; margin: 20px 0; }
            .controls { text-align: center; margin: 20px 0; }
            .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .stats span { margin: 0 15px; font-weight: bold; }
            .correct-count { color: #28a745; }
            .incorrect-count { color: #dc3545; }
            .unanswered-count { color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 세트${setNum} 연습</h1>
            <div class="timer" id="timer">시간: 00:00</div>
            <div class="progress" id="progress">문제 1 / 0</div>
            <div class="stats" id="stats">
              <span class="correct-count">정답: 0</span>
              <span class="incorrect-count">오답: 0</span>
              <span class="unanswered-count">미답: 0</span>
            </div>
            <div id="question-container">
              <p>문제를 불러오는 중...</p>
            </div>
            <div class="controls">
              <button class="btn" id="prevBtn" onclick="prevQuestion()" disabled>이전</button>
              <button class="btn" id="nextBtn" onclick="nextQuestion()" disabled>다음</button>
              <button class="btn" id="submitBtn" onclick="submitAnswer()" disabled>정답 확인</button>
            </div>
            <div id="answer-container"></div>
            <a href="/" class="btn">메인으로 돌아가기</a>
          </div>
          <script>
            let questions = [];
            let currentQuestionIndex = 0;
            let selectedAnswer = null;
            let startTime = Date.now();
            let timerInterval;
            let answers = {}; // 답안 기록
            let correctCount = 0;
            let incorrectCount = 0;

            // 타이머 시작
            function startTimer() {
              timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('timer').textContent = \`시간: \${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
              }, 1000);
            }

            // 통계 업데이트
            function updateStats() {
              const answeredCount = Object.keys(answers).length;
              const unansweredCount = questions.length - answeredCount;
              document.getElementById('stats').innerHTML = \`
                <span class="correct-count">정답: \${correctCount}</span>
                <span class="incorrect-count">오답: \${incorrectCount}</span>
                <span class="unanswered-count">미답: \${unansweredCount}</span>
              \`;
            }

            // 문제 로드
            fetch('/api/set-questions/${setNum}')
              .then(response => response.json())
              .then(data => {
                if (data.questions && data.questions.length > 0) {
                  questions = data.questions;
                  displayQuestion();
                  startTimer();
                  updateStats();
                } else {
                  document.getElementById('question-container').innerHTML = '<p>해당 세트의 문제를 불러올 수 없습니다.</p>';
                }
              });

            function displayQuestion() {
              const question = questions[currentQuestionIndex];
              const container = document.getElementById('question-container');
              const previousAnswer = answers[currentQuestionIndex];
              
              container.innerHTML = \`
                <div class="question">
                  <h3>문제 \${question.number} (세트${question.set})</h3>
                  <p>\${question.text}</p>
                  <div class="options">
                    \${question.options.map((option, index) => {
                      let className = 'option';
                      if (previousAnswer !== undefined) {
                        if (index === question.correct) {
                          className += ' correct';
                        } else if (index === previousAnswer && previousAnswer !== question.correct) {
                          className += ' incorrect';
                        }
                      } else if (index === selectedAnswer) {
                        className += ' selected';
                      }
                      return \`<div class="\${className}" onclick="selectOption(\${index})">\${index + 1}. \${option}</div>\`;
                    }).join('')}
                  </div>
                </div>
              \`;
              
              document.getElementById('progress').textContent = \`문제 \${currentQuestionIndex + 1} / \${questions.length}\`;
              updateButtons();
            }

            function selectOption(index) {
              if (answers[currentQuestionIndex] !== undefined) return; // 이미 답한 문제는 변경 불가
              
              selectedAnswer = index;
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected');
                if (i === index) opt.classList.add('selected');
              });
              document.getElementById('submitBtn').disabled = false;
            }

            function submitAnswer() {
              if (selectedAnswer === null) return;
              
              const question = questions[currentQuestionIndex];
              const isCorrect = selectedAnswer === question.correct;
              
              // 답안 기록
              answers[currentQuestionIndex] = selectedAnswer;
              
              // 정답/오답 카운트 업데이트
              if (isCorrect) {
                correctCount++;
              } else {
                incorrectCount++;
              }
              
              // 정답/오답 표시
              document.querySelectorAll('.option').forEach((opt, i) => {
                opt.classList.remove('selected', 'correct', 'incorrect');
                if (i === question.correct) {
                  opt.classList.add('correct');
                } else if (i === selectedAnswer && !isCorrect) {
                  opt.classList.add('incorrect');
                }
              });
              
              // 모범답안 표시
              const answerContainer = document.getElementById('answer-container');
              answerContainer.innerHTML = \`
                <div class="answer">
                  <h4>\${isCorrect ? '✅ 정답입니다!' : '❌ 틀렸습니다.'}</h4>
                  <p><strong>정답:</strong> \${question.correct + 1}. \${question.options[question.correct]}</p>
                  <p><strong>해설:</strong> \${question.answer}</p>
                </div>
              \`;
              
              document.getElementById('submitBtn').disabled = true;
              document.getElementById('nextBtn').disabled = false;
              updateStats();
            }

            function nextQuestion() {
              if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                selectedAnswer = null;
                document.getElementById('answer-container').innerHTML = '';
                displayQuestion();
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('nextBtn').disabled = true;
              }
            }

            function prevQuestion() {
              if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                selectedAnswer = null;
                document.getElementById('answer-container').innerHTML = '';
                displayQuestion();
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('nextBtn').disabled = true;
              }
            }

            function updateButtons() {
              document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
              document.getElementById('nextBtn').disabled = currentQuestionIndex === questions.length - 1;
            }
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else {
      // 404 페이지
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - 페이지를 찾을 수 없습니다</h1>');
    }
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Internal Server Error</h1>');
  }
}; 