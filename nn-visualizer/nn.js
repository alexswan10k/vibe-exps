/**
 * Neural Network Learning Simulator
 * Core Engine
 */

class Activation {
    static sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    static sigmoidDeriv(y) {
        return y * (1 - y); // Here y is sigmoid(x)
    }

    static relu(x) {
        return Math.max(0, x);
    }

    static reluDeriv(y) {
        return y > 0 ? 1 : 0.01; // Leaky ReLu for better training
    }

    static tanh(x) {
        return Math.tanh(x);
    }

    static tanhDeriv(y) {
        return 1 - y * y;
    }

    static linear(x) {
        return x;
    }

    static linearDeriv(y) {
        return 1;
    }
}

class Layer {
    constructor(inputSize, outputSize, activation = 'sigmoid') {
        this.inputSize = inputSize;
        this.outputSize = outputSize;

        // Xavier/Glorot Initialization
        const range = Math.sqrt(6 / (inputSize + outputSize));
        this.weights = Array.from({ length: outputSize }, () =>
            Array.from({ length: inputSize }, () => Math.random() * 2 * range - range)
        );
        this.biases = Array.from({ length: outputSize }, () => 0);

        this.activationName = activation;
        this.activationFunc = Activation[activation];
        this.activationDeriv = Activation[activation + 'Deriv'];

        // Gradients
        this.weightGradients = Array.from({ length: outputSize }, () => Array(inputSize).fill(0));
        this.biasGradients = Array(outputSize).fill(0);

        // Cache for backprop
        this.lastInputs = null;
        this.lastOutputsAtiv = null;
    }

    forward(inputs) {
        this.lastInputs = [...inputs];
        const outputs = [];
        for (let i = 0; i < this.outputSize; i++) {
            let sum = this.biases[i];
            for (let j = 0; j < this.inputSize; j++) {
                sum += inputs[j] * this.weights[i][j];
            }
            outputs.push(this.activationFunc(sum));
        }
        this.lastOutputsAtiv = outputs;
        return outputs;
    }

    // Returns error with respect to inputs of this layer
    backward(errorAtOutput) {
        const delta = errorAtOutput.map((err, i) => err * this.activationDeriv(this.lastOutputsAtiv[i]));

        // Calculate gradients for weights and biases
        for (let i = 0; i < this.outputSize; i++) {
            this.biasGradients[i] += delta[i];
            for (let j = 0; j < this.inputSize; j++) {
                this.weightGradients[i][j] += delta[i] * this.lastInputs[j];
            }
        }

        // Error for previous layer
        const errorAtInput = Array(this.inputSize).fill(0);
        for (let j = 0; j < this.inputSize; j++) {
            for (let i = 0; i < this.outputSize; i++) {
                errorAtInput[j] += delta[i] * this.weights[i][j];
            }
        }
        return errorAtInput;
    }

    update(learningRate, batchSize) {
        for (let i = 0; i < this.outputSize; i++) {
            this.biases[i] -= (learningRate * this.biasGradients[i]) / batchSize;
            for (let j = 0; j < this.inputSize; j++) {
                this.weights[i][j] -= (learningRate * this.weightGradients[i][j]) / batchSize;
                this.weightGradients[i][j] = 0; // Reset gradients
            }
            this.biasGradients[i] = 0;
        }
    }
}

class NeuralNetwork {
    constructor(config) {
        this.layers = [];
        let inputSize = config.inputSize;
        for (const layerSize of config.hiddenLayers) {
            this.layers.push(new Layer(inputSize, layerSize, config.activation || 'tanh'));
            inputSize = layerSize;
        }
        // Output layer: 'sigmoid' for classification, 'linear' for regression
        this.outputType = config.outputType || 'classification';
        const outActiv = this.outputType === 'classification' ? 'sigmoid' : 'linear';
        this.layers.push(new Layer(inputSize, 1, outActiv));

        this.learningRate = config.learningRate || 0.1;
    }

    predict(inputs) {
        let output = inputs;
        for (const layer of this.layers) {
            output = layer.forward(output);
        }
        return output[0];
    }

    train(data, labels, batchSize = 1) {
        let totalLoss = 0;
        for (let i = 0; i < data.length; i++) {
            const pred = this.predict(data[i]);
            const label = labels[i];

            let error;
            if (this.outputType === 'classification') {
                // BCE Loss Gradient: pred - label
                error = [pred - label];
                totalLoss += - (label * Math.log(pred + 1e-15) + (1 - label) * Math.log(1 - pred + 1e-15));
            } else {
                // MSE Loss Gradient: 2 * (pred - label)
                error = [2 * (pred - label)];
                totalLoss += Math.pow(pred - label, 2);
            }

            // Backprop through layers
            for (let j = this.layers.length - 1; j >= 0; j--) {
                error = this.layers[j].backward(error);
            }

            if ((i + 1) % batchSize === 0 || i === data.length - 1) {
                const currentBatchSize = (i % batchSize) + 1;
                for (const layer of this.layers) {
                    layer.update(this.learningRate, currentBatchSize);
                }
            }
        }
        return totalLoss / data.length;
    }
}
