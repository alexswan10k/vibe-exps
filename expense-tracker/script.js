/**
 * @typedef {Object} Person
 * @property {string} id - Unique identifier
 * @property {string} name - Person's name
 * @property {number} balance - Current balance
 */

/**
 * @typedef {Object} Expense
 * @property {string} id - Unique identifier
 * @property {string} payeeId - ID of person who paid
 * @property {number} amount - Total expense amount
 * @property {string} description - Expense description
 * @property {string} icon - Expense icon emoji
 * @property {string} date - ISO date string
 * @property {Array<{personId: string, amount: number}>} splits - How the expense is split
 */

/**
 * @typedef {Object} Payment
 * @property {string} id - Unique identifier
 * @property {string} fromId - ID of person paying
 * @property {string} toId - ID of person receiving
 * @property {number} amount - Payment amount
 * @property {string} description - Payment description
 * @property {string} date - ISO date string
 */

/**
 * @typedef {Object} LedgerEntry
 * @property {string} id - Unique identifier
 * @property {string} type - 'expense' or 'payment'
 * @property {string} date - ISO date string
 * @property {string} description - Description
 * @property {Array<{personId: string, amount: number}>} changes - Balance changes
 */

/**
 * Expense Tracker Application
 */
class ExpenseTracker {
    /**
     * @param {Array<Person>} people
     * @param {Array<Expense>} expenses
     * @param {Array<Payment>} payments
     * @param {Array<LedgerEntry>} ledger
     */
    constructor(people = [], expenses = [], payments = [], ledger = []) {
        this.people = people;
        this.expenses = expenses;
        this.payments = payments;
        this.ledger = ledger;
        this.templates = {
            equal: { name: 'Equal Split', calculate: this.calculateEqualSplit.bind(this) },
            water: { name: 'Water Bill (50/50)', calculate: this.calculate5050Split.bind(this) }
        };
    }

    /**
     * Add a new person
     * @param {string} name
     * @param {number} initialBalance
     */
    addPerson(name, initialBalance = 0) {
        const person = {
            id: this.generateId(),
            name,
            balance: initialBalance
        };
        this.people.push(person);
        this.saveData();
        return person;
    }

    /**
     * Remove a person
     * @param {string} personId
     */
    removePerson(personId) {
        this.people = this.people.filter(p => p.id !== personId);
        // Remove from expenses and payments
        this.expenses = this.expenses.filter(e => e.payeeId !== personId && !e.splits.some(s => s.personId === personId));
        this.payments = this.payments.filter(p => p.fromId !== personId && p.toId !== personId);
        this.saveData();
    }

    /**
     * Add an expense
     * @param {string} payeeId
     * @param {number} amount
     * @param {string} description
     * @param {string} icon
     * @param {Array<{personId: string, amount: number}>} splits
     * @param {string} date
     */
    addExpense(payeeId, amount, description, icon, splits, date = null) {
        const expenseDate = date ? new Date(date).toISOString() : new Date().toISOString();
        const expense = {
            id: this.generateId(),
            payeeId,
            amount,
            description,
            icon,
            date: expenseDate,
            splits
        };
        this.expenses.push(expense);

        // Update balances
        this.updateBalancesForExpense(expense);

        // Add to ledger
        this.addLedgerEntry('expense', expense.date, `${icon} ${description}`, splits.map(s => ({ personId: s.personId, amount: -s.amount })));

        this.saveData();
        return expense;
    }

    /**
     * Add a payment
     * @param {string} fromId
     * @param {string} toId
     * @param {number} amount
     * @param {string} description
     * @param {string} date
     */
    addPayment(fromId, toId, amount, description, date = null) {
        const paymentDate = date ? new Date(date).toISOString() : new Date().toISOString();
        const payment = {
            id: this.generateId(),
            fromId,
            toId,
            amount,
            description,
            date: paymentDate
        };
        this.payments.push(payment);

        // Update balances
        this.updateBalancesForPayment(payment);

        // Add to ledger
        this.addLedgerEntry('payment', payment.date, `💸 ${description}`, [
            { personId: fromId, amount: -amount },
            { personId: toId, amount: amount }
        ]);

        this.saveData();
        return payment;
    }

