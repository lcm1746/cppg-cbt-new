from flask import Flask, render_template, redirect, url_for
from upbit_mock import MockUpbit, COINS
from auto_trader import AutoTrader

app = Flask(__name__)

upbit = MockUpbit()
auto_trader = AutoTrader(upbit)

@app.route('/')
def index():
    portfolio = upbit.get_portfolio()
    total_asset = portfolio['cash']
    for symbol, amount in portfolio['coins'].items():
        price = upbit.get_current_price(symbol)
        total_asset += price * amount
    profit = total_asset - 10000000
    profit_pct = (profit / 10000000) * 100
    return render_template('coin_index.html',
                           coins=COINS,
                           portfolio=portfolio,
                           total_asset=round(total_asset,2),
                           profit=round(profit,2),
                           profit_pct=round(profit_pct,2),
                           auto_running=auto_trader.running)

@app.route('/start')
def start():
    if not auto_trader.running:
        auto_trader.start()
    return redirect(url_for('index'))

@app.route('/stop')
def stop():
    if auto_trader.running:
        auto_trader.stop()
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True) 