/**
 * @typedef {Object} Expense
 * @property {string} name - Name of the expense
 * @property {number} amount - Monthly amount in currency
 * @property {number} inflationRate - Annual inflation rate as decimal (e.g., 0.03 for 3%)
 * @property {number|null} durationMonths - Number of months this expense lasts (null for indefinite)
 * @property {boolean} enabled - Whether this expense is included in calculations (default: true)
 */

/**
 * @typedef {Object} SavingsPot
 * @property {string} name - Name of the savings pot
 * @property {number} amount - Current amount in currency
 * @property {number} interestRate - Annual interest rate as decimal (e.g., 0.05 for 5%)
 * @property {number} riskRate - Risk rate as decimal (e.g., 0.02 for 2% risk)
 * @property {number} monthlyPayment - Monthly payment amount (e.g., salary contribution)
 * @property {number} yearlyPayment - Yearly payment amount (e.g., bonus, ISA contribution)
 * @property {boolean} enabled - Whether this savings pot is included in calculations (default: true)
 */

/**
 * @typedef {Object} MonthlyProgression
 * @property {number} month - Month number
 * @property {number} nominalSavings - Savings amount without risk adjustment
 * @property {number} minSavings - Minimum savings considering risk
 * @property {number} maxSavings - Maximum savings considering risk
 * @property {number} totalExpenses - Total expenses for this month
 * @property {Object} expenseBreakdown - Individual expense amounts for this month
 * @property {Object} savingsBreakdown - Individual savings amounts for this month (nominal, min, max)
 */

/**
 * @typedef {Object} CalculationResult
 * @property {number} nominalMonths - Estimated survival time in months (nominal)
 * @property {number} minMonths - Minimum survival time considering risk
 * @property {number} maxMonths - Maximum survival time considering risk
 * @property {MonthlyProgression[]} monthlyProgression - Month-by-month progression data
 */

/**
 * Domain class representing a monthly expense with inflation
 */
class Expense {
  /**
   * @param {string} name
   * @param {number} amount
   * @param {number} inflationRate
   * @param {number|null} durationMonths - Number of months this expense lasts (null for indefinite)
   * @param {boolean} enabled - Whether this expense is included in calculations (default: true)
   */
  constructor(name, amount, inflationRate, durationMonths = null, enabled = true) {
    if (!name || typeof name !== 'string') {
      throw new Error('Expense name must be a non-empty string');
    }
    if (typeof amount !== 'number' || amount < 0) {
      throw new Error('Expense amount must be a non-negative number');
    }
    if (typeof inflationRate !== 'number' || inflationRate < 0) {
      throw new Error('Inflation rate must be a non-negative number');
    }
    if (durationMonths !== null && (typeof durationMonths !== 'number' || durationMonths < 1)) {
      throw new Error('Duration months must be null or a positive number');
    }
    if (typeof enabled !== 'boolean') {
      throw new Error('Enabled must be a boolean');
    }

    this.name = name;
    this.amount = amount;
    this.inflationRate = inflationRate;
    this.durationMonths = durationMonths;
    this.enabled = enabled;
  }

  /**
   * Check if this expense is active in a given month
   * @param {number} month - Month number (1-based)
   * @returns {boolean} True if expense is active this month
   */
  isActiveInMonth(month) {
    return this.durationMonths === null || month <= this.durationMonths;
  }

  /**
   * Calculate the inflated amount for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Inflated amount (0 if expense has ended)
   */
  getInflatedAmount(month) {
    if (!this.isActiveInMonth(month)) {
      return 0;
    }
    return this.amount * Math.pow(1 + this.inflationRate, month / 12);
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      amount: this.amount,
      inflationRate: this.inflationRate,
      durationMonths: this.durationMonths,
      enabled: this.enabled
    };
  }

  /**
   * Create Expense from plain object
   * @param {Object} data
   * @returns {Expense}
   */
  static fromJSON(data) {
    return new Expense(data.name, data.amount, data.inflationRate, data.durationMonths || null, data.enabled !== false);
  }
}

/**
 * Domain class representing a savings pot with interest and risk
 */
