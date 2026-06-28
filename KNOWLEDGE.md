# YouTrader Product Knowledge

This document contains the product rules and business logic of YouTrader. It intentionally avoids implementation details. Use it as the source of truth for how YouTrader should think about trades, analytics, AI coaching, prop firm risk, achievements, and visual direction.

## Product Purpose

YouTrader is a premium trading journal and analytics terminal for futures and prop-firm traders. Its job is not to predict markets. Its job is to help a trader understand their own execution, risk behavior, consistency, session performance, emotional patterns, and prop-firm survival path.

The product should always favor discipline, risk control, journaling quality, and process improvement over excitement, trade signals, or market prediction.

## Core Trade Model

Each trade contributes to analytics through:

- Date
- Symbol/instrument
- Direction
- Entry time and/or exit time
- Entry price
- Exit price
- Contracts
- Stop loss
- Take profit
- P&L
- Mood
- Notes
- Tags/setup labels
- Screenshot/photo/voice context when available

The journal is the source of truth. Every statistic should be derived from logged trades and selected time periods.

## Core Calculations

### Net P&L

Net P&L is the sum of all selected trade P&L values.

### Wins

A winning trade is any trade with P&L greater than zero.

### Losses

A losing trade is any trade with P&L less than zero.

### Breakeven Trades

A trade with P&L equal to zero is neither a win nor a loss for win/loss counts.

### Gross Wins

Gross wins are the sum of all positive P&L values.

### Gross Losses

Gross losses are the absolute value of the sum of all negative P&L values.

### Win Rate

Win Rate = winning trades / total trades × 100.

If there are no trades, Win Rate is zero.

### Expectancy

Expectancy = total net P&L / total trades.

It represents average expected P&L per logged trade.

### Profit Factor

Profit Factor = gross wins / gross losses.

If there are gross wins but no gross losses, Profit Factor is treated as a very high positive value. If there are no wins and no losses, it is zero.

### Average Win

Average Win = gross wins / number of winning trades.

### Average Loss

Average Loss = gross losses / number of losing trades.

Average Loss is treated as a positive magnitude, not a negative number.

### Average Win / Loss Ratio

Average Win / Loss = average win / average loss.

If average loss is zero and average win exists, the ratio is treated as a very high positive value.

### Risk / Reward

When entry, stop loss, and take profit are available:

Risk = absolute distance from entry to stop loss.

Reward = absolute distance from take profit to entry.

Risk / Reward = reward / risk.

If entry price is missing but stop loss and take profit are entered as direct values, the fallback ratio is take profit / stop loss.

### Average R:R

Average R:R is the average of all valid trade risk/reward ratios.

Trades without enough risk/reward data are ignored for this calculation.

### Equity Curve

The equity curve is the running sum of trade P&L in chronological order.

### Max Drawdown

Max Drawdown is the largest negative drop from any previous equity peak.

Process:

1. Sort trades chronologically.
2. Build running equity.
3. Track the highest equity peak reached so far.
4. Measure each equity point against the peak.
5. The most negative difference is max drawdown.

### Daily P&L

Daily P&L is the sum of all trades on the same date.

### Weekly P&L

Weekly P&L is the sum of all trades from the beginning of the selected week through the selected date context.

The week starts on Sunday.

### Monthly P&L

Monthly P&L is the sum of all trades from the first day of the selected month through the selected date context.

### Sharpe-Style Daily Ratio

The app uses a simplified daily stability ratio:

Average daily P&L / standard deviation of daily P&L.

If there is not enough daily data, the value is zero.

If daily volatility is zero and average daily P&L is positive, the value is treated as very high.

## Session Definitions

YouTrader groups trades into simple trading sessions based on trade time:

- Morning: before 11:00
- Midday / Lunch: 11:00 to before 14:00
- Afternoon / Power Hour: 14:00 and later

When exact trade time is unavailable, the app uses the best available trade timestamp context.

Heatmap modes:

- Hours: 00:00 through 23:00
- Sessions: Morning, Midday, Afternoon
- Days: Monday through Sunday
- Months: January through December

Session intelligence should identify where the trader performs best and worst, not encourage trading at any specific time without journal evidence.

## Performance Breakdowns

Breakdowns can be grouped by:

- Day of week
- Session
- Hour
- Instrument
- Direction
- Mood
- Setup/tag

Each group should calculate:

- Number of trades
- Wins
- Losses
- Win Rate
- Net P&L
- Average P&L
- Profit Factor
- Expectancy
- Average Win
- Average Loss
- Max Win
- Max Loss

Breakdowns are ranked primarily by sample size and performance relevance. Small samples should be treated with lower confidence.

