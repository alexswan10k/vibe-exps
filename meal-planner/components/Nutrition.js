/**
 * @param {Object} props
 * @param {Recipe[]} props.recipes
 * @param {Calendar} props.calendar
 * @param {Function} props.getRecipeById
 * @param {Object} props.ingredientsData
 */
function Nutrition({ recipes, calendar, getRecipeById, ingredientsData }) {
    const calculateRecipeNutrition = (recipe) => {
        // Start with recipe's own nutritional data if available
        let nutrition = recipe.nutritional || { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: {}, minerals: {} };

        // Initialize vitamins and minerals if not present
        if (!nutrition.vitamins) nutrition.vitamins = {};
        if (!nutrition.minerals) nutrition.minerals = {};

        // Calculate from ingredients if available
        if (recipe.ingredients && ingredientsData) {
            recipe.ingredients.forEach(ing => {
                const ingData = ingredientsData[ing.name];
                if (ingData) {
                    // Aggregate vitamins (OR logic - if any ingredient has it, recipe has it)
                    if (ingData.vitamins) {
                        Object.keys(ingData.vitamins).forEach(vitamin => {
                            if (ingData.vitamins[vitamin]) {
                                nutrition.vitamins[vitamin] = true;
                            }
                        });
                    }
                    // Aggregate minerals (OR logic - if any ingredient has it, recipe has it)
                    if (ingData.minerals) {
                        Object.keys(ingData.minerals).forEach(mineral => {
                            if (ingData.minerals[mineral]) {
                                nutrition.minerals[mineral] = true;
                            }
                        });
                    }
                }
            });
        }

        // Ensure all vitamin and mineral keys exist with default false values
        const allVitamins = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
        const allMinerals = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];

        allVitamins.forEach(vitamin => {
            if (nutrition.vitamins[vitamin] === undefined) {
                nutrition.vitamins[vitamin] = false;
            }
        });

        allMinerals.forEach(mineral => {
            if (nutrition.minerals[mineral] === undefined) {
                nutrition.minerals[mineral] = false;
            }
        });

        return nutrition;
    };

    const dayNutrition = Object.keys(calendar).map(day => {
        const recipeId = calendar[day];
        if (!recipeId) return { day, nutrition: null };
        const recipe = getRecipeById(recipeId);
        if (!recipe) return { day, nutrition: null };
        return { day, nutrition: calculateRecipeNutrition(recipe) };
    });

    const weeklyTotal = dayNutrition.reduce((total, day) => {
        if (!day.nutrition) return total;
        return {
            calories: total.calories + day.nutrition.calories,
            carbs: total.carbs + day.nutrition.carbs,
            fat: total.fat + day.nutrition.fat,
            protein: total.protein + day.nutrition.protein,
            fiber: total.fiber + day.nutrition.fiber,
            vitamins: Object.keys(total.vitamins).reduce((vits, vit) => ({ ...vits, [vit]: total.vitamins[vit] || day.nutrition.vitamins[vit] }), {}),
            minerals: Object.keys(total.minerals).reduce((mins, min) => ({ ...mins, [min]: total.minerals[min] || day.nutrition.minerals[min] }), {})
        };
    }, { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: { vitaminA: false, vitaminC: false, vitaminD: false, vitaminE: false, vitaminK1: false, vitaminK2: false, vitaminB12: false, folate: false }, minerals: { calcium: false, iron: false, magnesium: false, potassium: false, zinc: false } });

    // Create stacked bar chart data for macronutrients
    const chartData = {
        labels: dayNutrition.map(d => d.day.substring(0, 3)), // Short day names
        datasets: [
            {
                label: 'Carbs (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.carbs : 0),
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            },
            {
                label: 'Fat (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.fat : 0),
                backgroundColor: 'rgba(231, 76, 60, 0.8)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            },
            {
                label: 'Protein (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.protein : 0),
                backgroundColor: 'rgba(46, 204, 113, 0.8)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            },
            {
                label: 'Fiber (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.fiber : 0),
                backgroundColor: 'rgba(155, 89, 182, 0.8)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                stacked: true,
                title: {
                    display: true,
                    text: 'Day of Week'
                }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Macronutrients (grams)'
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            title: {
                display: true,
                text: 'Weekly Macronutrient Breakdown'
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + context.parsed.y + 'g';
                    }
                }
            }
        }
    };

    // Use useEffect to create the charts after component mounts
    React.useEffect(() => {
        const chartRefs = {};

        // Calories chart
        const caloriesCtx = document.getElementById('caloriesChart');
        if (caloriesCtx) {
            const caloriesData = {
                labels: dayNutrition.map(d => d.day.substring(0, 3)),
                datasets: [{
                    label: 'Calories',
                    data: dayNutrition.map(d => d.nutrition ? d.nutrition.calories : 0),
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            };

            const caloriesOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Calories'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Weekly Calorie Intake'
                    }
                }
            };

            chartRefs.caloriesChart = new Chart(caloriesCtx, {
                type: 'bar',
                data: caloriesData,
                options: caloriesOptions
            });
        }

        // Macronutrients stacked chart
        const macroCtx = document.getElementById('macroChart');
        if (macroCtx) {
            chartRefs.macroChart = new Chart(macroCtx, {
                type: 'bar',
                data: chartData,
                options: chartOptions
            });
        }

        // Vitamins stacked bar chart
        const vitaminsCtx = document.getElementById('vitaminsChart');
        if (vitaminsCtx) {
            const vitaminNames = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
            const vitaminsData = {
                labels: dayNutrition.map(d => d.day.substring(0, 3)),
                datasets: vitaminNames.map(vitamin => ({
                    label: vitamin,
                    data: dayNutrition.map(d => d.nutrition && d.nutrition.vitamins[vitamin] ? 1 : 0),
                    backgroundColor: getVitaminColor(vitamin),
                    borderColor: getVitaminColor(vitamin, true),
                    borderWidth: 1
                }))
            };

            const vitaminsOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Day of Week'
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: vitaminNames.length,
                        title: {
                            display: true,
                            text: 'Vitamins Present'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Weekly Vitamin Intake'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y > 0 ? 'Present' : 'Absent');
                            }
                        }
                    }
                }
            };

            chartRefs.vitaminsChart = new Chart(vitaminsCtx, {
                type: 'bar',
                data: vitaminsData,
                options: vitaminsOptions
            });
        }

        // Minerals stacked bar chart
        const mineralsCtx = document.getElementById('mineralsChart');
        if (mineralsCtx) {
            const mineralNames = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];
            const mineralsData = {
                labels: dayNutrition.map(d => d.day.substring(0, 3)),
                datasets: mineralNames.map(mineral => ({
                    label: mineral,
                    data: dayNutrition.map(d => d.nutrition && d.nutrition.minerals[mineral] ? 1 : 0),
                    backgroundColor: getMineralColor(mineral),
                    borderColor: getMineralColor(mineral, true),
                    borderWidth: 1
                }))
            };

            const mineralsOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Day of Week'
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: mineralNames.length,
                        title: {
                            display: true,
                            text: 'Minerals Present'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Weekly Mineral Intake'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y > 0 ? 'Present' : 'Absent');
                            }
                        }
                    }
                }
            };

            chartRefs.mineralsChart = new Chart(mineralsCtx, {
                type: 'bar',
                data: mineralsData,
                options: mineralsOptions
            });
        }

        // Weekly Vitamins Pie Chart
        const weeklyVitaminsCtx = document.getElementById('weeklyVitaminsChart');
        if (weeklyVitaminsCtx) {
            const vitaminNames = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
            const vitaminCounts = vitaminNames.map(vitamin => {
                return dayNutrition.reduce((count, day) => {
                    return count + (day.nutrition && day.nutrition.vitamins[vitamin] ? 1 : 0);
                }, 0);
            });

            // Create mapping to strip "vitamin" prefix for display
            const getVitaminDisplayName = (vitaminName) => {
                if (vitaminName.startsWith('vitamin')) {
                    return vitaminName.replace('vitamin', '');
                }
                return vitaminName;
            };

            const weeklyVitaminsData = {
                labels: vitaminNames.map(name => getVitaminDisplayName(name)),
                datasets: [{
                    data: vitaminCounts,
                    backgroundColor: vitaminNames.map(v => getVitaminColor(v)),
                    borderColor: vitaminNames.map(v => getVitaminColor(v, true)),
                    borderWidth: 1
                }]
            };

            const weeklyVitaminsOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Weekly Vitamin Distribution'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + ' days';
                            }
                        }
                    }
                }
            };

            chartRefs.weeklyVitaminsChart = new Chart(weeklyVitaminsCtx, {
                type: 'pie',
                data: weeklyVitaminsData,
                options: weeklyVitaminsOptions
            });
        }

        // Weekly Minerals Pie Chart
        const weeklyMineralsCtx = document.getElementById('weeklyMineralsChart');
        if (weeklyMineralsCtx) {
            const mineralNames = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];
            const mineralCounts = mineralNames.map(mineral => {
                return dayNutrition.reduce((count, day) => {
                    return count + (day.nutrition && day.nutrition.minerals[mineral] ? 1 : 0);
                }, 0);
            });

            const weeklyMineralsData = {
                labels: mineralNames,
                datasets: [{
                    data: mineralCounts,
                    backgroundColor: mineralNames.map(m => getMineralColor(m)),
                    borderColor: mineralNames.map(m => getMineralColor(m, true)),
                    borderWidth: 1
                }]
            };

            const weeklyMineralsOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Weekly Mineral Distribution'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + ' days';
                            }
                        }
                    }
                }
            };

            chartRefs.weeklyMineralsChart = new Chart(weeklyMineralsCtx, {
                type: 'pie',
                data: weeklyMineralsData,
                options: weeklyMineralsOptions
            });
        }

        // Weekly Macronutrients Pie Chart
        const weeklyMacrosCtx = document.getElementById('weeklyMacronutrientsChart');
        if (weeklyMacrosCtx) {
            const weeklyMacrosData = window.NutritionCalculations.generateWeeklyMacronutrientsChartData(dayNutrition);

            const weeklyMacrosOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Weekly Macronutrient Distribution'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + 'g';
                            }
                        }
                    }
                }
            };

            chartRefs.weeklyMacronutrientsChart = new Chart(weeklyMacrosCtx, {
                type: 'pie',
                data: weeklyMacrosData,
                options: weeklyMacrosOptions
            });
        }

        // Cleanup function
        return () => {
            Object.values(chartRefs).forEach(chart => {
                if (chart) {
                    chart.destroy();
                }
            });
        };
    }, [recipes, calendar]);

    // Helper functions for colors
    function getVitaminColor(vitamin, border = false) {
        const colors = {
            vitaminA: border ? 'rgba(255, 99, 132, 1)' : 'rgba(255, 99, 132, 0.8)',
            vitaminC: border ? 'rgba(54, 162, 235, 1)' : 'rgba(54, 162, 235, 0.8)',
            vitaminD: border ? 'rgba(255, 205, 86, 1)' : 'rgba(255, 205, 86, 0.8)',
            vitaminE: border ? 'rgba(75, 192, 192, 1)' : 'rgba(75, 192, 192, 0.8)',
            vitaminK1: border ? 'rgba(153, 102, 255, 1)' : 'rgba(153, 102, 255, 0.8)',
            vitaminK2: border ? 'rgba(255, 159, 64, 1)' : 'rgba(255, 159, 64, 0.8)',
            vitaminB12: border ? 'rgba(199, 199, 199, 1)' : 'rgba(199, 199, 199, 0.8)',
            folate: border ? 'rgba(83, 102, 255, 1)' : 'rgba(83, 102, 255, 0.8)'
        };
        return colors[vitamin] || (border ? 'rgba(128, 128, 128, 1)' : 'rgba(128, 128, 128, 0.8)');
    }

    function getMineralColor(mineral, border = false) {
        const colors = {
            calcium: border ? 'rgba(255, 99, 132, 1)' : 'rgba(255, 99, 132, 0.8)',
            iron: border ? 'rgba(54, 162, 235, 1)' : 'rgba(54, 162, 235, 0.8)',
            magnesium: border ? 'rgba(255, 205, 86, 1)' : 'rgba(255, 205, 86, 0.8)',
            potassium: border ? 'rgba(75, 192, 192, 1)' : 'rgba(75, 192, 192, 0.8)',
            zinc: border ? 'rgba(153, 102, 255, 1)' : 'rgba(153, 102, 255, 0.8)'
        };
        return colors[mineral] || (border ? 'rgba(128, 128, 128, 1)' : 'rgba(128, 128, 128, 0.8)');
    }

    // Calculate omitted nutrients
    const allVitamins = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
    const allMinerals = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];

    const omittedVitamins = allVitamins.filter(vitamin => {
        return !dayNutrition.some(day => day.nutrition && day.nutrition.vitamins[vitamin]);
    });

    const omittedMinerals = allMinerals.filter(mineral => {
        return !dayNutrition.some(day => day.nutrition && day.nutrition.minerals[mineral]);
    });

    return React.createElement('div', { className: 'nutrition' },
        React.createElement('h2', null, 'Nutritional Overview'),
        React.createElement('div', { className: 'nutrition-charts-container' },
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'caloriesChart', width: '400', height: '200' })
            ),
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'macroChart', width: '400', height: '200' })
            )
        ),
        React.createElement('h3', null, 'Vitamin & Mineral Intake'),
        React.createElement('div', { className: 'nutrition-charts-container' },
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'vitaminsChart', width: '400', height: '200' })
            ),
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'mineralsChart', width: '400', height: '200' })
            )
        ),
        React.createElement('h3', null, 'Weekly Distribution'),
        React.createElement('div', { className: 'nutrition-charts-container' },
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'weeklyVitaminsChart', width: '400', height: '200' })
            ),
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'weeklyMineralsChart', width: '400', height: '200' })
            ),
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'weeklyMacronutrientsChart', width: '400', height: '200' })
            )
        ),
        React.createElement('h3', null, 'Daily Breakdown'),
        React.createElement('div', { className: 'daily-nutrition' },
            dayNutrition.map(({ day, nutrition }) =>
                React.createElement('div', { key: day, className: 'day-nutrition' },
                    React.createElement('h4', null, day),
                    nutrition ? React.createElement('div', null,
                        React.createElement('p', null, `Calories: ${nutrition.calories.toFixed(0)}`),
                        React.createElement('p', null, `Carbs: ${nutrition.carbs.toFixed(1)}g, Fat: ${nutrition.fat.toFixed(1)}g, Protein: ${nutrition.protein.toFixed(1)}g, Fiber: ${nutrition.fiber.toFixed(1)}g`),
                        React.createElement('p', null, 'Vitamins: ' + Object.keys(nutrition.vitamins).filter(v => nutrition.vitamins[v]).join(', ')),
                        React.createElement('p', null, 'Minerals: ' + Object.keys(nutrition.minerals).filter(m => nutrition.minerals[m]).join(', '))
                    ) : React.createElement('p', null, 'No recipe planned')
                )
            )
        ),
        React.createElement('h3', null, 'Weekly Totals'),
        React.createElement('div', { className: 'weekly-nutrition' },
            React.createElement('p', null, `Total Calories: ${weeklyTotal.calories.toFixed(0)}`),
            React.createElement('p', null, `Total Carbs: ${weeklyTotal.carbs.toFixed(1)}g, Fat: ${weeklyTotal.fat.toFixed(1)}g, Protein: ${weeklyTotal.protein.toFixed(1)}g, Fiber: ${weeklyTotal.fiber.toFixed(1)}g`),
            React.createElement('p', null, 'Vitamins present: ' + Object.keys(weeklyTotal.vitamins).filter(v => weeklyTotal.vitamins[v]).join(', ')),
            React.createElement('p', null, 'Minerals present: ' + Object.keys(weeklyTotal.minerals).filter(m => weeklyTotal.minerals[m]).join(', '))
        ),
        (omittedVitamins.length > 0 || omittedMinerals.length > 0) && React.createElement('h3', null, 'Omitted Nutrients'),
        (omittedVitamins.length > 0 || omittedMinerals.length > 0) && React.createElement('div', { className: 'omitted-nutrients' },
            omittedVitamins.length > 0 && React.createElement('p', null, `Vitamins not present this week: ${omittedVitamins.join(', ')}`),
            omittedMinerals.length > 0 && React.createElement('p', null, `Minerals not present this week: ${omittedMinerals.join(', ')}`)
        )
    );
}