class SavingsPot {
  /**
   * @param {string} name
   * @param {number} amount
   * @param {number} interestRate
   * @param {number} riskRate
   * @param {number} monthlyPayment - Monthly payment amount (default: 0)
   * @param {number} yearlyPayment - Yearly payment amount (default: 0)
   * @param {boolean} enabled - Whether this savings pot is included in calculations (default: true)
   */
  constructor(name, amount, interestRate, riskRate, monthlyPayment = 0, yearlyPayment = 0, enabled = true) {
    if (!name || typeof name !== 'string') {
      throw new Error('Savings pot name must be a non-empty string');
    }
    if (typeof amount !== 'number' || amount < 0) {
      throw new Error('Savings amount must be a non-negative number');
    }
    if (typeof interestRate !== 'number' || interestRate < 0) {
      throw new Error('Interest rate must be a non-negative number');
    }
    if (typeof riskRate !== 'number' || riskRate < 0) {
      throw new Error('Risk rate must be a non-negative number');
    }
    if (typeof monthlyPayment !== 'number' || monthlyPayment < 0) {
      throw new Error('Monthly payment must be a non-negative number');
    }
    if (typeof yearlyPayment !== 'number' || yearlyPayment < 0) {
      throw new Error('Yearly payment must be a non-negative number');
    }
    if (typeof enabled !== 'boolean') {
      throw new Error('Enabled must be a boolean');
    }

    this.name = name;
    this.amount = amount;
    this.interestRate = interestRate;
    this.riskRate = riskRate;
    this.monthlyPayment = monthlyPayment;
    this.yearlyPayment = yearlyPayment;
    this.enabled = enabled;
  }

  /**
   * Calculate the nominal amount (without risk) for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Nominal amount
   */
  getNominalAmount(month) {
    return this.amount * Math.pow(1 + this.interestRate, month / 12);
  }

  /**
   * Calculate the minimum amount (with negative risk) for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Minimum amount
   */
  getMinAmount(month) {
    const riskAdjustedRate = this.interestRate - this.riskRate;
    return this.amount * Math.pow(1 + Math.max(0, riskAdjustedRate), month / 12);
  }

  /**
   * Calculate the maximum amount (with positive risk) for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Maximum amount
   */
  getMaxAmount(month) {
    const riskAdjustedRate = this.interestRate + this.riskRate;
    return this.amount * Math.pow(1 + riskAdjustedRate, month / 12);
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      amount: this.amount,
      interestRate: this.interestRate,
      riskRate: this.riskRate,
      monthlyPayment: this.monthlyPayment,
      yearlyPayment: this.yearlyPayment,
      enabled: this.enabled
    };
  }

  /**
   * Create SavingsPot from plain object
   * @param {Object} data
   * @returns {SavingsPot}
   */
  static fromJSON(data) {
    return new SavingsPot(
      data.name,
      data.amount,
      data.interestRate,
      data.riskRate,
      data.monthlyPayment || 0,
      data.yearlyPayment || 0,
      data.enabled !== false
    );
  }
}

/**
 * Domain class representing the complete survival calculation data
 */
class SurvivalData {
  /**
   * @param {Expense[]} expenses
   * @param {SavingsPot[]} savingsPots
   */
  constructor(expenses = [], savingsPots = []) {
    this.expenses = [...expenses]; // Create immutable copy
    this.savingsPots = [...savingsPots]; // Create immutable copy
    this.lastCalculated = null;
  }

  /**
   * Add an expense (returns new instance)
   * @param {Expense} expense
   * @returns {SurvivalData} New instance with added expense
   */
  addExpense(expense) {
    if (!(expense instanceof Expense)) {
      throw new Error('Must provide a valid Expense instance');
    }
    const newExpenses = [...this.expenses, expense];
    const newInstance = new SurvivalData(newExpenses, this.savingsPots);
    newInstance.lastCalculated = this.lastCalculated;
    newInstance.saveToLocalStorage();
    return newInstance;
  }

  /**
   * Remove an expense by index (returns new instance)
   * @param {number} index
   * @returns {SurvivalData} New instance with expense removed
   */
  removeExpense(index) {
    if (index < 0 || index >= this.expenses.length) {
      throw new Error('Invalid expense index');
    }
    const newExpenses = [...this.expenses];
    newExpenses.splice(index, 1);
    const newInstance = new SurvivalData(newExpenses, this.savingsPots);
    newInstance.lastCalculated = this.lastCalculated;
    newInstance.saveToLocalStorage();
    return newInstance;
  }

  /**
   * Update an expense by index (returns new instance)
   * @param {number} index
   * @param {Expense} expense
   * @returns {SurvivalData} New instance with expense updated
   */
  updateExpense(index, expense) {
    if (index < 0 || index >= this.expenses.length) {
      throw new Error('Invalid expense index');
    }
    if (!(expense instanceof Expense)) {
      throw new Error('Must provide a valid Expense instance');
    }
    const newExpenses = [...this.expenses];
    newExpenses[index] = expense;
    const newInstance = new SurvivalData(newExpenses, this.savingsPots);
    newInstance.lastCalculated = this.lastCalculated;
    newInstance.saveToLocalStorage();
    return newInstance;
  }

