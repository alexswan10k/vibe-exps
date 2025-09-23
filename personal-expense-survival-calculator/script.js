// Survival Calculator React App using direct React API
const { useState, useEffect } = React;

// Expense Form Component
const ExpenseForm = ({ onAdd, initialData }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [inflationRate, setInflationRate] = useState(initialData?.inflationRate || '');

  // Update form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setAmount(initialData.amount || '');
      setInflationRate(initialData.inflationRate || '');
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && amount && inflationRate) {
      onAdd({
        name: name.trim(),
        amount: parseFloat(amount),
        inflationRate: parseFloat(inflationRate) / 100 // Convert percentage to decimal
      });
      // Only clear form if not editing
      if (!initialData) {
        setName('');
        setAmount('');
        setInflationRate('');
      }
    }
  };

  return React.createElement('form', { onSubmit: handleSubmit, className: 'form-group' },
    React.createElement('div', { className: 'form-row' },
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'expense-name' }, 'Expense Name'),
        React.createElement('input', {
          id: 'expense-name',
          type: 'text',
          value: name,
          onChange: (e) => setName(e.target.value),
          placeholder: 'e.g., Rent, Food, Utilities',
          required: true
        })
      ),
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'expense-amount' }, 'Monthly Amount ($)'),
        React.createElement('input', {
          id: 'expense-amount',
          type: 'number',
          step: '0.01',
          min: '0',
          value: amount,
          onChange: (e) => setAmount(e.target.value),
          placeholder: '0.00',
          required: true
        })
      ),
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'expense-inflation' }, 'Annual Inflation (%)'),
        React.createElement('input', {
          id: 'expense-inflation',
          type: 'number',
          step: '0.1',
          min: '0',
          value: inflationRate,
          onChange: (e) => setInflationRate(e.target.value),
          placeholder: '3.0',
          required: true
        })
      ),
      React.createElement('button', { type: 'submit', className: 'btn btn-primary' }, initialData ? 'Update Expense' : 'Add Expense')
    )
  );
};

// Expense List Component
const ExpenseList = ({ expenses, onRemove, onEdit }) => {
  if (expenses.length === 0) {
    return React.createElement('div', { className: 'no-data' }, 'No expenses added yet');
  }

  return React.createElement('div', { className: 'item-list' },
    expenses.map((expense, index) =>
      React.createElement('div', { key: index, className: 'item' },
        React.createElement('div', { className: 'item-info' },
          React.createElement('div', { className: 'item-name' }, expense.name),
          React.createElement('div', { className: 'item-details' },
            `$${expense.amount.toFixed(2)}/month • ${(expense.inflationRate * 100).toFixed(1)}% inflation`
          )
        ),
        React.createElement('div', { className: 'item-actions' },
          React.createElement('button', {
            onClick: () => onEdit(index),
            className: 'btn btn-secondary btn-small'
          }, 'Edit'),
          React.createElement('button', {
            onClick: () => onRemove(index),
            className: 'btn btn-secondary btn-small'
          }, 'Remove')
        )
      )
    )
  );
};