## Streak Logic

### Trade Streaks

A winning trade streak counts consecutive trades with positive P&L.

A losing trade streak counts consecutive trades with negative P&L.

Zero-P&L trades reset streaks.

The app tracks:

- Current win streak
- Current loss streak
- Max winning streak
- Max losing streak

### Daily Streaks

A green day is a day with total P&L greater than zero.

A red day is a day with total P&L less than zero.

Zero days reset daily streaks.

The app tracks:

- Max green day streak
- Max red day streak

## Consistency Formula

Consistency measures whether the trader produces stable daily results without extreme volatility.

Inputs:

- Daily P&L series
- Green day rate
- Stability of daily returns

Rules:

- No trades: consistency is 0.
- Only one daily sample: consistency defaults to a moderate baseline of 62.
- Green Rate = green days / total trading days × 100.
- Average Absolute Daily P&L = average of absolute daily P&L values.
- Daily Volatility = standard deviation of daily P&L.
- Stability = 100 − (daily volatility / average absolute daily P&L × 42), clamped between 0 and 100.

Final Consistency Score:

Consistency = Green Rate × 0.55 + Stability × 0.45.

The result is clamped from 0 to 100.

## Risk Control And Recovery

### Recovery Factor

Recovery Factor = net P&L / absolute max drawdown.

If max drawdown is zero and net P&L is positive, recovery is treated as very high.

### Drawdown Control

Drawdown control reflects how well the trader protects equity relative to gains and losses. Higher drawdowns reduce the score; stable equity growth improves it.

### Risk Control

Risk control combines drawdown behavior, daily loss pressure, consistency, and whether the trader avoids emotional/rule-breaking patterns.

Risk control should always reward:

- Smaller controlled losses
- Respecting daily stop rules
- Avoiding size increases after losses
- Stable trade count
- Lower drawdown relative to total performance

Risk control should penalize:

- Large drawdowns
- Red days that damage daily buffer
- Overtrading
- Revenge trading
- Negative expectancy
- Oversized trades

## Trading Score Logic

Trading Score is the main composite quality score of the trader.

Inputs:

- Win Rate
- Profit Factor
- Expectancy
- Consistency
- Risk Control
- Recovery Factor
- Max Drawdown
- Average Win/Loss Ratio
- Trade Count

Normalized components:

- Profit Factor Score = Profit Factor / 2.2 × 100, clamped to 0-100.
- Expectancy Score:
  - If expectancy is positive: 55 plus a positive expectancy boost.
  - If expectancy is negative: 45 plus the negative expectancy impact.
- Recovery Score = Recovery Factor / 3 × 100, clamped to 0-100.
- Sample Score = trade count / 20 × 100, clamped to 0-100.

Weighted score:

- Win Rate: 18%
- Profit Factor Score: 20%
- Expectancy Score: 18%
- Consistency: 16%
- Risk Control: 18%
- Recovery Score: 6%
- Sample Score: 4%

Final score is rounded and clamped from 0 to 100.

Grades:

- A+: 85+
- A: 75-84
- B: 65-74
- C: 50-64
- D: below 50

Percentile label:

- Displayed as top percentile based on score.
- Minimum displayed top percentile is Top 5%.

Strengths may include:

- Strong win rate
- Positive profit factor
- Stable daily execution
- Controlled drawdown

Weaknesses may include:

- Improve loss control
- Fix negative expectancy
- Reduce volatility between trading days
- Protect drawdown buffer

## Trader Levels

Trader levels are based on Trading Score.

### Rookie

Score below 58.

Meaning: the trader is still building enough data and needs to keep logging trades and controlling risk.

### Consistent

Score 58-75.

Meaning: the trader’s edge is forming. They should protect risk and repeat best setups.

### Funded

Score 76-87.

Meaning: the trader’s edge is strong enough to protect like funded capital. The focus becomes reducing drawdown and keeping execution clean.

### Elite

Score 88+.

Meaning: the process behaves like a professional desk. The focus becomes protecting size and consistency.

## Prop Firm Logic

Prop firm logic helps the trader protect evaluation and funded-account rules.

It should never encourage reckless progress toward a target. Survival comes before speed.

Core prop account inputs:

- Account size
- Evaluation target
- Daily loss limit
- Max loss limit
- Evaluation contract limit
- Live contract limit
- Evaluation risk percentage
- Live risk percentage
- Trailing drawdown status

Default account templates:

- 25K Evaluation:
  - Target: 1,500
  - Daily loss limit: 550
  - Max loss limit: 1,500
  - Evaluation contracts: 3
  - Live contracts: 2
  - Evaluation risk: 12%
  - Live risk: 8%

