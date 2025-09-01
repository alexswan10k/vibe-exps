const output = document.getElementById('output');
const commandInput = document.getElementById('command-input');
const prompt = document.getElementById('prompt');

// Web Audio API for typing sound
let audioContext;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function playTypingSound() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    initAudio();
}

// Simulated filesystem
const fs = {
    '/': {
        type: 'dir',
        contents: {
            'home': {
                type: 'dir',
                contents: {
                    'user': {
                        type: 'dir',
                        contents: {
                            'documents': {
                                type: 'dir',
                                contents: {
                                    'secret.txt': {
                                        type: 'file',
                                        content: 'This is a secret file.\nIt contains valuable information.\n'
                                    },
                                    'notes.txt': {
                                        type: 'file',
                                        content: 'Remember to hack the mainframe.\n'
                                    }
                                }
                            },
                            'downloads': {
                                type: 'dir',
                                contents: {}
                            }
                        }
                    }
                }
            },
            'etc': {
                type: 'dir',
                contents: {
                    'passwd': {
                        type: 'file',
                        content: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash\n'
                    },
                    'hosts': {
                        type: 'file',
                        content: '127.0.0.1 localhost\n::1 localhost\n'
                    }
                }
            },
            'var': {
                type: 'dir',
                contents: {
                    'log': {
                        type: 'dir',
                        contents: {
                            'syslog': {
                                type: 'file',
                                content: 'System log entries...\nHacker detected!\n'
                            }
                        }
                    }
                }
            },
            'bin': {
                type: 'dir',
                contents: {
                    'ls': { type: 'file', content: 'ls command' },
                    'cd': { type: 'file', content: 'cd command' },
                    'pwd': { type: 'file', content: 'pwd command' },
                    'cat': { type: 'file', content: 'cat command' },
                    'echo': { type: 'file', content: 'echo command' },
                    'grep': { type: 'file', content: 'grep command' }
                }
            }
        }
    }
};

let currentPath = ['/'];

function getCurrentDir() {
    let dir = fs['/'];
    for (let p of currentPath.slice(1)) {
        if (dir.contents && dir.contents[p]) {
            dir = dir.contents[p];
        } else {
            return null;
        }
    }
    return dir;
}

function resolvePath(path) {
    if (path.startsWith('/')) {
        return path.split('/').filter(p => p);
    } else {
        let newPath = [...currentPath];
        const parts = path.split('/').filter(p => p);
        for (let part of parts) {
            if (part === '..') {
                if (newPath.length > 1) newPath.pop();
            } else if (part !== '.') {
                newPath.push(part);
            }
        }
        return newPath;
    }
}

function getNode(path) {
    const resolved = resolvePath(path);
    let node = fs['/'];
    let start = (resolved.length > 0 && resolved[0] === '/') ? 1 : 0;
    for (let p of resolved.slice(start)) {
        if (node.contents && node.contents[p]) {
            node = node.contents[p];
        } else {
            return null;
        }
    }
    return node;
}

function typeText(text, callback) {
    let i = 0;
    const interval = setInterval(() => {
        output.textContent += text[i];
        playTypingSound();
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            if (callback) callback();
        }
    }, 50);
}

function displayText(text) {
    output.textContent += text;
    output.scrollTop = output.scrollHeight; // Autoscroll to bottom
}

function clearOutput() {
    output.textContent = '';
}

function updatePrompt() {
    prompt.textContent = `hacker@cyberheist:${currentPath.join('/').replace('//', '/')}$ `;
    updateButtons();
}

function updateButtons() {
    const buttonsDiv = document.getElementById('command-buttons');
    buttonsDiv.innerHTML = '';

    // Fixed buttons
    const fixedButtons = [
        { text: 'ls', cmd: 'ls' },
        { text: 'pwd', cmd: 'pwd' },
        { text: 'help', cmd: 'help' },
        { text: 'clear', cmd: 'clear' }
    ];

    fixedButtons.forEach(b => {
        const btn = document.createElement('button');
        btn.textContent = b.text;
        btn.onclick = () => runCommand(b.cmd);
        buttonsDiv.appendChild(btn);
    });

    // Dynamic buttons for current directory contents
    const dir = getCurrentDir();
    if (dir && Object.keys(dir.contents).length > 0) {
        Object.keys(dir.contents).slice(0, 4).forEach(item => {  // Limit to 4 to not overcrowd
            const node = dir.contents[item];
            if (node.type === 'dir') {
                const btn = document.createElement('button');
                btn.textContent = 'cd ' + item;
                btn.onclick = () => runCommand('cd ' + item);
                buttonsDiv.appendChild(btn);
            } else if (node.type === 'file') {
                const btn = document.createElement('button');
                btn.textContent = 'cat ' + item;
                btn.onclick = () => runCommand('cat ' + item);
                buttonsDiv.appendChild(btn);
            }
        });
    }
}

