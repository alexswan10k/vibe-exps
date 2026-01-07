const canvas = document.getElementById('aquarium-canvas');
const ctx = canvas.getContext('2d');

let fish = [];
let bubbles = [];
let plants = [];
let showNeuralNetwork = false;
let showDebugWeights = false; // Hidden by default as requested
let trainingMode = 'adversarial'; // Always adversarial for automatic gameplay
let trainingData = [];
let currentTrainingExample = null;
let trainingStep = 0;

// Learning rate controls
let learningRates = {
    eatingReward: 0.10,
    positiveReward: 0.10,
    negativeReward: 0.10,
    preySurvival: 0.02,
    predatorHunting: 0.02
};

// Training log system
let trainingLog = [];
const MAX_LOG_ENTRIES = 50;

function addToTrainingLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        message,
        type
    };

    trainingLog.push(logEntry);

    // Keep only the last MAX_LOG_ENTRIES
    if (trainingLog.length > MAX_LOG_ENTRIES) {
        trainingLog = trainingLog.slice(-MAX_LOG_ENTRIES);
    }

    updateTrainingLogDisplay();
}

function updateTrainingLogDisplay() {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    logContainer.innerHTML = '';

    trainingLog.forEach(entry => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        let emoji = '📝';
        if (entry.message.includes('fish ate plant')) emoji = '🍽️';
        else if (entry.message.includes('positive reinforcement')) emoji = '👍';
        else if (entry.message.includes('negative reinforcement')) emoji = '👎';
        else if (entry.message.includes('prey survival')) emoji = '🐟';
        else if (entry.message.includes('predator hunting')) emoji = '🦈';
        else if (entry.message.includes('Round')) emoji = '🏆';
        else if (entry.message.includes('Winner')) emoji = '🎯';

        logEntry.textContent = `${emoji} ${entry.timestamp}: ${entry.message}`;
        logContainer.appendChild(logEntry);
    });

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearTrainingLog() {
    trainingLog = [];
    updateTrainingLogDisplay();
    addToTrainingLog('Log cleared by user');
}

// Adversarial round system
let currentRound = 0;
let roundTime = 0;
let roundDuration = 1800; // 30 seconds per round
let predatorScore = 0;
let preyScore = 0;
let roundActive = false;
let roundWinner = null;
let initialPreyCount = 0;
let initialPredatorCount = 0;

// === PHASE 3: Curriculum Learning ===
let difficultyLevel = 1;         // 1-10 scale
let preyWinStreak = 0;           // Consecutive prey wins
let predatorWinStreak = 0;       // Consecutive predator wins

// Difficulty affects predator capabilities
function getPredatorSpeedMultiplier() {
    return 0.5 + (difficultyLevel * 0.05); // 0.55 at level 1, 1.0 at level 10
}

function getPredatorDetectionRange() {
    return 100 + (difficultyLevel * 10); // 110 at level 1, 200 at level 10
}

// === PHASE 4: Genetic Evolution ===
let generation = 1;
let topPreySurvivors = [];      // Top 3 prey brains from last round
let topPredatorSurvivors = [];  // Top 3 predator brains from last round
let topPreyFitness = 0;
let topPredatorFitness = 0;

// Simple Neural Network for fish behavior
class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;

        // Initialize weights and biases
        this.weightsIH = this.randomMatrix(hiddenSize, inputSize);
        this.weightsHO = this.randomMatrix(outputSize, hiddenSize);
        this.biasH = this.randomMatrix(hiddenSize, 1);
        this.biasO = this.randomMatrix(outputSize, 1);

        // Learning parameters
        this.learningRate = 0.1;
    }

    randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = Math.random() * 2 - 1; // Random between -1 and 1
            }
        }
        return matrix;
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }

    sigmoidDerivative(x) {
        return x * (1 - x);
    }

    // Tanh activation - centered around 0, faster learning
    tanh(x) {
        return Math.tanh(x);
    }

    tanhDerivative(x) {
        return 1 - x * x;
    }

    matrixMultiply(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < b[0].length; j++) {
                let sum = 0;
                for (let k = 0; k < a[0].length; k++) {
                    sum += a[i][k] * b[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    matrixAdd(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < a[0].length; j++) {
                result[i][j] = a[i][j] + b[i][j];
            }
        }
        return result;
    }

    matrixSubtract(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < a[0].length; j++) {
                result[i][j] = a[i][j] - b[i][j];
            }
        }
        return result;
    }

    matrixTranspose(a) {
        const result = [];
        for (let i = 0; i < a[0].length; i++) {
            result[i] = [];
            for (let j = 0; j < a.length; j++) {
                result[i][j] = a[j][i];
            }
        }
        return result;
    }

    predict(inputs) {
        // Forward pass
        const inputMatrix = inputs.map(x => [x]);

        // Hidden layer
        let hidden = this.matrixMultiply(this.weightsIH, inputMatrix);
        hidden = this.matrixAdd(hidden, this.biasH);

        // Apply tanh activation for hidden layer (centered, faster learning)
        for (let i = 0; i < hidden.length; i++) {
            hidden[i][0] = this.tanh(hidden[i][0]);
        }

        // Output layer
        let output = this.matrixMultiply(this.weightsHO, hidden);
        output = this.matrixAdd(output, this.biasO);

        // Apply activation
        for (let i = 0; i < output.length; i++) {
            output[i][0] = this.sigmoid(output[i][0]);
        }

        return {
            output: output.map(x => x[0]),
            hidden: hidden.map(x => x[0])
        };
    }

    train(inputs, targets) {
        const result = this.predict(inputs);
        const outputs = result.output;
        const hiddens = result.hidden;

        const inputMatrix = inputs.map(x => [x]);
        const targetMatrix = targets.map(x => [x]);
        const outputMatrix = outputs.map(x => [x]);
        const hiddenMatrix = hiddens.map(x => [x]);

        // Calculate output layer errors
        const outputErrors = this.matrixSubtract(targetMatrix, outputMatrix);

        // Calculate hidden layer errors
        const weightsHOT = this.matrixTranspose(this.weightsHO);
        const hiddenErrors = this.matrixMultiply(weightsHOT, outputErrors);

        // Clip errors to prevent exploding gradients
        for (let i = 0; i < outputErrors.length; i++) {
            outputErrors[i][0] = Math.max(-1, Math.min(1, outputErrors[i][0]));
        }
        for (let i = 0; i < hiddenErrors.length; i++) {
            hiddenErrors[i][0] = Math.max(-1, Math.min(1, hiddenErrors[i][0]));
        }

        // Calculate mean squared error for tracking
        let totalError = 0;
        for (let i = 0; i < outputErrors.length; i++) {
            totalError += outputErrors[i][0] * outputErrors[i][0];
        }
        const mse = totalError / outputErrors.length;

        // Update output weights and biases
        for (let i = 0; i < this.weightsHO.length; i++) {
            for (let j = 0; j < this.weightsHO[0].length; j++) {
                this.weightsHO[i][j] += this.learningRate * outputErrors[i][0] * this.sigmoidDerivative(outputs[i]) * hiddens[j];
            }
        }

        for (let i = 0; i < this.biasO.length; i++) {
            this.biasO[i][0] += this.learningRate * outputErrors[i][0] * this.sigmoidDerivative(outputs[i]);
        }

        // Update hidden weights and biases (using tanh derivative)
        for (let i = 0; i < this.weightsIH.length; i++) {
            for (let j = 0; j < this.weightsIH[0].length; j++) {
                this.weightsIH[i][j] += this.learningRate * hiddenErrors[i][0] * this.tanhDerivative(hiddens[i]) * inputs[j];
            }
        }

        for (let i = 0; i < this.biasH.length; i++) {
            this.biasH[i][0] += this.learningRate * hiddenErrors[i][0] * this.tanhDerivative(hiddens[i]);
        }

        return mse; // Return the error for tracking
    }

    copy() {
        const copy = new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize);
        copy.weightsIH = JSON.parse(JSON.stringify(this.weightsIH));
        copy.weightsHO = JSON.parse(JSON.stringify(this.weightsHO));
        copy.biasH = JSON.parse(JSON.stringify(this.biasH));
        copy.biasO = JSON.parse(JSON.stringify(this.biasO));
        return copy;
    }

    mutate(rate = 0.1) {
        const mutateMatrix = (matrix) => {
            for (let i = 0; i < matrix.length; i++) {
                for (let j = 0; j < matrix[0].length; j++) {
                    if (Math.random() < rate) {
                        matrix[i][j] += (Math.random() * 2 - 1) * 0.5;
                        matrix[i][j] = Math.max(-2, Math.min(2, matrix[i][j]));
                    }
                }
            }
        };

        mutateMatrix(this.weightsIH);
        mutateMatrix(this.weightsHO);
        mutateMatrix(this.biasH);
        mutateMatrix(this.biasO);
    }

    // === PHASE 4: Genetic Crossover ===
    crossover(partner) {
        const child = new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize);

        // Crossover helper - randomly pick from either parent
        const crossoverMatrix = (m1, m2) => {
            const result = [];
            for (let i = 0; i < m1.length; i++) {
                result[i] = [];
                for (let j = 0; j < m1[0].length; j++) {
                    result[i][j] = Math.random() < 0.5 ? m1[i][j] : m2[i][j];
                }
            }
            return result;
        };

        child.weightsIH = crossoverMatrix(this.weightsIH, partner.weightsIH);
        child.weightsHO = crossoverMatrix(this.weightsHO, partner.weightsHO);
        child.biasH = crossoverMatrix(this.biasH, partner.biasH);
        child.biasO = crossoverMatrix(this.biasO, partner.biasO);

        return child;
    }

    // Save neural network to localStorage
    save(key) {
        try {
            const data = {
                inputSize: this.inputSize,
                hiddenSize: this.hiddenSize,
                outputSize: this.outputSize,
                weightsIH: this.weightsIH,
                weightsHO: this.weightsHO,
                biasH: this.biasH,
                biasO: this.biasO,
                learningRate: this.learningRate
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`🧠 Neural network saved to localStorage: ${key}`);
            return true;
        } catch (error) {
            console.error('Failed to save neural network:', error);
            return false;
        }
    }

    // Load neural network from localStorage
    static load(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            if (!data) {
                console.log(`No saved neural network found for: ${key}`);
                return null;
            }

            const network = new NeuralNetwork(data.inputSize, data.hiddenSize, data.outputSize);
            network.weightsIH = data.weightsIH;
            network.weightsHO = data.weightsHO;
            network.biasH = data.biasH;
            network.biasO = data.biasO;
            network.learningRate = data.learningRate;

            console.log(`🧠 Neural network loaded from localStorage: ${key}`);
            return network;
        } catch (error) {
            console.error(`Failed to load neural network ${key}:`, error);
            return null;
        }
    }

    // Delete neural network from localStorage
    static delete(key) {
        try {
            localStorage.removeItem(key);
            console.log(`🧠 Neural network deleted from localStorage: ${key}`);
            return true;
        } catch (error) {
            console.error('Failed to delete neural network:', error);
            return false;
        }
    }
}

