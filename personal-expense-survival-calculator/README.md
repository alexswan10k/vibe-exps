# 💰 Personal Expense Survival Calculator

A comprehensive financial planning tool that calculates how long your savings will last based on monthly expenses, inflation rates, and investment risk factors.

## Features

- **📉 Expense Management**: Add, edit, and remove monthly expenses with customizable inflation rates
- **💰 Savings Pots**: Add, edit, and remove savings accounts with different interest rates and risk factors
- **📊 Risk Analysis**: Calculates minimum and maximum survival times based on investment risk
- **📈 Visual Charts**: Month-by-month savings progression with Chart.js (updates automatically)
- **📋 Detailed Analytics**: Comprehensive month-by-month breakdown of individual expenses and savings
- **⚡ Reactive Updates**: Charts and results update automatically when you modify data
- **💾 Persistence**: Auto-saves to localStorage for session resumption
- **🔒 Immutable Design**: Uses immutable data patterns for predictable state management

## Technology Stack

- **React 18** (CDN) - Direct API usage, no build pipeline
- **Chart.js** - Interactive savings progression charts
- **Vanilla JavaScript** - Domain logic and unit tests
- **localStorage** - Client-side data persistence
- **Modern CSS** - Responsive design with CSS Grid and Flexbox

## Project Structure

```
personal-expense-survival-calculator/
├── index.html          # Main HTML with CDN dependencies
├── script.js           # React application with immutable patterns
├── domain.js           # Domain model with JSDoc types
├── tests.js            # Comprehensive unit tests
└── README.md           # This file
```

## Domain Model

### Expense Class
- **Properties**: name, amount, inflationRate
- **Methods**: getInflatedAmount(month), toJSON(), fromJSON()
- **Validation**: Non-empty name, non-negative amount and inflation rate

### SavingsPot Class
- **Properties**: name, amount, interestRate, riskRate
- **Methods**: getNominalAmount(month), getMinAmount(month), getMaxAmount(month)
- **Risk Calculation**: Interest rate ± risk rate for min/max scenarios

### SurvivalData Class
- **Properties**: expenses[], savingsPots[], lastCalculated
- **Methods**: addExpense(), removeExpense(), addSavingsPot(), removeSavingsPot(), calculateSurvival()
- **Immutable**: All modification methods return new instances

## Usage

1. **Add Expenses**: Enter monthly expenses with their expected annual inflation rates
2. **Add Savings**: Create savings pots with different interest rates and risk factors
3. **Calculate**: Click "Calculate Survival" to see results
4. **View Results**: See nominal, minimum, and maximum survival times
5. **Charts**: View month-by-month savings progression with risk ranges

## Key Features

### Immutable Architecture
- All domain objects use immutable patterns
- State changes return new instances rather than mutating existing ones
- Predictable and thread-safe operations

### Risk Analysis
- Calculates three scenarios: nominal, pessimistic (high risk), optimistic (low risk)
- Risk factors adjust interest rates up/down for realistic projections
- Visual representation of risk ranges in charts

### Month-by-Month Calculation
- **Accurate monthly simulation**: Each month applies interest to current savings balance
- **Progressive expense inflation**: Expenses grow month by month with compound inflation
- **Realistic cash flow**: Interest earned on remaining balance, not original amounts
- **Proper sequencing**: Interest added before expenses subtracted each month
- **Individual pot tracking**: Each savings pot grows independently with its own interest rate
- **Total savings for charts**: Chart displays combined savings minus total expenses
- **Pure functions**: All calculation logic is implemented as pure, testable functions
- **Month 1 special case**: No interest applied, just initial savings minus expenses
- **Month 2+ logic**: Interest applied to previous month's pot balances, then total expenses deducted

### Data Persistence
- Automatic saving to localStorage
- Session resumption on page reload
- JSON serialization for all domain objects

## Running Tests

```bash
cd personal-expense-survival-calculator
node tests.js
```

Tests cover:
- ✅ Domain class validation and calculations
- ✅ Immutable data patterns
- ✅ Serialization/deserialization
- ✅ Edge cases and error handling
- ✅ Risk and inflation calculations

## Browser Support

- Modern browsers with ES6+ support
- React 18+ compatible
- Chart.js compatible
- localStorage support required

## Development Notes

- Uses React.createElement directly (no JSX)
- Immutable patterns throughout for predictability
- Strong typing with JSDoc annotations
- Comprehensive unit test coverage
- No build pipeline - pure HTML/CSS/JS

## Example Usage

```javascript
// Create expenses with inflation
const rent = new Expense('Rent', 1000, 0.03); // 3% annual inflation
const food = new Expense('Food', 500, 0.02);  // 2% annual inflation

// Create savings with risk
const retirement = new SavingsPot('Retirement', 50000, 0.07, 0.02); // 7% return, 2% risk
const emergency = new SavingsPot('Emergency', 10000, 0.05, 0.01);   // 5% return, 1% risk

// Calculate survival
const data = new SurvivalData([rent, food], [retirement, emergency]);
const result = data.calculateSurvival();
// Returns: { nominalMonths: 156, minMonths: 142, maxMonths: 171, monthlyProgression: [...] }
```

## License

This project is open source and available under the MIT License.
