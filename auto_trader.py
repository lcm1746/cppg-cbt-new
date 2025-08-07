import threading
import time
from upbit_mock import MockUpbit, COINS

class AutoTrader:
    def __init__(self, upbit, interval=10):
        self.upbit = upbit
        self.interval = interval  # 가격 체크 주기(초)
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self.run)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()

    def run(self):
        # 초기 매수: 5개 코인에 동일 비율 분산 투자(시드 1/5씩)
        total_cash = self.upbit.cash
        per_coin_cash = total_cash / len(COINS)
        for coin in COINS:
            symbol = coin['symbol']
            price = self.upbit.get_current_price(symbol)
            amount = per_coin_cash // price
            if amount > 0:
                self.upbit.buy(symbol, amount)
        # 자동매매 루프
        while self.running:
            for coin in COINS:
                symbol = coin['symbol']
                amount = self.upbit.balance[symbol]
                buy_price = self.upbit.buy_price[symbol]
                if amount > 0 and buy_price:
                    now_price = self.upbit.get_current_price(symbol)
                    change_pct = (now_price - buy_price) / buy_price * 100
                    # 3% 익절
                    if change_pct >= 3:
                        self.upbit.sell(symbol, amount)
                    # -2% 손절
                    elif change_pct <= -2:
                        self.upbit.sell(symbol, amount)
            time.sleep(self.interval)56756788786