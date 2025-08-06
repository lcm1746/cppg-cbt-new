const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 전역 변수로 문제 저장
let questionsBySet = null;
let stats = null;

// 파일 기반 사용자 저장소 (영구 저장)
const USERS_FILE = path.join(__dirname, '..', 'users.json');
let usersData = { users: {} };

// 사용자 데이터 로드 (파일에서)
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      usersData = JSON.parse(data);
      return usersData;
    }
  } catch (error) {
    console.error('사용자 데이터 로드 오류:', error);
  }
  return usersData;
}

// 사용자 데이터 저장 (파일에)
function saveUsers(data) {
  try {
    usersData = data;
    // 파일에도 저장 시도
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('사용자 데이터 저장 오류:', error);
    // 파일 저장 실패해도 메모리에는 저장
    return true;
  }
}

// 초기 사용자 데이터 로드
loadUsers();

// 테스트용 사용자 미리 생성 (파일에 저장)
if (!usersData.users['test']) {
  usersData.users['test'] = {
    password: 'test123',
    createdAt: new Date().toISOString(),
    stats: {
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalStudyTime: 0,
      lastPracticeDate: null,
      practiceHistory: [],
      wrongQuestions: [],
      lastSequentialPosition: 0
    }
  };
  saveUsers(usersData);
}

// 사용자 생성
function createUser(username, password) {
  const usersData = loadUsers();
  
  if (usersData.users[username]) {
    return { success: false, message: '이미 존재하는 사용자명입니다.' };
  }
  
  usersData.users[username] = {
    password: password,
    createdAt: new Date().toISOString(),
    stats: {
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalStudyTime: 0, // 초 단위
      lastPracticeDate: null,
      practiceHistory: [],
      wrongQuestions: [], // 틀린 문제 기록
      lastSequentialPosition: 0 // 순차 연습에서 마지막 위치
    }
  };
  
  if (saveUsers(usersData)) {
    return { success: true, message: '회원가입이 완료되었습니다.' };
  } else {
    return { success: false, message: '회원가입 중 오류가 발생했습니다.' };
  }
}

// 사용자 인증
function authenticateUser(username, password) {
  const usersData = loadUsers();
  const user = usersData.users[username];
  
  if (!user) {
    return { success: false, message: '존재하지 않는 사용자명입니다.' };
  }
  
  if (user.password !== password) {
    return { success: false, message: '비밀번호가 일치하지 않습니다.' };
  }
  
  return { success: true, user: { username, stats: user.stats } };
}

// 사용자 통계 업데이트
function updateUserStats(username, questionData) {
  const usersData = loadUsers();
  const user = usersData.users[username];
  
  if (!user) return false;
  
  const { isCorrect, questionNumber, setNumber, studyTime } = questionData;
  
  // 기본 통계 업데이트
  user.stats.totalQuestions++;
  if (isCorrect) {
    user.stats.correctAnswers++;
  } else {
    user.stats.incorrectAnswers++;
    // 틀린 문제 기록
    user.stats.wrongQuestions.push({
      questionNumber,
      setNumber,
      timestamp: new Date().toISOString()
    });
  }
  
  // 공부 시간 추가
  user.stats.totalStudyTime += studyTime || 0;
  user.stats.lastPracticeDate = new Date().toISOString();
  
  // 연습 기록 추가
  user.stats.practiceHistory.push({
    questionNumber,
    setNumber,
    isCorrect,
    timestamp: new Date().toISOString(),
    studyTime: studyTime || 0
  });
  
  return saveUsers(usersData);
}

