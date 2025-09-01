const output = document.getElementById('output');
const commandInput = document.getElementById('command-input');

// Web Audio API for typing sound
let audioContext;
let typingSoundBuffer;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Create a simple typing sound using oscillator
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
        // Fallback if Web Audio API is not supported
        console.log('Web Audio API not supported');
    }
}

function playTypingSound() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    initAudio();
}

let currentStage = 0;
let cipherMode = false;
let cipherText = '';

const stages = [
    {
        intro: "Welcome to CyberHeist Terminal v2.0\nInitializing connection to dark web...\nConnection established.\n\nAvailable commands: help, scan, hack, clear\n\nType 'help' for more information.\n",
        commands: {
            help: "Available commands:\n- scan: Scan the network for vulnerabilities\n- hack: Attempt to breach the system\n- decrypt: Decrypt encrypted data\n- clear: Clear the terminal screen\n- help: Show this help message\n",
            scan: "Scanning network...\nVulnerabilities found: Firewall weakness detected.\nProceed to 'hack' to exploit.\n",
            hack: "Hacking initiated...\nBypassing firewall...\nAccess granted to level 1.\n\nNew command available: decrypt\n",
            decrypt: "Decrypting data...\nData contains encrypted message.\nUse 'cipher' to solve the code.\n",
            clear: ""
        }
    },
    {
        intro: "Level 2 accessed. Advanced systems detected.\n\nAvailable commands: help, scan, hack, decrypt, cipher, clear\n",
        commands: {
            help: "Available commands:\n- scan: Deep scan for hidden data\n- hack: Breach advanced security\n- decrypt: Decrypt level 2 data\n- cipher: Enter cipher mode\n- clear: Clear the terminal screen\n- help: Show this help message\n",
            scan: "Deep scanning...\nHidden database found.\nContains valuable information.\n",
            hack: "Advanced hacking...\nSecurity protocols bypassed.\nLevel 3 access granted.\n",
            decrypt: "Decrypting level 2 data...\nMessage: 'The vault code is encrypted.'\n",
            cipher: "Entering cipher mode...\nDecrypt this Caesar cipher (shift 3): 'Wkh ydxow frgh lv'\nType your answer: ",
            clear: ""
        }
    },
    {
        intro: "Level 3: The Vault\nFinal stage reached.\n\nAvailable commands: help, unlock, clear\n",
        commands: {
            help: "Available commands:\n- unlock: Attempt to unlock the vault\n- clear: Clear the terminal screen\n- help: Show this help message\n",
            unlock: "Vault unlocked!\nCongratulations! You have completed the cyber-heist.\n\nThe end.\n",
            clear: ""
        }
    }
];

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
}

function clearOutput() {
    output.textContent = '';
}

function processCommand(command) {
    const cmd = command.trim().toLowerCase();

    if (cipherMode) {
        if (cmd === 'the vault code is') {
            displayText("Correct! Cipher solved.\nAccessing level 3...\n\n");
            currentStage = 2;
            cipherMode = false;
            displayText(stages[currentStage].intro);
        } else {
            displayText("Incorrect. Try again.\n");
        }
        return;
    }

    if (stages[currentStage].commands[cmd]) {
        if (cmd === 'clear') {
            clearOutput();
            displayText(stages[currentStage].intro);
        } else {
            displayText(stages[currentStage].commands[cmd]);

            if (cmd === 'hack' && currentStage === 0) {
                currentStage = 1;
                displayText(stages[currentStage].intro);
            } else if (cmd === 'hack' && currentStage === 1) {
                currentStage = 2;
                displayText(stages[currentStage].intro);
            } else if (cmd === 'cipher') {
                cipherMode = true;
            }
        }
    } else {
        displayText(`Command not recognized: ${cmd}\nType 'help' for available commands.\n`);
    }
}

commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = commandInput.value;
        displayText(`hacker@cyberheist:~$ ${command}\n`);
        processCommand(command);
        commandInput.value = '';
    }
});

// Initialize with typing effect
typeText(stages[currentStage].intro);