    /**
     * Update balances for an expense
     * @param {Expense} expense
     */
    updateBalancesForExpense(expense) {
        expense.splits.forEach(split => {
            const person = this.people.find(p => p.id === split.personId);
            if (person) {
                person.balance += split.amount;
            }
        });
    }

    /**
     * Update balances for a payment
     * @param {Payment} payment
     */
    updateBalancesForPayment(payment) {
        const fromPerson = this.people.find(p => p.id === payment.fromId);
        const toPerson = this.people.find(p => p.id === payment.toId);
        if (fromPerson) fromPerson.balance -= payment.amount;
        if (toPerson) toPerson.balance += payment.amount;
    }

    /**
     * Add entry to ledger
     * @param {string} type
     * @param {string} date
     * @param {string} description
     * @param {Array<{personId: string, amount: number}>} changes
     */
    addLedgerEntry(type, date, description, changes) {
        const entry = {
            id: this.generateId(),
            type,
            date,
            description,
            changes
        };
        this.ledger.push(entry);
    }

    /**
     * Calculate equal split
     * @param {number} amount
     * @param {Array<string>} personIds
     * @returns {Array<{personId: string, amount: number}>}
     */
    calculateEqualSplit(amount, personIds) {
        const splitAmount = amount / personIds.length;
        return personIds.map(personId => ({ personId, amount: splitAmount }));
    }

    /**
     * Calculate 50/50 split
     * @param {number} amount
     * @param {Array<string>} personIds
     * @returns {Array<{personId: string, amount: number}>}
     */
    calculate5050Split(amount, personIds) {
        if (personIds.length !== 2) return this.calculateEqualSplit(amount, personIds);
        const splitAmount = amount / 2;
        return personIds.map(personId => ({ personId, amount: splitAmount }));
    }

    /**
     * Get current balances
     * @returns {Array<Person>}
     */
    getBalances() {
        return this.people.map(person => ({ ...person }));
    }

    /**
     * Generate unique ID
     * @returns {string}
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Save data to localStorage
     */
    saveData() {
        const data = {
            people: this.people,
            expenses: this.expenses,
            payments: this.payments,
            ledger: this.ledger
        };
        localStorage.setItem('expenseTrackerData', JSON.stringify(data));
    }

    /**
     * Load data from localStorage
     */
    loadData() {
        const data = localStorage.getItem('expenseTrackerData');
        if (data) {
            const parsed = JSON.parse(data);
            this.people = parsed.people || [];
            this.expenses = parsed.expenses || [];
            this.payments = parsed.payments || [];
            this.ledger = parsed.ledger || [];
        }
    }

    /**
     * Export data as JSON
     * @returns {string}
     */
    exportData() {
        return JSON.stringify({
            people: this.people,
            expenses: this.expenses,
            payments: this.payments,
            ledger: this.ledger
        }, null, 2);
    }

    /**
     * Import data from JSON
     * @param {string} jsonData
     */
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            this.people = data.people || [];
            this.expenses = data.expenses || [];
            this.payments = data.payments || [];
            this.ledger = data.ledger || [];
            this.saveData();
        } catch (error) {
            throw new Error('Invalid JSON data');
        }
    }
}

