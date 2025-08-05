const fs = require('fs');
const path = require('path');

// 간단한 문제 데이터 (임시)
const sampleQuestions = [
  {
    number: 1,
    text: "개인정보보호법에서 개인정보란?",
    options: [
      "생존하는 개인에 관한 정보",
      "사망한 개인에 관한 정보", 
      "법인에 관한 정보",
      "단체에 관한 정보",
      "기타 정보"
    ],
    correct: 0,
    answer: "생존하는 개인에 관한 정보가 정답입니다.",
    set: 1
  },
  {
    number: 2,
    text: "개인정보처리자는 개인정보를 처리할 때?",
    options: [
      "무조건 수집해야 한다",
      "최소한의 범위에서 수집해야 한다",
      "가능한 많이 수집해야 한다",
      "수집하지 않아도 된다",
      "임의로 수집해도 된다"
    ],
    correct: 1,
    answer: "최소한의 범위에서 수집해야 합니다.",
    set: 1
  }
];

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
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG CBT 시스템</h1>
            <div class="stats">
              <h3>📊 문제 통계</h3>
              <p><strong>총 문제수:</strong> ${sampleQuestions.length}개</p>
              <p><strong>세트1:</strong> ${sampleQuestions.filter(q => q.set === 1).length}개</p>
              <p><strong>세트2:</strong> ${sampleQuestions.filter(q => q.set === 2).length}개</p>
            </div>
            <div style="text-align: center;">
              <a href="/practice" class="btn">📚 순차 연습</a>
              <a href="/random" class="btn">🎲 랜덤 연습</a>
              <a href="/exam" class="btn">📝 시험 모드</a>
            </div>
          </div>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname === '/api/questions' && req.method === 'GET') {
      // 문제 목록 API
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ questions: sampleQuestions }));
    }
    else if (pathname === '/api/exam-questions' && req.method === 'GET') {
      // 시험 문제 API
      const examQuestions = sampleQuestions.map((q, index) => ({
        ...q,
        exam_number: index + 1
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ questions: examQuestions }));
    }
    else if (pathname === '/practice' && req.method === 'GET') {
      // 연습 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 연습 모드</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .question { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .option { margin: 10px 0; padding: 10px; border: 1px solid #eee; border-radius: 3px; cursor: pointer; }
            .option:hover { background: #f8f9fa; }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 연습 모드</h1>
            <div id="question-container">
              <p>문제를 불러오는 중...</p>
            </div>
            <a href="/" class="btn">메인으로 돌아가기</a>
          </div>
          <script>
            fetch('/api/questions')
              .then(response => response.json())
              .then(data => {
                const container = document.getElementById('question-container');
                if (data.questions && data.questions.length > 0) {
                  const question = data.questions[0];
                  container.innerHTML = \`
                    <div class="question">
                      <h3>문제 \${question.number}</h3>
                      <p>\${question.text}</p>
                      <div class="options">
                        \${question.options.map((option, index) => 
                          \`<div class="option" onclick="selectOption(\${index})">\${index + 1}. \${option}</div>\`
                        ).join('')}
                      </div>
                    </div>
                  \`;
                }
              });
            
            function selectOption(index) {
              alert('선택된 답안: ' + (index + 1));
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