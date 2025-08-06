# Google AdSense 설정 가이드

## 📋 AdSense 계정 설정

### 1. AdSense 계정 생성
1. [Google AdSense](https://www.google.com/adsense) 방문
2. Google 계정으로 로그인
3. "시작하기" 클릭
4. 사이트 URL 입력: `https://your-domain.vercel.app`
5. 개인정보 처리방침 및 이용약관 동의
6. 계정 정보 입력 및 제출

### 2. 사이트 승인 대기
- **승인 기간**: 보통 1-2주 소요
- **필요 조건**:
  - 원본 콘텐츠
  - 적절한 트래픽
  - Google 정책 준수
  - 개인정보 처리방침 페이지

### 3. 광고 코드 발급
승인 후 AdSense 대시보드에서 광고 코드를 받을 수 있습니다.

## 🔧 광고 코드 삽입

### 메인 페이지 광고
`api/index.js` 파일의 메인 페이지 부분에서 다음 주석을 찾아 실제 광고 코드로 교체:

```html
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
```

### 연습 페이지 광고
각 연습 페이지에도 동일한 방식으로 광고 코드를 삽입할 수 있습니다.

## 📊 광고 수익 최적화 팁

### 1. 광고 배치 전략
- **메인 페이지**: 상단 배너, 사이드바
- **연습 페이지**: 문제 사이, 하단
- **결과 페이지**: 결과 표시 후

### 2. 사용자 경험 고려
- 학습에 방해되지 않는 위치
- 적절한 광고 크기
- 로딩 속도 최적화

### 3. 콘텐츠 품질
- 정기적인 문제 업데이트
- 사용자 참여도 높이기
- 모바일 최적화

## ⚠️ 주의사항

### AdSense 정책 준수
- **클릭 유도 금지**: "클릭하세요", "광고 클릭" 등의 텍스트 사용 금지
- **광고 위치**: 콘텐츠와 광고 구분 명확히
- **트래픽 품질**: 자연스러운 트래픽만 허용

### 기술적 고려사항
- **Vercel 환경**: 서버리스 환경에서 광고 로딩 최적화
- **모바일 대응**: 반응형 광고 사용
- **성능**: 광고 로딩이 페이지 성능에 미치는 영향 최소화

## 💰 수익 예상

### 수익 요소
- **페이지뷰**: 더 많은 페이지뷰 = 더 많은 광고 노출
- **클릭률**: 관련성 높은 광고로 클릭률 향상
- **CPC**: 키워드에 따른 클릭당 비용 차이

### 예상 수익 (참고)
- **월 1,000 페이지뷰**: $1-5
- **월 10,000 페이지뷰**: $10-50
- **월 100,000 페이지뷰**: $100-500

*실제 수익은 트래픽, 지역, 콘텐츠 품질에 따라 달라집니다.*

## 🚀 추가 수익화 방안

### 1. 프리미엄 기능
- 고급 문제 세트
- 상세한 분석 리포트
- 무제한 연습

### 2. 제휴 마케팅
- 관련 도서 추천
- 온라인 강의 링크
- 학습 도구 추천

### 3. 스폰서십
- 교육 기관과의 협력
- 브랜드 파트너십
- 이벤트 스폰서 