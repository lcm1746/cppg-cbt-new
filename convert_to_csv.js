const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Excel 파일을 CSV로 변환
function convertExcelToCSV() {
  try {
    const excelPath = 'cppg_qa_final.xlsx';
    const csvPath = 'cppg_qa_final.csv';
    
    if (!fs.existsSync(excelPath)) {
      console.log('Excel 파일을 찾을 수 없습니다:', excelPath);
      return;
    }
    
    console.log('Excel 파일 읽는 중...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log('CSV로 변환 중...');
    const csvContent = XLSX.utils.sheet_to_csv(worksheet, { header: 1 });
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log('CSV 파일 생성 완료:', csvPath);
    
  } catch (error) {
    console.error('변환 오류:', error);
  }
}

convertExcelToCSV(); 