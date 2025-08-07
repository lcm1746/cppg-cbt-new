from flask import Flask, request, jsonify
import random

app = Flask(__name__)

# 점심 메뉴 리스트
LUNCH_MENUS = [
    # 한식
    "김치찌개", "된장찌개", "비빔밥", "불고기", "삼겹살", "닭볶음탕", "갈비찜", "순두부찌개",
    "김치볶음밥", "제육볶음", "닭갈비", "돼지갈비", "소불고기", "닭볶음탕", "갈비찜",
    
    # 분식/패스트푸드
    "치킨", "피자", "햄버거", "라면", "국수", "샌드위치", "샐러드", "토스트",
    
    # 일식
    "초밥", "회", "우동", "라멘", "돈까스", "오니기리", "가라아게", "덮밥",
    
    # 중식
    "탕수육", "짜장면", "짬뽕", "마라탕", "훠궈", "깐풍기", "양장피", "마파두부",
    
    # 양식
    "파스타", "스테이크", "카레", "리조또", "오믈렛", "샌드위치", "피자", "스테이크",
    
    # 기타
    "떡볶이", "순대", "어묵", "김밥", "라면", "국수", "덮밥", "돈까스"
]

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        data = request.json
        user_message = data['userRequest']['utterance']
        
        # 점심 메뉴 추천 키워드
        lunch_keywords = ["점심", "메뉴", "뭐먹", "밥", "식사", "추천"]
        
        if any(keyword in user_message for keyword in lunch_keywords):
            selected = random.choice(LUNCH_MENUS)
            
            # 추천 이유 생성
            reasons = [
                "맛있을 것 같아요! 😋",
                "오늘 기분에 딱 맞을 것 같아요! 🎯",
                "건강에도 좋을 것 같아요! 💪",
                "가성비가 좋을 것 같아요! 💰",
                "오늘 날씨에 딱 맞는 메뉴예요! 🌤️",
                "새로운 맛을 경험해보세요! ✨"
            ]
            reason = random.choice(reasons)
            
            response = f"🍽️ 오늘 점심은 '{selected}' 어떠세요?\n\n추천 이유: {reason}"
        else:
            response = """안녕하세요! 점심 메뉴를 추천해드릴게요. 🍜

다음 중 하나를 말씀해주세요:
• 점심
• 메뉴
• 뭐먹
• 밥
• 식사
• 추천

그러면 맛있는 점심 메뉴를 랜덤으로 추천해드릴게요! 😊"""
        
        return jsonify({
            "version": "2.0",
            "template": {
                "outputs": [{"simpleText": {"text": response}}]
            }
        })
        
    except Exception as e:
        return jsonify({
            "version": "2.0",
            "template": {
                "outputs": [{"simpleText": {"text": "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요."}}]
            }
        })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "점심 봇이 정상 동작 중입니다!"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 