class Fish {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.dx = Math.random() * 2 - 1;
        this.dy = Math.random() * 2 - 1;
        this.size = 20;
        this.hunger = 0; // Hunger level (0-100)
        this.maxHunger = 100;
        this.starvationTime = 0;
        this.lastAte = Date.now();
        this.energy = 50; // Energy for reproduction
        this.maxEnergy = 100;
    }

    update() {
        // Update hunger
        this.hunger += 0.5;
        if (this.hunger >= this.maxHunger) {
            this.starvationTime++;
            if (this.starvationTime > 600) { // Die after 10 seconds of starvation
                this.die();
            }
        }

        // Seek food if hungry
        if (this.hunger > 50) {
            this.seekFood();
        } else {
            // Random movement when not hungry
            this.x += this.dx;
            this.y += this.dy;
        }

        if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.dy *= -1;

        // Try to eat nearby plants
        this.eatPlants();

        // Reproduction check (prey reproduce more frequently)
        if (this.energy >= this.maxEnergy && Math.random() < 0.002) {
            this.reproduce();
        }
    }

    seekFood() {
        // Find nearest plant
        let nearestPlant = null;
        let nearestDistance = Infinity;

        for (const plant of plants) {
            const distance = Math.sqrt((this.x - plant.x) ** 2 + (this.y - plant.y) ** 2);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPlant = plant;
            }
        }

        if (nearestPlant) {
            // Move towards the plant
            const angle = Math.atan2(nearestPlant.y - this.y, nearestPlant.x - this.x);
            this.dx = Math.cos(angle) * 1.5; // Move faster when seeking food
            this.dy = Math.sin(angle) * 1.5;

            this.x += this.dx;
            this.y += this.dy;
        } else {
            // No plants found, random movement
            this.x += this.dx;
            this.y += this.dy;
        }
    }

    eatPlants() {
        // Find nearby plants
        for (let i = plants.length - 1; i >= 0; i--) {
            const plant = plants[i];
            const distance = Math.sqrt((this.x - plant.x) ** 2 + (this.y - plant.y) ** 2);
            if (distance < this.size + 20) {
                // Eat from the plant
                const plantDestroyed = plant.eat();

                // Reward the fish for eating
                this.hunger = Math.max(0, this.hunger - 40); // More hunger reduction
                this.energy = Math.min(this.maxEnergy, this.energy + 25); // More energy gain
                this.starvationTime = 0;
                this.lastAte = Date.now();

                // Visual reward - spawn bubbles
                this.spawnEatingReward();

                // Neural network reward for eating
                if (this.brain) {
                    const reward = [0.9, 0.9, 0.9, 0.9]; // Positive reinforcement
                    this.brain.learningRate = learningRates.eatingReward;
                    const error = this.brain.train(this.getSensoryInputs(), reward);
                    this.errorHistory.push(error);
                    if (this.errorHistory.length > this.maxErrorHistory) {
                        this.errorHistory.shift();
                    }
                    addToTrainingLog('fish ate plant');
                    console.log('🧠 Neural network trained - fish ate plant');
                }

                break;
            }
        }
    }

    spawnEatingReward() {
        // Spawn 3-5 bubbles as visual reward
        const bubbleCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = new Bubble(
                this.x + (Math.random() - 0.5) * 20,
                this.y + (Math.random() - 0.5) * 20
            );
            bubbles.push(bubble);
        }

        // Add a small size boost temporarily
        if (this.size < 30) {
            this.size += 2;
            // Reset size after a short time
            setTimeout(() => {
                if (this.size > 20) {
                    this.size -= 2;
                }
            }, 1000);
        }
    }

    reproduce() {
        // Create a new fish of the same type
        const newFish = new this.constructor(
            this.x + (Math.random() - 0.5) * 50,
            this.y + (Math.random() - 0.5) * 50
        );
        fish.push(newFish);
        this.energy = 0; // Reset energy after reproduction
    }

    die() {
        // Remove this fish from the array
        const index = fish.indexOf(this);
        if (index > -1) {
            fish.splice(index, 1);
        }
    }

    draw() {
        ctx.save();
        if (this.dx < 0) {
            ctx.translate(this.x, this.y);
            ctx.scale(-1, 1);
            ctx.translate(-this.x, -this.y);
        }
        this.drawFish();
        ctx.restore();
    }

    drawFish() {
        // To be overridden by subclasses
    }
}

