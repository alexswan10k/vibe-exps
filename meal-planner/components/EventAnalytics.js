// Shared Event Analytics Components
// Handles chart creation and analytics data processing

const AnalyticsCharts = ({ logEntries, ingredientsData }) => {
    const chartRefs = React.useRef({
        actionTypes: null,
        ingredientConsumption: null,
        dailyActivity: null,
        dailyCalories: null,
        dailyVitamins: null
    });

    // Get basic nutrition data for an ingredient
    const getBasicNutritionData = (ingredientName) => {
        const ingData = ingredientsData[ingredientName.toLowerCase()];
        if (ingData && ingData.vitamins) {
            // Convert from boolean vitamins to the expected format
            return {
                calories: 0, // We don't have calorie data in ingredientsData, but we can estimate
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber: 0,
                vitamins: ingData.vitamins
            };
        }
        return null;
    };

    // Generate analytics data
    const generateAnalyticsData = () => {
        const recipeFrequency = {};
        const ingredientConsumption = {};
        const nutrientConsumption = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        const dailyActivity = {};
        const dailyVitaminConsumption = {}; // Track vitamins and calories per day

        logEntries.forEach(entry => {
            // Track recipe cooking frequency
            if (entry.action === 'cook') {
                recipeFrequency[entry.details.recipeName] = (recipeFrequency[entry.details.recipeName] || 0) + 1;

                const date = new Date(entry.timestamp).toDateString();
                if (!dailyVitaminConsumption[date]) {
                    dailyVitaminConsumption[date] = {
                        calories: 0,
                        vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0,
                        vitaminK1: 0, vitaminK2: 0, vitaminB12: 0, folate: 0
                    };
                }

                // Track ingredient consumption with nutritional data
                entry.details.ingredientsConsumed.forEach(ing => {
                    ingredientConsumption[ing.name] = (ingredientConsumption[ing.name] || 0) + ing.quantity;

                    // Add nutritional data if available
                    const nutritionData = getBasicNutritionData(ing.name);
                    if (nutritionData) {
                        // For now, just track vitamin consumption
                        dailyVitaminConsumption[date].calories += nutritionData.calories * ing.quantity;
                        if (nutritionData.vitamins) {
                            dailyVitaminConsumption[date].vitaminA += nutritionData.vitamins.vitaminA ? ing.quantity : 0;
                            dailyVitaminConsumption[date].vitaminC += nutritionData.vitamins.vitaminC ? ing.quantity : 0;
                            dailyVitaminConsumption[date].vitaminD += nutritionData.vitamins.vitaminD ? ing.quantity : 0;
                            dailyVitaminConsumption[date].vitaminE += nutritionData.vitamins.vitaminE ? ing.quantity : 0;
                            dailyVitaminConsumption[date].vitaminK1 += nutritionData.vitamins.vitaminK1 ? ing.quantity : 0;
                            dailyVitaminConsumption[date].vitaminK2 += nutritionData.vitamins.vitaminK2 ? ing.quantity : 0;
                            dailyVitaminConsumption[date].vitaminB12 += nutritionData.vitamins.vitaminB12 ? ing.quantity : 0;
                            dailyVitaminConsumption[date].folate += nutritionData.vitamins.folate ? ing.quantity : 0;
                        }
                    }
                });
            }

            // Track daily activity
            const date = new Date(entry.timestamp).toDateString();
            dailyActivity[date] = (dailyActivity[date] || 0) + 1;
        });

        return { recipeFrequency, ingredientConsumption, nutrientConsumption, dailyActivity, dailyVitaminConsumption };
    };

    const analytics = generateAnalyticsData();

    React.useEffect(() => {
        // Destroy existing charts
        Object.values(chartRefs.current).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });

        // Most cooked recipes chart
        const recipeCtx = document.getElementById('actionTypesChart');
        if (recipeCtx && Object.keys(analytics.recipeFrequency).length > 0) {
            const topRecipes = Object.entries(analytics.recipeFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);

            chartRefs.current.actionTypes = new Chart(recipeCtx, {
                type: 'bar',
                data: {
                    labels: topRecipes.map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name),
                    datasets: [{
                        label: 'Times Cooked',
                        data: topRecipes.map(([, count]) => count),
                        backgroundColor: '#27ae60',
                        borderColor: '#229954',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Nutrient consumption chart (placeholder - would need actual nutrient data)
        const nutrientCtx = document.getElementById('ingredientConsumptionChart');
        if (nutrientCtx) {
            // For now, show ingredient consumption instead
            const topIngredients = Object.entries(analytics.ingredientConsumption)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);

            chartRefs.current.ingredientConsumption = new Chart(nutrientCtx, {
                type: 'bar',
                data: {
                    labels: topIngredients.map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name),
                    datasets: [{
                        label: 'Total Consumed',
                        data: topIngredients.map(([, count]) => count),
                        backgroundColor: '#3498db',
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Daily activity chart
        const dailyCtx = document.getElementById('dailyActivityChart');
        if (dailyCtx && Object.keys(analytics.dailyActivity).length > 0) {
            const sortedDays = Object.entries(analytics.dailyActivity)
                .sort(([a], [b]) => new Date(a) - new Date(b));

            chartRefs.current.dailyActivity = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: sortedDays.map(([date]) => new Date(date).toLocaleDateString()),
                    datasets: [{
                        label: 'Activities',
                        data: sortedDays.map(([, count]) => count),
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Daily calories line chart (placeholder)
        const caloriesCtx = document.getElementById('dailyCaloriesChart');
        if (caloriesCtx && Object.keys(analytics.dailyVitaminConsumption).length > 0) {
            const sortedDays = Object.entries(analytics.dailyVitaminConsumption)
                .sort(([a], [b]) => new Date(a) - new Date(b))
                .slice(-7); // Show last 7 days

            chartRefs.current.dailyCalories = new Chart(caloriesCtx, {
                type: 'line',
                data: {
                    labels: sortedDays.map(([date]) => new Date(date).toLocaleDateString()),
                    datasets: [{
                        label: 'Calories Consumed',
                        data: sortedDays.map(([, dayData]) => dayData.calories),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#e74c3c',
                        pointBorderColor: '#c0392b',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Daily vitamins stacked bar chart
        const vitaminsCtx = document.getElementById('dailyVitaminsChart');
        if (vitaminsCtx && Object.keys(analytics.dailyVitaminConsumption).length > 0) {
            const sortedDays = Object.entries(analytics.dailyVitaminConsumption)
                .sort(([a], [b]) => new Date(a) - new Date(b))
                .slice(-7); // Show last 7 days

            chartRefs.current.dailyVitamins = new Chart(vitaminsCtx, {
                type: 'bar',
                data: {
                    labels: sortedDays.map(([date]) => new Date(date).toLocaleDateString()),
                    datasets: [
                        {
                            label: 'Vitamin A',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminA),
                            backgroundColor: '#f39c12',
                            borderColor: '#e67e22',
                            borderWidth: 1
                        },
                        {
                            label: 'Vitamin C',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminC),
                            backgroundColor: '#27ae60',
                            borderColor: '#229954',
                            borderWidth: 1
                        },
                        {
                            label: 'Vitamin D',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminD),
                            backgroundColor: '#3498db',
                            borderColor: '#2980b9',
                            borderWidth: 1
                        },
                        {
                            label: 'Vitamin E',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminE),
                            backgroundColor: '#9b59b6',
                            borderColor: '#8e44ad',
                            borderWidth: 1
                        },
                        {
                            label: 'Vitamin K1',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminK1),
                            backgroundColor: '#e67e22',
                            borderColor: '#d35400',
                            borderWidth: 1
                        },
                        {
                            label: 'Vitamin K2',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminK2),
                            backgroundColor: '#16a085',
                            borderColor: '#138f7a',
                            borderWidth: 1
                        },
                        {
                            label: 'Vitamin B12',
                            data: sortedDays.map(([, dayData]) => dayData.vitaminB12),
                            backgroundColor: '#8e44ad',
                            borderColor: '#7d3c98',
                            borderWidth: 1
                        },
                        {
                            label: 'Folate',
                            data: sortedDays.map(([, dayData]) => dayData.folate),
                            backgroundColor: '#d35400',
                            borderColor: '#a04000',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                }
            });
        }

        // Cleanup function
        return () => {
            Object.values(chartRefs.current).forEach(chart => {
                if (chart) {
                    chart.destroy();
                }
            });
        };
    }, [logEntries, ingredientsData]);

    return React.createElement('div', { className: 'analytics-section' },
        React.createElement('div', { className: 'chart-container' },
            React.createElement('h3', null, 'Most Cooked Recipes'),
            React.createElement('canvas', { id: 'actionTypesChart' })
        ),
        React.createElement('div', { className: 'chart-container' },
            React.createElement('h3', null, 'Top Ingredients Consumed'),
            React.createElement('canvas', { id: 'ingredientConsumptionChart' })
        ),
        React.createElement('div', { className: 'chart-container' },
            React.createElement('h3', null, 'Daily Activity'),
            React.createElement('canvas', { id: 'dailyActivityChart' })
        ),

        React.createElement('div', { className: 'analytics-section-four' },
            React.createElement('div', { className: 'chart-container' },
                React.createElement('h3', null, 'Daily Calories'),
                React.createElement('canvas', { id: 'dailyCaloriesChart' })
            ),
            React.createElement('div', { className: 'chart-container' },
                React.createElement('h3', null, 'Daily Vitamins'),
                React.createElement('canvas', { id: 'dailyVitaminsChart' })
            )
        )
    );
};

window.EventAnalyticsComponents = { AnalyticsCharts };