  /**
   * Add a savings pot (returns new instance)
   * @param {SavingsPot} savingsPot
   * @returns {SurvivalData} New instance with added savings pot
   */
  addSavingsPot(savingsPot) {
    if (!(savingsPot instanceof SavingsPot)) {
      throw new Error('Must provide a valid SavingsPot instance');
    }
    const newSavingsPots = [...this.savingsPots, savingsPot];
    const newInstance = new SurvivalData(this.expenses, newSavingsPots);
    newInstance.lastCalculated = this.lastCalculated;
    newInstance.saveToLocalStorage();
    return newInstance;
  }

  /**
   * Remove a savings pot by index (returns new instance)
   * @param {number} index
   * @returns {SurvivalData} New instance with savings pot removed
   */
  removeSavingsPot(index) {
    if (index < 0 || index >= this.savingsPots.length) {
      throw new Error('Invalid savings pot index');
    }
    const newSavingsPots = [...this.savingsPots];
    newSavingsPots.splice(index, 1);
    const newInstance = new SurvivalData(this.expenses, newSavingsPots);
    newInstance.lastCalculated = this.lastCalculated;
    newInstance.saveToLocalStorage();
    return newInstance;
  }

  /**
   * Update a savings pot by index (returns new instance)
   * @param {number} index
   * @param {SavingsPot} savingsPot
   * @returns {SurvivalData} New instance with savings pot updated
   */
  updateSavingsPot(index, savingsPot) {
    if (index < 0 || index >= this.savingsPots.length) {
      throw new Error('Invalid savings pot index');
    }
    if (!(savingsPot instanceof SavingsPot)) {
      throw new Error('Must provide a valid SavingsPot instance');
    }
    const newSavingsPots = [...this.savingsPots];
    newSavingsPots[index] = savingsPot;
    const newInstance = new SurvivalData(this.expenses, newSavingsPots);
    newInstance.lastCalculated = this.lastCalculated;
    newInstance.saveToLocalStorage();
    return newInstance;
  }

  /**
   * Calculate total monthly expenses for a given month (with inflation)
   * @param {number} month - Month number (1-based)
   * @returns {number} Total monthly expenses
   */
  getTotalExpenses(month) {
    return this.expenses
      .filter(expense => expense.enabled)
      .reduce((total, expense) => {
        return total + expense.getInflatedAmount(month);
      }, 0);
  }

  /**
   * Calculate total nominal savings for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Total nominal savings
   */
  getTotalNominalSavings(month) {
    return this.savingsPots
      .filter(pot => pot.enabled)
      .reduce((total, pot) => {
        return total + pot.getNominalAmount(month);
      }, 0);
  }

  /**
   * Calculate total minimum savings for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Total minimum savings
   */
  getTotalMinSavings(month) {
    return this.savingsPots
      .filter(pot => pot.enabled)
      .reduce((total, pot) => {
        return total + pot.getMinAmount(month);
      }, 0);
  }

  /**
   * Calculate total maximum savings for a given month
   * @param {number} month - Month number (1-based)
   * @returns {number} Total maximum savings
   */
  getTotalMaxSavings(month) {
    return this.savingsPots
      .filter(pot => pot.enabled)
      .reduce((total, pot) => {
        return total + pot.getMaxAmount(month);
      }, 0);
  }

  /**
   * Calculate next month's savings after applying payments, interest and deducting expenses in priority order
   * @param {Object} currentSavings - Current savings by pot name
   * @param {Object} interestRates - Interest rates by pot name
   * @param {Object} monthlyPayments - Monthly payments by pot name
   * @param {Object} yearlyPayments - Yearly payments by pot name
   * @param {number} month - Current month number (1-based)
   * @param {number} totalExpenses - Total expenses for the month
   * @returns {Object} Individual savings after payments, interest and priority-based expense deduction
   */
  static calculateNextMonthSavings(currentSavings, interestRates, monthlyPayments, yearlyPayments, month, totalExpenses) {
    const individualSavings = {};
    let totalWithInterest = 0;

    // Apply payments and interest to each pot individually
    Object.keys(currentSavings).forEach(potName => {
      let currentAmount = currentSavings[potName];

      // Add monthly payment
      const monthlyPayment = monthlyPayments[potName] || 0;
      currentAmount += monthlyPayment;

      // Add yearly payment if it's the right month (every 12 months)
      if (month % 12 === 0) {
        const yearlyPayment = yearlyPayments[potName] || 0;
        currentAmount += yearlyPayment;
      }

      // Apply interest
      const interestRate = interestRates[potName] || 0;
      const monthlyInterest = currentAmount * interestRate / 12;
      individualSavings[potName] = currentAmount + monthlyInterest;
      totalWithInterest += individualSavings[potName];
    });

    // Deduct expenses in priority order (lowest interest rate first)
    let remainingExpenses = totalExpenses;

    // Sort pots by interest rate (lowest first)
    const sortedPots = Object.keys(individualSavings).sort((a, b) => {
      return interestRates[a] - interestRates[b];
    });

    // Deduct from each pot in priority order
    for (const potName of sortedPots) {
      if (remainingExpenses <= 0) break;

      const potAmount = individualSavings[potName];
      const deduction = Math.min(potAmount, remainingExpenses);
      individualSavings[potName] -= deduction;
      remainingExpenses -= deduction;
    }

    const totalSavings = Object.values(individualSavings).reduce((sum, val) => sum + val, 0);

    return {
      individualSavings, // Each pot's amount after payments, interest and priority-based expenses
      totalSavings     // Total of all pots (should be same as sum of individualSavings)
    };
  }

