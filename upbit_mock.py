import random
import time

COINS = [
    {"name": "비트코인", "symbol": "BTC", "ticker": "KRW-BTC"},
    {"name": "이더리움", "symbol": "ETH", "ticker": "KRW-ETH"},
    {"name": "리플", "symbol": "XRP", "ticker": "KRW-XRP"},
    {"name": "에이다", "symbol": "ADA", "ticker": "KRW-ADA"},
    {"name": "도지코인", "symbol": "DOGE", "ticker": "KRW-DOGE"},
]

class MockUpbit:
    def __init__(self):
        self.balance = {coin['symbol']: 0 for coin in COINS}
        self.cash = 10000000  # 1,000만원 가상 시드
        self.trades = []
        self.prices = {coin['symbol']: self._random_price(coin['symbol']) for coin in COINS}
        self.buy_price = {coin['symbol']: None for coin in COINS}

    def _random_price(self, symbol):
        base = {
            'BTC': 70000000,
            'ETH': 4000000,
            'XRP': 700,
            'ADA': 500,
            'DOGE': 100
        }
        return base.get(symbol, 1000) * random.uniform(0.95, 1.05)

    def get_current_price(self, symbol):
        # 시세를 임의로 약간씩 변동
        self.prices[symbol] *= random.uniform(0.98, 1.02)
        return round(self.prices[symbol], 2)

    def buy(self, symbol, amount):
        price = self.get_current_price(symbol)
        total = price * amount
        if self.cash >= total:
            self.cash -= total
            self.balance[symbol] += amount
            self.buy_price[symbol] = price
            self.trades.append({
                'type': '매수', 'symbol': symbol, 'price': price, 'amount': amount, 'time': time.strftime('%Y-%m-%d %H:%M:%S')
            })
            return True
        return False

    def sell(self, symbol, amount):
        if self.balance[symbol] >= amount:
            price = self.get_current_price(symbol)
            self.cash += price * amount
            self.balance[symbol] -= amount
            self.trades.append({
                'type': '매도', 'symbol': symbol, 'price': price, 'amount': amount, 'time': time.strftime('%Y-%m-%d %H:%M:%S')
            })
            self.buy_price[symbol] = None
            return True
        return False

    def get_portfolio(self):
        return {
            'cash': self.cash,
            'coins': {symbol: self.balance[symbol] for symbol in self.balance},
            'buy_price': self.buy_price.copy(),
            'trades': self.trades.copy(),
        } 