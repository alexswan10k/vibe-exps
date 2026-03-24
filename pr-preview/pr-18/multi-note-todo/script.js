// Multi-Note Todo App JavaScript

class TodoApp {
    constructor() {
        this.notes = this.loadNotes();
        this.currentNoteId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderNotes();
        this.showEmptyStateIfNeeded();
    }

    bindEvents() {
        // Add note button
        document.getElementById('addNoteBtn').addEventListener('click', () => {
            this.showNoteModal();
        });

        // Save note button
        document.getElementById('saveNoteBtn').addEventListener('click', () => {
            this.saveNote();
        });

        // Save todo button
        document.getElementById('saveTodoBtn').addEventListener('click', () => {
            this.saveTodo();
        });

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });

        // Enter key support for inputs
        document.getElementById('noteTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveNote();
            }
        });

        document.getElementById('todoText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTodo();
            }
        });
    }

    showNoteModal() {
        document.getElementById('noteModal').style.display = 'block';
        document.getElementById('noteTitle').focus();
    }

    showTodoModal(noteId) {
        this.currentNoteId = noteId;
        const note = this.notes.find(n => n.id === noteId);
        document.getElementById('currentNoteTitle').textContent = note.title;
        document.getElementById('todoModal').style.display = 'block';
        document.getElementById('todoText').focus();
    }

    closeModals() {
        document.getElementById('noteModal').style.display = 'none';
        document.getElementById('todoModal').style.display = 'none';
        this.clearInputs();
    }

    clearInputs() {
        document.getElementById('noteTitle').value = '';
        document.getElementById('todoText').value = '';
    }

    saveNote() {
        const title = document.getElementById('noteTitle').value.trim();
        if (!title) {
            alert('Please enter a note title');
            return;
        }

        const note = {
            id: Date.now().toString(),
            title: title,
            todos: [],
            createdAt: new Date().toISOString()
        };

        this.notes.push(note);
        this.saveNotes();
        this.renderNotes();
        this.closeModals();
        this.showEmptyStateIfNeeded();
    }

    saveTodo() {
        const text = document.getElementById('todoText').value.trim();
        if (!text) {
            alert('Please enter a todo item');
            return;
        }

        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (!note) return;

        const todo = {
            id: Date.now().toString(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        note.todos.push(todo);
        this.saveNotes();
        this.renderNotes();
        this.closeModals();
    }

    toggleTodo(noteId, todoId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const todo = note.todos.find(t => t.id === todoId);
        if (!todo) return;

        todo.completed = !todo.completed;
        this.saveNotes();
        this.renderNotes();
    }

    deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note and all its todos?')) {
            return;
        }

        this.notes = this.notes.filter(n => n.id !== noteId);
        this.saveNotes();
        this.renderNotes();
        this.showEmptyStateIfNeeded();
    }

    deleteTodo(noteId, todoId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        note.todos = note.todos.filter(t => t.id !== todoId);
        this.saveNotes();
        this.renderNotes();
    }

    renderNotes() {
        const container = document.getElementById('notesContainer');
        container.innerHTML = '';

        this.notes.forEach(note => {
            const noteElement = this.createNoteElement(note);
            container.appendChild(noteElement);
        });
    }

    createNoteElement(note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-card';
        noteDiv.innerHTML = `
            <div class="note-header">
                <div class="note-title">${this.escapeHtml(note.title)}</div>
                <div class="note-actions">
                    <button class="btn secondary small" onclick="app.showTodoModal('${note.id}')">Add Todo</button>
                    <button class="btn danger small" onclick="app.deleteNote('${note.id}')">Delete</button>
                </div>
            </div>
            <div class="todo-list">
                ${note.todos.length === 0 ?
                    '<div style="text-align: center; color: #6c757d; padding: 20px; font-style: italic;">No todos yet. Click "Add Todo" to get started!</div>' :
                    note.todos.map(todo => this.createTodoElement(note.id, todo)).join('')
                }
            </div>
        `;

        return noteDiv;
    }

    createTodoElement(noteId, todo) {
        return `
            <div class="todo-item">
                <input type="checkbox"
                       class="todo-checkbox"
                       ${todo.completed ? 'checked' : ''}
                       onchange="app.toggleTodo('${noteId}', '${todo.id}')">
                <span class="todo-text ${todo.completed ? 'completed' : ''}">${this.escapeHtml(todo.text)}</span>
                <div class="todo-actions">
                    <button class="btn danger small" onclick="app.deleteTodo('${noteId}', '${todo.id}')">×</button>
                </div>
            </div>
        `;
    }

    showEmptyStateIfNeeded() {
        const container = document.getElementById('notesContainer');
        const emptyState = document.querySelector('.empty-state');

        if (this.notes.length === 0) {
            if (!emptyState) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-state';
                emptyDiv.innerHTML = `
                    <h2>Welcome to Multi-Note Todo!</h2>
                    <p>You don't have any notes yet. Click "Add New Note" to create your first note and start organizing your todos.</p>
                `;
                container.appendChild(emptyDiv);
            }
        } else {
            if (emptyState) {
                emptyState.remove();
            }
        }
    }

    loadNotes() {
        const notes = localStorage.getItem('multiNoteTodos');
        return notes ? JSON.parse(notes) : [];
    }

    saveNotes() {
        localStorage.setItem('multiNoteTodos', JSON.stringify(this.notes));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TodoApp();
});