  /**
   * Calculate total expenses for a given month with inflation
   * @param {Expense[]} expenses - Array of expenses
   * @param {number} month - Month number (1-based)
   * @returns {number} Total expenses for the month
   */
  static calculateTotalExpenses(expenses, month) {
    return expenses.reduce((total, expense) => {
      return total + expense.getInflatedAmount(month);
    }, 0);
  }

  /**
   * Calculate individual expense breakdown for a given month
   * @param {Expense[]} expenses - Array of expenses
   * @param {number} month - Month number (1-based)
   * @returns {Object} Expense breakdown by name
   */
  static calculateExpenseBreakdown(expenses, month) {
    const breakdown = {};
    expenses.forEach(expense => {
      breakdown[expense.name] = expense.getInflatedAmount(month);
    });
    return breakdown;
  }

  /**
   * Perform the survival calculation
   * @returns {CalculationResult} Calculation results
   */
  calculateSurvival() {
    const monthlyProgression = [];
    let month = 0;

    // Filter enabled items
    const enabledExpenses = this.expenses.filter(expense => expense.enabled);
    const enabledSavingsPots = this.savingsPots.filter(pot => pot.enabled);

    // Initialize savings amounts for each scenario
    const nominalSavings = {};
    const minSavings = {};
    const maxSavings = {};

    enabledSavingsPots.forEach(pot => {
      nominalSavings[pot.name] = pot.amount;
      minSavings[pot.name] = pot.amount;
      maxSavings[pot.name] = pot.amount;
    });

    // Initial state (month 0)
    monthlyProgression.push({
      month: 0,
      nominalSavings: Object.values(nominalSavings).reduce((sum, val) => sum + val, 0),
      minSavings: Object.values(minSavings).reduce((sum, val) => sum + val, 0),
      maxSavings: Object.values(maxSavings).reduce((sum, val) => sum + val, 0),
      totalExpenses: 0,
      expenseBreakdown: {},
      savingsBreakdown: {
        nominal: { ...nominalSavings },
        min: { ...minSavings },
        max: { ...maxSavings }
      }
    });

    // Simulate month by month until savings are depleted
    while (month < 1200) { // Max 100 years (1200 months)
      month++;

      // Calculate expenses for this month (with inflation) - only enabled expenses
      const monthlyExpenses = SurvivalData.calculateTotalExpenses(enabledExpenses, month);
      const expenseBreakdown = SurvivalData.calculateExpenseBreakdown(enabledExpenses, month);

      // Calculate next month's savings for each scenario
      // Month 1: No interest applied (initial values minus expenses)
      if (month === 1) {
        const totalInitialSavings = Object.values(nominalSavings).reduce((sum, val) => sum + val, 0);
        const newNominalTotal = totalInitialSavings - monthlyExpenses;
        const newMinTotal = totalInitialSavings - monthlyExpenses;
        const newMaxTotal = totalInitialSavings - monthlyExpenses;

        // Distribute remaining amount proportionally across pots
        Object.keys(nominalSavings).forEach(potName => {
          const proportion = nominalSavings[potName] / totalInitialSavings;
          nominalSavings[potName] = Math.max(0, newNominalTotal * proportion);
          minSavings[potName] = Math.max(0, newMinTotal * proportion);
          maxSavings[potName] = Math.max(0, newMaxTotal * proportion);
        });

        monthlyProgression.push({
          month,
          nominalSavings: newNominalTotal,
          minSavings: newMinTotal,
          maxSavings: newMaxTotal,
          totalExpenses: monthlyExpenses,
          expenseBreakdown,
          savingsBreakdown: {
            nominal: { ...nominalSavings },
            min: { ...minSavings },
            max: { ...maxSavings }
          }
        });
      } else {
        // Month 2+: Apply payments, interest to previous month's remaining balance
        const nominalRates = {};
        const minRates = {};
        const maxRates = {};
        const monthlyPayments = {};
        const yearlyPayments = {};

        enabledSavingsPots.forEach(pot => {
          nominalRates[pot.name] = pot.interestRate;
          minRates[pot.name] = Math.max(0, pot.interestRate - pot.riskRate);
          maxRates[pot.name] = pot.interestRate + pot.riskRate;
          monthlyPayments[pot.name] = pot.monthlyPayment;
          yearlyPayments[pot.name] = pot.yearlyPayment;
        });

        // Nominal scenario
        const nominalResult = SurvivalData.calculateNextMonthSavings(nominalSavings, nominalRates, monthlyPayments, yearlyPayments, month, monthlyExpenses);
        Object.keys(nominalSavings).forEach(potName => {
          nominalSavings[potName] = nominalResult.individualSavings[potName];
        });

        // Minimum scenario
        const minResult = SurvivalData.calculateNextMonthSavings(minSavings, minRates, monthlyPayments, yearlyPayments, month, monthlyExpenses);
        Object.keys(minSavings).forEach(potName => {
          minSavings[potName] = minResult.individualSavings[potName];
        });

        // Maximum scenario
        const maxResult = SurvivalData.calculateNextMonthSavings(maxSavings, maxRates, monthlyPayments, yearlyPayments, month, monthlyExpenses);
        Object.keys(maxSavings).forEach(potName => {
          maxSavings[potName] = maxResult.individualSavings[potName];
        });

        monthlyProgression.push({
          month,
          nominalSavings: nominalResult.totalSavings,
          minSavings: minResult.totalSavings,
          maxSavings: maxResult.totalSavings,
          totalExpenses: monthlyExpenses,
          expenseBreakdown,
          savingsBreakdown: {
            nominal: { ...nominalSavings },
            min: { ...minSavings },
            max: { ...maxSavings }
          }
        });
      }

      // Stop if all scenarios are depleted (all three projections are negative/zero)
      const currentProgression = monthlyProgression[monthlyProgression.length - 1];
      if (currentProgression.nominalSavings <= 0 && currentProgression.minSavings <= 0 && currentProgression.maxSavings <= 0) {
        break;
      }
    }

    // Find when each scenario would be depleted, or use max period if never depleted
    const nominalMonths = monthlyProgression.find(p => p.nominalSavings <= 0)?.month || month;
    const minMonths = monthlyProgression.find(p => p.minSavings <= 0)?.month || month;
    const maxMonths = monthlyProgression.find(p => p.maxSavings <= 0)?.month || month;

    this.lastCalculated = new Date().toISOString();

    return {
      nominalMonths,
      minMonths,
      maxMonths,
      monthlyProgression
    };
  }