- 50K Evaluation:
  - Target: 3,000
  - Daily loss limit: 1,200
  - Max loss limit: 2,500
  - Evaluation contracts: 6
  - Live contracts: 4
  - Evaluation risk: 12%
  - Live risk: 8%

- 100K Evaluation:
  - Target: 6,000
  - Daily loss limit: 2,000
  - Max loss limit: 3,500
  - Evaluation contracts: 8
  - Live contracts: 6
  - Evaluation risk: 10%
  - Live risk: 7.5%

- 150K Evaluation:
  - Target: 9,000
  - Daily loss limit: 2,500
  - Max loss limit: 4,500
  - Evaluation contracts: 10
  - Live contracts: 7
  - Evaluation risk: 9.5%
  - Live risk: 8%

## Pass Probability Logic

Pass Probability estimates the likelihood that the current journal behavior is on track for a prop evaluation.

It does not predict the market.

Inputs:

- Current net P&L
- Evaluation target
- Max loss limit
- Current drawdown
- Trade sample size

Formula:

- Progress component = max(0, current P&L / target) × 55.
- Drawdown buffer component = max(0, 1 − current drawdown / max loss limit) × 35.
- Sample component = minimum of 10 and trade count / 2.
- Pass Probability = progress + drawdown buffer + sample component.

Final value is rounded and clamped from 3 to 98.

Statuses:

- 82+ = Excellent
- 58-81 = On Track
- 32-57 = At Risk
- Below 32 = Danger

Confidence:

- 25+ trades = high
- 10-24 trades = medium
- Fewer than 10 trades = low

## Prop Survival Score

Prop Survival estimates whether the trader is protecting the account and rules.

Inputs:

- Consistency
- Win Rate
- Profit Factor
- Current drawdown
- Today’s P&L
- Daily/account remaining buffers
- Expectancy when available

Scoring behavior:

- Consistency and Win Rate are major positive contributors.
- Profit Factor above 1 adds a boost.
- Drawdown creates a penalty.
- Negative daily P&L creates a daily buffer penalty.

Formula behavior:

- Drawdown penalty is capped.
- Day loss penalty is capped.
- Profit Factor boost is capped.
- Final probability is clamped from 5 to 98.

Interpretation:

- If drawdown pressure is high, the top risk is the drawdown buffer.
- If today is red, the top risk is the daily buffer.
- Otherwise, the main risk is overtrading after green sessions.

Recommended action:

- High survival: keep size fixed and protect the buffer.
- Lower survival: reduce size, stop after rule breaks, and trade only A setups.

## Risk Predictor Logic

Risk Predictor estimates discipline-violation risk, not market direction.

Inputs:

- Recent losses
- Loss streak
- Overtrading
- Daily trade count
- Weak sessions
- Weak days
- Oversized trades
- Revenge trading patterns
- Prop firm limits
- Upcoming news as volatility context

Risk levels:

- Low
- Medium
- High

Risk should rise when:

- The trader has multiple losses in the selected day.
- The trader has five or more trades in one day.
- Danger mode is active.
- Losses cluster after prior losses.
- Mood/notes show tilt, FOMO, fear, anger, stress, or rule-breaking.

Recommended rules should focus on:

- Stop after 2 losses.
- Do not increase size after a loss.
- Define invalidation before entry.
- Journal every trade.
- Reduce size when discipline is not clean.

## Revenge Trading Logic

Revenge trading is suspected when:

- The selected day has 2 or more losses.
- The selected day has 5 or more trades.
- A danger/risk mode is active.

Severity:

- High: danger mode active or 3+ losses in the selected day.
- Medium: revenge pattern detected but not high severity.
- Low: no clear revenge pattern.

Recommendation:

- Pause.
- Review screenshots and notes.
- Do not increase size after losses.
- Return to checklist and fixed risk.

## Hidden Leak Detection Logic

Hidden leaks are behavior/performance problems that may not be obvious from headline stats.

Detected leaks include:

### Loss Frequency

Triggered when losing trades are more than half of the sample.

Recommendation:

- Filter lower-quality setups.
- Reduce size until win rate stabilizes.

### Mood-Linked Losses

Triggered when losses include mood labels such as:

- Angry
- Fear
- FOMO
- Tilt
- Stress

Recommendation:

- Add a cooldown rule after emotional trades.

Only the most relevant hidden leaks should be shown. The product should avoid overwhelming the trader.

## Pattern Detection Logic

