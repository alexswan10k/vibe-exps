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
    const [insideAnnualRate, setInsideAnnualRate] = useState(110000);
    const [sameRate, setSameRate] = useState(true);
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

    // Keep inside rate in sync with daily rate if 'sameRate' is true
    useEffect(() => {
        if (sameRate) {
            setInsideAnnualRate((parseFloat(dailyRate) || 0) * (parseFloat(daysWorked) || 0));
        }
    }, [dailyRate, daysWorked, sameRate]);

    // Calculate whenever inputs change
    useEffect(() => {
        calculate();
    }, [dailyRate, insideAnnualRate, sameRate, daysWorked, annualExpenses, pensionContribution, targetSalary, targetDividend, takeAllProfit, projectionYears, interestRate]);

    const calculate = () => {
        const calc = calcRef.current;

        // Ensure numbers
        const rate = parseFloat(dailyRate) || 0;
        const inAnnual = parseFloat(insideAnnualRate) || 0;
        const days = parseFloat(daysWorked) || 0;
        const expenses = parseFloat(annualExpenses) || 0;
        const pension = parseFloat(pensionContribution) || 0;
        const salary = parseFloat(targetSalary) || 0;
        const dividend = takeAllProfit ? null : (parseFloat(targetDividend) || 0);

        const insideAnnualRevenue = sameRate ? (rate * days) : inAnnual;
        const inside = calc.calculateInside(insideAnnualRevenue, expenses, pension);
        const outside = calc.calculateOutside(rate, days, expenses, pension, salary, dividend);

        setInsideResult(inside);
        setOutsideResult(outside);

        // Project Retained Profit & Take Home Difference
        const years = parseInt(projectionYears) || 5;
        const interest = (parseFloat(interestRate) || 0) / 100;
        const annualAddition = outside.retainedProfit;

        const projection = calc.projectRetainedProfit(0, years, interest, annualAddition);

        // Add cumulative take home difference to projection data
        const takeHomeDifference = outside.takeHome - inside.takeHome;
        let cumulativeDifference = 0;
        projection.forEach(p => {
            cumulativeDifference += takeHomeDifference;
            p.cumulativeTakeHomeDiff = cumulativeDifference;
        });

        setProjectionData(projection);
    };

    return React.createElement('div', null,
        React.createElement('div', { className: 'calculator-grid' },
            // Contract Details Section
            React.createElement('div', { className: 'section' },
                React.createElement('h2', null, '📋 Contract Details'),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Outside IR35 Rate (£/day)'),
                    React.createElement('input', {
                        type: 'number',
                        value: dailyRate,
                        onChange: (e) => setDailyRate(e.target.value),
                        min: 0,
                        step: 50
                    })
                ),
                React.createElement('div', { className: 'form-group', style: { padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' } },
                    React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px', fontWeight: 'normal' } },
                        React.createElement('input', {
                            type: 'checkbox',
                            checked: sameRate,
                            onChange: (e) => setSameRate(e.target.checked),
                            style: { width: 'auto' }
                        }),
                        'Inside IR35 rate is the same'
                    ),
                    !sameRate && React.createElement('div', { style: { marginTop: '10px' } },
                        React.createElement('label', { style: { fontSize: '0.9rem' } }, 'Inside IR35 / Perm Salary (£/year)'),
                        React.createElement('input', {
                            type: 'number',
                            value: insideAnnualRate,
                            onChange: (e) => setInsideAnnualRate(e.target.value),
                            min: 0,
                            step: 1000
                        })
                    )
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

        // Projection Summary & Charts
        React.createElement('div', { className: 'chart-container' },
            React.createElement('h2', null, '📈 Multi-Year Projection'),
            projectionData && projectionData.length > 0 && React.createElement('div', { className: 'projection-summary', style: { backgroundColor: '#f0f4f8', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #cbd5e0' } },
                React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '1.1rem' } },
                    `After `, React.createElement('strong', null, `${projectionYears} years`), `, by retaining `,
                    React.createElement('strong', null, formatCurrency(outsideResult?.retainedProfit || 0)),
                    ` annually with a `, React.createElement('strong', null, `${interestRate}%`), ` expected return:`
                ),
                React.createElement('div', { style: { display: 'flex', gap: '20px', flexWrap: 'wrap' } },
                    React.createElement('div', null,
                        React.createElement('div', { style: { fontSize: '0.9rem', color: '#4a5568' } }, 'Total Retained Balance'),
                        React.createElement('div', { style: { fontSize: '1.4rem', fontWeight: 'bold', color: '#2b6cb0' } }, formatCurrency(projectionData[projectionData.length - 1].endBalance))
                    ),
                    React.createElement('div', null,
                        React.createElement('div', { style: { fontSize: '0.9rem', color: '#4a5568' } }, 'Total Interest Earned'),
                        React.createElement('div', { style: { fontSize: '1.4rem', fontWeight: 'bold', color: '#38a169' } }, formatCurrency(projectionData[projectionData.length - 1].endBalance - (projectionData[0].addition * projectionYears)))
                    )
                )
            ),

            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '30px' } },
                React.createElement('div', null,
                    React.createElement('h3', { style: { fontSize: '1.1rem', marginBottom: '10px', color: '#2d3748' } }, 'Retained Profit Compound Growth'),
                    React.createElement(RetainedProfitChart, { projectionData })
                ),
                React.createElement('div', null,
                    React.createElement('h3', { style: { fontSize: '1.1rem', marginBottom: '10px', color: '#2d3748' } }, 'Cumulative Take Home Difference (Outside vs Inside)'),
                    React.createElement(TakeHomeDiffChart, { projectionData })
                )
            )
        )
    );
};

// Retained Profit Chart Component
const RetainedProfitChart = ({ projectionData }) => {
    const chartRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!projectionData || projectionData.length === 0 || !canvasRef.current) return;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const labels = projectionData.map(d => `Year ${d.year}`);

        // Calculate total contributions vs interest vs take home diff
        const contributions = projectionData.map(d => d.addition * d.year);
        const interestEarned = projectionData.map(d => d.endBalance - (d.addition * d.year));

        chartRef.current = new Chart(canvasRef.current, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Principal (Retained Profit Added)',
                        data: contributions,
                        backgroundColor: '#3182ce',
                    },
                    {
                        type: 'bar',
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
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Amount (£)'
                        },
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

// Take Home Diff Chart Component
const TakeHomeDiffChart = ({ projectionData }) => {
    const chartRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!projectionData || projectionData.length === 0 || !canvasRef.current) return;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const labels = projectionData.map(d => `Year ${d.year}`);
        const cumulativeTakeHomeDiff = projectionData.map(d => d.cumulativeTakeHomeDiff);

        chartRef.current = new Chart(canvasRef.current, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cumulative Take Home Difference (£)',
                        data: cumulativeTakeHomeDiff,
                        borderColor: '#e53e3e',
                        backgroundColor: 'rgba(229, 62, 62, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: '#e53e3e',
                        pointRadius: 4,
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Amount (£)'
                        },
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