// Savings Pot Form Component
const SavingsPotForm = ({ onAdd, initialData }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [interestRate, setInterestRate] = useState(initialData?.interestRate || '');
  const [riskRate, setRiskRate] = useState(initialData?.riskRate || '');

  // Update form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setAmount(initialData.amount || '');
      setInterestRate(initialData.interestRate || '');
      setRiskRate(initialData.riskRate || '');
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && amount && interestRate && riskRate) {
      onAdd({
        name: name.trim(),
        amount: parseFloat(amount),
        interestRate: parseFloat(interestRate) / 100, // Convert percentage to decimal
        riskRate: parseFloat(riskRate) / 100 // Convert percentage to decimal
      });
      // Only clear form if not editing
      if (!initialData) {
        setName('');
        setAmount('');
        setInterestRate('');
        setRiskRate('');
      }
    }
  };

  return React.createElement('form', { onSubmit: handleSubmit, className: 'form-group' },
    React.createElement('div', { className: 'form-row' },
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'savings-name' }, 'Savings Pot Name'),
        React.createElement('input', {
          id: 'savings-name',
          type: 'text',
          value: name,
          onChange: (e) => setName(e.target.value),
          placeholder: 'e.g., Retirement Fund, Emergency Fund',
          required: true
        })
      ),
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'savings-amount' }, 'Current Amount ($)'),
        React.createElement('input', {
          id: 'savings-amount',
          type: 'number',
          step: '0.01',
          min: '0',
          value: amount,
          onChange: (e) => setAmount(e.target.value),
          placeholder: '0.00',
          required: true
        })
      ),
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'savings-interest' }, 'Annual Interest (%)'),
        React.createElement('input', {
          id: 'savings-interest',
          type: 'number',
          step: '0.1',
          min: '0',
          value: interestRate,
          onChange: (e) => setInterestRate(e.target.value),
          placeholder: '5.0',
          required: true
        })
      ),
      React.createElement('div', null,
        React.createElement('label', { htmlFor: 'savings-risk' }, 'Risk Rate (%)'),
        React.createElement('input', {
          id: 'savings-risk',
          type: 'number',
          step: '0.1',
          min: '0',
          value: riskRate,
          onChange: (e) => setRiskRate(e.target.value),
          placeholder: '2.0',
          required: true
        })
      ),
      React.createElement('button', { type: 'submit', className: 'btn btn-primary' }, initialData ? 'Update Savings' : 'Add Savings')
    )
  );
};

// Savings Pot List Component
const SavingsPotList = ({ savingsPots, onRemove, onEdit }) => {
  if (savingsPots.length === 0) {
    return React.createElement('div', { className: 'no-data' }, 'No savings pots added yet');
  }

  return React.createElement('div', { className: 'item-list' },
    savingsPots.map((pot, index) =>
      React.createElement('div', { key: index, className: 'item' },
        React.createElement('div', { className: 'item-info' },
          React.createElement('div', { className: 'item-name' }, pot.name),
          React.createElement('div', { className: 'item-details' },
            `$${pot.amount.toFixed(2)} • ${(pot.interestRate * 100).toFixed(1)}% interest • ${(pot.riskRate * 100).toFixed(1)}% risk`
          )
        ),
        React.createElement('div', { className: 'item-actions' },
          React.createElement('button', {
            onClick: () => onEdit(index),
            className: 'btn btn-secondary btn-small'
          }, 'Edit'),
          React.createElement('button', {
            onClick: () => onRemove(index),
            className: 'btn btn-secondary btn-small'
          }, 'Remove')
        )
      )
    )
  );
};