const commands = {
    ls: (args, stdin) => {
        if (args.length > 0) {
            const node = getNode(args[0]);
            if (!node) {
                return 'ls: cannot access ' + args[0] + ': No such file or directory\n';
            }
            if (node.type === 'file') {
                return args[0] + '\n';
            }
            return Object.keys(node.contents).join(' ') + '\n';
        } else {
            const dir = getCurrentDir();
            if (!dir) {
                return 'ls: cannot access . : No such file or directory\n';
            }
            return Object.keys(dir.contents).join(' ') + '\n';
        }
    },
    cd: (args, stdin) => {
        const newPath = args.length > 0 ? resolvePath(args[0]) : ['/'];
        const target = getNode(newPath.join('/').replace('//', '/'));
        if (!target) {
            return 'cd: ' + (args.length > 0 ? args[0] : '/') + ': No such file or directory\n';
        }
        if (target.type !== 'dir') {
            return 'cd: ' + (args.length > 0 ? args[0] : '/') + ': Not a directory\n';
        }
        currentPath = newPath;
        updatePrompt();
        return '';
    },
    pwd: (args, stdin) => {
        return currentPath.join('/').replace('//', '/') + '\n';
    },
    cat: (args, stdin) => {
        if (args.length === 0) return 'cat: missing file operand\n';
        const file = getNode(args[0]);
        if (!file) {
            return 'cat: ' + args[0] + ': No such file or directory\n';
        }
        if (file.type !== 'file') {
            return 'cat: ' + args[0] + ': Is a directory\n';
        }
        return file.content;
    },
    echo: (args, stdin) => {
        return args.join(' ') + '\n';
    },
    grep: (args, stdin) => {
        if (args.length < 1) return 'grep: missing pattern\n';
        const pattern = args[0];
        const lines = stdin.split('\n');
        return lines.filter(line => line.includes(pattern)).join('\n') + '\n';
    },
    help: (args, stdin) => {
        return 'Available commands:\n- ls [dir]: list directory contents\n- cd [dir]: change directory\n- pwd: print working directory\n- cat [file]: display file contents\n- echo [text]: display text\n- grep [pattern]: search for pattern\n- clear: clear screen\n- help: show this help\n';
    },
    clear: (args, stdin) => {
        clearOutput();
        return '';
    }
};

function executeCommand(cmd, args, stdin = '') {
    if (commands[cmd]) {
        return commands[cmd](args, stdin);
    } else {
        return `Command not found: ${cmd}\n`;
    }
}

function processCommand(command) {
    const parts = command.split('|').map(p => p.trim());
    let stdin = '';

    for (let i = 0; i < parts.length; i++) {
        const cmdParts = parts[i].split(/\s+/);
        const cmd = cmdParts[0];
        const args = cmdParts.slice(1);
        stdin = executeCommand(cmd, args, stdin);
    }

    displayText(stdin);
}

function runCommand(cmd) {
    displayText(`hacker@cyberheist:${currentPath.join('/').replace('//', '/')}$ ${cmd}\n`);
    processCommand(cmd);
}

function getCompletions(prefix, context) {
    if (context === 'command') {
        return Object.keys(commands).filter(cmd => cmd.startsWith(prefix));
    } else if (context === 'path') {
        const dir = getCurrentDir();
        if (!dir) return [];
        return Object.keys(dir.contents).filter(item => item.startsWith(prefix));
    }
    return [];
}

let tabIndex = 0;
let lastCompletions = [];

commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = commandInput.value;
        runCommand(command);
        commandInput.value = '';
        tabIndex = 0;
        lastCompletions = [];
    } else if (e.key === 'Tab') {
        e.preventDefault();
        const input = commandInput.value;
        const parts = input.split(/\s+/);
        const lastPart = parts[parts.length - 1];
        const isFirstWord = parts.length === 1;

        let completions;
        if (isFirstWord) {
            completions = getCompletions(lastPart, 'command');
        } else {
            completions = getCompletions(lastPart, 'path');
        }

        if (completions.length === 0) {
            return;
        }

        if (completions.length === 1) {
            parts[parts.length - 1] = completions[0];
            commandInput.value = parts.join(' ');
            tabIndex = 0;
            lastCompletions = [];
        } else {
            if (lastCompletions.length === 0 || JSON.stringify(lastCompletions) !== JSON.stringify(completions)) {
                lastCompletions = completions;
                tabIndex = 0;
            }
            parts[parts.length - 1] = completions[tabIndex];
            commandInput.value = parts.join(' ');
            tabIndex = (tabIndex + 1) % completions.length;
        }
    } else {
        tabIndex = 0;
        lastCompletions = [];
    }
});

// Initialize
const intro = "Welcome to CyberHeist Terminal v3.0\nSimulated Linux environment loaded.\n\nType 'help' for available commands.\n";
typeText(intro, updatePrompt);
