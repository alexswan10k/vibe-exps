// Time Tracker App
class TimeTracker {
    constructor() {
        this.projects = JSON.parse(localStorage.getItem('timetracker_projects')) || [];
        this.entries = JSON.parse(localStorage.getItem('timetracker_entries')) || [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.setDefaultDate();
        this.renderProjects();
        this.renderProjectSelect();
        this.renderEntries();
        this.updateTotalHours();
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('entry-date').value = today;
    }

    bindEvents() {
        // Project management
        document.getElementById('add-project').addEventListener('click', () => this.addProject());

        // Time entry
        document.getElementById('time-entry-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTimeEntry();
        });

        // Filtering
        document.getElementById('filter-btn').addEventListener('click', () => this.filterEntries());
        document.getElementById('clear-filter').addEventListener('click', () => this.clearFilter());

        // CSV operations
        document.getElementById('export-csv').addEventListener('click', () => this.exportToCSV());
        document.getElementById('import-btn').addEventListener('click', () => this.importFromCSV());
    }

    addProject() {
        const projectName = document.getElementById('project-name').value.trim();
        if (projectName && !this.projects.includes(projectName)) {
            this.projects.push(projectName);
            this.saveProjects();
            this.renderProjects();
            this.renderProjectSelect();
            document.getElementById('project-name').value = '';
        }
    }

    renderProjects() {
        const projectsList = document.getElementById('projects-list');
        projectsList.innerHTML = '';
        this.projects.forEach((project, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${project}
                <button onclick="tracker.deleteProject(${index})">Delete</button>
            `;
            projectsList.appendChild(li);
        });
    }

    deleteProject(index) {
        this.projects.splice(index, 1);
        this.saveProjects();
        this.renderProjects();
        this.renderProjectSelect();
        // Remove entries for this project
        this.entries = this.entries.filter(entry => entry.project !== this.projects[index]);
        this.saveEntries();
        this.renderEntries();
        this.updateTotalHours();
    }

    renderProjectSelect() {
        const select = document.getElementById('project-select');
        const filterSelect = document.getElementById('filter-project');
        select.innerHTML = '<option value="">Select Project</option>';
        filterSelect.innerHTML = '<option value="">All Projects</option>';

        this.projects.forEach(project => {
            select.innerHTML += `<option value="${project}">${project}</option>`;
            filterSelect.innerHTML += `<option value="${project}">${project}</option>`;
        });
    }

    addTimeEntry() {
        const project = document.getElementById('project-select').value;
        const date = document.getElementById('entry-date').value;
        const hours = parseFloat(document.getElementById('hours').value);
        const description = document.getElementById('description').value;

        if (project && date && hours > 0) {
            const entry = { id: Date.now(), project, date, hours, description };
            this.entries.push(entry);
            this.saveEntries();
            this.renderEntries();
            this.updateTotalHours();
            document.getElementById('time-entry-form').reset();
            this.setDefaultDate(); // Reset date to today after form submission
        }
    }

    renderEntries(entriesToRender = this.entries) {
        const tbody = document.getElementById('entries-body');
        tbody.innerHTML = '';

        entriesToRender.sort((a, b) => new Date(b.date) - new Date(a.date));

        entriesToRender.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${this.formatDate(entry.date)}</td>
                <td>${entry.project}</td>
                <td>${entry.hours}</td>
                <td>${entry.description || ''}</td>
                <td><button onclick="tracker.deleteEntry(${entry.id})">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    deleteEntry(id) {
        this.entries = this.entries.filter(entry => entry.id !== id);
        this.saveEntries();
        this.renderEntries();
        this.updateTotalHours();
    }

    filterEntries() {
        const projectFilter = document.getElementById('filter-project').value;
        const monthFilter = document.getElementById('filter-month').value;

        let filteredEntries = this.entries;

        if (projectFilter) {
            filteredEntries = filteredEntries.filter(entry => entry.project === projectFilter);
        }

        if (monthFilter) {
            filteredEntries = filteredEntries.filter(entry => {
                const entryMonth = entry.date.substring(0, 7); // YYYY-MM
                return entryMonth === monthFilter;
            });
        }

        this.renderEntries(filteredEntries);
        this.updateTotalHours(filteredEntries);
    }

    clearFilter() {
        document.getElementById('filter-project').value = '';
        document.getElementById('filter-month').value = '';
        this.renderEntries();
        this.updateTotalHours();
    }

    updateTotalHours(entriesToSum = this.entries) {
        const total = entriesToSum.reduce((sum, entry) => sum + entry.hours, 0);
        document.getElementById('total-hours').textContent = total.toFixed(2);
    }

    exportToCSV() {
        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'time_entries.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    generateCSV() {
        const headers = ['Date', 'Project', 'Hours', 'Description'];
        const rows = this.entries.map(entry => [
            entry.date,
            entry.project,
            entry.hours,
            entry.description || ''
        ]);

        const csvData = [headers, ...rows];
        return csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    }

    importFromCSV() {
        const fileInput = document.getElementById('import-csv');
        const file = fileInput.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const csvText = e.target.result;
                this.parseCSV(csvText);
            };
            reader.readAsText(file);
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));

        // Assuming CSV format: Date,Project,Hours,Description
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
            if (values.length >= 3) {
                const [date, project, hoursStr, description] = values;
                const hours = parseFloat(hoursStr);

                if (date && project && !isNaN(hours)) {
                    // Add project if it doesn't exist
                    if (!this.projects.includes(project)) {
                        this.projects.push(project);
                    }

                    const entry = {
                        id: Date.now() + i, // Ensure unique IDs
                        project,
                        date,
                        hours,
                        description: description || ''
                    };
                    this.entries.push(entry);
                }
            }
        }

        this.saveProjects();
        this.saveEntries();
        this.renderProjects();
        this.renderProjectSelect();
        this.renderEntries();
        this.updateTotalHours();
    }

    saveProjects() {
        localStorage.setItem('timetracker_projects', JSON.stringify(this.projects));
    }

    saveEntries() {
        localStorage.setItem('timetracker_entries', JSON.stringify(this.entries));
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
}

// Initialize the app
const tracker = new TimeTracker();