Pattern detection compares performance across instruments, payoff profile, loss frequency, gross wins/losses, sessions, days, hours, direction, mood, and setups.

Strength examples:

- Best instrument by net P&L.
- Positive payoff profile.
- Strong session or setup.
- Gross wins leading gross losses.

Risk examples:

- Loss frequency pressure.
- Gross losses exceeding gross wins.
- Weak session.
- Weak instrument.
- Negative expectancy.
- Poor performance after losses or red days.

Opportunity:

- The most important risk or strength that can produce the highest behavioral improvement.

Pattern confidence should depend on sample size. Small samples should be framed cautiously.

## Streak Behavior Analysis

The product analyzes what happens after:

- Winning trades
- Losing trades
- Green days
- Red days

Purpose:

- Detect whether the trader increases risk after wins.
- Detect revenge behavior after losses.
- Detect red-day continuation.
- Detect whether the trader protects gains after green days.

The goal is to create better process rules, not to predict the next trade.

## Achievement Rules

Achievement status:

- Unlocked: progress reaches or exceeds target.
- Next Target: progress is at least 55% of target but not unlocked.
- Locked: progress below 55% of target.

Achievements:

- First Trade Logged: log 1 trade.
- 10 Trades Logged: log 10 trades.
- 100 Green Trades: close 100 green trades.
- 10 Green Days: finish 10 days green.
- First Green Week: finish one week green.
- 5R Trade: log a 5R trade.
- Pass Eval: reach 85 prop survival score.
- No Revenge Trading Week: keep 5 clean sessions.
- Risk Discipline Streak: keep discipline score above 70.
- New Equity High: build positive monthly P&L.
- First $1K Month: reach $1,000 in a month.
- First $10K Month: reach $10,000 in a month.
- Top 20% Trader: reach Trading Score 70.
- One Step From Funding: keep prop target remaining under 10%.

Risk discipline streak:

- Continues when trade notes/mistakes do not indicate revenge, overtrading, tilt, FOMO, or rule breaks.
- Resets when those behaviors appear.

Achievement sharing:

- Free users can share a limited number per day.
- Pro users can share more per day.
- Shared cards should show the achievement, result, trader level, and YouTrader branding.

## AI Rules

AI in YouTrader is a coach, not a signal engine.

AI must:

- Use only the trader’s journal, stats, prop firm context, and news payload.
- Focus on discipline, risk, consistency, behavior, and journaling.
- Give educational feedback only.
- Be clear when there is not enough data.
- Fall back to safe local analysis when cloud AI is unavailable.
- Respect daily/weekly usage limits.

AI must never:

- Give financial advice.
- Give buy/sell/hold signals.
- Predict market direction.
- Promise profits.
- Promise prop-firm passing.
- Use screenshots or voice notes unless explicitly implemented and consented.
- Expose API keys.
- Pretend limited/free AI access is unlimited production infrastructure.

## AI Feature Rules

### AI Daily Plan

Purpose:

- Prepare the trader for the day based on recent behavior.

Uses:

- Recent performance
- Prop firm status
- Day/session patterns
- Upcoming news as volatility context
- Win/loss streaks
- Best/worst session

Must output:

- Daily focus
- Risk budget
- What to avoid
- Trade rules
- Session focus
- News awareness
- Coach message

No market prediction.

### AI Risk Predictor

Purpose:

- Estimate discipline-violation risk today.

Must output:

- Risk level
- Risk score
- Reasons
- Warning signs
- Recommended rules
- Max risk suggestion
- Coach message

No market direction prediction.

### AI Weekly Coach

Purpose:

- Review the last 7 days of trading behavior.

Must output:

- Title
- Summary
- Top strengths
- Main leaks
- Best session
- Worst session
- Risk notes
- Next week focus
- Coach message

### AI Journal Summary

Purpose:

- Summarize selected-period behavior.

Must output:

- Period
- Summary
- Patterns detected
- Strengths
- Mistakes
- Behavior notes
- Improvement plan

### AI Daily Challenge

Purpose:

- Give one discipline challenge for the day.

Challenge examples:

- No revenge trade challenge.
- Stop after 2 losses.
- Follow max risk.
- Journal every trade.
- No oversized trade.
- Trade only best session.

Must output:

- Challenge title
- Challenge description
- Rules
- Success criteria
- Difficulty
- Why it helps

### AI News Explainer

Product rule:

- The AI News Explainer can explain volatility/risk context, but the current News screen should remain a clean premium list without the AI CTA.

If used in the future, it must:

- Explain in plain English.
- Explain why news matters.
- List markets potentially affected.
- Include a risk reminder.
- Include not-financial-advice.
- Never generate buy/sell signals.