class Clownfish extends Fish {
    drawFish() {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // White stripes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(this.x - 5, this.y, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(this.x + 5, this.y, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Black outline
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eye (position depends on direction)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        const eyeX = this.dx > 0 ? this.x - 8 : this.x + 8;
        ctx.arc(eyeX, this.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Goldfish extends Fish {
    drawFish() {
        ctx.fillStyle = 'gold';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail (position depends on direction)
        ctx.fillStyle = 'darkorange';
        ctx.beginPath();
        if (this.dx > 0) {
            // Facing right
            ctx.moveTo(this.x + this.size, this.y);
            ctx.lineTo(this.x + this.size + 15, this.y - 8);
            ctx.lineTo(this.x + this.size + 15, this.y + 8);
        } else {
            // Facing left
            ctx.moveTo(this.x - this.size, this.y);
            ctx.lineTo(this.x - this.size - 15, this.y - 8);
            ctx.lineTo(this.x - this.size - 15, this.y + 8);
        }
        ctx.closePath();
        ctx.fill();

        // Eye (position depends on direction)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        const eyeX = this.dx > 0 ? this.x - 8 : this.x + 8;
        ctx.arc(eyeX, this.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Angelfish extends Fish {
    drawFish() {
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dorsal fin (position depends on direction)
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        if (this.dx > 0) {
            // Facing right
            ctx.moveTo(this.x, this.y - this.size * 0.8);
            ctx.lineTo(this.x - 5, this.y - this.size * 0.8 - 10);
            ctx.lineTo(this.x + 5, this.y - this.size * 0.8 - 10);
        } else {
            // Facing left
            ctx.moveTo(this.x, this.y - this.size * 0.8);
            ctx.lineTo(this.x - 5, this.y - this.size * 0.8 - 10);
            ctx.lineTo(this.x + 5, this.y - this.size * 0.8 - 10);
        }
        ctx.closePath();
        ctx.fill();

        // Eye (position depends on direction)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        const eyeX = this.dx > 0 ? this.x - 8 : this.x + 8;
        ctx.arc(eyeX, this.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class SmartFish extends Fish {
    constructor(x, y, team = null, parentBrain = null) {
        super(x, y);

        // === PHASE 4: Team-specific input sizes ===
        // Prey: 22 base + 4 schooling = 26 inputs
        // Predator: 22 base + 3 pack hunting = 25 inputs
        const inputSize = team === 'prey' ? 26 : (team === 'predator' ? 25 : 22);
        const storageKey = team ? `aquarium-${team}-brain-v2` : 'aquarium-brain';

        if (parentBrain) {
            // Inherit from parent with mutation
            this.brain = parentBrain.copy();
            this.brain.mutate(0.05); // 5% mutation rate
        } else {
            // Try to load from localStorage
            const savedBrain = NeuralNetwork.load(storageKey);
            if (savedBrain && savedBrain.inputSize === inputSize) {
                this.brain = savedBrain;
            } else {
                this.brain = new NeuralNetwork(inputSize, 12, 4);
            }
        }

        this.fitness = 0;
        this.lifetime = 0;
        this.lastDecision = [0, 0, 0, 0];
        this.decisionCooldown = 0;
        this.team = team; // 'prey', 'predator', or null

        // === PHASE 4: Generation tracking ===
        this.generation = generation;
        this.parentFitness = 0;

        // Velocity tracking for prediction
        this.prevX = x;
        this.prevY = y;

        // Reflex system - immediate danger response
        this.reflexDistance = 60; // Distance at which reflex kicks in
        this.inReflexMode = false;

        // Error tracking for visualization
        this.errorHistory = [];
        this.maxErrorHistory = 100; // Keep last 100 error values

        // Auto-save timer
        this.lastSaveTime = Date.now();
        this.saveInterval = 30000; // Save every 30 seconds

        // === PHASE 3: Experience Replay Buffer ===
        this.experienceBuffer = [];     // Stores recent experiences
        this.maxExperiences = 50;       // Keep last 50 state-action pairs
        this.experienceReplayCounter = 0;
        this.experienceReplayInterval = 120; // Replay every 2 seconds (120 frames)

        // === PHASE 3: Short-term Memory ===
        this.previousHidden = new Array(12).fill(0.5); // Previous hidden layer state
        this.hiddenActivations = new Array(12).fill(0.5);
    }

    update() {
        this.lifetime++;
        this.decisionCooldown--;

        // Auto-save neural network periodically
        if (Date.now() - this.lastSaveTime > this.saveInterval) {
            const storageKey = this.team ? `aquarium-${this.team}-brain-v2` : 'aquarium-brain';
            this.brain.save(storageKey);
            this.lastSaveTime = Date.now();
        }

        // Update hunger
        this.hunger += 0.5;
        if (this.hunger >= this.maxHunger) {
            this.starvationTime++;
            if (this.starvationTime > 600) {
                this.die();
            }
        }

        // Different behavior based on training mode
        if (this.isTraining && trainingMode === 'supervised') {
            // In supervised training, don't move automatically
            this.dx = 0;
            this.dy = 0;
        } else {
            // Use neural network for decisions
            if (this.decisionCooldown <= 0) {
                this.makeDecision();
                this.decisionCooldown = 10; // Make decisions every 10 frames

                // === PHASE 3: Record experience ===
                this.recordExperience();
            }

            // Apply movement based on neural network output
            this.applyDecision();
        }

        if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.dy *= -1;

        // Try to eat nearby plants
        this.eatPlants();

        // Reproduction check (only for evolution mode)
        if (trainingMode === 'evolution' && this.energy >= this.maxEnergy && Math.random() < 0.001) {
            this.reproduce();
        }

        // Update fitness
        this.fitness = this.lifetime + this.energy - this.hunger;

        // Hunt if predator
        if (this.team === 'predator') {
            this.huntPrey();
        }

        // Flee if prey
        if (this.team === 'prey') {
            this.fleeFromPredators();
        }

        // === PHASE 3: Experience Replay ===
        this.experienceReplayCounter++;
        if (this.experienceReplayCounter >= this.experienceReplayInterval) {
            this.experienceReplayCounter = 0;
            this.replayExperiences();
        }
    }

    // === PHASE 3: Record current state-action pair ===
    recordExperience() {
        const experience = {
            state: this.getSensoryInputs(),
            action: [...this.lastDecision],
            timestamp: this.lifetime,
            position: { x: this.x, y: this.y }
        };

        this.experienceBuffer.push(experience);

        // Keep buffer size limited
        if (this.experienceBuffer.length > this.maxExperiences) {
            this.experienceBuffer.shift();
        }
    }

    // === PHASE 3: Learn from past experiences ===
    replayExperiences() {
        if (this.experienceBuffer.length < 10) return; // Need enough experiences

        // Mark old experiences as "survived" if fish is still alive
        const currentTime = this.lifetime;
        const survivalThreshold = 180; // 3 seconds (at 60fps)

        for (const exp of this.experienceBuffer) {
            const timeSince = currentTime - exp.timestamp;
            if (timeSince > survivalThreshold && !exp.evaluated) {
                exp.evaluated = true;
                exp.survived = true;

                // Positive reinforcement for actions that led to survival
                if (this.team === 'prey') {
                    // Prey: surviving is good, reinforce the action
                    const reinforcedAction = exp.action.map(v => Math.min(1, v * 1.1));
                    this.brain.learningRate = learningRates.preySurvival * 0.5;
                    this.brain.train(exp.state, reinforcedAction);
                }
            }
        }

        // Sample and train from random past experiences
        const sampleSize = Math.min(5, this.experienceBuffer.length);
        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor(Math.random() * this.experienceBuffer.length);
            const exp = this.experienceBuffer[idx];

            if (exp.survived) {
                // Reinforce successful experiences more
                this.brain.learningRate = learningRates.preySurvival * 0.3;
                this.brain.train(exp.state, exp.action);
            }
        }
    }

    huntPrey() {
        // First check for catches
        for (let i = fish.length - 1; i >= 0; i--) {
            const prey = fish[i];
            // Skip teammates, self, and non-fish
            if (prey === this || (prey instanceof SmartFish && prey.team === 'predator') || prey instanceof PredatorFish) continue;

            const distance = Math.sqrt((this.x - prey.x) ** 2 + (this.y - prey.y) ** 2);
            if (distance < this.size + prey.size) {
                // Eat the prey
                fish.splice(i, 1);
                this.hunger = Math.max(0, this.hunger - 50);
                this.energy = Math.min(this.maxEnergy, this.energy + 40);
                this.starvationTime = 0;
                this.lastAte = Date.now();

                // Strong positive reinforcement for catching prey
                // Reinforce the decisions that led to this catch
                const successOutputs = [
                    this.lastDecision[0],     // Keep current turn (it worked!)
                    0.9,                       // High speed was good
                    0.2,                       // Don't eat plants when hunting
                    0.8                        // Lunge is effective
                ];
                this.brain.learningRate = learningRates.predatorHunting * 2; // Double learning rate for success
                const error = this.brain.train(this.getSensoryInputs(), successOutputs);
                this.errorHistory.push(error);
                if (this.errorHistory.length > this.maxErrorHistory) this.errorHistory.shift();

                addToTrainingLog('Predator caught prey!');
                return; // Exit after catching
            }
        }

        // If no catch, train toward nearest prey
        let nearestPrey = null;
        let nearestDist = Infinity;

        for (const other of fish) {
            if (other === this) continue;
            if (other.team === 'prey' || (other instanceof Fish && !(other instanceof SmartFish) && !(other instanceof PredatorFish))) {
                const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestPrey = other;
                }
            }
        }

        if (nearestPrey && nearestDist < 200) {
            // Calculate ideal chase direction (toward prey)
            const chaseAngle = Math.atan2(nearestPrey.y - this.y, nearestPrey.x - this.x);
            const currentAngle = Math.atan2(this.dy, this.dx);

            // Calculate target turn rate to achieve chase angle
            let turnDelta = chaseAngle - currentAngle;
            // Normalize to -PI to PI
            while (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
            while (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
            const targetTurnRate = Math.max(0, Math.min(1, turnDelta / (Math.PI * 0.5) * 0.5 + 0.5));

            // Opportunity: closer prey = stronger training signal
            const opportunity = 1 - (nearestDist / 200);

            // Target outputs: [turnRate, speed, eat, special]
            const targetOutputs = [
                targetTurnRate,           // Turn toward prey
                0.8 + opportunity * 0.2,  // Higher speed when closer
                0.1,                       // Don't eat plants
                nearestDist < 60 ? 0.9 : 0.2 // Lunge when close
            ];

            // Train with opportunity-scaled learning rate
            this.brain.learningRate = learningRates.predatorHunting * (0.5 + opportunity);
            const error = this.brain.train(this.getSensoryInputs(), targetOutputs);
            this.errorHistory.push(error);
            if (this.errorHistory.length > this.maxErrorHistory) this.errorHistory.shift();
        }
    }

    fleeFromPredators() {
        let nearestPredator = null;
        let nearestDist = Infinity;

        for (const other of fish) {
            if (other === this) continue;
            if (other.team === 'predator' || other instanceof PredatorFish) {
                const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestPredator = other;
                }
            }
        }

        if (nearestPredator) {
            // Trigger reflex mode when very close
            if (nearestDist < this.reflexDistance) {
                this.inReflexMode = true;
            }

            // Train with directional rewards when predator is in range
            if (nearestDist < 150) {
                // Calculate ideal flee direction (away from predator)
                const fleeAngle = Math.atan2(this.y - nearestPredator.y, this.x - nearestPredator.x);
                const currentAngle = Math.atan2(this.dy, this.dx);

                // How well are we fleeing? (1 = perfect flee direction, 0 = toward predator)
                const angleDiff = Math.abs(fleeAngle - currentAngle);
                const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff) / Math.PI;
                const fleeQuality = 1 - normalizedDiff; // Higher is better

                // Calculate target turn rate to achieve flee angle
                // turnRate 0.5 = no turn, 0 = turn left, 1 = turn right
                let turnDelta = fleeAngle - currentAngle;
                // Normalize to -PI to PI
                while (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
                while (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
                const targetTurnRate = Math.max(0, Math.min(1, turnDelta / (Math.PI * 0.5) * 0.5 + 0.5));

                // Urgency: closer predator = stronger training signal
                const urgency = 1 - (nearestDist / 150);

                // Target outputs: [turnRate, speed, eat, special]
                // - Turn toward flee direction
                // - High speed to escape
                // - Don't eat (waste of time)
                // - Use dash (special) if very close
                const targetOutputs = [
                    targetTurnRate,           // Turn toward flee direction
                    0.9,                       // Max speed
                    0.1,                       // Don't eat
                    nearestDist < 80 ? 0.9 : 0.3 // Dash when close
                ];

                // Train with urgency-scaled learning rate
                this.brain.learningRate = learningRates.negativeReward * (1 + urgency);
                const error = this.brain.train(this.getSensoryInputs(), targetOutputs);
                this.errorHistory.push(error);
                if (this.errorHistory.length > this.maxErrorHistory) this.errorHistory.shift();

                // Reward if we're fleeing well, punish if not
                if (fleeQuality < 0.5 && nearestDist < 80) {
                    addToTrainingLog('Prey learning to flee (bad angle)');
                }
            }
        }
    }

    makeDecision() {
        // === PHASE 3: Save previous hidden state for memory ===
        this.previousHidden = [...(this.hiddenActivations || new Array(12).fill(0.5))];

        // Gather sensory inputs (now includes memory from previous hidden state)
        const inputs = this.getSensoryInputs();

        // Get neural network output
        const result = this.brain.predict(inputs);
        this.lastDecision = result.output;

        // Store hidden layer for visualization and next iteration's memory
        this.hiddenActivations = result.hidden;
    }

    getSensoryInputs() {
        // Find nearest plant
        let nearestPlant = null;
        let nearestPlantDistance = Infinity;

        for (const plant of plants) {
            const distance = Math.sqrt((this.x - plant.x) ** 2 + (this.y - plant.y) ** 2);
            if (distance < nearestPlantDistance) {
                nearestPlantDistance = distance;
                nearestPlant = plant;
            }
        }

        // Find nearest predator and prey with velocity tracking
        let nearestPredator = null;
        let nearestPredatorDistance = Infinity;
        let nearestPrey = null;
        let nearestPreyDistance = Infinity;

        for (const otherFish of fish) {
            if (otherFish === this) continue;

            const distance = Math.sqrt((this.x - otherFish.x) ** 2 + (this.y - otherFish.y) ** 2);

            if (otherFish instanceof SmartFish) {
                if (otherFish.team === 'predator' && distance < nearestPredatorDistance) {
                    nearestPredatorDistance = distance;
                    nearestPredator = otherFish;
                }
                if (otherFish.team === 'prey' && distance < nearestPreyDistance) {
                    nearestPreyDistance = distance;
                    nearestPrey = otherFish;
                }
            }
        }

        // Count nearby fish (within 100px)
        let nearbyTeammates = 0;
        let nearbyEnemies = 0;

        for (const otherFish of fish) {
            if (otherFish === this) continue;

            const distance = Math.sqrt((this.x - otherFish.x) ** 2 + (this.y - otherFish.y) ** 2);
            if (distance < 100 && otherFish instanceof SmartFish) {
                if (otherFish.team === this.team) {
                    nearbyTeammates++;
                } else {
                    nearbyEnemies++;
                }
            }
        }

        // Distance to boundaries (normalized urgency - closer = higher value)
        const distToLeft = this.x;
        const distToRight = canvas.width - this.x;
        const distToTop = this.y;
        const distToBottom = canvas.height - this.y;
        const minBoundaryDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
        const boundaryUrgency = 1 - Math.min(minBoundaryDist / 50, 1); // Higher when close to wall

        // Calculate velocity of threats (is predator approaching?)
        let predatorApproaching = 0.5; // Neutral
        if (nearestPredator) {
            const predVelX = nearestPredator.dx || 0;
            const predVelY = nearestPredator.dy || 0;

            // Vector from predator to us
            const toPrey_x = this.x - nearestPredator.x;
            const toPrey_y = this.y - nearestPredator.y;

            // Dot product shows if predator is moving toward us
            const dot = predVelX * toPrey_x + predVelY * toPrey_y;
            const predSpeed = Math.sqrt(predVelX * predVelX + predVelY * predVelY);
            const dist = Math.sqrt(toPrey_x * toPrey_x + toPrey_y * toPrey_y);

            if (predSpeed > 0.1 && dist > 0) {
                // Normalized: -1 = fleeing, 0 = perpendicular, 1 = approaching
                predatorApproaching = (dot / (predSpeed * dist) + 1) / 2; // Map to 0-1
            }
        }

        // Calculate if prey is escaping (for predators)
        let preyEscaping = 0.5; // Neutral
        if (nearestPrey) {
            const preyVelX = nearestPrey.dx || 0;
            const preyVelY = nearestPrey.dy || 0;

            // Vector from us to prey
            const toPrey_x = nearestPrey.x - this.x;
            const toPrey_y = nearestPrey.y - this.y;

            // Dot product shows if prey is moving away
            const dot = preyVelX * toPrey_x + preyVelY * toPrey_y;
            const preySpeed = Math.sqrt(preyVelX * preyVelX + preyVelY * preyVelY);
            const dist = Math.sqrt(toPrey_x * toPrey_x + toPrey_y * toPrey_y);

            if (preySpeed > 0.1 && dist > 0) {
                // 1 = escaping directly away, 0 = coming toward us
                preyEscaping = (dot / (preySpeed * dist) + 1) / 2;
            }
        }

        // Current movement direction
        const currentAngle = Math.atan2(this.dy, this.dx) / (Math.PI * 2) + 0.5;

        // Our own speed (normalized)
        const ourSpeed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        const normalizedSpeed = Math.min(ourSpeed / 3, 1);

        // === PHASE 3: Get memory from previous hidden state ===
        const memory = this.previousHidden || new Array(12).fill(0.5);
        // Normalize tanh outputs (-1 to 1) to (0 to 1)
        const memoryInputs = memory.slice(0, 4).map(v => (v + 1) / 2);

        // === PHASE 4: Calculate social behavior inputs ===
        let nearestAllyDx = 0, nearestAllyDy = 0;
        let allyCount = 0;
        let avgAllyVx = 0, avgAllyVy = 0;
        let allyPredatorDx = 0, allyPredatorDy = 0;
        let allyPredatorCount = 0;
        let preyBeingChasedByAlly = 0;

        const schoolingRadius = 80;  // For prey
        const packRadius = 100;      // For predators

        for (const otherFish of fish) {
            if (otherFish === this || !(otherFish instanceof SmartFish)) continue;

            const dx = otherFish.x - this.x;
            const dy = otherFish.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Schooling data for prey
            if (this.team === 'prey' && otherFish.team === 'prey' && dist < schoolingRadius) {
                allyCount++;
                avgAllyVx += otherFish.dx || 0;
                avgAllyVy += otherFish.dy || 0;

                // Track nearest ally
                if (allyCount === 1 || dist < Math.sqrt(nearestAllyDx * nearestAllyDx + nearestAllyDy * nearestAllyDy)) {
                    nearestAllyDx = dx;
                    nearestAllyDy = dy;
                }
            }

            // Pack hunting data for predators
            if (this.team === 'predator' && otherFish.team === 'predator' && dist < packRadius) {
                allyPredatorCount++;

                // Track nearest ally predator
                if (allyPredatorCount === 1 || dist < Math.sqrt(allyPredatorDx * allyPredatorDx + allyPredatorDy * allyPredatorDy)) {
                    allyPredatorDx = dx;
                    allyPredatorDy = dy;
                }
            }
        }

        // Normalize schooling vectors
        if (allyCount > 0) {
            avgAllyVx /= allyCount;
            avgAllyVy /= allyCount;
        }
        const allyDist = Math.sqrt(nearestAllyDx * nearestAllyDx + nearestAllyDy * nearestAllyDy);
        if (allyDist > 0) {
            nearestAllyDx /= allyDist;
            nearestAllyDy /= allyDist;
        }
        const avgAllySpeed = Math.sqrt(avgAllyVx * avgAllyVx + avgAllyVy * avgAllyVy);
        if (avgAllySpeed > 0) {
            avgAllyVx /= Math.max(avgAllySpeed, 1);
            avgAllyVy /= Math.max(avgAllySpeed, 1);
        }

        // Normalize pack hunting vectors
        const allyPredDist = Math.sqrt(allyPredatorDx * allyPredatorDx + allyPredatorDy * allyPredatorDy);
        if (allyPredDist > 0) {
            allyPredatorDx /= allyPredDist;
            allyPredatorDy /= allyPredDist;
        }

        // Check if any ally predator is chasing the same prey we're targeting
        if (this.team === 'predator' && nearestPrey) {
            for (const otherFish of fish) {
                if (otherFish === this || otherFish.team !== 'predator') continue;
                const distToOurPrey = Math.sqrt(
                    (otherFish.x - nearestPrey.x) ** 2 +
                    (otherFish.y - nearestPrey.y) ** 2
                );
                if (distToOurPrey < 150) {
                    preyBeingChasedByAlly = 1;
                    break;
                }
            }
        }

        // Base sensory inputs (22 total: 18 sensory + 4 memory)
        const inputs = [
            // Basic needs (0-1)
            this.hunger / this.maxHunger,                                           // 0: Hunger urgency
            this.energy / this.maxEnergy,                                           // 1: Energy level

            // Plant/food awareness (2-3)
            nearestPlant ? 1 - Math.min(nearestPlantDistance / 200, 1) : 0,         // 2: Food proximity (higher = closer)
            nearestPlant ? (Math.atan2(nearestPlant.y - this.y, nearestPlant.x - this.x) / Math.PI + 1) / 2 : 0.5, // 3: Direction to food

            // Predator awareness (4-6) - CRITICAL for prey
            nearestPredator ? 1 - Math.min(nearestPredatorDistance / 200, 1) : 0,   // 4: Predator proximity (higher = danger!)
            nearestPredator ? (Math.atan2(nearestPredator.y - this.y, nearestPredator.x - this.x) / Math.PI + 1) / 2 : 0.5, // 5: Direction to predator
            predatorApproaching,                                                     // 6: Is predator approaching? (1 = yes)

            // Prey awareness (7-9) - CRITICAL for predators
            nearestPrey ? 1 - Math.min(nearestPreyDistance / 200, 1) : 0,           // 7: Prey proximity (higher = opportunity!)
            nearestPrey ? (Math.atan2(nearestPrey.y - this.y, nearestPrey.x - this.x) / Math.PI + 1) / 2 : 0.5, // 8: Direction to prey
            preyEscaping,                                                            // 9: Is prey escaping? (1 = yes)

            // Social awareness (10-11)
            Math.min(nearbyTeammates / 5, 1),                                        // 10: Nearby allies
            Math.min(nearbyEnemies / 5, 1),                                          // 11: Nearby threats/targets

            // Spatial awareness (12-14)
            boundaryUrgency,                                                         // 12: Wall proximity (higher = danger)
            Math.max(0, Math.min(1, (distToLeft - distToRight) / canvas.width + 0.5)), // 13: Left-right bias
            Math.max(0, Math.min(1, (distToTop - distToBottom) / canvas.height + 0.5)), // 14: Top-bottom bias

            // Self-state (15-17)
            currentAngle,                                                            // 15: Current heading
            normalizedSpeed,                                                         // 16: Current speed
            this.team === 'predator' ? 1 : 0,                                        // 17: Am I a predator? (role awareness)

            // === PHASE 3: Memory inputs (18-21) ===
            memoryInputs[0],                                                         // 18: Memory 1 (recent hidden state)
            memoryInputs[1],                                                         // 19: Memory 2
            memoryInputs[2],                                                         // 20: Memory 3
            memoryInputs[3]                                                          // 21: Memory 4
        ];

        // === PHASE 4: Add team-specific social inputs ===
        if (this.team === 'prey') {
            // Schooling inputs for prey (22-25)
            inputs.push(
                (nearestAllyDx + 1) / 2,                  // 22: Nearest ally direction X (normalized 0-1)
                (nearestAllyDy + 1) / 2,                  // 23: Nearest ally direction Y (normalized 0-1)
                Math.min(allyCount / 5, 1),               // 24: Ally count within schooling radius
                (avgAllyVx + 1) / 2                       // 25: Average ally velocity X (normalized 0-1)
            );
        } else if (this.team === 'predator') {
            // Pack hunting inputs for predators (22-24)
            inputs.push(
                (allyPredatorDx + 1) / 2,                 // 22: Nearest ally predator direction X
                (allyPredatorDy + 1) / 2,                 // 23: Nearest ally predator direction Y
                preyBeingChasedByAlly                     // 24: Is our target being chased by ally? (0 or 1)
            );
        }

        return inputs;
    }

    applyDecision() {
        const [turnRate, speedControl, eat, special] = this.lastDecision;

        // REFLEX SYSTEM: Immediate danger response bypasses neural network
        if (this.team === 'prey' && this.inReflexMode) {
            // Find nearest predator for reflex direction
            let nearestPredator = null;
            let nearestDist = Infinity;
            for (const other of fish) {
                if (other.team === 'predator' || other instanceof PredatorFish) {
                    const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestPredator = other;
                    }
                }
            }

            if (nearestPredator && nearestDist < this.reflexDistance) {
                // Flee directly away from predator at max speed
                const fleeAngle = Math.atan2(this.y - nearestPredator.y, this.x - nearestPredator.x);
                this.dx = Math.cos(fleeAngle) * 2.5;
                this.dy = Math.sin(fleeAngle) * 2.5;

                // Apply position with boundary checking
                this.applyMovement();
                return; // Skip neural network decision
            } else {
                this.inReflexMode = false; // Exit reflex mode when safe
            }
        }

        // Convert neural network outputs to actions
        // turnRate: 0-1 maps to turning left (-1) to right (+1) relative to current heading
        // speedControl: 0-1 maps to speed 0.5 to 2.5

        const currentAngle = Math.atan2(this.dy, this.dx);
        const turnAmount = (turnRate - 0.5) * Math.PI * 0.5; // Max turn: 45 degrees per decision
        const newAngle = currentAngle + turnAmount;
        let speed = 0.5 + speedControl * 2.0;

        // === PHASE 3: Curriculum Learning - Apply speed handicap to predators ===
        if (this.team === 'predator') {
            speed *= getPredatorSpeedMultiplier(); // Slower at low difficulty
        }

        this.dx = Math.cos(newAngle) * speed;
        this.dy = Math.sin(newAngle) * speed;

        this.applyMovement();

        // Eating decision (if output > 0.5, try to eat)
        if (eat > 0.5) {
            this.eatPlants();
        }

        // Special action: For prey = dash away, for predator = lunge
        if (special > 0.7 && this.energy > 20) {
            if (this.team === 'prey') {
                // Quick dash in current direction
                this.dx *= 1.5;
                this.dy *= 1.5;
            } else if (this.team === 'predator') {
                // Lunge toward nearest prey
                let nearestPrey = null;
                let nearestDist = Infinity;
                for (const other of fish) {
                    if (other.team === 'prey') {
                        const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
                        if (dist < nearestDist) {
                            nearestDist = dist;
                            nearestPrey = other;
                        }
                    }
                }
                if (nearestPrey && nearestDist < 100) {
                    const lungeAngle = Math.atan2(nearestPrey.y - this.y, nearestPrey.x - this.x);
                    this.dx = Math.cos(lungeAngle) * 3;
                    this.dy = Math.sin(lungeAngle) * 3;
                }
            }
            this.energy -= 5; // Special moves cost energy
        }
    }

    applyMovement() {
        // Calculate new position
        const newX = this.x + this.dx;
        const newY = this.y + this.dy;

        // Enforce strict boundaries - don't allow fish to go off screen
        if (newX < this.size) {
            this.x = this.size;
            this.dx *= -1;
        } else if (newX > canvas.width - this.size) {
            this.x = canvas.width - this.size;
            this.dx *= -1;
        } else {
            this.x = newX;
        }

        if (newY < this.size) {
            this.y = this.size;
            this.dy *= -1;
        } else if (newY > canvas.height - this.size) {
            this.y = canvas.height - this.size;
            this.dy *= -1;
        } else {
            this.y = newY;
        }
    }

    reproduce() {
        // Create offspring with mutated neural network
        const offspring = new SmartFish(
            this.x + (Math.random() - 0.5) * 50,
            this.y + (Math.random() - 0.5) * 50
        );

        // Copy and mutate the neural network
        offspring.brain = this.brain.copy();
        offspring.brain.mutate(0.1); // 10% mutation rate

        fish.push(offspring);
        this.energy = 0;
    }

    drawFish() {
        // Color based on team
        const baseColor = this.team === 'prey' ? 'blue' : this.team === 'predator' ? 'red' : 'purple';
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Neural network indicator (small brain icon)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 8, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eye (position depends on direction)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        const eyeX = this.dx > 0 ? this.x - 8 : this.x + 8;
        ctx.arc(eyeX, this.y - 3, 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw neural network visualization if enabled
        if (showNeuralNetwork) {
            this.drawNeuralNetwork();
        }
    }

    drawNeuralNetwork() {
        const startX = this.x + 30;
        const startY = this.y - 50;
        const nodeRadius = 3;
        const inputs = this.getSensoryInputs();

        // Draw input layer (18 nodes, arranged in columns)
        for (let i = 0; i < 18; i++) {
            const col = Math.floor(i / 9);
            const row = i % 9;
            const x = startX + col * 8;
            const y = startY + row * 5;
            const val = inputs[i] || 0;
            ctx.fillStyle = `rgb(${Math.floor(val * 255)}, 100, 100)`;
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw hidden layer (12 nodes)
        const hiddenActivations = this.hiddenActivations || new Array(12).fill(0.5);
        for (let i = 0; i < 12; i++) {
            const x = startX + 35;
            const y = startY + i * 4;
            const val = (hiddenActivations[i] + 1) / 2; // tanh outputs -1 to 1, normalize to 0-1
            ctx.fillStyle = `rgb(100, ${Math.floor(val * 255)}, 100)`;
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw output layer (4 nodes)
        for (let i = 0; i < 4; i++) {
            const x = startX + 60;
            const y = startY + 10 + i * 10;
            ctx.fillStyle = `rgb(100, 100, ${Math.floor(this.lastDecision[i] * 255)})`;
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw connections (simplified)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;

        // Input to hidden connections (sample only)
        for (let i = 0; i < 18; i++) {
            const inputCol = Math.floor(i / 9);
            const inputRow = i % 9;
            const inputX = startX + inputCol * 8;
            const inputY = startY + inputRow * 5;

            for (let j = 0; j < 12; j++) {
                if (Math.random() < 0.1) { // Only draw some connections for clarity
                    ctx.beginPath();
                    ctx.moveTo(inputX, inputY);
                    ctx.lineTo(startX + 35, startY + j * 4);
                    ctx.stroke();
                }
            }
        }

        // Hidden to output connections
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 4; j++) {
                if (Math.random() < 0.3) {
                    ctx.beginPath();
                    ctx.moveTo(startX + 35, startY + i * 4);
                    ctx.lineTo(startX + 60, startY + 10 + j * 10);
                    ctx.stroke();
                }
            }
        }
    }
}

class PredatorFish extends Fish {
    constructor(x, y) {
        super(x, y);
        this.size = 25;
        this.hunger = 20; // Start hungrier
        this.maxHunger = 120;
        this.energy = 30;
        this.maxEnergy = 120;
    }

    update() {
        // Update hunger (predators get hungry slower)
        this.hunger += 0.3; // Reduced from 1.0
        if (this.hunger >= this.maxHunger) {
            this.starvationTime++;
            if (this.starvationTime > 400) { // Die after ~6.7 seconds
                this.die();
            }
        }

        // Seek prey if very hungry
        if (this.hunger > 80) { // Increased threshold from 60
            this.seekPrey();
        } else {
            // Random movement when not hungry
            this.x += this.dx;
            this.y += this.dy;
        }

        if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.dy *= -1;

        // Try to eat other fish
        this.huntFish();

        // Reproduction check (less frequent for predators)
        if (this.energy >= this.maxEnergy && Math.random() < 0.0003) { // Reduced frequency
            this.reproduce();
        }
    }

    seekPrey() {
        // Find nearest prey fish
        let nearestPrey = null;
        let nearestDistance = Infinity;

        for (const prey of fish) {
            if (prey === this || prey instanceof PredatorFish) continue; // Don't hunt self or other predators

            const distance = Math.sqrt((this.x - prey.x) ** 2 + (this.y - prey.y) ** 2);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPrey = prey;
            }
        }

        if (nearestPrey) {
            // Move towards the prey
            const angle = Math.atan2(nearestPrey.y - this.y, nearestPrey.x - this.x);
            this.dx = Math.cos(angle) * 2; // Move faster when hunting
            this.dy = Math.sin(angle) * 2;

            this.x += this.dx;
            this.y += this.dy;
        } else {
            // No prey found, random movement
            this.x += this.dx;
            this.y += this.dy;
        }
    }

    huntFish() {
        // Find nearby prey fish
        for (let i = fish.length - 1; i >= 0; i--) {
            const prey = fish[i];
            if (prey === this || prey instanceof PredatorFish) continue; // Don't eat self or other predators

            const distance = Math.sqrt((this.x - prey.x) ** 2 + (this.y - prey.y) ** 2);
            if (distance < this.size + prey.size) {
                // Eat the prey
                fish.splice(i, 1);
                this.hunger = Math.max(0, this.hunger - 50);
                this.energy = Math.min(this.maxEnergy, this.energy + 40);
                this.starvationTime = 0;
                this.lastAte = Date.now();
                break;
            }
        }
    }

    drawFish() {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sharp teeth
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y + 5);
        ctx.lineTo(this.x - 5, this.y + 10);
        ctx.lineTo(this.x, this.y + 5);
        ctx.closePath();
        ctx.fill();

        // Dorsal fin
        ctx.fillStyle = 'darkred';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.size * 0.7);
        ctx.lineTo(this.x - 8, this.y - this.size * 0.7 - 15);
        ctx.lineTo(this.x + 8, this.y - this.size * 0.7 - 15);
        ctx.closePath();
        ctx.fill();

        // Eye (position depends on direction)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        const eyeX = this.dx > 0 ? this.x - 10 : this.x + 10;
        ctx.arc(eyeX, this.y - 5, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Plant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.height = 10; // Start small
        this.maxHeight = Math.random() * 100 + 100;
        this.growthRate = 0.5;
        this.leaves = [];
        this.age = 0;
        this.matureAge = 200; // Time to become mature
        this.health = 3; // Number of times plant can be eaten
        this.maxHealth = 3;
    }

    update() {
        this.age++;
        if (this.height < this.maxHeight) {
            this.height += this.growthRate;
        }

        // Regenerate health
        if (this.health < this.maxHealth && Math.random() < 0.05) {
            this.health++;
        }

        // Add leaves as plant grows
        const targetLeaves = Math.floor((this.height / this.maxHeight) * 8) + 1;
        while (this.leaves.length < targetLeaves && this.leaves.length < 8) {
            this.leaves.push({
                offsetX: Math.random() * 20 - 10,
                angle: Math.random() * Math.PI
            });
        }
    }

    eat() {
        this.health--;
        if (this.health <= 0) {
            // Plant is completely eaten
            const index = plants.indexOf(this);
            if (index > -1) {
                plants.splice(index, 1);
            }
            return true; // Plant was destroyed
        }
        return false; // Plant still alive
    }

    draw() {
        // Adjust color based on health
        const healthRatio = this.health / this.maxHealth;
        const greenValue = Math.floor(100 + (155 * healthRatio));
        ctx.strokeStyle = `rgb(0, ${greenValue}, 0)`;
        ctx.lineWidth = Math.max(2, this.height / 30);
        ctx.beginPath();
        ctx.moveTo(this.x, canvas.height);
        ctx.lineTo(this.x, canvas.height - this.height);
        ctx.stroke();

        // Leaves
        ctx.fillStyle = `rgb(0, ${Math.floor(100 + (155 * healthRatio))}, 0)`;
        for (let i = 0; i < this.leaves.length; i++) {
            const leafY = canvas.height - this.height + (this.height / this.leaves.length) * i;
            const leafSize = Math.max(8, this.height / 20);
            ctx.beginPath();
            ctx.ellipse(this.x + this.leaves[i].offsetX, leafY, 15, leafSize, this.leaves[i].angle, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Bubble {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 10 + 5;
        this.dy = -Math.random() * 2 - 1;
    }

    update() {
        this.y += this.dy;
        if (this.y < -this.radius) {
            this.y = canvas.height + this.radius;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

let gameTime = 0;

// Training functions
function resetTraining() {
    trainingData = [];
    currentTrainingExample = null;
    trainingStep = 0;

    // Hide all training buttons initially
    goodExampleButton.style.display = 'none';
    badExampleButton.style.display = 'none';
    rewardButton.style.display = 'none';
    punishButton.style.display = 'none';

    // Show relevant buttons based on training mode
    if (trainingMode === 'supervised') {
        goodExampleButton.style.display = 'inline-block';
        badExampleButton.style.display = 'inline-block';
    } else if (trainingMode === 'reinforcement') {
        rewardButton.style.display = 'inline-block';
        punishButton.style.display = 'inline-block';
    } else if (trainingMode === 'interactive') {
        goodExampleButton.style.display = 'inline-block';
        badExampleButton.style.display = 'inline-block';
        rewardButton.style.display = 'inline-block';
        punishButton.style.display = 'inline-block';
    }
}

function startTraining() {
    if (trainingMode === 'supervised') {
        startSupervisedTraining();
    } else if (trainingMode === 'reinforcement') {
        startReinforcementTraining();
    } else if (trainingMode === 'interactive') {
        startInteractiveTraining();
    } else if (trainingMode === 'adversarial') {
        startAdversarialTraining();
    }
}

function startSupervisedTraining() {
    // Create a single smart fish for training
    fish = fish.filter(f => !(f instanceof SmartFish)); // Remove existing smart fish
    const smartFish = new SmartFish(canvas.width / 2, canvas.height / 2);
    smartFish.isTraining = true; // Mark fish as in training mode
    fish.push(smartFish);

    trainingStep = 0;
    trainingData = [];
    console.log('Starting supervised training...');
    collectTrainingExamples();
}

function collectTrainingExamples() {
    if (trainingStep < 10) { // Collect 10 examples
        const smartFish = fish.find(f => f instanceof SmartFish);
        if (smartFish) {
            // Pause the fish for training
            smartFish.dx = 0;
            smartFish.dy = 0;

            // Store current state for training
            currentTrainingExample = {
                inputs: smartFish.getSensoryInputs(),
                outputs: smartFish.lastDecision,
                timestamp: Date.now()
            };

            // Update button text to show progress
            trainButton.textContent = `Training: Step ${trainingStep + 1}/10`;
            console.log(`Training step ${trainingStep + 1}/10 - Click Good/Bad Example buttons`);
        }
    } else {
        // Training complete, train the network
        console.log('Training data collected, starting network training...');
        trainButton.textContent = 'Training Network...';
        trainSupervisedNetwork();
    }
}

function recordExample(isGood) {
    if (currentTrainingExample) {
        const targetOutputs = isGood ? currentTrainingExample.outputs : [
            Math.random(), // Random movement
            Math.random(),
            Math.random() < 0.3 ? 1 : 0, // Random eat decision
            Math.random() < 0.2 ? 1 : 0  // Random reproduce decision
        ];

        trainingData.push({
            inputs: currentTrainingExample.inputs,
            targets: targetOutputs
        });

        trainingStep++;
        collectTrainingExamples();
    }
}

function trainSupervisedNetwork() {
    const smartFish = fish.find(f => f instanceof SmartFish);
    if (smartFish && trainingData.length > 0) {
        // Train the network with collected examples
        for (let epoch = 0; epoch < 100; epoch++) {
            for (const example of trainingData) {
                smartFish.brain.train(example.inputs, example.targets);
            }
        }
        console.log('Supervised training complete!');
        trainButton.textContent = 'Training Complete!';
        smartFish.isTraining = false; // Allow fish to move again

        // Reset button after a delay
        setTimeout(() => {
            trainButton.textContent = 'Start Training';
        }, 2000);
    }
}

function startReinforcementTraining() {
    // Create smart fish and let them learn through rewards/punishments
    fish = fish.filter(f => !(f instanceof SmartFish));
    for (let i = 0; i < 3; i++) {
        fish.push(new SmartFish(Math.random() * canvas.width, Math.random() * canvas.height));
    }
}

function giveReward() {
    const smartFish = fish.filter(f => f instanceof SmartFish);
    smartFish.forEach(fish => {
        if (fish.lastDecision) {
            // Reinforce the current decision
            const reward = fish.lastDecision.map(v => Math.min(1, v + 0.15));
            fish.brain.learningRate = learningRates.positiveReward;
            const error = fish.brain.train(fish.getSensoryInputs(), reward);
            fish.errorHistory.push(error);
            if (fish.errorHistory.length > fish.maxErrorHistory) {
                fish.errorHistory.shift();
            }
            addToTrainingLog('positive reinforcement');
            console.log('🧠 Neural network trained - positive reinforcement');
        }
    });
}

function givePunishment() {
    const smartFish = fish.filter(f => f instanceof SmartFish);
    smartFish.forEach(fish => {
        if (fish.lastDecision) {
            // Punish the current decision
            const punishment = fish.lastDecision.map(v => Math.max(0, v - 0.15));
            fish.brain.learningRate = learningRates.negativeReward;
            const error = fish.brain.train(fish.getSensoryInputs(), punishment);
            fish.errorHistory.push(error);
            if (fish.errorHistory.length > fish.maxErrorHistory) {
                fish.errorHistory.shift();
            }
            addToTrainingLog('negative reinforcement');
            console.log('🧠 Neural network trained - negative reinforcement');
        }
    });
}

function startInteractiveTraining() {
    // Combine supervised and reinforcement learning
    startSupervisedTraining();
    // Additional interactive elements can be added here
}

function startAdversarialTraining() {
    // Start the adversarial round system
    currentRound = 0;
    predatorScore = 0;
    preyScore = 0;
    roundActive = true;
    roundWinner = null;

    // Clear existing fish and set up balanced teams
    fish = [];

    // Create prey fish (SmartFish that learn to survive)
    for (let i = 0; i < 5; i++) {
        const prey = new SmartFish(
            Math.random() * canvas.width * 0.4, // Left side
            Math.random() * canvas.height,
            'prey' // Pass team as parameter
        );
        fish.push(prey);
    }

    // Create predator fish (SmartFish that learn to hunt)
    for (let i = 0; i < 3; i++) {
        const predator = new SmartFish(
            canvas.width * 0.7 + Math.random() * canvas.width * 0.25, // Safer right side position
            Math.random() * (canvas.height - 50) + 25, // Keep away from top/bottom edges
            'predator' // Pass team as parameter
        );
        predator.size = 25; // Make predators bigger
        fish.push(predator);
    }

    initialPreyCount = fish.filter(f => f.team === 'prey').length;
    initialPredatorCount = fish.filter(f => f.team === 'predator').length;

    console.log(`Starting adversarial training - Round ${currentRound + 1}`);
    console.log(`Prey: ${initialPreyCount}, Predators: ${initialPredatorCount}`);
}

function updateAdversarialRound() {
    if (!roundActive) return;

    roundTime++;

    // Check win conditions
    const currentPreyCount = fish.filter(f => f.team === 'prey').length;
    const currentPredatorCount = fish.filter(f => f.team === 'predator').length;

    // Predators win if they eat all prey
    if (currentPreyCount === 0) {
        roundWinner = 'predators';
        predatorScore++;
        endRound();
        return;
    }

    // Prey win if all predators die (even if time hasn't run out)
    if (currentPredatorCount === 0 && currentPreyCount > 0) {
        roundWinner = 'prey';
        preyScore++;
        endRound();
        return;
    }

    // Prey win if time runs out and some survive
    if (roundTime >= roundDuration) {
        if (currentPreyCount > 0) {
            roundWinner = 'prey';
            preyScore++;
        } else {
            roundWinner = 'predators';
            predatorScore++;
        }
        endRound();
        return;
    }

    // Train fish based on performance
    if (roundTime % 60 === 0) { // Every second
        trainAdversarialFish(currentPreyCount, currentPredatorCount);
    }
}

function trainAdversarialFish(currentPreyCount, currentPredatorCount) {
    const preyFish = fish.filter(f => f.team === 'prey');
    const predatorFish = fish.filter(f => f.team === 'predator');

    // Reward surviving prey
    preyFish.forEach(prey => {
        const reward = [0.9, 0.9, 0.9, 0.9]; // Reward for survival
        prey.brain.learningRate = learningRates.preySurvival;
        const error = prey.brain.train(prey.getSensoryInputs(), reward);
        prey.errorHistory.push(error);
        if (prey.errorHistory.length > prey.maxErrorHistory) {
            prey.errorHistory.shift();
        }
        addToTrainingLog('adversarial prey survival');
        console.log('🧠 Neural network trained - adversarial prey survival');
    });

    // Reward successful predators
    predatorFish.forEach(predator => {
        const reward = [0.9, 0.9, 0.9, 0.9]; // Reward for hunting
        predator.brain.learningRate = learningRates.predatorHunting;
        const error = predator.brain.train(predator.getSensoryInputs(), reward);
        predator.errorHistory.push(error);
        if (predator.errorHistory.length > predator.maxErrorHistory) {
            predator.errorHistory.shift();
        }
        addToTrainingLog('adversarial predator hunting');
        console.log('🧠 Neural network trained - adversarial predator hunting');
    });
}

function endRound() {
    roundActive = false;

    addToTrainingLog(`Round ${currentRound + 1} Complete! Winner: ${roundWinner}`);
    console.log(`Round ${currentRound + 1} Complete!`);
    console.log(`Winner: ${roundWinner}`);
    console.log(`Score - Predators: ${predatorScore}, Prey: ${preyScore}`);

    // === PHASE 4: Collect top survivors for breeding ===
    const preyFish = fish.filter(f => f.team === 'prey');
    const predatorFish = fish.filter(f => f.team === 'predator');

    // Sort by fitness and keep top 3 brains
    preyFish.sort((a, b) => b.fitness - a.fitness);
    predatorFish.sort((a, b) => b.fitness - a.fitness);

    topPreySurvivors = preyFish.slice(0, 3).map(f => ({
        brain: f.brain.copy(),
        fitness: f.fitness
    }));
    topPredatorSurvivors = predatorFish.slice(0, 3).map(f => ({
        brain: f.brain.copy(),
        fitness: f.fitness
    }));

    // Track top fitness
    if (topPreySurvivors.length > 0) {
        topPreyFitness = Math.max(topPreyFitness, topPreySurvivors[0].fitness);
    }
    if (topPredatorSurvivors.length > 0) {
        topPredatorFitness = Math.max(topPredatorFitness, topPredatorSurvivors[0].fitness);
    }

    addToTrainingLog(`🧬 Top Prey Fitness: ${topPreySurvivors[0]?.fitness.toFixed(0) || 0}`);
    addToTrainingLog(`🧬 Top Predator Fitness: ${topPredatorSurvivors[0]?.fitness.toFixed(0) || 0}`);

    // === PHASE 3: Curriculum Learning - Adjust difficulty based on win streaks ===
    if (roundWinner === 'prey') {
        preyWinStreak++;
        predatorWinStreak = 0;

        if (preyWinStreak >= 3 && difficultyLevel < 10) {
            difficultyLevel++;
            preyWinStreak = 0;
            addToTrainingLog(`📈 Difficulty increased to ${difficultyLevel}!`);
            console.log(`📈 Difficulty increased to ${difficultyLevel}`);
        }
    } else if (roundWinner === 'predators') {
        predatorWinStreak++;
        preyWinStreak = 0;

        if (predatorWinStreak >= 3 && difficultyLevel > 1) {
            difficultyLevel--;
            predatorWinStreak = 0;
            addToTrainingLog(`📉 Difficulty decreased to ${difficultyLevel}`);
            console.log(`📉 Difficulty decreased to ${difficultyLevel}`);
        }
    }

    // Start next round after a delay
    setTimeout(() => {
        startNextRound();
    }, 3000); // 3 second delay
}

function startNextRound() {
    currentRound++;
    roundTime = 0;
    roundActive = true;
    roundWinner = null;

    // === PHASE 4: Increment generation ===
    generation++;
    addToTrainingLog(`🧬 Generation ${generation} begins!`);

    fish = [];

    // === PHASE 4: Create new prey using crossover breeding ===
    for (let i = 0; i < 5; i++) {
        const prey = new SmartFish(
            Math.random() * canvas.width * 0.4,
            Math.random() * canvas.height,
            'prey'
        );

        // Breed from top survivors using crossover
        if (topPreySurvivors.length >= 2 && Math.random() < 0.8) {
            // Select two parents (fitness-weighted)
            const parent1 = topPreySurvivors[Math.floor(Math.random() * Math.min(3, topPreySurvivors.length))];
            const parent2 = topPreySurvivors[Math.floor(Math.random() * Math.min(3, topPreySurvivors.length))];

            prey.brain = parent1.brain.crossover(parent2.brain);
            prey.brain.mutate(0.05);
            prey.parentFitness = (parent1.fitness + parent2.fitness) / 2;

            console.log(`🧬 Prey bred from parents with fitness ${parent1.fitness.toFixed(0)} & ${parent2.fitness.toFixed(0)}`);
        } else if (topPreySurvivors.length >= 1 && Math.random() < 0.5) {
            // Single parent + mutation
            const parent = topPreySurvivors[0];
            prey.brain = parent.brain.copy();
            prey.brain.mutate(0.1);
            prey.parentFitness = parent.fitness;
        }
        // Otherwise keeps fresh random brain

        fish.push(prey);
    }

    // === PHASE 4: Create new predators using crossover breeding ===
    for (let i = 0; i < 3; i++) {
        const predator = new SmartFish(
            canvas.width * 0.7 + Math.random() * canvas.width * 0.25,
            Math.random() * (canvas.height - 50) + 25,
            'predator'
        );
        predator.size = 25;

        // Breed from top survivors using crossover
        if (topPredatorSurvivors.length >= 2 && Math.random() < 0.8) {
            const parent1 = topPredatorSurvivors[Math.floor(Math.random() * Math.min(3, topPredatorSurvivors.length))];
            const parent2 = topPredatorSurvivors[Math.floor(Math.random() * Math.min(3, topPredatorSurvivors.length))];

            predator.brain = parent1.brain.crossover(parent2.brain);
            predator.brain.mutate(0.05);
            predator.parentFitness = (parent1.fitness + parent2.fitness) / 2;

            console.log(`🧬 Predator bred from parents with fitness ${parent1.fitness.toFixed(0)} & ${parent2.fitness.toFixed(0)}`);
        } else if (topPredatorSurvivors.length >= 1 && Math.random() < 0.5) {
            const parent = topPredatorSurvivors[0];
            predator.brain = parent.brain.copy();
            predator.brain.mutate(0.1);
            predator.parentFitness = parent.fitness;
        }

        fish.push(predator);
    }

    initialPreyCount = fish.filter(f => f.team === 'prey').length;
    initialPredatorCount = fish.filter(f => f.team === 'predator').length;

    addToTrainingLog(`Starting Round ${currentRound + 1} - Prey: ${initialPreyCount}, Predators: ${initialPredatorCount}`);
    console.log(`Starting Round ${currentRound + 1} (Gen ${generation})`);
    console.log(`Prey: ${initialPreyCount}, Predators: ${initialPredatorCount}`);
}

function drawAdversarialUI() {
    if (trainingMode !== 'adversarial') return;

    // Draw round information
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Round: ${currentRound + 1}`, 10, 30);
    ctx.fillText(`Time: ${Math.floor(roundTime / 60)}s`, 10, 60);

    // Draw scores
    ctx.fillStyle = 'red';
    ctx.fillText(`Predators: ${predatorScore}`, 10, 90);
    ctx.fillStyle = 'blue';
    ctx.fillText(`Prey: ${preyScore}`, 10, 120);

    // Draw current counts
    const currentPreyCount = fish.filter(f => f.team === 'prey').length;
    const currentPredatorCount = fish.filter(f => f.team === 'predator').length;

    ctx.fillStyle = 'blue';
    ctx.fillText(`Prey Left: ${currentPreyCount}/${initialPreyCount}`, 10, 150);
    ctx.fillStyle = 'red';
    ctx.fillText(`Predators Left: ${currentPredatorCount}/${initialPredatorCount}`, 10, 180);

    // === PHASE 3: Show difficulty level ===
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Difficulty: ${difficultyLevel}/10`, 10, 210);
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`Speed: ${(getPredatorSpeedMultiplier() * 100).toFixed(0)}%`, 10, 225);

    // === PHASE 4: Show generation and fitness ===
    ctx.fillStyle = 'cyan';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Generation: ${generation}`, 10, 250);
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
    ctx.fillText(`Top Prey: ${topPreyFitness.toFixed(0)}`, 10, 265);
    ctx.fillText(`Top Pred: ${topPredatorFitness.toFixed(0)}`, 10, 280);

    // Draw round status
    if (roundWinner) {
        ctx.fillStyle = roundWinner === 'predators' ? 'red' : 'blue';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`${roundWinner.toUpperCase()} WIN!`, canvas.width / 2 - 100, canvas.height / 2);
    }

    // Draw timer bar
    const timeRatio = roundTime / roundDuration;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(10, canvas.height - 30, canvas.width - 20, 20);
    ctx.fillStyle = timeRatio > 0.8 ? 'red' : timeRatio > 0.5 ? 'yellow' : 'green';
    ctx.fillRect(10, canvas.height - 30, (canvas.width - 20) * timeRatio, 20);
}

function drawDebugWeights() {
    const smartFish = fish.filter(f => f instanceof SmartFish);
    if (smartFish.length === 0) return;

    const preyFish = smartFish.filter(f => f.team === 'prey');
    const predatorFish = smartFish.filter(f => f.team === 'predator');

    // Draw panels side by side, ensuring they fit within canvas
    const panelWidth = 400;
    const totalWidth = panelWidth * 2;
    const startX = Math.max(0, (canvas.width - totalWidth) / 2);

    // Draw prey panel (left side)
    if (preyFish.length > 0) {
        const prey = preyFish[0];
        drawBrainPanel(prey, startX, 10, 'Prey Brain', 'blue');
    }

    // Draw predator panel (right side)
    if (predatorFish.length > 0) {
        const predator = predatorFish[0];
        drawBrainPanel(predator, startX + panelWidth, 10, 'Predator Brain', 'red');
    }
}

function drawBrainPanel(fish, x, y, title, color) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(x, y, 400, 750);

    // Title
    ctx.fillStyle = color;
    ctx.font = '18px Arial';
    ctx.fillText(title, x + 10, y + 25);

    // Draw weight matrices
    drawWeightMatrices(fish, x + 10, y + 40);

    // Visual Inputs and Outputs Section
    let currentY = y + 370;
    const barWidth = 150;
    const barHeight = 12;
    const barSpacing = 16; // Reduced spacing for more compact layout

    // Inputs Section
    ctx.fillStyle = 'cyan';
    ctx.font = '14px Arial';
    ctx.fillText('🧠 Neural Inputs:', x + 10, currentY);
    currentY += 20;

    const inputs = fish.getSensoryInputs();
    const inputLabels = [
        '🍽️ Hunger', '⚡ Energy', '🌱 Food Near', '🧭 Food Dir',
        '🦈 Pred Near', '🧭 Pred Dir', '⚠️ Pred Approach',
        '🐟 Prey Near', '🧭 Prey Dir', '🏃 Prey Escape',
        '🤝 Allies', '⚔️ Enemies', '🏗️ Wall Danger',
        '↔️ L/R Bias', '↕️ U/D Bias', '🌀 Heading', '💨 Speed', '🔴 Is Pred'
    ];

    for (let i = 0; i < inputs.length; i++) {
        const value = inputs[i];
        const barX = x + 10;
        const barY = currentY;

        // Background bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Value bar
        const barColor = value > 0.7 ? '#00ff00' : value > 0.5 ? '#ffff00' : value > 0.3 ? '#ffa500' : '#ff4444';
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barWidth * value, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Label and value
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        const label = inputLabels[i] || `Input${i}`;
        ctx.fillText(label, barX + barWidth + 8, barY + 9);

        ctx.fillStyle = barColor;
        ctx.font = 'bold 10px Arial';
        ctx.fillText(value.toFixed(2), barX + barWidth * value - 20, barY + 9);

        currentY += barSpacing;
    }

    // Outputs Section
    currentY += 10;
    ctx.fillStyle = 'lime';
    ctx.font = '14px Arial';
    ctx.fillText('🎯 Neural Outputs:', x + 10, currentY);
    currentY += 20;

    const outputLabels = ['🏃 Move X', '🏃 Move Y', '🍴 Eat', '👶 Reproduce'];

    for (let i = 0; i < fish.lastDecision.length; i++) {
        const value = fish.lastDecision[i];
        const barX = x + 10;
        const barY = currentY;

        // Background bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Value bar
        const barColor = value > 0.7 ? '#00ff00' : value > 0.5 ? '#ffff00' : value > 0.3 ? '#ffa500' : '#ff4444';
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barWidth * value, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Label and value
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(outputLabels[i], barX + barWidth + 8, barY + 9);

        ctx.fillStyle = barColor;
        ctx.font = 'bold 10px Arial';
        ctx.fillText(value.toFixed(2), barX + barWidth * value - 20, barY + 9);

        currentY += barSpacing;
    }

    // Decision Summary
    currentY += 15;
    ctx.fillStyle = 'yellow';
    ctx.font = '12px Arial';
    ctx.fillText('📊 Current Decision:', x + 10, currentY);
    currentY += 18;

    const [moveX, moveY, eat, reproduce] = fish.lastDecision;
    const speed = 1 + moveX * 1.5;
    const angle = (moveY - 0.5) * Math.PI * 2;
    const direction = Math.round((angle * 180 / Math.PI + 360) % 360);

    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(`Speed: ${speed.toFixed(1)} | Direction: ${direction}°`, x + 10, currentY);
    currentY += 14;
    ctx.fillText(`Eat: ${eat > 0.5 ? 'YES' : 'NO'} | Reproduce: ${reproduce > 0.7 ? 'YES' : 'NO'}`, x + 10, currentY);
}

function drawWeightMatrices(fish, x, y) {
    let currentY = y;
    const lineHeight = 14;
    const colWidth = 45;

    // Input to Hidden weights
    ctx.fillStyle = 'yellow';
    ctx.font = '12px Arial';
    ctx.fillText('Input → Hidden Weights:', x, currentY);
    currentY += lineHeight + 4;

    ctx.fillStyle = 'white';
    ctx.font = '9px Arial';

    // Header row
    ctx.fillText('H\\I', x, currentY);
    for (let i = 0; i < 6; i++) {
        ctx.fillText(`I${i}`, x + colWidth + (i * colWidth), currentY);
    }
    currentY += lineHeight;

    // Weight matrix rows (show first 4 for space)
    for (let h = 0; h < 4; h++) {
        ctx.fillText(`H${h}`, x, currentY);
        for (let i = 0; i < 6; i++) {
            const weight = fish.brain.weightsIH[h][i];
            const weightColor = weight > 0 ? 'lightgreen' : 'pink';
            ctx.fillStyle = weightColor;
            ctx.fillText(weight.toFixed(2), x + colWidth + (i * colWidth), currentY);
        }
        ctx.fillStyle = 'white';
        currentY += lineHeight;
    }

    currentY += 8;

    // Hidden to Output weights
    ctx.fillStyle = 'yellow';
    ctx.font = '12px Arial';
    ctx.fillText('Hidden → Output Weights:', x, currentY);
    currentY += lineHeight + 4;

    ctx.fillStyle = 'white';
    ctx.font = '9px Arial';

    // Header row
    ctx.fillText('O\\H', x, currentY);
    for (let h = 0; h < 8; h++) {
        ctx.fillText(`H${h}`, x + colWidth + (h * colWidth), currentY);
    }
    currentY += lineHeight;

    // Weight matrix rows
    for (let o = 0; o < 4; o++) {
        ctx.fillText(`O${o}`, x, currentY);
        for (let h = 0; h < 8; h++) {
            const weight = fish.brain.weightsHO[o][h];
            const weightColor = weight > 0 ? 'lightgreen' : 'pink';
            ctx.fillStyle = weightColor;
            ctx.fillText(weight.toFixed(2), x + colWidth + (h * colWidth), currentY);
        }
        ctx.fillStyle = 'white';
        currentY += lineHeight;
    }

    currentY += 8;

    // Error plot
    ctx.fillStyle = 'yellow';
    ctx.font = '12px Arial';
    ctx.fillText('Training Error History:', x, currentY);
    currentY += lineHeight + 4;

    // Draw error plot background
    const plotWidth = 300;
    const plotHeight = 60;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, currentY, plotWidth, plotHeight);

    // Draw error plot
    if (fish.errorHistory.length > 1) {
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const maxError = Math.max(...fish.errorHistory);
        const minError = Math.min(...fish.errorHistory);
        const errorRange = maxError - minError || 1;

        for (let i = 0; i < fish.errorHistory.length; i++) {
            const error = fish.errorHistory[i];
            const plotX = x + (i / (fish.errorHistory.length - 1)) * plotWidth;
            const plotY = currentY + plotHeight - ((error - minError) / errorRange) * plotHeight;

            if (i === 0) {
                ctx.moveTo(plotX, plotY);
            } else {
                ctx.lineTo(plotX, plotY);
            }
        }
        ctx.stroke();

        // Current error value
        const currentError = fish.errorHistory[fish.errorHistory.length - 1];
        ctx.fillStyle = 'cyan';
        ctx.font = '10px Arial';
        ctx.fillText(`Current: ${currentError.toFixed(4)}`, x + plotWidth + 10, currentY + 15);

        // Min/Max error values
        ctx.fillStyle = 'yellow';
        ctx.fillText(`Min: ${minError.toFixed(4)}`, x + plotWidth + 10, currentY + 30);
        ctx.fillText(`Max: ${maxError.toFixed(4)}`, x + plotWidth + 10, currentY + 45);
    } else {
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText('No training data yet', x + 10, currentY + plotHeight / 2);
    }

    currentY += plotHeight + 8;

    // Biases (compact version)
    ctx.fillStyle = 'yellow';
    ctx.font = '12px Arial';
    ctx.fillText('Biases:', x, currentY);
    currentY += lineHeight + 4;

    ctx.fillStyle = 'white';
    ctx.font = '9px Arial';

    // Hidden biases (first 4)
    ctx.fillText('Hidden:', x, currentY);
    for (let i = 0; i < 4; i++) {
        const bias = fish.brain.biasH[i][0];
        const biasColor = bias > 0 ? 'lightgreen' : 'pink';
        ctx.fillStyle = biasColor;
        ctx.fillText(bias.toFixed(2), x + colWidth + (i * colWidth), currentY);
    }
    currentY += lineHeight;

    // Output biases
    ctx.fillStyle = 'white';
    ctx.fillText('Output:', x, currentY);
    for (let i = 0; i < 4; i++) {
        const bias = fish.brain.biasO[i][0];
        const biasColor = bias > 0 ? 'lightgreen' : 'pink';
        ctx.fillStyle = biasColor;
        ctx.fillText(bias.toFixed(2), x + colWidth + (i * colWidth), currentY);
    }
}

function animate() {
    gameTime++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update adversarial rounds if active
    if (trainingMode === 'adversarial') {
        updateAdversarialRound();
    }

    // Update and draw plants
    plants.forEach(p => {
        p.update();
        p.draw();
    });

    // Spawn new plants occasionally
    if (gameTime % 300 === 0 && plants.length < 15) { // Every 5 seconds, max 15 plants
        plants.push(new Plant(Math.random() * canvas.width, canvas.height - Math.random() * 100 - 50));
    }

    fish.forEach(f => {
        f.update();
        f.draw();
    });

    bubbles.forEach(b => {
        b.update();
        b.draw();
    });

    // Draw adversarial UI if active
    drawAdversarialUI();

    // Draw debug weights if enabled
    if (showDebugWeights) {
        drawDebugWeights();
    }

    requestAnimationFrame(animate);
}

// Floating Toolbar System
const toolbar = document.createElement('div');
toolbar.id = 'floating-toolbar';
document.body.appendChild(toolbar);

function createToolbarButton(label, icon, key, onClick, isActive = false) {
    const btn = document.createElement('button');
    btn.className = `toolbar-btn ${isActive ? 'active' : ''}`;
    btn.innerHTML = `<span>${icon}</span> ${label} <span class="key-hint">${key}</span>`;
    btn.addEventListener('click', () => {
        onClick();
        updateToolbarVisuals();
    });
    toolbar.appendChild(btn);
    return btn;
}

function updateToolbarVisuals() {
    controlsBtn.classList.toggle('active', !document.querySelector('.controls').classList.contains('hidden'));
    neuralBtn.classList.toggle('active', showNeuralNetwork);
    statsBtn.classList.toggle('active', showDebugWeights);
}

function toggleUI() {
    const controls = document.querySelector('.controls');
    const controlsContainer = document.querySelector('.controls-container');
    const h1 = document.querySelector('h1');

    controls.classList.toggle('hidden');
    controlsContainer.classList.toggle('hidden');
    if (h1) h1.classList.toggle('hidden');
}

const controlsBtn = createToolbarButton('Controls', '⌨️', 'H', toggleUI, true);
const neuralBtn = createToolbarButton('Neural', '🧠', 'N', () => {
    showNeuralNetwork = !showNeuralNetwork;
    addToTrainingLog(`Neural network overlay ${showNeuralNetwork ? 'shown' : 'hidden'}`);
}, showNeuralNetwork);
const statsBtn = createToolbarButton('Stats', '📊', 'D', () => {
    showDebugWeights = !showDebugWeights;
    addToTrainingLog(`Debug weights overlay ${showDebugWeights ? 'shown' : 'hidden'}`);
}, showDebugWeights);
createToolbarButton('Reset', '🔄', 'R', () => {
    if (confirm('Delete all saved data and reset everything?')) resetEverything();
});

// Keyboard shortcut for UI toggle and debug overlays
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'h') {
        toggleUI();
    } else if (key === 'n') {
        showNeuralNetwork = !showNeuralNetwork;
        addToTrainingLog(`Neural network overlay ${showNeuralNetwork ? 'shown' : 'hidden'}`);
    } else if (key === 'd') {
        showDebugWeights = !showDebugWeights;
        addToTrainingLog(`Debug weights overlay ${showDebugWeights ? 'shown' : 'hidden'}`);
    } else if (key === 'r') {
        if (confirm('Delete all saved data and reset everything?')) resetEverything();
    }
    updateToolbarVisuals();
});

// Reset everything function
function resetEverything() {
    console.log('🔄 Resetting everything...');

    // Clear all localStorage
    try {
        localStorage.clear();
        console.log('🗑️ Cleared all localStorage data');
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
    }

    // Reset global variables
    fish = [];
    bubbles = [];
    plants = [];
    trainingLog = [];
    currentRound = 0;
    predatorScore = 0;
    preyScore = 0;
    roundActive = false;
    roundWinner = null;
    gameTime = 0;

    // Clear training data
    trainingData = [];
    currentTrainingExample = null;
    trainingStep = 0;

    // Reinitialize plants
    for (let i = 0; i < 8; i++) {
        plants.push(new Plant(Math.random() * canvas.width, canvas.height - Math.random() * 200 - 100));
    }

    // Update training log display
    updateTrainingLogDisplay();

    // Restart adversarial training
    setTimeout(() => {
        startAdversarialTraining();
    }, 500);

    addToTrainingLog('🔄 Everything reset - starting fresh!');
    console.log('✅ Reset complete - starting fresh simulation');
}

// Initialize plants
for (let i = 0; i < 8; i++) {
    plants.push(new Plant(Math.random() * canvas.width, canvas.height - Math.random() * 200 - 100));
}

// Slider event handlers
function setupLearningRateSliders() {
    // Eating reward slider
    const eatingSlider = document.getElementById('eating-reward-rate');
    const eatingValue = document.getElementById('eating-rate-value');
    eatingSlider.addEventListener('input', (e) => {
        learningRates.eatingReward = parseFloat(e.target.value);
        eatingValue.textContent = learningRates.eatingReward.toFixed(2);
    });

    // Positive reward slider
    const positiveSlider = document.getElementById('positive-reward-rate');
    const positiveValue = document.getElementById('positive-rate-value');
    positiveSlider.addEventListener('input', (e) => {
        learningRates.positiveReward = parseFloat(e.target.value);
        positiveValue.textContent = learningRates.positiveReward.toFixed(2);
    });

    // Negative reward slider
    const negativeSlider = document.getElementById('negative-reward-rate');
    const negativeValue = document.getElementById('negative-rate-value');
    negativeSlider.addEventListener('input', (e) => {
        learningRates.negativeReward = parseFloat(e.target.value);
        negativeValue.textContent = learningRates.negativeReward.toFixed(2);
    });

    // Prey survival slider
    const preySlider = document.getElementById('prey-survival-rate');
    const preyValue = document.getElementById('prey-rate-value');
    preySlider.addEventListener('input', (e) => {
        learningRates.preySurvival = parseFloat(e.target.value);
        preyValue.textContent = learningRates.preySurvival.toFixed(2);
    });

    // Predator hunting slider
    const predatorSlider = document.getElementById('predator-hunting-rate');
    const predatorValue = document.getElementById('predator-rate-value');
    predatorSlider.addEventListener('input', (e) => {
        learningRates.predatorHunting = parseFloat(e.target.value);
        predatorValue.textContent = learningRates.predatorHunting.toFixed(2);
    });
}

// Initialize sliders when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupLearningRateSliders();

    // Clear log button
    const clearLogButton = document.getElementById('clear-log');
    if (clearLogButton) {
        clearLogButton.addEventListener('click', clearTrainingLog);
    }

    // Add Fish button
    const addFishButton = document.getElementById('add-fish');
    if (addFishButton) {
        addFishButton.addEventListener('click', () => {
            const team = Math.random() > 0.7 ? 'predator' : 'prey';
            const newFish = new SmartFish(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                team
            );
            if (team === 'predator') newFish.size = 25;
            fish.push(newFish);
            addToTrainingLog(`Added manual ${team} fish`);
        });
    }

    // Add Bubble button
    const addBubbleButton = document.getElementById('add-bubble');
    if (addBubbleButton) {
        addBubbleButton.addEventListener('click', () => {
            bubbles.push(new Bubble(Math.random() * canvas.width, canvas.height));
            addToTrainingLog('Added manual bubble');
        });
    }
});

// Start adversarial training automatically
setTimeout(() => {
    startAdversarialTraining();
}, 1000); // Start after 1 second

animate();
