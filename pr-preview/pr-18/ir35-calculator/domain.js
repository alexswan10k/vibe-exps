class TaxCalculator {
    constructor(taxYear = "2024/25") {
        this.taxYear = taxYear;
        // 2024/25 UK Tax Rates and Thresholds
        this.personalAllowance = 12570;
        this.basicRateLimit = 37700;
        this.higherRateLimit = 125140;

        // Income Tax
        this.basicRate = 0.20;
        this.higherRate = 0.40;
        this.additionalRate = 0.45;

        // National Insurance
        this.niPrimaryThreshold = 12570; // Employee
        this.niUpperEarningsLimit = 50270;
        this.niEmployeeRate = 0.08; // 2024/25 rate drop to 8%
        this.niEmployeeUpperRate = 0.02;

        this.niSecondaryThreshold = 9100; // Employer
        this.niEmployerRate = 0.138;

        // Corporation Tax
        this.corpTaxSmallProfitsRate = 0.19;
        this.corpTaxMainRate = 0.25;
        this.corpTaxLowerLimit = 50000;
        this.corpTaxUpperLimit = 250000;
        this.marginalReliefFraction = 3 / 200;

        // Dividends
        this.dividendAllowance = 500; // 2024/25
        this.dividendBasicRate = 0.0875;
        this.dividendHigherRate = 0.3375;
        this.dividendAdditionalRate = 0.3935;
    }

    calculateIncomeTax(grossIncome) {
        let taxableIncome = Math.max(0, grossIncome - this.personalAllowance);
        let tax = 0;

        // Personal Allowance Reduction (abatement)
        if (grossIncome > 100000) {
            let reduction = Math.min(this.personalAllowance, (grossIncome - 100000) / 2);
            taxableIncome = Math.max(0, grossIncome - (this.personalAllowance - reduction));
        }

        if (taxableIncome > 0) {
            let basicTaxable = Math.min(taxableIncome, this.basicRateLimit);
            tax += basicTaxable * this.basicRate;

            let higherTaxable = Math.max(0, Math.min(taxableIncome - basicTaxable, this.higherRateLimit - this.personalAllowance - this.basicRateLimit));
            // Edge case: when personal allowance is reduced, the higher rate band effectively grows to cover the reduced allowance
            if (grossIncome > 100000) {
                let reduction = Math.min(this.personalAllowance, (grossIncome - 100000) / 2);
                let extendedHigherLimit = this.higherRateLimit - this.personalAllowance - this.basicRateLimit + reduction;
                higherTaxable = Math.max(0, Math.min(taxableIncome - basicTaxable, extendedHigherLimit));
            }

            tax += higherTaxable * this.higherRate;

            let additionalTaxable = Math.max(0, taxableIncome - basicTaxable - higherTaxable);
            tax += additionalTaxable * this.additionalRate;
        }

        return tax;
    }

    calculateEmployeeNI(grossIncome) {
        let ni = 0;
        if (grossIncome > this.niPrimaryThreshold) {
            let basicNI = Math.min(grossIncome - this.niPrimaryThreshold, this.niUpperEarningsLimit - this.niPrimaryThreshold);
            ni += basicNI * this.niEmployeeRate;

            if (grossIncome > this.niUpperEarningsLimit) {
                ni += (grossIncome - this.niUpperEarningsLimit) * this.niEmployeeUpperRate;
            }
        }
        return ni;
    }

    calculateEmployerNI(grossIncome) {
        if (grossIncome > this.niSecondaryThreshold) {
            return (grossIncome - this.niSecondaryThreshold) * this.niEmployerRate;
        }
        return 0;
    }

    calculateCorporationTax(profit) {
        if (profit <= this.corpTaxLowerLimit) {
            return profit * this.corpTaxSmallProfitsRate;
        } else if (profit >= this.corpTaxUpperLimit) {
            return profit * this.corpTaxMainRate;
        } else {
            // Marginal Relief
            let mainTax = profit * this.corpTaxMainRate;
            let marginalRelief = (this.corpTaxUpperLimit - profit) * this.marginalReliefFraction;
            return mainTax - marginalRelief;
        }
    }

    calculateDividendTax(dividends, otherIncome = 0) {
        // Adjust bands by other income
        let personalAllowanceRemaining = Math.max(0, this.personalAllowance - otherIncome);
        if (otherIncome > 100000) {
            let reduction = Math.min(this.personalAllowance, (otherIncome - 100000) / 2);
            personalAllowanceRemaining = Math.max(0, (this.personalAllowance - reduction) - otherIncome);
        } else if (otherIncome + dividends > 100000) {
            // Complex case, simplified for this calculator
            let reduction = Math.min(this.personalAllowance, (otherIncome + dividends - 100000) / 2);
            personalAllowanceRemaining = Math.max(0, (this.personalAllowance - reduction) - otherIncome);
        }

        let taxableDividends = Math.max(0, dividends - personalAllowanceRemaining);

        // Dividend allowance is applied against the lowest available tax band
        let taxableDividendsAfterAllowance = Math.max(0, taxableDividends - this.dividendAllowance);
        let dividendAllowanceUsed = Math.min(taxableDividends, this.dividendAllowance);

        let basicRateBandRemaining = Math.max(0, this.basicRateLimit - Math.max(0, otherIncome - this.personalAllowance));
        let higherRateBandRemaining = Math.max(0, (this.higherRateLimit - this.personalAllowance) - this.basicRateLimit - Math.max(0, otherIncome - this.personalAllowance - this.basicRateLimit));

        // Adjust remaining bands for dividend allowance
        if (dividendAllowanceUsed > 0) {
            let allowanceInBasic = Math.min(dividendAllowanceUsed, basicRateBandRemaining);
            basicRateBandRemaining -= allowanceInBasic;
            dividendAllowanceUsed -= allowanceInBasic;

            if (dividendAllowanceUsed > 0) {
                higherRateBandRemaining -= dividendAllowanceUsed;
            }
        }

        let tax = 0;

        if (taxableDividendsAfterAllowance > 0) {
            let basicTaxable = Math.min(taxableDividendsAfterAllowance, basicRateBandRemaining);
            tax += basicTaxable * this.dividendBasicRate;

            let higherTaxable = Math.max(0, Math.min(taxableDividendsAfterAllowance - basicTaxable, higherRateBandRemaining));
            tax += higherTaxable * this.dividendHigherRate;

            let additionalTaxable = Math.max(0, taxableDividendsAfterAllowance - basicTaxable - higherTaxable);
            tax += additionalTaxable * this.dividendAdditionalRate;
        }

        return tax;
    }
}

