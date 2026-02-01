class AlgorithmVisualizer {
    constructor() {
        this.container = document.getElementById('visualizer-container');
        this.sizeSlider = document.getElementById('size-slider');
        this.speedSlider = document.getElementById('speed-slider');
        this.algorithmSelect = document.getElementById('algorithm-select');
        this.generateBtn = document.getElementById('generate-btn');
        this.sortBtn = document.getElementById('sort-btn');
        this.compCountEl = document.getElementById('comp-count');
        this.swapCountEl = document.getElementById('swap-count');

        this.array = [];
        this.isSorting = false;
        this.abortController = null;
        
        // Stats
        this.comparisons = 0;
        this.swaps = 0;

        this.init();
    }

    init() {
        this.addEventListeners();
        this.generateArray();
    }

    addEventListeners() {
        this.generateBtn.addEventListener('click', () => {
            if (this.isSorting) this.abortSorting();
            this.generateArray();
        });

        this.sortBtn.addEventListener('click', () => {
            if (!this.isSorting) this.startSorting();
        });

        this.sizeSlider.addEventListener('input', () => {
            if (this.isSorting) this.abortSorting();
            this.generateArray();
        });
    }

    generateArray() {
        const size = parseInt(this.sizeSlider.value);
        this.array = [];
        this.container.innerHTML = '';
        
        // Reset Stats
        this.updateStats(0, 0);

        for (let i = 0; i < size; i++) {
            // Generate random height between 5% and 100%
            const value = Math.floor(Math.random() * 95) + 5;
            this.array.push(value);
            
            const bar = document.createElement('div');
            bar.classList.add('bar');
            bar.style.height = `${value}%`;
            bar.style.width = `${100 / size}%`; // Ensure bars fit
            this.container.appendChild(bar);
        }
    }

    updateStats(comp, swap) {
        this.comparisons = comp;
        this.swaps = swap;
        this.compCountEl.innerText = this.comparisons;
        this.swapCountEl.innerText = this.swaps;
    }

    async startSorting() {
        this.isSorting = true;
        this.disableControls(true);
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const algorithm = this.algorithmSelect.value;
        
        try {
            switch (algorithm) {
                case 'bubble':
                    await this.bubbleSort(signal);
                    break;
                case 'insertion':
                    await this.insertionSort(signal);
                    break;
                case 'quick':
                    await this.quickSort(this.array, 0, this.array.length - 1, signal);
                    break;
                case 'merge':
                    await this.mergeSort(this.array, 0, this.array.length - 1, signal);
                    break;
            }
            
            if (!signal.aborted) {
                await this.animateCompletion();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Sorting aborted');
            } else {
                console.error(error);
            }
        } finally {
            this.isSorting = false;
            this.disableControls(false);
            this.abortController = null;
        }
    }

    abortSorting() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isSorting = false;
        this.disableControls(false);
        this.generateArray(); // Reset visually
    }

    disableControls(disabled) {
        this.sizeSlider.disabled = disabled;
        this.algorithmSelect.disabled = disabled;
        this.sortBtn.disabled = disabled;
        this.generateBtn.textContent = disabled ? 'Stop' : 'New Array';
    }

    getDelay() {
        // Invert speed: 1 (slow) -> 200ms, 100 (fast) -> 1ms
        const val = 101 - parseInt(this.speedSlider.value);
        return Math.floor(val * 2); // Tuning factor
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkAbort(signal) {
        if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        await this.sleep(this.getDelay());
    }

    getBars() {
        return document.getElementsByClassName('bar');
    }

    async swap(i, j) {
        const bars = this.getBars();
        
        // Visual Swap
        bars[i].classList.add('swap');
        bars[j].classList.add('swap');
        
        // Logical Swap
        let temp = this.array[i];
        this.array[i] = this.array[j];
        this.array[j] = temp;

        // DOM Update
        bars[i].style.height = `${this.array[i]}%`;
        bars[j].style.height = `${this.array[j]}%`;

        this.updateStats(this.comparisons, this.swaps + 1);

        // Wait to show color
        await this.sleep(this.getDelay());

        bars[i].classList.remove('swap');
        bars[j].classList.remove('swap');
    }

    async highlight(indices, className) {
        const bars = this.getBars();
        indices.forEach(idx => {
            if (bars[idx]) bars[idx].classList.add(className);
        });
    }

    async unhighlight(indices, className) {
        const bars = this.getBars();
        indices.forEach(idx => {
            if (bars[idx]) bars[idx].classList.remove(className);
        });
    }

    // --- Algorithms ---

    async bubbleSort(signal) {
        const len = this.array.length;
        for (let i = 0; i < len; i++) {
            for (let j = 0; j < len - i - 1; j++) {
                await this.checkAbort(signal);
                
                // Compare
                await this.highlight([j, j + 1], 'compare');
                this.updateStats(this.comparisons + 1, this.swaps);
                
                await this.sleep(this.getDelay());

                if (this.array[j] > this.array[j + 1]) {
                    await this.swap(j, j + 1);
                }
                
                await this.unhighlight([j, j + 1], 'compare');
            }
            // Mark sorted
            const bars = this.getBars();
            bars[len - i - 1].classList.add('sorted');
        }
    }

    async insertionSort(signal) {
        const len = this.array.length;
        for (let i = 1; i < len; i++) {
            let key = this.array[i];
            let j = i - 1;
            
            // Highlight key
            await this.highlight([i], 'compare'); 

            while (j >= 0 && this.array[j] > key) {
                await this.checkAbort(signal);
                
                this.updateStats(this.comparisons + 1, this.swaps + 1);
                
                // Visualize "shift"
                this.array[j + 1] = this.array[j];
                const bars = this.getBars();
                bars[j + 1].style.height = `${this.array[j]}%`;
                bars[j + 1].classList.add('swap');
                
                await this.sleep(this.getDelay());
                bars[j + 1].classList.remove('swap');

                j--;
            }
            this.array[j + 1] = key;
            const bars = this.getBars();
            bars[j + 1].style.height = `${key}%`;
            
            await this.unhighlight([i], 'compare');
        }
    }

    async quickSort(arr, low, high, signal) {
        if (low < high) {
            let pi = await this.partition(arr, low, high, signal);
            await this.quickSort(arr, low, pi - 1, signal);
            await this.quickSort(arr, pi + 1, high, signal);
        }
    }

    async partition(arr, low, high, signal) {
        let pivot = arr[high];
        await this.highlight([high], 'sorted'); // Mark pivot temporarily
        
        let i = (low - 1);
        
        for (let j = low; j < high; j++) {
            await this.checkAbort(signal);
            
            await this.highlight([j], 'compare');
            this.updateStats(this.comparisons + 1, this.swaps);
            await this.sleep(this.getDelay());

            if (arr[j] < pivot) {
                i++;
                await this.swap(i, j);
            }
            await this.unhighlight([j], 'compare');
        }
        await this.swap(i + 1, high);
        await this.unhighlight([high], 'sorted');
        return i + 1;
    }

    async mergeSort(arr, l, r, signal) {
        if (l >= r) {
            return;
        }
        const m = l + parseInt((r - l) / 2);
        await this.mergeSort(arr, l, m, signal);
        await this.mergeSort(arr, m + 1, r, signal);
        await this.merge(arr, l, m, r, signal);
    }

    async merge(arr, l, m, r, signal) {
        const n1 = m - l + 1;
        const n2 = r - m;
        
        // Create temp arrays
        let L = new Array(n1);
        let R = new Array(n2);

        for (let i = 0; i < n1; i++) L[i] = arr[l + i];
        for (let j = 0; j < n2; j++) R[j] = arr[m + 1 + j];

        let i = 0, j = 0, k = l;
        const bars = this.getBars();

        while (i < n1 && j < n2) {
            await this.checkAbort(signal);
            
            // Visualize comparison
            await this.highlight([l + i, m + 1 + j], 'compare');
            this.updateStats(this.comparisons + 1, this.swaps);
            await this.sleep(this.getDelay());

            if (L[i] <= R[j]) {
                arr[k] = L[i];
                i++;
            } else {
                arr[k] = R[j];
                j++;
            }
            
            // Visualize update
            bars[k].style.height = `${arr[k]}%`;
            bars[k].classList.add('swap');
            await this.sleep(this.getDelay());
            bars[k].classList.remove('swap');
            
            await this.unhighlight([l + i - (L[i] <= R[j] ? 1 : 0), m + 1 + j - (L[i] > R[j] ? 1 : 0)], 'compare'); // Tricky to unhighlight exact indices, cleaning simplified

            // Cleanup any stuck highlights in range
            for(let x=l; x<=r; x++) bars[x].classList.remove('compare');

            k++;
        }

        while (i < n1) {
            await this.checkAbort(signal);
            arr[k] = L[i];
            bars[k].style.height = `${arr[k]}%`;
            bars[k].classList.add('swap');
            await this.sleep(this.getDelay());
            bars[k].classList.remove('swap');
            i++;
            k++;
        }

        while (j < n2) {
            await this.checkAbort(signal);
            arr[k] = R[j];
            bars[k].style.height = `${arr[k]}%`;
            bars[k].classList.add('swap');
            await this.sleep(this.getDelay());
            bars[k].classList.remove('swap');
            j++;
            k++;
        }
    }

    async animateCompletion() {
        const bars = this.getBars();
        for (let i = 0; i < bars.length; i++) {
            bars[i].classList.remove('compare', 'swap');
            bars[i].classList.add('sorted');
            await this.sleep(10);
        }
    }
}

// Start app
const app = new AlgorithmVisualizer();
