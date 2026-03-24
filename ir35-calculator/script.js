const { useState, useEffect, useRef } = React;

// Format currency helper
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0
    }).format(amount);
};

// Main App Component
const App = () => {
    // Calculator instance
    const calcRef = useRef(new IR35Calculator());

    // Input States
    const [dailyRate, setDailyRate] = useState(500);
    const [daysWorked, setDaysWorked] = useState(220); // typical working days in a year
    const [annualExpenses, setAnnualExpenses] = useState(2000);
    const [pensionContribution, setPensionContribution] = useState(0);
    const [targetSalary, setTargetSalary] = useState(12570); // Optimum salary for 24/25
    const [targetDividend, setTargetDividend] = useState(40000); // Set a target, or leave blank to take all
    const [takeAllProfit, setTakeAllProfit] = useState(false);

    // Projection States
    const [projectionYears, setProjectionYears] = useState(5);
    const [interestRate, setInterestRate] = useState(5); // 5% expected return

    // Result States
    const [insideResult, setInsideResult] = useState(null);
    const [outsideResult, setOutsideResult] = useState(null);
    const [projectionData, setProjectionData] = useState(null);

    // Calculate whenever inputs change
    useEffect(() => {
        calculate();
    }, [dailyRate, daysWorked, annualExpenses, pensionContribution, targetSalary, targetDividend, takeAllProfit, projectionYears, interestRate]);

    const calculate = () => {
        const calc = calcRef.current;

        // Ensure numbers
        const rate = parseFloat(dailyRate) || 0;
        const days = parseFloat(daysWorked) || 0;
        const expenses = parseFloat(annualExpenses) || 0;
        const pension = parseFloat(pensionContribution) || 0;
        const salary = parseFloat(targetSalary) || 0;
        const dividend = takeAllProfit ? null : (parseFloat(targetDividend) || 0);

        const inside = calc.calculateInside(rate, days, expenses, pension);
        const outside = calc.calculateOutside(rate, days, expenses, pension, salary, dividend);

        setInsideResult(inside);
        setOutsideResult(outside);

        // Project Retained Profit
        const years = parseInt(projectionYears) || 5;
        const interest = (parseFloat(interestRate) || 0) / 100;
        const annualAddition = outside.retainedProfit;

        const projection = calc.projectRetainedProfit(0, years, interest, annualAddition);
        setProjectionData(projection);
    };

    return React.createElement('div', null,
        React.createElement('div', { className: 'calculator-grid' },
            // Contract Details Section
            React.createElement('div', { className: 'section' },
                React.createElement('h2', null, '📋 Contract Details'),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Daily Rate (£)'),
                    React.createElement('input', {
                        type: 'number',
                        value: dailyRate,
                        onChange: (e) => setDailyRate(e.target.value),
                        min: 0,
                        step: 50
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Days Worked per Year'),
                    React.createElement('input', {
                        type: 'number',
                        value: daysWorked,
                        onChange: (e) => setDaysWorked(e.target.value),
                        min: 0,
                        max: 365
                    }),
                    React.createElement('div', { style: { fontSize: '0.8rem', color: '#666', marginTop: '4px' } },
                        'Typical: 220 days (accounting for weekends, bank holidays, and leave)'
                    )
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Annual Allowable Expenses (£)'),
                    React.createElement('input', {
                        type: 'number',
                        value: annualExpenses,
                        onChange: (e) => setAnnualExpenses(e.target.value),
                        min: 0,
                        step: 500
                    })
                ),
                React.createElement('div', { className: 'form-group', style: { padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '8px', border: '1px solid #cbd5e0' } },
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } },
                        React.createElement('label', { style: { margin: 0, fontWeight: 600, color: '#2b5876' } }, 'Annual Pension Contribution'),
                        React.createElement('span', { style: { fontSize: '1.2rem', fontWeight: 700, color: '#2b5876' } }, formatCurrency(pensionContribution))
                    ),
                    React.createElement('input', {
                        type: 'range',
                        min: 0,
                        max: 60000,
                        step: 1000,
                        value: pensionContribution,
                        onChange: (e) => setPensionContribution(e.target.value),
                        style: { width: '100%', cursor: 'pointer', accentColor: '#2b5876' }
                    }),
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', marginTop: '5px' } },
                        React.createElement('span', null, '£0'),
                        React.createElement('span', null, '£60,000 Allowance')
                    ),
                    React.createElement('div', { style: { fontSize: '0.85rem', color: '#4a5568', marginTop: '10px', fontStyle: 'italic' } },
                        '💡 Pre-profit deduction. Extremely effective at reducing Corporation Tax, especially when avoiding the 26.5% marginal rate between £50k and £250k profit.'
                    )
                )
            ),

            // Outside IR35 Strategy Section
            React.createElement('div', { className: 'section' },
                React.createElement('h2', null, '🎯 Outside IR35 Strategy'),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Target Annual Salary (£)'),
                    React.createElement('input', {
                        type: 'number',
                        value: targetSalary,
                        onChange: (e) => setTargetSalary(e.target.value),
                        min: 0,
                        step: 100
                    }),
                    React.createElement('div', { style: { fontSize: '0.8rem', color: '#666', marginTop: '4px' } },
                        'Optimum for 2024/25 is usually £12,570 (Personal Allowance)'
                    )
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: takeAllProfit,
                            onChange: (e) => setTakeAllProfit(e.target.checked),
                            style: { width: 'auto' }
                        }),
                        'Take all available profit as dividends'
                    )
                ),
                !takeAllProfit && React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Target Annual Dividends (£)'),
                    React.createElement('input', {
                        type: 'number',
                        value: targetDividend,
                        onChange: (e) => setTargetDividend(e.target.value),
                        min: 0,
                        step: 1000
                    }),
                    React.createElement('div', { style: { fontSize: '0.8rem', color: '#666', marginTop: '4px' } },
                        'Limit dividends to avoid higher tax brackets and retain profit in the company.'
                    )
                ),
                React.createElement('hr', { style: { margin: '20px 0', border: 'none', borderTop: '1px solid #eee' } }),
                React.createElement('h3', { style: { fontSize: '1.1rem', marginBottom: '15px', color: '#444' } }, 'Company Retention Projection'),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Projection Years'),
                    React.createElement('input', {
                        type: 'number',
                        value: projectionYears,
                        onChange: (e) => setProjectionYears(e.target.value),
                        min: 1,
                        max: 30
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Expected Annual Return on Retained Profit (%)'),
                    React.createElement('input', {
                        type: 'number',
                        value: interestRate,
                        onChange: (e) => setInterestRate(e.target.value),
                        min: 0,
                        step: 0.5
                    })
                )
            )
        ),

        // Headline Results
        React.createElement('div', { className: 'section results-section' },
            React.createElement('h2', null, '💰 Annual Take Home Pay'),
            React.createElement('div', { className: 'results-grid' },
                React.createElement('div', { className: 'result-card inside' },
                    React.createElement('div', { className: 'result-label' }, 'Inside IR35'),
                    React.createElement('div', { className: 'result-value' }, insideResult ? formatCurrency(insideResult.takeHome) : '£0'),
                    React.createElement('div', { className: 'result-sub' }, insideResult ? `${(insideResult.retentionRate * 100).toFixed(1)}% Retention` : '')
                ),
                React.createElement('div', { className: 'result-card outside' },
                    React.createElement('div', { className: 'result-label' }, 'Outside IR35'),
                    React.createElement('div', { className: 'result-value' }, outsideResult ? formatCurrency(outsideResult.takeHome) : '£0'),
                    React.createElement('div', { className: 'result-sub' }, outsideResult ? `${(outsideResult.retentionRate * 100).toFixed(1)}% Retention` : '')
                ),
                React.createElement('div', { className: 'result-card highlight' },
                    React.createElement('div', { className: 'result-label' }, 'Retained in Company'),
                    React.createElement('div', { className: 'result-value' }, outsideResult ? formatCurrency(outsideResult.retainedProfit) : '£0'),
                    React.createElement('div', { className: 'result-sub' }, 'Available for future extraction/investment')
                )
            )
        ),

        // Detailed Breakdown Tables
        React.createElement('div', { className: 'calculator-grid', style: { marginBottom: '40px' } },
            // Inside IR35 Breakdown
            React.createElement('div', { className: 'section' },
                React.createElement('h3', { style: { color: '#e53e3e', marginBottom: '15px' } }, 'Inside IR35 Breakdown (Umbrella)'),
                insideResult && React.createElement('table', { className: 'breakdown-table' },
                    React.createElement('tbody', null,
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Gross Revenue'),
                            React.createElement('td', null, formatCurrency(insideResult.grossRevenue))
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Expenses & Pension'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency((parseFloat(annualExpenses)||0) + (parseFloat(pensionContribution)||0))}`)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Umbrella Emp. NI Deduction'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(insideResult.employerNI)}`)
                        ),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', null, 'Gross Salary'),
                            React.createElement('td', null, formatCurrency(insideResult.grossSalary))
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Income Tax'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(insideResult.incomeTax)}`)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Employee NI'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(insideResult.employeeNI)}`)
                        ),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', { style: { color: '#e53e3e' } }, 'Net Take Home'),
                            React.createElement('td', { style: { color: '#e53e3e' } }, formatCurrency(insideResult.takeHome))
                        )
                    )
                )
            ),

            // Outside IR35 Breakdown
            React.createElement('div', { className: 'section' },
                React.createElement('h3', { style: { color: '#38a169', marginBottom: '15px' } }, 'Outside IR35 Breakdown (Ltd Co)'),
                outsideResult && React.createElement('table', { className: 'breakdown-table' },
                    React.createElement('tbody', null,
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Gross Revenue'),
                            React.createElement('td', null, formatCurrency(outsideResult.grossRevenue))
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Expenses & Pension'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency((parseFloat(annualExpenses)||0) + (parseFloat(pensionContribution)||0))}`)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Salary (Deductible)'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.salary)}`)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Employer NI'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.employerNI)}`)
                        ),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', null, 'Company Profit (Pre-tax)'),
                            React.createElement('td', null, formatCurrency(outsideResult.companyProfit))
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null,
                                'Corporation Tax ',
                                outsideResult.companyProfit > 0 && React.createElement('span', { style: { fontSize: '0.8rem', color: '#666' } },
                                    `(~${((outsideResult.corporationTax / outsideResult.companyProfit) * 100).toFixed(1)}%)`
                                )
                            ),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.corporationTax)}`)
                        ),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', null, 'Distributable Profit'),
                            React.createElement('td', null, formatCurrency(outsideResult.distributableProfit))
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Dividends Taken'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.dividends)}`)
                        ),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', { style: { color: '#3182ce' } }, 'Retained Profit'),
                            React.createElement('td', { style: { color: '#3182ce' } }, formatCurrency(outsideResult.retainedProfit))
                        ),
                        React.createElement('tr', { style: { height: '10px' } }, React.createElement('td', { colSpan: 2 })),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', null, 'Personal Tax Breakdown'),
                            React.createElement('td', null)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Income Tax (on Salary)'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.incomeTax)}`)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Employee NI (on Salary)'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.employeeNI)}`)
                        ),
                        React.createElement('tr', null,
                            React.createElement('td', null, 'Dividend Tax'),
                            React.createElement('td', { className: 'negative' }, `-${formatCurrency(outsideResult.dividendTax)}`)
                        ),
                        React.createElement('tr', { className: 'total-row' },
                            React.createElement('td', { style: { color: '#38a169' } }, 'Net Take Home (Salary + Divs - Taxes)'),
                            React.createElement('td', { style: { color: '#38a169' } }, formatCurrency(outsideResult.takeHome))
                        )
                    )
                )
            )
        ),

        // Projection Chart
        React.createElement('div', { className: 'chart-container' },
            React.createElement('h2', null, '📈 Retained Profit Compound Growth'),
            React.createElement('p', { style: { marginBottom: '20px', color: '#666' } },
                `Projecting ${formatCurrency(outsideResult?.retainedProfit || 0)} added annually with a ${interestRate}% expected return (net of corporation tax on interest).`
            ),
            React.createElement(RetainedProfitChart, { projectionData })
        )
    );
};

// Chart Component
const RetainedProfitChart = ({ projectionData }) => {
    const chartRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!projectionData || projectionData.length === 0 || !canvasRef.current) return;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const labels = projectionData.map(d => `Year ${d.year}`);
        const dataPoints = projectionData.map(d => d.endBalance);

        // Calculate total contributions vs interest
        const contributions = projectionData.map(d => d.addition * d.year);
        const interestEarned = projectionData.map(d => d.endBalance - (d.addition * d.year));

        chartRef.current = new Chart(canvasRef.current, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Principal (Retained Profit Added)',
                        data: contributions,
                        backgroundColor: '#3182ce',
                    },
                    {
                        label: 'Compound Interest (Net of Tax)',
                        data: interestEarned,
                        backgroundColor: '#48bb78',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            callback: function(value) {
                                return '£' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [projectionData]);

    return React.createElement('div', { className: 'chart-wrapper' },
        React.createElement('canvas', { ref: canvasRef })
    );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(App));