// UI Controller
class UIController {
    /**
     * @param {ExpenseTracker} tracker
     */
    constructor(tracker) {
        this.tracker = tracker;
        this.currentTab = 'people';
        this.ledgerFilters = {
            type: '',
            personId: '',
            startDate: '',
            endDate: ''
        };
        this.ledgerPage = 1;
        this.ledgerPageSize = 10;
        this.currentExpenseToRepeat = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setDefaultDates();
        this.updateUI();
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.id.replace('Tab', ''));
            });
        });

        // Forms
        document.getElementById('addPersonForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPerson();
        });

        document.getElementById('addExpenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        document.getElementById('addPaymentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPayment();
        });

        document.getElementById('editExpenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.editExpense();
        });

        document.getElementById('repeatExpenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.repeatExpense();
        });

        // Template change
        document.getElementById('expenseTemplate').addEventListener('change', () => {
            this.updateSplitInputs();
        });

        // Ledger filters
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyLedgerFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearLedgerFilters();
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.ledgerPage > 1) {
                this.ledgerPage--;
                this.updateLedgerList();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            const totalPages = Math.ceil(this.getFilteredLedger().length / this.ledgerPageSize);
            if (this.ledgerPage < totalPages) {
                this.ledgerPage++;
                this.updateLedgerList();
            }
        });

        // Modal
        const modal = document.getElementById('repeatExpenseModal');
        const closeBtn = document.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Import/Export
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importData').addEventListener('click', () => {
            this.importData();
        });
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
        document.getElementById('paymentDate').value = today;
        document.getElementById('repeatDate').value = today;
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

        document.getElementById(tabName + 'Tab').classList.add('active');
        document.getElementById(tabName + 'Section').classList.add('active');

        this.currentTab = tabName;
        this.updateUI();
    }

    addPerson() {
        const name = document.getElementById('personName').value;
        const balance = parseFloat(document.getElementById('initialBalance').value) || 0;

        if (name.trim()) {
            this.tracker.addPerson(name, balance);
            this.updateUI();
            document.getElementById('addPersonForm').reset();
        }
    }

    addExpense() {
        const payeeId = document.getElementById('expensePayee').value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const description = document.getElementById('expenseDescription').value;
        const date = document.getElementById('expenseDate').value;
        const icon = document.getElementById('expenseIcon').value;
        const template = document.getElementById('expenseTemplate').value;

        if (payeeId && amount > 0 && description.trim()) {
            let splits = [];

            if (template) {
                const personIds = this.tracker.people.map(p => p.id);
                splits = this.tracker.templates[template].calculate(amount, personIds);
            } else {
                // Custom splits - collect from inputs
                splits = this.collectCustomSplits(amount);
            }

            this.tracker.addExpense(payeeId, amount, description, icon, splits, date);
            this.updateUI();
            document.getElementById('addExpenseForm').reset();
            this.setDefaultDates();
            this.updateSplitInputs();
        }
    }

    collectCustomSplits(totalAmount) {
        const splits = [];
        let collectedAmount = 0;

        this.tracker.people.forEach(person => {
            const input = document.getElementById(`split-${person.id}`);
            if (input) {
                const amount = parseFloat(input.value) || 0;
                if (amount > 0) {
                    splits.push({ personId: person.id, amount });
                    collectedAmount += amount;
                }
            }
        });

        // If amounts don't add up, adjust proportionally
        if (Math.abs(collectedAmount - totalAmount) > 0.01) {
            const ratio = totalAmount / collectedAmount;
            splits.forEach(split => split.amount *= ratio);
        }

        return splits;
    }

    addPayment() {
        const fromId = document.getElementById('paymentFrom').value;
        const toId = document.getElementById('paymentTo').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const description = document.getElementById('paymentDescription').value;
        const date = document.getElementById('paymentDate').value;

        if (fromId && toId && amount > 0 && description.trim()) {
            this.tracker.addPayment(fromId, toId, amount, description, date);
            this.updateUI();
            document.getElementById('addPaymentForm').reset();
            this.setDefaultDates();
        }
    }

    openEditModal(expenseId) {
        this.currentExpenseToEdit = this.tracker.expenses.find(e => e.id === expenseId);
        if (!this.currentExpenseToEdit) return;

        const modal = document.getElementById('editExpenseModal');
        document.getElementById('editExpensePayee').value = this.currentExpenseToEdit.payeeId;
        document.getElementById('editExpenseAmount').value = this.currentExpenseToEdit.amount;
        document.getElementById('editExpenseDescription').value = this.currentExpenseToEdit.description;
        document.getElementById('editExpenseDate').value = new Date(this.currentExpenseToEdit.date).toISOString().split('T')[0];
        document.getElementById('editExpenseIcon').value = this.currentExpenseToEdit.icon;
        this.updateEditSplitInputs();
        modal.style.display = 'block';
    }

    openRepeatModal(expenseId) {
        this.currentExpenseToRepeat = this.tracker.expenses.find(e => e.id === expenseId);
        if (!this.currentExpenseToRepeat) return;

        const modal = document.getElementById('repeatExpenseModal');
        document.getElementById('repeatAmount').value = this.currentExpenseToRepeat.amount;
        document.getElementById('repeatDescription').value = this.currentExpenseToRepeat.description;
        document.getElementById('repeatIcon').value = this.currentExpenseToRepeat.icon;
        modal.style.display = 'block';
    }

    repeatExpense() {
        const amount = parseFloat(document.getElementById('repeatAmount').value);
        const description = document.getElementById('repeatDescription').value;
        const date = document.getElementById('repeatDate').value;
        const icon = document.getElementById('repeatIcon').value;

        if (amount > 0 && description.trim()) {
            // Calculate splits based on original proportions
            const splits = this.calculateRepeatSplits(amount);
            this.tracker.addExpense(this.currentExpenseToRepeat.payeeId, amount, description, icon, splits, date);
            this.updateUI();
            document.getElementById('repeatExpenseModal').style.display = 'none';
            this.currentExpenseToRepeat = null;
        }
    }

    editExpense() {
        const payeeId = document.getElementById('editExpensePayee').value;
        const amount = parseFloat(document.getElementById('editExpenseAmount').value);
        const description = document.getElementById('editExpenseDescription').value;
        const date = document.getElementById('editExpenseDate').value;
        const icon = document.getElementById('editExpenseIcon').value;

        if (payeeId && amount > 0 && description.trim()) {
            const splits = this.collectEditSplits(amount);

            // Reverse the original expense's balance changes
            this.reverseExpenseBalances(this.currentExpenseToEdit);

            // Update the expense
            this.currentExpenseToEdit.payeeId = payeeId;
            this.currentExpenseToEdit.amount = amount;
            this.currentExpenseToEdit.description = description;
            this.currentExpenseToEdit.date = new Date(date).toISOString();
            this.currentExpenseToEdit.icon = icon;
            this.currentExpenseToEdit.splits = splits;

            // Apply the new expense's balance changes
            this.tracker.updateBalancesForExpense(this.currentExpenseToEdit);

            // Update ledger entry
            this.updateLedgerEntryForExpense(this.currentExpenseToEdit);

            this.tracker.saveData();
            this.updateUI();
            document.getElementById('editExpenseModal').style.display = 'none';
            this.currentExpenseToEdit = null;
        }
    }

    reverseExpenseBalances(expense) {
        expense.splits.forEach(split => {
            const person = this.tracker.people.find(p => p.id === split.personId);
            if (person) {
                person.balance -= split.amount;
            }
        });
    }

    updateLedgerEntryForExpense(expense) {
        // Find and update the ledger entry for this expense
        const ledgerEntry = this.tracker.ledger.find(entry =>
            entry.type === 'expense' &&
            entry.date === expense.date &&
            entry.description.includes(expense.description)
        );

        if (ledgerEntry) {
            ledgerEntry.description = `${expense.icon} ${expense.description}`;
            ledgerEntry.changes = expense.splits.map(s => ({ personId: s.personId, amount: -s.amount }));
        }
    }

    collectEditSplits(totalAmount) {
        const splits = [];
        let collectedAmount = 0;

        this.tracker.people.forEach(person => {
            const input = document.getElementById(`edit-split-${person.id}`);
            if (input) {
                const amount = parseFloat(input.value) || 0;
                if (amount > 0) {
                    splits.push({ personId: person.id, amount });
                    collectedAmount += amount;
                }
            }
        });

        // If amounts don't add up, adjust proportionally
        if (Math.abs(collectedAmount - totalAmount) > 0.01) {
            const ratio = totalAmount / collectedAmount;
            splits.forEach(split => split.amount *= ratio);
        }

        return splits;
    }

    calculateRepeatSplits(totalAmount) {
        const originalTotal = this.currentExpenseToRepeat.amount;
        return this.currentExpenseToRepeat.splits.map(split => ({
            personId: split.personId,
            amount: (split.amount / originalTotal) * totalAmount
        }));
    }

    updateSplitInputs() {
        const template = document.getElementById('expenseTemplate').value;
        const container = document.getElementById('splitInputs');

        if (template) {
            container.innerHTML = '<p>Using template: splits will be calculated automatically</p>';
        } else {
            container.innerHTML = this.tracker.people.map(person =>
                `<div>
                    <label>${person.name}:</label>
                    <input type="number" id="split-${person.id}" step="0.01" placeholder="0.00">
                </div>`
            ).join('');
        }
    }

    applyLedgerFilters() {
        this.ledgerFilters.type = document.getElementById('ledgerTypeFilter').value;
        this.ledgerFilters.personId = document.getElementById('ledgerPersonFilter').value;
        this.ledgerFilters.startDate = document.getElementById('ledgerStartDate').value;
        this.ledgerFilters.endDate = document.getElementById('ledgerEndDate').value;
        this.ledgerPage = 1;
        this.updateLedgerList();
    }

    clearLedgerFilters() {
        this.ledgerFilters = {
            type: '',
            personId: '',
            startDate: '',
            endDate: ''
        };
        document.getElementById('ledgerTypeFilter').value = '';
        document.getElementById('ledgerPersonFilter').value = '';
        document.getElementById('ledgerStartDate').value = '';
        document.getElementById('ledgerEndDate').value = '';
        this.ledgerPage = 1;
        this.updateLedgerList();
    }

    getFilteredLedger() {
        return this.tracker.ledger.filter(entry => {
            if (this.ledgerFilters.type && entry.type !== this.ledgerFilters.type) return false;
            if (this.ledgerFilters.personId && !entry.changes.some(c => c.personId === this.ledgerFilters.personId)) return false;
            if (this.ledgerFilters.startDate && new Date(entry.date) < new Date(this.ledgerFilters.startDate)) return false;
            if (this.ledgerFilters.endDate && new Date(entry.date) > new Date(this.ledgerFilters.endDate + 'T23:59:59')) return false;
            return true;
        });
    }

    updateUI() {
        this.updatePeopleList();
        this.updatePayeeSelect();
        this.updatePaymentSelects();
        this.updateExpensesList();
        this.updateBalancesList();
        this.updateLedgerList();
        this.updateLedgerFilters();
        this.updateSplitInputs();
    }

    updatePeopleList() {
        const container = document.getElementById('peopleList');
        container.innerHTML = this.tracker.people.map(person =>
            `<div class="person-item">
                <span>${person.name} - Balance: $${person.balance.toFixed(2)}</span>
                <button onclick="uiController.removePerson('${person.id}')">Remove</button>
            </div>`
        ).join('');
    }

    updatePayeeSelect() {
        const select = document.getElementById('expensePayee');
        select.innerHTML = '<option value="">Select Payee</option>' +
            this.tracker.people.map(person => `<option value="${person.id}">${person.name}</option>`).join('');
    }

    updateEditPayeeSelect() {
        const select = document.getElementById('editExpensePayee');
        select.innerHTML = '<option value="">Select Payee</option>' +
            this.tracker.people.map(person => `<option value="${person.id}">${person.name}</option>`).join('');
    }

    updateEditSplitInputs() {
        const container = document.getElementById('editSplitInputs');
        container.innerHTML = this.tracker.people.map(person => {
            const existingSplit = this.currentExpenseToEdit.splits.find(s => s.personId === person.id);
            const amount = existingSplit ? existingSplit.amount : 0;
            return `<div>
                <label>${person.name}:</label>
                <input type="number" id="edit-split-${person.id}" step="0.01" value="${amount}" placeholder="0.00">
            </div>`;
        }).join('');
    }

    updatePaymentSelects() {
        const fromSelect = document.getElementById('paymentFrom');
        const toSelect = document.getElementById('paymentTo');
        const options = '<option value="">Select Person</option>' +
            this.tracker.people.map(person => `<option value="${person.id}">${person.name}</option>`).join('');

        fromSelect.innerHTML = options;
        toSelect.innerHTML = options;
    }

    updateExpensesList() {
        const container = document.getElementById('expensesList');
        container.innerHTML = this.tracker.expenses.map(expense => {
            const payee = this.tracker.people.find(p => p.id === expense.payeeId);
            const splits = expense.splits.map(split => {
                const person = this.tracker.people.find(p => p.id === split.personId);
                return `${person.name}: $${split.amount.toFixed(2)}`;
            }).join(', ');

            return `<div class="expense-item">
                <span>${expense.icon} ${expense.description} - $${expense.amount.toFixed(2)} (Paid by ${payee.name})</span>
                <div>Splits: ${splits}</div>
                <button onclick="uiController.openEditModal('${expense.id}')">Edit</button>
                <button onclick="uiController.openRepeatModal('${expense.id}')">Repeat</button>
            </div>`;
        }).join('');
    }

    updateBalancesList() {
        const container = document.getElementById('balancesList');
        const balances = this.tracker.getBalances();
        container.innerHTML = balances.map(person =>
            `<div class="balance-item ${person.balance >= 0 ? 'positive' : 'negative'}">
                <span>${person.name}: $${person.balance.toFixed(2)}</span>
            </div>`
        ).join('');
    }

    updateLedgerFilters() {
        const personFilter = document.getElementById('ledgerPersonFilter');
        personFilter.innerHTML = '<option value="">All People</option>' +
            this.tracker.people.map(person => `<option value="${person.id}">${person.name}</option>`).join('');
    }

    updateLedgerList() {
        const container = document.getElementById('ledgerList');
        const filteredLedger = this.getFilteredLedger();
        const startIndex = (this.ledgerPage - 1) * this.ledgerPageSize;
        const endIndex = startIndex + this.ledgerPageSize;
        const pageEntries = filteredLedger.slice().reverse().slice(startIndex, endIndex);

        container.innerHTML = pageEntries.map(entry => {
            const changes = entry.changes.map(change => {
                const person = this.tracker.people.find(p => p.id === change.personId);
                return `${person.name}: ${change.amount >= 0 ? '+' : ''}$${change.amount.toFixed(2)}`;
            }).join(', ');

            return `<div class="ledger-item">
                <span>${new Date(entry.date).toLocaleString()} - ${entry.description}</span>
                <div>Changes: ${changes}</div>
            </div>`;
        }).join('');

        // Update pagination
        const totalPages = Math.ceil(filteredLedger.length / this.ledgerPageSize);
        document.getElementById('pageInfo').textContent = `Page ${this.ledgerPage} of ${totalPages}`;
        document.getElementById('prevPage').disabled = this.ledgerPage === 1;
        document.getElementById('nextPage').disabled = this.ledgerPage === totalPages;
    }

    removePerson(personId) {
        if (confirm('Are you sure you want to remove this person? This will also remove their expenses and payments.')) {
            this.tracker.removePerson(personId);
            this.updateUI();
        }
    }

    exportData() {
        const data = this.tracker.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'expense-tracker-data.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    importData() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    this.tracker.importData(e.target.result);
                    this.updateUI();
                    alert('Data imported successfully!');
                } catch (error) {
                    alert('Error importing data: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    }
}

// Initialize the application
const tracker = new ExpenseTracker();
tracker.loadData();
const uiController = new UIController(tracker);