// Results Display Component
const ResultsDisplay = ({ result }) => {
  if (!result) {
    return React.createElement('div', { className: 'no-data' }, 'Add some expenses and savings pots to see results');
  }

  const formatTime = (months) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${remainingMonths} months`;
    if (remainingMonths === 0) return `${years} years`;
    return `${years} years ${remainingMonths} months`;
  };

  return React.createElement('div', null,
    React.createElement('div', { className: 'results-grid' },
      React.createElement('div', { className: 'result-card' },
        React.createElement('div', { className: 'result-value' }, formatTime(result.nominalMonths)),
        React.createElement('div', { className: 'result-label' }, 'Nominal Survival Time')
      ),
      React.createElement('div', { className: 'result-card' },
        React.createElement('div', { className: 'result-value' }, formatTime(result.minMonths)),
        React.createElement('div', { className: 'result-label' }, 'Minimum Survival Time')
      ),
      React.createElement('div', { className: 'result-card' },
        React.createElement('div', { className: 'result-value' }, formatTime(result.maxMonths)),
        React.createElement('div', { className: 'result-label' }, 'Maximum Survival Time')
      )
    )
  );
};

// Chart Component
const SurvivalChart = ({ result }) => {
  const [chart, setChart] = useState(null);

  useEffect(() => {
    if (result && result.monthlyProgression.length > 0) {
      // Destroy existing chart
      if (chart) {
        chart.destroy();
      }

      const ctx = document.getElementById('survival-chart');
      if (ctx) {
        const newChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: result.monthlyProgression.map(p => `Month ${p.month}`),
            datasets: [
              {
                label: 'Nominal Savings',
                data: result.monthlyProgression.map(p => p.nominalSavings),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: false
              },
              {
                label: 'Minimum Savings (High Risk)',
                data: result.monthlyProgression.map(p => p.minSavings),
                borderColor: '#e53e3e',
                backgroundColor: 'rgba(229, 62, 62, 0.1)',
                borderWidth: 2,
                fill: false,
                borderDash: [5, 5]
              },
              {
                label: 'Maximum Savings (Low Risk)',
                data: result.monthlyProgression.map(p => p.maxSavings),
                borderColor: '#38a169',
                backgroundColor: 'rgba(56, 161, 105, 0.1)',
                borderWidth: 2,
                fill: false,
                borderDash: [10, 5]
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Time (Months)'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Savings Amount ($)'
                },
                ticks: {
                  callback: function(value) {
                    return '$' + value.toLocaleString();
                  }
                }
              }
            },
            plugins: {
              legend: {
                position: 'top',
              },
              title: {
                display: true,
                text: 'Month-on-Month Savings Progression'
              }
            }
          }
        });
        setChart(newChart);
      }
    }

    return () => {
      if (chart) {
        chart.destroy();
      }
    };
  }, [result]);

  if (!result || result.monthlyProgression.length === 0) {
    return React.createElement('div', { className: 'no-data' }, 'No chart data available');
  }

  return React.createElement('div', { className: 'chart-wrapper' },
    React.createElement('canvas', { id: 'survival-chart' })
  );
};

// Detailed Analytics Component
const DetailedAnalytics = ({ result, survivalData }) => {
  if (!result || result.monthlyProgression.length === 0) {
    return null;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (rate) => {
    return (rate * 100).toFixed(2) + '%';
  };

  // Get unique expense and savings names
  const expenseNames = [...new Set(survivalData.expenses.map(e => e.name))];
  const savingsNames = [...new Set(survivalData.savingsPots.map(s => s.name))];

  return React.createElement('div', { className: 'analytics-section' },
    React.createElement('h3', { style: { margin: '30px 0 20px 0', color: '#333', fontSize: '1.3rem' } }, '📊 Detailed Month-by-Month Analytics'),

    // Summary Cards
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' } },
      React.createElement('div', { style: { background: '#f0f8ff', padding: '15px', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea' } }, result.nominalMonths),
        React.createElement('div', { style: { fontSize: '0.9rem', color: '#666' } }, 'Total Months Simulated')
      ),
      React.createElement('div', { style: { background: '#fff5f5', padding: '15px', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#e53e3e' } }, formatCurrency(result.monthlyProgression[result.monthlyProgression.length - 1]?.totalExpenses || 0)),
        React.createElement('div', { style: { fontSize: '0.9rem', color: '#666' } }, 'Final Monthly Expenses')
      ),
      React.createElement('div', { style: { background: '#e0f2fe', padding: '15px', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#0369a1' } }, formatCurrency(survivalData.getTotalExpenses(0))),
        React.createElement('div', { style: { fontSize: '0.9rem', color: '#666' } }, 'Initial Monthly Expenses')
      ),
      React.createElement('div', { style: { background: '#f0fff4', padding: '15px', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#38a169' } }, formatCurrency(result.monthlyProgression[0]?.nominalSavings || 0)),
        React.createElement('div', { style: { fontSize: '0.9rem', color: '#666' } }, 'Starting Savings')
      )
    ),

    // Expense Progression Table
    React.createElement('div', { style: { marginBottom: '40px' } },
      React.createElement('h4', { style: { marginBottom: '15px', color: '#333', fontSize: '1.1rem' } }, '💸 Individual Expense Progression'),
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { background: '#667eea' } },
              React.createElement('th', { style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, 'Month'),
              React.createElement('th', { style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, 'Total Expenses'),
              ...expenseNames.map(name =>
                React.createElement('th', { key: name, style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, name)
              )
            )
          ),
          React.createElement('tbody', null,
            result.monthlyProgression.map((progression, index) => // Show ALL months
              React.createElement('tr', { key: index, style: { borderBottom: '1px solid #e2e8f0' } },
                React.createElement('td', { style: { padding: '10px' } }, progression.month),
                React.createElement('td', { style: { padding: '10px', fontWeight: '600' } }, formatCurrency(progression.totalExpenses)),
                ...expenseNames.map(expenseName =>
                  React.createElement('td', { key: expenseName, style: { padding: '10px' } },
                    formatCurrency(progression.expenseBreakdown[expenseName] || 0)
                  )
                )
              )
            )
          )
        )
      )
    ),

    // Separate Savings Progression Tables for each scenario
    React.createElement('div', { style: { marginBottom: '40px' } },
      React.createElement('h4', { style: { marginBottom: '15px', color: '#333', fontSize: '1.1rem' } }, '💰 Individual Savings Progression'),

      // Nominal Scenario Table
      React.createElement('div', { style: { marginBottom: '30px' } },
        React.createElement('h5', { style: { marginBottom: '10px', color: '#667eea', fontSize: '1rem', fontWeight: '600' } }, '📈 Nominal Scenario (Expected Returns)'),
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } },
            React.createElement('thead', null,
              React.createElement('tr', { style: { background: '#667eea' } },
                React.createElement('th', { style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, 'Month'),
                ...savingsNames.map(name =>
                  React.createElement('th', { key: name, style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, name)
                )
              )
            ),
            React.createElement('tbody', null,
              result.monthlyProgression.map((progression, index) =>
                React.createElement('tr', { key: index, style: { borderBottom: '1px solid #e2e8f0' } },
                  React.createElement('td', { style: { padding: '10px' } }, progression.month),
                  ...savingsNames.map(savingsName =>
                    React.createElement('td', { key: savingsName, style: { padding: '10px' } },
                      formatCurrency(progression.savingsBreakdown.nominal[savingsName] || 0)
                    )
                  )
                )
              )
            )
          )
        )
      ),

      // Minimum Scenario Table
      React.createElement('div', { style: { marginBottom: '30px' } },
        React.createElement('h5', { style: { marginBottom: '10px', color: '#e53e3e', fontSize: '1rem', fontWeight: '600' } }, '📉 Minimum Scenario (High Risk - Poor Returns)'),
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } },
            React.createElement('thead', null,
              React.createElement('tr', { style: { background: '#e53e3e' } },
                React.createElement('th', { style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, 'Month'),
                ...savingsNames.map(name =>
                  React.createElement('th', { key: name, style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, name)
                )
              )
            ),
            React.createElement('tbody', null,
              result.monthlyProgression.map((progression, index) =>
                React.createElement('tr', { key: index, style: { borderBottom: '1px solid #e2e8f0' } },
                  React.createElement('td', { style: { padding: '10px' } }, progression.month),
                  ...savingsNames.map(savingsName =>
                    React.createElement('td', { key: savingsName, style: { padding: '10px' } },
                      formatCurrency(progression.savingsBreakdown.min[savingsName] || 0)
                    )
                  )
                )
              )
            )
          )
        )
      ),

      // Maximum Scenario Table
      React.createElement('div', { style: { marginBottom: '30px' } },
        React.createElement('h5', { style: { marginBottom: '10px', color: '#38a169', fontSize: '1rem', fontWeight: '600' } }, '📊 Maximum Scenario (Low Risk - Strong Returns)'),
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } },
            React.createElement('thead', null,
              React.createElement('tr', { style: { background: '#38a169' } },
                React.createElement('th', { style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, 'Month'),
                ...savingsNames.map(name =>
                  React.createElement('th', { key: name, style: { padding: '12px', color: 'white', textAlign: 'left', fontWeight: '600' } }, name)
                )
              )
            ),
            React.createElement('tbody', null,
              result.monthlyProgression.map((progression, index) =>
                React.createElement('tr', { key: index, style: { borderBottom: '1px solid #e2e8f0' } },
                  React.createElement('td', { style: { padding: '10px' } }, progression.month),
                  ...savingsNames.map(savingsName =>
                    React.createElement('td', { key: savingsName, style: { padding: '10px' } },
                      formatCurrency(progression.savingsBreakdown.max[savingsName] || 0)
                    )
                  )
                )
              )
            )
          )
        )
      )
    ),

    // Key Metrics Summary
    React.createElement('div', { style: { background: '#f7fafc', padding: '20px', borderRadius: '8px', marginTop: '30px' } },
      React.createElement('h4', { style: { marginBottom: '15px', color: '#333', fontSize: '1.1rem' } }, '📈 Key Metrics Summary'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' } },
        React.createElement('div', null,
          React.createElement('strong', null, 'Initial Setup:'),
          React.createElement('ul', { style: { marginTop: '8px', paddingLeft: '20px' } },
            ...survivalData.expenses.map(expense =>
              React.createElement('li', { key: expense.name },
                `${expense.name}: ${formatCurrency(expense.amount)}/month (${formatPercent(expense.inflationRate)} inflation)`
              )
            ),
            ...survivalData.savingsPots.map(pot =>
              React.createElement('li', { key: pot.name },
                `${pot.name}: ${formatCurrency(pot.amount)} (${formatPercent(pot.interestRate)} interest, ${formatPercent(pot.riskRate)} risk)`
              )
            )
          )
        ),
        React.createElement('div', null,
          React.createElement('strong', null, 'Final Results:'),
          React.createElement('ul', { style: { marginTop: '8px', paddingLeft: '20px' } },
            React.createElement('li', null, `Nominal survival: ${result.nominalMonths} months`),
            React.createElement('li', null, `Pessimistic survival: ${result.minMonths} months`),
            React.createElement('li', null, `Optimistic survival: ${result.maxMonths} months`),
            React.createElement('li', null, `Risk range: ${(result.maxMonths - result.minMonths)} months`)
          )
        )
      )
    )
  );
};

// Main App Component
const App = () => {
  const [survivalData, setSurvivalData] = useState(new SurvivalData());
  const [result, setResult] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSavingsPot, setEditingSavingsPot] = useState(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadedData = SurvivalData.loadFromLocalStorage();
    if (loadedData) {
      setSurvivalData(loadedData);
    }
  }, []);

  // Auto-calculate when data changes
  useEffect(() => {
    if (survivalData.expenses.length > 0 && survivalData.savingsPots.length > 0) {
      try {
        const calculationResult = survivalData.calculateSurvival();
        setResult(calculationResult);
      } catch (error) {
        console.error('Auto-calculation error:', error);
        setResult(null);
      }
    } else {
      setResult(null);
    }
  }, [survivalData]);

  const handleAddExpense = (expenseData) => {
    try {
      const expense = new Expense(expenseData.name, expenseData.amount, expenseData.inflationRate);
      const newSurvivalData = survivalData.addExpense(expense);
      setSurvivalData(newSurvivalData);
      setEditingExpense(null);
    } catch (error) {
      alert('Error adding expense: ' + error.message);
    }
  };

  const handleEditExpense = (index) => {
    const expense = survivalData.expenses[index];
    setEditingExpense({
      index,
      name: expense.name,
      amount: expense.amount.toString(),
      inflationRate: (expense.inflationRate * 100).toString()
    });
  };

  const handleUpdateExpense = (expenseData) => {
    try {
      const expense = new Expense(expenseData.name, expenseData.amount, expenseData.inflationRate);
      const newSurvivalData = survivalData.removeExpense(editingExpense.index).addExpense(expense);
      setSurvivalData(newSurvivalData);
      setEditingExpense(null);
    } catch (error) {
      alert('Error updating expense: ' + error.message);
    }
  };

  const handleRemoveExpense = (index) => {
    try {
      const newSurvivalData = survivalData.removeExpense(index);
      setSurvivalData(newSurvivalData);
    } catch (error) {
      alert('Error removing expense: ' + error.message);
    }
  };

  const handleAddSavingsPot = (savingsData) => {
    try {
      const savingsPot = new SavingsPot(savingsData.name, savingsData.amount, savingsData.interestRate, savingsData.riskRate);
      const newSurvivalData = survivalData.addSavingsPot(savingsPot);
      setSurvivalData(newSurvivalData);
      setEditingSavingsPot(null);
    } catch (error) {
      alert('Error adding savings pot: ' + error.message);
    }
  };

  const handleEditSavingsPot = (index) => {
    const pot = survivalData.savingsPots[index];
    setEditingSavingsPot({
      index,
      name: pot.name,
      amount: pot.amount.toString(),
      interestRate: (pot.interestRate * 100).toString(),
      riskRate: (pot.riskRate * 100).toString()
    });
  };

  const handleUpdateSavingsPot = (savingsData) => {
    try {
      const savingsPot = new SavingsPot(savingsData.name, savingsData.amount, savingsData.interestRate, savingsData.riskRate);
      const newSurvivalData = survivalData.removeSavingsPot(editingSavingsPot.index).addSavingsPot(savingsPot);
      setSurvivalData(newSurvivalData);
      setEditingSavingsPot(null);
    } catch (error) {
      alert('Error updating savings pot: ' + error.message);
    }
  };

  const handleRemoveSavingsPot = (index) => {
    try {
      const newSurvivalData = survivalData.removeSavingsPot(index);
      setSurvivalData(newSurvivalData);
    } catch (error) {
      alert('Error removing savings pot: ' + error.message);
    }
  };

  const formatLastCalculated = () => {
    if (!survivalData.lastCalculated) return '';
    return `Last calculated: ${new Date(survivalData.lastCalculated).toLocaleString()}`;
  };

  return React.createElement('div', null,
    React.createElement('div', { className: 'calculator-grid' },
      React.createElement('div', { className: 'section' },
        React.createElement('h2', null, '📉 Monthly Expenses'),
        editingExpense ?
          React.createElement(ExpenseForm, { onAdd: handleUpdateExpense, initialData: editingExpense }) :
          React.createElement(ExpenseForm, { onAdd: handleAddExpense }),
        React.createElement(ExpenseList, {
          expenses: survivalData.expenses,
          onRemove: handleRemoveExpense,
          onEdit: handleEditExpense
        })
      ),
      React.createElement('div', { className: 'section' },
        React.createElement('h2', null, '💰 Savings Pots'),
        editingSavingsPot ?
          React.createElement(SavingsPotForm, { onAdd: handleUpdateSavingsPot, initialData: editingSavingsPot }) :
          React.createElement(SavingsPotForm, { onAdd: handleAddSavingsPot }),
        React.createElement(SavingsPotList, {
          savingsPots: survivalData.savingsPots,
          onRemove: handleRemoveSavingsPot,
          onEdit: handleEditSavingsPot
        })
      )
    ),
    React.createElement('div', { className: 'section results-section' },
      React.createElement('h2', null, '📊 Survival Results'),
      React.createElement('div', { style: { textAlign: 'center', marginBottom: '20px', color: '#666', fontSize: '0.9rem' } },
        'Results update automatically when you add, edit, or remove items'
      ),
      React.createElement(ResultsDisplay, { result })
    ),
    result && React.createElement('div', { className: 'chart-container' },
      React.createElement('h2', null, '📈 Savings Progression Chart'),
      React.createElement(SurvivalChart, { result })
    ),
    React.createElement(DetailedAnalytics, { result, survivalData }),
    React.createElement('div', { className: 'last-calculated' }, formatLastCalculated())
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(App));