// 순차 연습 위치 업데이트
function updateSequentialPosition(username, position) {
  const usersData = loadUsers();
  const user = usersData.users[username];
  
  if (!user) return false;
  
  user.stats.lastSequentialPosition = position;
  return saveUsers(usersData);
}

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
  console.log('문제 로드 시작...');
  const result = loadQuestionsFromExcel();
  if (result && result.questionsBySet && Object.keys(result.questionsBySet).length > 0) {
    questionsBySet = result.questionsBySet;
    stats = result.stats;
    console.log('문제 로드 완료:', Object.keys(questionsBySet).length, '개 세트');
    console.log('통계:', stats);
  } else {
    console.log('문제 로드 실패! 재시도 중...');
    // 재시도 로직
    setTimeout(() => {
      const retryResult = loadQuestionsFromExcel();
      if (retryResult && retryResult.questionsBySet && Object.keys(retryResult.questionsBySet).length > 0) {
        questionsBySet = retryResult.questionsBySet;
        stats = retryResult.stats;
        console.log('재시도 성공 - 문제 로드 완료:', Object.keys(questionsBySet).length, '개 세트');
      } else {
        console.log('재시도도 실패했습니다.');
      }
    }, 1000);
  }
}

module.exports = (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    console.log(`요청 경로: ${pathname}`);

    if (pathname === '/' && req.method === 'GET') {
      // 로그인 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG CBT 시스템 - 로그인</title>
          <meta charset="utf-8">
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .login-container { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #333; margin: 0; font-size: 28px; }
            .form-group { margin-bottom: 20px; }
            .form-group label { display: block; margin-bottom: 8px; color: #555; font-weight: bold; }
            .form-group input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
            .form-group input:focus { outline: none; border-color: #667eea; }
            .btn { width: 100%; padding: 15px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 10px; transition: background 0.3s; }
            .btn:hover { background: #5a6fd8; }
            .btn-secondary { background: #6c757d; }
            .btn-secondary:hover { background: #5a6268; }
            .toggle-form { text-align: center; margin-top: 20px; }
            .toggle-form a { color: #667eea; text-decoration: none; font-weight: bold; }
            .toggle-form a:hover { text-decoration: underline; }
            .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; margin-bottom: 20px; display: none; }
            .success { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin-bottom: 20px; display: none; }
            .form { display: none; }
            .form.active { display: block; }
          </style>
        </head>
        <body>
          <div class="login-container">
            <div class="logo">
              <h1>📚 CPPG CBT</h1>
              <p>개인정보보호 전문가 자격증 연습 시스템</p>
            </div>
            
            <div id="error" class="error"></div>
            <div id="success" class="success"></div>
            
            <!-- 로그인 폼 -->
            <form id="loginForm" class="form active">
              <div class="form-group">
                <label for="loginUsername">사용자명</label>
                <input type="text" id="loginUsername" required>
              </div>
              <div class="form-group">
                <label for="loginPassword">비밀번호</label>
                <input type="password" id="loginPassword" required>
              </div>
              <button type="submit" class="btn">로그인</button>
              <div class="toggle-form">
                <a href="#" onclick="toggleForm('register')">회원가입하기</a>
              </div>
            </form>
            
            <!-- 회원가입 폼 -->
            <form id="registerForm" class="form">
              <div class="form-group">
                <label for="registerUsername">사용자명</label>
                <input type="text" id="registerUsername" required>
              </div>
              <div class="form-group">
                <label for="registerPassword">비밀번호</label>
                <input type="password" id="registerPassword" required>
              </div>
              <div class="form-group">
                <label for="confirmPassword">비밀번호 확인</label>
                <input type="password" id="confirmPassword" required>
              </div>
              <button type="submit" class="btn">회원가입</button>
              <div class="toggle-form">
                <a href="#" onclick="toggleForm('login')">로그인하기</a>
              </div>
            </form>
          </div>
          
          <script>
            function showMessage(type, message) {
              const errorDiv = document.getElementById('error');
              const successDiv = document.getElementById('success');
              
              errorDiv.style.display = 'none';
              successDiv.style.display = 'none';
              
              if (type === 'error') {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
              } else {
                successDiv.textContent = message;
                successDiv.style.display = 'block';
              }
            }
            
            function toggleForm(type) {
              const loginForm = document.getElementById('loginForm');
              const registerForm = document.getElementById('registerForm');
              
              if (type === 'register') {
                loginForm.classList.remove('active');
                registerForm.classList.add('active');
              } else {
                registerForm.classList.remove('active');
                loginForm.classList.add('active');
              }
              
              // 메시지 숨기기
              document.getElementById('error').style.display = 'none';
              document.getElementById('success').style.display = 'none';
            }
            
            // 로그인 폼 제출
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const username = document.getElementById('loginUsername').value;
              const password = document.getElementById('loginPassword').value;
              
              try {
                const response = await fetch('/api/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                  // 로그인 성공 시 메인 페이지로 이동
                  localStorage.setItem('username', username);
                  window.location.href = '/main';
                } else {
                  showMessage('error', data.message);
                }
              } catch (error) {
                showMessage('error', '로그인 중 오류가 발생했습니다.');
              }
            });
            
            // 회원가입 폼 제출
            document.getElementById('registerForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const username = document.getElementById('registerUsername').value;
              const password = document.getElementById('registerPassword').value;
              const confirmPassword = document.getElementById('confirmPassword').value;
              
              if (password !== confirmPassword) {
                showMessage('error', '비밀번호가 일치하지 않습니다.');
                return;
              }
              
              try {
                const response = await fetch('/api/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                  showMessage('success', data.message);
                  // 2초 후 로그인 폼으로 전환
                  setTimeout(() => toggleForm('login'), 2000);
                } else {
                  showMessage('error', data.message);
                }
              } catch (error) {
                showMessage('error', '회원가입 중 오류가 발생했습니다.');
              }
            });
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname === '/api/login' && req.method === 'POST') {
      // 로그인 API
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          console.log('로그인 요청 받음:', body);
          const { username, password } = JSON.parse(body);
          
          if (!username || !password) {
            console.log('사용자명 또는 비밀번호 누락');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '사용자명과 비밀번호를 모두 입력해주세요.' }));
            return;
          }
          
          console.log('로그인 시도:', username);
          const result = authenticateUser(username, password);
          console.log('로그인 결과:', result.success ? '성공' : '실패');
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('로그인 오류:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '로그인 중 오류가 발생했습니다: ' + error.message }));
        }
      });
    }
    else if (pathname === '/api/register' && req.method === 'POST') {
      // 회원가입 API
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          console.log('회원가입 요청 받음:', body);
          const { username, password } = JSON.parse(body);
          
          if (!username || !password) {
            console.log('사용자명 또는 비밀번호 누락');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '사용자명과 비밀번호를 모두 입력해주세요.' }));
            return;
          }
          
          if (username.length < 3) {
            console.log('사용자명이 너무 짧음');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '사용자명은 3자 이상이어야 합니다.' }));
            return;
          }
          
          if (password.length < 4) {
            console.log('비밀번호가 너무 짧음');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '비밀번호는 4자 이상이어야 합니다.' }));
            return;
          }
          
          console.log('회원가입 시도:', username);
          const result = createUser(username, password);
          console.log('회원가입 결과:', result);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('회원가입 오류:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '회원가입 중 오류가 발생했습니다: ' + error.message }));
        }
      });
    }
    else if (pathname === '/main' && req.method === 'GET') {
      // 메인 페이지 (로그인 후)
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG CBT 시스템</title>
          <meta charset="utf-8">
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
            .user-info { text-align: right; }
            .user-info h3 { margin: 0; color: #333; }
            .logout-btn { background: #dc3545; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px; }
            .btn { display: inline-block; padding: 15px 30px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; font-weight: bold; transition: background 0.3s; }
            .btn:hover { background: #0056b3; }
            .stats { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
            h1 { color: #333; text-align: center; margin: 0; }
            .stats h3 { color: #007bff; margin-top: 0; }
            .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .user-stats { background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745; }
            .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
            .stat-item { background: white; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
            .stat-label { color: #666; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>CPPG CBT 시스템</h1>
              <div class="user-info">
                <h3 id="username">사용자</h3>
                <button class="logout-btn" onclick="logout()">로그아웃</button>
              </div>
            </div>
            
            <div style="text-align: center; margin-bottom: 20px;">
              <a href="/privacy" style="color: #666; text-decoration: none; font-size: 14px;">개인정보 처리방침</a>
            </div>
            
            <div id="userStats" class="user-stats">
              <h3>📊 내 학습 통계</h3>
              <div class="stat-grid">
                <div class="stat-item">
                  <div class="stat-number" id="totalQuestions">0</div>
                  <div class="stat-label">총 문제 수</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number" id="correctAnswers">0</div>
                  <div class="stat-label">정답 수</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number" id="accuracy">0%</div>
                  <div class="stat-label">정답률</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number" id="studyTime">0분</div>
                  <div class="stat-label">총 공부시간</div>
                </div>
              </div>
            </div>
            
            <!-- Google AdSense 광고 영역 -->
            <div class="ad-container" style="text-align: center; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 5px;">
              <div class="ad-placeholder" style="min-height: 90px; display: flex; align-items: center; justify-content: center; color: #666; border: 2px dashed #ddd;">
                <p>📢 Google AdSense 광고가 여기에 표시됩니다</p>
              </div>
              <!-- AdSense 코드를 여기에 삽입하세요 -->
              <!-- 
              <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_PUBLISHER_ID"
                   crossorigin="anonymous"></script>
              <ins class="adsbygoogle"
                   style="display:block"
                   data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
                   data-ad-slot="YOUR_AD_SLOT"
                   data-ad-format="auto"
                   data-full-width-responsive="true"></ins>
              <script>
                   (adsbygoogle = window.adsbygoogle || []).push({});
              </script>
              -->
            </div>
            
            ${!stats ? '<div class="error">⚠️ 문제 파일을 로드할 수 없습니다.</div>' : `
              <div class="stats">
                <h3>📚 문제 통계</h3>
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
                <a href="/wrong-only" class="btn">❌ 오답만 연습</a>
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
          
          <script>
            // 사용자 정보 로드
            const username = localStorage.getItem('username');
            if (!username) {
              window.location.href = '/';
            }
            
            document.getElementById('username').textContent = username;
            
            // 사용자 통계 로드
            async function loadUserStats() {
              try {
                const response = await fetch('/api/user-stats', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                if (data.success) {
                  const stats = data.stats;
                  document.getElementById('totalQuestions').textContent = stats.totalQuestions;
                  document.getElementById('correctAnswers').textContent = stats.correctAnswers;
                  document.getElementById('accuracy').textContent = stats.totalQuestions > 0 ? 
                    Math.round((stats.correctAnswers / stats.totalQuestions) * 100) + '%' : '0%';
                  document.getElementById('studyTime').textContent = Math.floor(stats.totalStudyTime / 60) + '분';
                }
              } catch (error) {
                console.error('통계 로드 오류:', error);
              }
            }
            
            function logout() {
              localStorage.removeItem('username');
              window.location.href = '/';
            }
            
            // 페이지 로드 시 통계 로드
            loadUserStats();
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
    else if (pathname === '/api/questions' && req.method === 'GET') {
      // 순차 문제 API
      console.log('순차 문제 API 호출됨');
      console.log('questionsBySet 상태:', questionsBySet ? '로드됨' : '로드되지 않음');
      
      if (!questionsBySet || Object.keys(questionsBySet).length === 0) {
        console.log('문제가 로드되지 않았습니다. 재시도 중...');
        // 재시도 로직
        const retryResult = loadQuestionsFromExcel();
        if (retryResult && retryResult.questionsBySet && Object.keys(retryResult.questionsBySet).length > 0) {
          questionsBySet = retryResult.questionsBySet;
          stats = retryResult.stats;
          console.log('재시도 성공 - 문제 로드 완료');
        } else {
          console.log('재시도도 실패했습니다.');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '문제를 로드할 수 없습니다. 서버를 재시작해주세요.' }));
          return;
        }
      }

      const allQuestions = [];
      for (const [setNum, questions] of Object.entries(questionsBySet)) {
        console.log(`세트 ${setNum}: ${questions.length}개 문제`);
        questions.forEach(question => {
          allQuestions.push({
            ...question,
            set: parseInt(setNum)
          });
        });
      }

      console.log(`총 ${allQuestions.length}개 문제 반환`);
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
      
      // 세트 번호 유효성 검사
      if (isNaN(setNum)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '잘못된 세트 번호입니다.' }));
        return;
      }
      
      const setQuestions = questionsBySet[setNum] || [];
      
      console.log(`세트 ${setNum} 문제 요청: ${setQuestions.length}개 문제`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        questions: setQuestions.map(q => ({ ...q, set: setNum })),
        setNumber: setNum,
        questionCount: setQuestions.length
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
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
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
            .resume-notice { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 순차 연습</h1>
            <div id="resumeNotice" class="resume-notice" style="display: none;">
              <strong>📖 이어서 연습하기:</strong> 마지막으로 풀었던 문제부터 시작합니다.
              <button class="btn" onclick="startFromBeginning()" style="margin-left: 10px;">처음부터 시작</button>
            </div>
            <div class="timer" id="timer">시간: 00:00</div>
            <div class="progress" id="progress">문제 1 / 0</div>
            <div class="stats" id="stats">
              <span class="correct-count">정답: 0</span>
              <span class="incorrect-count">오답: 0</span>
              <span class="unanswered-count">미답: 0</span>
            </div>
            
            <div class="controls">
              <button class="btn" id="prevBtn" onclick="prevQuestion()" disabled>이전</button>
              <button class="btn" id="nextBtn" onclick="nextQuestion()" disabled>다음</button>
              <button class="btn" id="submitBtn" onclick="submitAnswer()" disabled>정답 확인</button>
            </div>
            
            <!-- 문제 컨테이너 -->
            <div id="question-container"></div>
            
            <!-- Google AdSense 광고 영역 -->
            <div class="ad-container" style="text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
              <div class="ad-placeholder" style="min-height: 60px; display: flex; align-items: center; justify-content: center; color: #666; border: 2px dashed #ddd; font-size: 12px;">
                <p>📢 광고 영역</p>
              </div>
            </div>
            
            <div id="answer-container"></div>
            <a href="/main" class="btn">메인으로 돌아가기</a>
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
            const username = localStorage.getItem('username');

            if (!username) {
              window.location.href = '/';
            }

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

            // 사용자 통계에서 마지막 위치 가져오기
            async function getLastPosition() {
              try {
                const response = await fetch('/api/user-stats', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                if (data.success) {
                  return data.stats.lastSequentialPosition || 0;
                }
              } catch (error) {
                console.error('마지막 위치 로드 오류:', error);
              }
              return 0;
            }

            // 문제 로드
            async function loadQuestions() {
              try {
                console.log('문제 로드 시작...');
                const response = await fetch('/api/questions');
                const data = await response.json();
                
                console.log('API 응답:', data);
                
                if (data.questions && data.questions.length > 0) {
                  questions = data.questions;
                  console.log(questions.length + '개 문제 로드 완료');
                  
                  // 마지막 위치 확인
                  const lastPosition = await getLastPosition();
                  if (lastPosition > 0 && lastPosition < questions.length) {
                    currentQuestionIndex = lastPosition;
                    document.getElementById('resumeNotice').style.display = 'block';
                  }
                  
                  displayQuestion();
                  startTimer();
                  updateStats();
                } else {
                  console.error('문제가 없습니다:', data);
                  document.getElementById('question-container').innerHTML = '<p style="color: red; text-align: center; padding: 20px;">문제를 불러올 수 없습니다. 서버를 확인해주세요.</p>';
                }
              } catch (error) {
                console.error('문제 로드 오류:', error);
                document.getElementById('question-container').innerHTML = '<p style="color: red; text-align: center; padding: 20px;">문제를 불러오는 중 오류가 발생했습니다: ' + error.message + '</p>';
              }
            }

            function startFromBeginning() {
              currentQuestionIndex = 0;
              document.getElementById('resumeNotice').style.display = 'none';
              displayQuestion();
            }

            // 페이지 로드 시 문제 로드
            loadQuestions();

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
              
              // 사용자 통계 업데이트
              const studyTime = Math.floor((Date.now() - startTime) / 1000);
              fetch('/api/update-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username,
                  questionData: {
                    isCorrect,
                    questionNumber: question.number,
                    setNumber: question.set,
                    studyTime
                  }
                })
              });
              
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
                
                // 현재 위치 저장
                fetch('/api/update-sequential-position', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username,
                    position: currentQuestionIndex
                  })
                });
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
                
                // 현재 위치 저장
                fetch('/api/update-sequential-position', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username,
                    position: currentQuestionIndex
                  })
                });
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
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
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
            <a href="/main" class="btn">메인으로 돌아가기</a>
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
            const username = localStorage.getItem('username');

            if (!username) {
              window.location.href = '/';
            }

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
              
              // 사용자 통계 업데이트
              const studyTime = Math.floor((Date.now() - startTime) / 1000);
              fetch('/api/update-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username,
                  questionData: {
                    isCorrect,
                    questionNumber: question.number,
                    setNumber: question.set,
                    studyTime
                  }
                })
              });
              
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
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
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
            <a href="/main" class="btn">메인으로 돌아가기</a>
          </div>
          <script>
            let questions = [];
            let currentQuestionIndex = 0;
            let answers = {};
            let startTime = Date.now();
            let timerInterval;
            let examSubmitted = false;
            const username = localStorage.getItem('username');

            if (!username) {
              window.location.href = '/';
            }

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
                
                // 시험 결과를 사용자 통계에 반영
                if (userAnswer !== undefined) {
                  fetch('/api/update-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      username,
                      questionData: {
                        isCorrect,
                        questionNumber: question.number,
                        setNumber: question.set,
                        studyTime: Math.floor(totalTime / questions.length)
                      }
                    })
                  });
                }
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
      
      // 세트 번호 유효성 검사
      if (!setNum || isNaN(parseInt(setNum))) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>잘못된 세트 번호입니다.</h1>');
        return;
      }
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 세트${setNum} 연습</title>
          <meta charset="utf-8">
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
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
            .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
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
            
            <!-- 문제 컨테이너 -->
            <div id="question-container"></div>
            
            <!-- Google AdSense 광고 영역 -->
            <div class="ad-container" style="text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
              <div class="ad-placeholder" style="min-height: 60px; display: flex; align-items: center; justify-content: center; color: #666; border: 2px dashed #ddd; font-size: 12px;">
                <p>📢 광고 영역</p>
              </div>
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
              .then(response => {
                if (!response.ok) {
                  throw new Error('Network response was not ok');
                }
                return response.json();
              })
              .then(data => {
                if (data.error) {
                  document.getElementById('question-container').innerHTML = \`
                    <div class="error">
                      <h3>오류 발생</h3>
                      <p>\${data.error}</p>
                    </div>
                  \`;
                  return;
                }
                if (data.questions && data.questions.length > 0) {
                  questions = data.questions;
                  displayQuestion();
                  startTimer();
                  updateStats();
                } else {
                  document.getElementById('question-container').innerHTML = \`
                    <div class="error">
                      <h3>문제 없음</h3>
                      <p>세트${setNum}에는 문제가 없습니다.</p>
                    </div>
                  \`;
                }
              })
              .catch(error => {
                console.error('Error:', error);
                document.getElementById('question-container').innerHTML = \`
                  <div class="error">
                    <h3>문제 로드 실패</h3>
                    <p>문제를 불러오는 중 오류가 발생했습니다.</p>
                    <p>오류: \${error.message}</p>
                  </div>
                \`;
              });

            function displayQuestion() {
              if (questions.length === 0) return;
              
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
              
              // 사용자 통계 업데이트
              const studyTime = Math.floor((Date.now() - startTime) / 1000);
              fetch('/api/update-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username,
                  questionData: {
                    isCorrect,
                    questionNumber: question.number,
                    setNumber: question.set,
                    studyTime
                  }
                })
              });
              
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
    } else if (pathname === '/api/user-stats' && req.method === 'POST') {
      // 사용자 통계 API
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { username } = JSON.parse(body);
          const usersData = loadUsers();
          const user = usersData.users[username];
          
          if (!user) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '사용자를 찾을 수 없습니다.' }));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, stats: user.stats }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '잘못된 요청입니다.' }));
        }
      });
    } else if (pathname === '/api/update-stats' && req.method === 'POST') {
      // 사용자 통계 업데이트 API
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { username, questionData } = JSON.parse(body);
          const success = updateUserStats(username, questionData);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '잘못된 요청입니다.' }));
        }
      });
    } else if (pathname === '/api/update-sequential-position' && req.method === 'POST') {
      // 순차 연습 위치 업데이트 API
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { username, position } = JSON.parse(body);
          const success = updateSequentialPosition(username, position);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '잘못된 요청입니다.' }));
        }
      });
    } else if (pathname === '/api/wrong-questions' && req.method === 'POST') {
      // 오답 문제 API
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { username } = JSON.parse(body);
          const usersData = loadUsers();
          const user = usersData.users[username];
          
          if (!user) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '사용자를 찾을 수 없습니다.' }));
            return;
          }
          
          // 오답 문제들을 실제 문제 데이터와 매칭
          const wrongQuestions = [];
          const wrongQuestionNumbers = user.stats.wrongQuestions.map(wq => wq.questionNumber);
          
          for (const [setNum, questions] of Object.entries(questionsBySet)) {
            questions.forEach(question => {
              if (wrongQuestionNumbers.includes(question.number)) {
                wrongQuestions.push({
                  ...question,
                  set: parseInt(setNum)
                });
              }
            });
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, questions: wrongQuestions }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '잘못된 요청입니다.' }));
        }
      });
    } else if (pathname === '/wrong-only' && req.method === 'GET') {
      // 오답만 연습 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>CPPG 오답 연습</title>
          <meta charset="utf-8">
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
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
            .no-questions { text-align: center; padding: 40px; color: #666; }
            .no-questions h2 { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>CPPG 오답 연습</h1>
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
            <a href="/main" class="btn">메인으로 돌아가기</a>
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
            const username = localStorage.getItem('username');

            if (!username) {
              window.location.href = '/';
            }

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

            // 오답 문제 로드
            fetch('/api/wrong-questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success && data.questions && data.questions.length > 0) {
                questions = data.questions;
                displayQuestion();
                startTimer();
                updateStats();
              } else {
                document.getElementById('question-container').innerHTML = \`
                  <div class="no-questions">
                    <h2>🎉 축하합니다!</h2>
                    <p>현재 틀린 문제가 없습니다.</p>
                    <p>다른 연습 모드를 이용해보세요.</p>
                  </div>
                \`;
              }
            });

            function displayQuestion() {
              if (questions.length === 0) return;
              
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
              
              // 사용자 통계 업데이트
              const studyTime = Math.floor((Date.now() - startTime) / 1000);
              fetch('/api/update-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username,
                  questionData: {
                    isCorrect,
                    questionNumber: question.number,
                    setNumber: question.set,
                    studyTime
                  }
                })
              });
              
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
    } else if (pathname === '/privacy' && req.method === 'GET') {
      // 개인정보 처리방침 페이지
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>개인정보 처리방침 - CPPG CBT 시스템</title>
          <meta charset="utf-8">
          <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5758443984574800" crossorigin="anonymous"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
                   background: #007bff; color: white; text-decoration: none; 
                   border-radius: 5px; font-weight: bold; transition: background 0.3s; }
            .btn:hover { background: #0056b3; }
            h1 { color: #333; text-align: center; }
            h2 { color: #007bff; margin-top: 30px; }
            p { line-height: 1.6; color: #555; }
            .contact { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>개인정보 처리방침</h1>
            <p><strong>최종 업데이트:</strong> 2024년 12월 19일</p>
            
            <h2>1. 수집하는 개인정보</h2>
            <p>CPPG CBT 시스템은 다음과 같은 개인정보를 수집합니다:</p>
            <ul>
              <li><strong>계정 정보:</strong> 사용자명, 비밀번호 (암호화 저장)</li>
              <li><strong>학습 데이터:</strong> 문제 풀이 기록, 정답/오답 통계, 공부시간</li>
              <li><strong>기술적 정보:</strong> IP 주소, 브라우저 정보, 접속 시간</li>
            </ul>
            
            <h2>2. 개인정보 수집 목적</h2>
            <p>수집된 개인정보는 다음 목적으로 사용됩니다:</p>
            <ul>
              <li>사용자 계정 관리 및 인증</li>
              <li>학습 진도 추적 및 통계 제공</li>
              <li>서비스 개선 및 사용자 경험 향상</li>
              <li>고객 지원 및 문의 응답</li>
            </ul>
            
            <h2>3. 개인정보 보관 기간</h2>
            <p>개인정보는 서비스 이용 기간 동안 보관되며, 계정 삭제 시 즉시 삭제됩니다.</p>
            
            <h2>4. 개인정보 공유</h2>
            <p>당사는 다음과 같은 경우를 제외하고 개인정보를 제3자와 공유하지 않습니다:</p>
            <ul>
              <li>사용자의 명시적 동의가 있는 경우</li>
              <li>법령에 의해 요구되는 경우</li>
              <li>서비스 제공을 위해 필요한 최소한의 정보만 공유</li>
            </ul>
            
            <h2>5. 쿠키 및 추적 기술</h2>
            <p>본 서비스는 다음과 같은 기술을 사용합니다:</p>
            <ul>
              <li><strong>세션 쿠키:</strong> 로그인 상태 유지</li>
              <li><strong>로컬 스토리지:</strong> 사용자 설정 및 학습 데이터 임시 저장</li>
              <li><strong>Google Analytics:</strong> 서비스 사용 통계 분석 (선택적)</li>
            </ul>
            
            <h2>6. 광고 서비스</h2>
            <p>본 서비스는 Google AdSense를 통해 광고를 제공할 수 있습니다. Google은 쿠키를 사용하여 사용자에게 맞춤형 광고를 제공할 수 있습니다.</p>
            
            <h2>7. 사용자 권리</h2>
            <p>사용자는 다음과 같은 권리를 가집니다:</p>
            <ul>
              <li>개인정보 조회 및 수정</li>
              <li>개인정보 삭제 요청</li>
              <li>개인정보 처리 중단 요청</li>
              <li>개인정보 이전 요청</li>
            </ul>
            
            <h2>8. 보안 조치</h2>
            <p>개인정보 보호를 위해 다음과 같은 보안 조치를 취하고 있습니다:</p>
            <ul>
              <li>비밀번호 암호화 저장</li>
              <li>HTTPS 통신 암호화</li>
              <li>정기적인 보안 점검</li>
              <li>접근 권한 관리</li>
            </ul>
            
            <div class="contact">
              <h2>9. 문의처</h2>
              <p>개인정보 처리방침에 관한 문의사항이 있으시면 다음으로 연락주세요:</p>
              <p><strong>이메일:</strong> privacy@cppg-cbt.com</p>
              <p><strong>처리기간:</strong> 문의 접수 후 14일 이내</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="/main" class="btn">메인으로 돌아가기</a>
            </div>
          </div>
        </body>
        </html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      // 404 페이지
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - 페이지를 찾을 수 없습니다</h1>');
    }
  } catch (error) {
    console.error('서버 오류:', error);
    console.error('오류 스택:', error.stack);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Internal Server Error</h1><p>서버에서 오류가 발생했습니다.</p>');
  }
}; 