class IR35Calculator {
    constructor() {
        this.taxCalc = new TaxCalculator();
    }

    calculateInside(annualRevenue, expenses = 0, pensionContribution = 0) {
        let grossRevenue = annualRevenue;
        // Inside IR35: fee payer deducts Employer NI and App Levy before paying the "gross" salary
        // Let's assume an umbrella company setup where the umbrella margin is an expense
        let revenueAfterExpenses = grossRevenue - expenses - pensionContribution;

        // Approximate Umbrella / Fee Payer deduction
        // Gross Salary + Employer NI = Revenue
        // S + (S - 9100) * 0.138 = R (assuming S > 9100)
        // 1.138S - 1255.8 = R
        // S = (R + 1255.8) / 1.138

        let grossSalary = revenueAfterExpenses;
        if (revenueAfterExpenses > this.taxCalc.niSecondaryThreshold) {
            grossSalary = (revenueAfterExpenses + (this.taxCalc.niSecondaryThreshold * this.taxCalc.niEmployerRate)) / (1 + this.taxCalc.niEmployerRate);
        }

        let employerNI = this.taxCalc.calculateEmployerNI(grossSalary);
        let employeeNI = this.taxCalc.calculateEmployeeNI(grossSalary);
        let incomeTax = this.taxCalc.calculateIncomeTax(grossSalary);

        let takeHome = grossSalary - employeeNI - incomeTax;

        return {
            grossRevenue,
            grossSalary,
            employerNI,
            employeeNI,
            incomeTax,
            takeHome,
            retentionRate: takeHome / grossRevenue
        };
    }

    calculateOutside(dailyRate, daysWorked, expenses = 0, pensionContribution = 0, targetSalary = 12570, targetDividend = null) {
        let grossRevenue = dailyRate * daysWorked;
        let companyProfitBeforeSalary = grossRevenue - expenses;

        // Salary is deductible for Corp Tax
        let salary = Math.min(companyProfitBeforeSalary, targetSalary);
        let employerNI = this.taxCalc.calculateEmployerNI(salary);
        let companyProfit = companyProfitBeforeSalary - salary - employerNI - pensionContribution;

        let corporationTax = this.taxCalc.calculateCorporationTax(Math.max(0, companyProfit));
        let distributableProfit = companyProfit - corporationTax;

        let dividendsTaken = 0;
        let retainedProfit = 0;

        if (targetDividend === null) {
            // Take all available profit as dividends
            dividendsTaken = Math.max(0, distributableProfit);
        } else {
            // Take minimum of target or available
            dividendsTaken = Math.min(Math.max(0, distributableProfit), targetDividend);
            retainedProfit = Math.max(0, distributableProfit - dividendsTaken);
        }

        let employeeNI = this.taxCalc.calculateEmployeeNI(salary);
        let incomeTax = this.taxCalc.calculateIncomeTax(salary);
        let dividendTax = this.taxCalc.calculateDividendTax(dividendsTaken, salary);

        let takeHome = salary - employeeNI - incomeTax + dividendsTaken - dividendTax;

        return {
            grossRevenue,
            salary,
            dividends: dividendsTaken,
            employerNI,
            corporationTax,
            companyProfit,
            distributableProfit,
            retainedProfit,
            employeeNI,
            incomeTax,
            dividendTax,
            totalPersonalTax: employeeNI + incomeTax + dividendTax,
            takeHome,
            retentionRate: takeHome / grossRevenue
        };
    }

    projectRetainedProfit(initialRetained, years, annualInterestRate = 0.05, annualAddition = 0) {
        let progression = [];
        let currentBalance = initialRetained;

        for (let i = 1; i <= years; i++) {
            let startBalance = currentBalance;
            // Add profit and apply corp tax to interest
            currentBalance += annualAddition;
            let interest = currentBalance * annualInterestRate;
            let corpTaxOnInterest = interest * this.taxCalc.corpTaxSmallProfitsRate; // Simplification
            currentBalance += (interest - corpTaxOnInterest);

            progression.push({
                year: i,
                startBalance: startBalance,
                addition: annualAddition,
                interest: interest,
                taxOnInterest: corpTaxOnInterest,
                endBalance: currentBalance
            });
        }

        return progression;
    }
}

// Export for Node.js environments (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TaxCalculator, IR35Calculator };
}