  /**
   * Save to localStorage
   */
  saveToLocalStorage() {
    try {
      // Check if localStorage is available (browser environment)
      if (typeof localStorage === 'undefined') {
        return; // Skip saving in Node.js environment
      }

      const data = {
        expenses: this.expenses.map(e => e.toJSON()),
        savingsPots: this.savingsPots.map(p => p.toJSON()),
        lastCalculated: this.lastCalculated
      };
      localStorage.setItem('survivalCalculatorData', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load from localStorage
   * @returns {SurvivalData|null} Loaded data or null if not found
   */
  static loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('survivalCalculatorData');
      if (!data) return null;

      const parsed = JSON.parse(data);
      const expenses = parsed.expenses.map(e => Expense.fromJSON(e));
      const savingsPots = parsed.savingsPots.map(p => SavingsPot.fromJSON(p));

      const survivalData = new SurvivalData(expenses, savingsPots);
      survivalData.lastCalculated = parsed.lastCalculated;
      return survivalData;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      expenses: this.expenses.map(e => e.toJSON()),
      savingsPots: this.savingsPots.map(p => p.toJSON()),
      lastCalculated: this.lastCalculated
    };
  }

  /**
   * Create SurvivalData from plain object
   * @param {Object} data
   * @returns {SurvivalData}
   */
  static fromJSON(data) {
    const expenses = data.expenses.map(e => Expense.fromJSON(e));
    const savingsPots = data.savingsPots.map(p => SavingsPot.fromJSON(p));

    const survivalData = new SurvivalData(expenses, savingsPots);
    survivalData.lastCalculated = data.lastCalculated;
    return survivalData;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Expense,
    SavingsPot,
    SurvivalData
  };
}