## AI Analytics Product Structure

AI Analytics should feel like one intelligent coach, not many disconnected AI widgets.

Current structure:

### 1. AI Command Center

Answers: “What should I focus on now?”

Shows:

- AI Confidence score
- Today’s Focus
- Three action chips
- One Refresh Analysis button
- Updated timestamp after refresh

### 2. Pattern Detective

Answers: “Where is my hidden edge or leak?”

Shows:

- Visual session/time pattern rows
- Confidence/sample/profit/win-rate context
- Hidden Edge
- Hidden Leak

### 3. Trading Coach

Answers: “What should I improve next?”

Merges:

- Weekly coach
- Daily plan
- Journal summary
- Daily challenge

Shows:

- Today’s coaching
- Next improvement
- 1-3 step action plan
- Focus score

### 4. Prop Firm Mission

Answers: “Am I protecting the pass path?”

Merges:

- Risk predictor
- Pass probability
- Survival score
- Prop firm rules

Shows:

- Account/template
- Pass probability
- Daily buffer
- Account buffer
- Remaining drawdown
- Safe contracts
- Today’s allowed risk
- Protect Pass Path detail

### 5. Monthly Intelligence

Answers: “What did this month teach me?”

Shows:

- Strengths
- Mistakes
- Best setup
- Worst setup
- Best day
- Worst day
- Hidden correlation
- Most emotional day
- Best R:R
- Most profitable hour

## Premium Feature Rules

Free users should see enough value to understand that YouTrader works.

Always keep visible for free users:

- Win Rate
- Trades
- Win/Loss
- Month P&L
- Biggest Win
- Biggest Loss
- Max Winning Streak
- Max Losing Streak
- Live News

Pro-gated examples:

- Profit Factor
- Expectancy
- Consistency Score
- Sharpe Ratio
- Avg Win / Loss
- Advanced AI Analytics
- Prop firm insights
- Full calendar access
- Premium exports
- Cloud sync
- Advanced stats and performance profile details

Premium locks should:

- Show blurred previews.
- Feel premium and intentional.
- Avoid black empty screens.
- Include clear upgrade CTA.

## Calendar Rules

The calendar is a journal-first interface.

Rules:

- Today should be usable.
- Future/extended access can be Pro-gated.
- Calendar days should show performance context.
- Green/red fills should be calm, not aggressive.
- Date title should remain readable and premium.
- Calendar interactions must not break add/edit trade logic.

## News Rules

News should be a clean premium market awareness list.

Rules:

- Free users can see the full news list.
- News can show impact, source, time, headline, summary, and asset bias.
- News should not imply trade signals.
- Current product direction removes `Explain with AI` from the News screen.

## Share Card Product Rules

Share cards should feel like premium visual rewards.

They should include:

- YouTrader branding/logo.
- Achievement or result.
- Trader level.
- Key stats such as trades logged, win rate, total P&L, and date label.
- A beautiful card-style design suitable for social sharing.

They should not expose private journal notes unless explicitly designed.

## Design Philosophy

YouTrader should feel like a premium Apple-quality professional trading terminal.

Reference feeling:

- iOS 26
- Apple Wallet
- Apple Health
- Apple Fitness
- Apple Stocks
- VisionOS
- Apple Intelligence
- Linear
- Arc Browser
- Notion Calendar
- Minimal Bloomberg Terminal

Must feel:

- Soft
- Floating
- Layered
- Alive
- Premium
- Calm
- Information-dense
- Intelligent

Must not feel:

- Cyberpunk
- Gamer
- Crypto dashboard
- Neon-heavy
- Childish
- Random widget collection

Visual rules:

- 90% black, glass, grey.
- Purple only as a careful accent.
- Lime only for positive/performance.
- Red only for danger.
- Use large numbers and small labels.
- Reduce text where visuals can explain.
- Every card answers one question.
- Merge cards that answer the same question.
- Use soft shadows, blur, translucent glass, subtle reflection, and rounded corners.
- Avoid harsh borders, hard shadows, oversized outlines, and glowing neon borders.

Motion rules:

- Use smooth spring, opacity fade, blur transitions, and subtle scale.
- No excessive bouncing.
- No vibration on chart interactions.
- Animate charts, rings, numbers, and bottom sheets subtly.
- Respect reduced motion where possible.

## Final Product Principle

YouTrader should help a trader think:

“I understand my behavior, my edge, my risk, and my path to protecting capital.”

It should never make the trader think:

“The app is giving me signals.”

The app is a professional trading journal, analytics coach, and prop-firm risk terminal, not a prediction engine.
