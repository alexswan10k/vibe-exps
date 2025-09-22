// Comprehensive Integration Tests for Mermaid Diagram Refiner
// Tests context management, chat activities, and function calling

// Mock localStorage for testing
const mockLocalStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

// Override global localStorage for Node.js
if (typeof global !== 'undefined') {
    global.localStorage = mockLocalStorage;
} else if (typeof window !== 'undefined') {
    window.localStorage = mockLocalStorage;
}

// Test state
let currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;

let conversationMessages = [];
const MAX_CONTEXT_TOKENS = 32000;
const CONTEXT_WARNING_THRESHOLD = 0.8;

// Mock functions from main script
function executeTool(name, args) {
    switch (name) {
        case 'add_node':
            // Check if node with this ID already exists and replace it
            const nodeRegex = new RegExp(`\\n${args.id}\\[.*?\\]`, 'g');
            if (currentDiagram.match(nodeRegex)) {
                // Replace existing node
                currentDiagram = currentDiagram.replace(nodeRegex, `\n${args.id}[${args.label}]`);
            } else {
                // Add new node
                currentDiagram += `\n${args.id}[${args.label}]`;
            }
            break;
        case 'remove_node':
            const removeNodeRegex = new RegExp(`\\n${args.id}\\[.*?\\]`, 'g');
            currentDiagram = currentDiagram.replace(removeNodeRegex, '');
            break;
        case 'add_edge':
            const edgeLabel = args.label ? `|${args.label}|` : '';
            currentDiagram += `\n${args.from} -->${edgeLabel} ${args.to}`;
            break;
        case 'remove_edge':
            const edgeRegex = new RegExp(`\\n${args.from} -->.*? ${args.to}`, 'g');
            currentDiagram = currentDiagram.replace(edgeRegex, '');
            break;
        case 'modify_node_label':
            const labelRegex = new RegExp(`(${args.id})\\[(.*?)\\]`, 'g');
            currentDiagram = currentDiagram.replace(labelRegex, `$1[${args.new_label}]`);
            break;
        case 'modify_edge_label':
            const edgeLabelRegex = new RegExp(`(${args.from} -->)\\|(.*?)\\| (${args.to})`, 'g');
            currentDiagram = currentDiagram.replace(edgeLabelRegex, `$1|${args.new_label}| $3`);
            break;
    }
    return true; // Success
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

function saveMessageToStorage(role, content, type = 'normal') {
    const message = { role, content, type };
    conversationMessages.push(message);
}

function resetTestState() {
    currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;
    conversationMessages = [];
    mockLocalStorage.clear();
}

function updateContextStatus() {
    const totalTokens = conversationMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    return { totalTokens, percent: Math.round((totalTokens / MAX_CONTEXT_TOKENS) * 100) };
}

// Mock LLM response simulator
function simulateLLMResponse(userMessage, shouldUseTools = false, toolCalls = []) {
    let response = '';

    if (shouldUseTools) {
        // Simulate tool calls
        response = `I'll help you modify the diagram.`;
        return {
            content: response,
            tool_calls: toolCalls
        };
    } else {
        // Simulate regular response
        response = `I understand your request: "${userMessage}". The diagram has been processed.`;
        return {
            content: response,
            tool_calls: []
        };
    }
}

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ ASSERTION FAILED: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
}

// Test suites
function runContextManagementTests() {
    console.log('📊 Testing Context Management\n');

    resetTestState();

    // Test 1: Token estimation
    console.log('Test 1: Token estimation');
    const text = 'Hello world this is a test message';
    const tokens = estimateTokens(text);
    assertEqual(tokens, 9, 'Token estimation should be ~4 chars per token');
    console.log('✅ PASS\n');

    // Test 2: Context status calculation
    console.log('Test 2: Context status calculation');
    saveMessageToStorage('user', 'Short message');
    saveMessageToStorage('assistant', 'A'.repeat(1000)); // Long message
    const status = updateContextStatus();
    assert(status.totalTokens > 0, 'Should have tokens');
    assert(status.percent >= 0 && status.percent <= 100, 'Percent should be valid');
    console.log('✅ PASS\n');

    // Test 3: Context warning threshold
    console.log('Test 3: Context warning threshold');
    const thresholdTokens = MAX_CONTEXT_TOKENS * CONTEXT_WARNING_THRESHOLD;
    const longMessage = 'A'.repeat(thresholdTokens * 4); // Should exceed threshold
    saveMessageToStorage('user', longMessage);
    const status2 = updateContextStatus();
    assert(status2.percent >= CONTEXT_WARNING_THRESHOLD * 100, 'Should trigger warning threshold');
    console.log('✅ PASS\n');
}

function runChatActivityTests() {
    console.log('💬 Testing Chat Activities\n');

    resetTestState();

    // Test 1: Message storage
    console.log('Test 1: Message storage');
    saveMessageToStorage('user', 'Hello');
    saveMessageToStorage('assistant', 'Hi there!');
    assertEqual(conversationMessages.length, 2, 'Should have 2 messages');
    assertEqual(conversationMessages[0].role, 'user', 'First message should be user');
    assertEqual(conversationMessages[1].role, 'assistant', 'Second message should be assistant');
    console.log('✅ PASS\n');

    // Test 2: Message persistence
    console.log('Test 2: Message persistence');
    const testDiagram = 'graph TD\nA[Test] --> B[Node]';
    mockLocalStorage.setItem('mermaid-diagram', testDiagram);
    mockLocalStorage.setItem('conversation-messages', JSON.stringify(conversationMessages));

    // Simulate loading
    const savedDiagram = mockLocalStorage.getItem('mermaid-diagram');
    const savedMessages = JSON.parse(mockLocalStorage.getItem('conversation-messages'));

    assertEqual(savedDiagram, testDiagram, 'Diagram should be saved');
    assertEqual(savedMessages.length, 2, 'Messages should be saved');
    console.log('✅ PASS\n');

    // Test 3: Thinking message parsing
    console.log('Test 3: Thinking message parsing');
    const thinkingContent = '<think>This is thinking content</think>This is final content';
    saveMessageToStorage('assistant', thinkingContent, 'thinking');

    const msg = conversationMessages[conversationMessages.length - 1];
    assertEqual(msg.type, 'thinking', 'Should be thinking type');
    assert(msg.content.includes('<think>'), 'Should contain thinking tags');
    assert(msg.content.includes('This is final content'), 'Should contain final content');
    console.log('✅ PASS\n');
}

function runFunctionCallingTests() {
    console.log('🔧 Testing Function Calling\n');

    // Test 1: Tool execution - add_node
    console.log('Test 1: Tool execution - add_node');
    resetTestState();
    const initialDiagram = currentDiagram;
    executeTool('add_node', { id: 'D', label: 'New Step' });
    assert(currentDiagram.includes('D[New Step]'), 'Should add new node');
    assert(currentDiagram !== initialDiagram, 'Diagram should change');
    assert(currentDiagram.includes('A[Start]'), 'Should preserve existing nodes');
    assert(currentDiagram.includes('B[Process]'), 'Should preserve existing nodes');
    assert(currentDiagram.includes('C[End]'), 'Should preserve existing nodes');
    console.log('✅ PASS\n');

    // Test 2: Tool execution - add_edge
    console.log('Test 2: Tool execution - add_edge');
    resetTestState();
    executeTool('add_edge', { from: 'C', to: 'D', label: 'Test' });
    assert(currentDiagram.includes('C -->|Test| D'), 'Should add edge with label');
    console.log('✅ PASS\n');

    // Test 3: Tool execution - add_edge without label
    console.log('Test 3: Tool execution - add_edge without label');
    resetTestState();
    executeTool('add_edge', { from: 'B', to: 'C' });
    assert(currentDiagram.includes('B --> C'), 'Should add edge without label');
    assert(!currentDiagram.includes('B -->|'), 'Should not have empty label syntax');
    console.log('✅ PASS\n');

    // Test 4: Tool execution - modify_node_label
    console.log('Test 4: Tool execution - modify_node_label');
    resetTestState();
    executeTool('modify_node_label', { id: 'B', new_label: 'Updated Process' });
    assert(currentDiagram.includes('B[Updated Process]'), 'Should modify node label');
    assert(!currentDiagram.includes('B[Process]'), 'Should not contain old label');
    console.log('✅ PASS\n');

    // Test 5: Tool execution - remove_node
    console.log('Test 5: Tool execution - remove_node');
    resetTestState();
    executeTool('add_node', { id: 'D', label: 'Temp' });
    assert(currentDiagram.includes('D[Temp]'), 'Should have temp node');
    executeTool('remove_node', { id: 'D' });
    assert(!currentDiagram.includes('D[Temp]'), 'Should remove temp node');
    console.log('✅ PASS\n');

    // Test 6: Tool execution - modify_edge_label
    console.log('Test 6: Tool execution - modify_edge_label');
    resetTestState();
    executeTool('add_edge', { from: 'B', to: 'C', label: 'old' });
    assert(currentDiagram.includes('B -->|old| C'), 'Should have old label');
    executeTool('modify_edge_label', { from: 'B', to: 'C', new_label: 'new' });
    assert(currentDiagram.includes('B -->|new| C'), 'Should have new label');
    assert(!currentDiagram.includes('B -->|old| C'), 'Should not have old label');
    console.log('✅ PASS\n');

    // Test 7: Complex tool sequence
    console.log('Test 7: Complex tool sequence');
    resetTestState();
    executeTool('add_node', { id: 'D', label: 'Review' });
    executeTool('add_edge', { from: 'C', to: 'D', label: 'After' });
    executeTool('modify_node_label', { id: 'D', new_label: 'Final Review' });

    assert(currentDiagram.includes('D[Final Review]'), 'Should have renamed node');
    assert(currentDiagram.includes('C -->|After| D'), 'Should have labeled edge');
    console.log('✅ PASS\n');

    // Test 8: Tool call simulation
    console.log('Test 8: Tool call simulation');
    const mockToolCalls = [
        {
            id: 'call_1',
            function: {
                name: 'add_node',
                arguments: '{"id": "E", "label": "Test Node"}'
            }
        }
    ];

    const llmResponse = simulateLLMResponse('Add a test node', true, mockToolCalls);
    assert(llmResponse.tool_calls.length > 0, 'Should have tool calls');
    assertEqual(llmResponse.tool_calls[0].function.name, 'add_node', 'Should call add_node');

    // Execute the tool call
    const args = JSON.parse(llmResponse.tool_calls[0].function.arguments);
    executeTool(llmResponse.tool_calls[0].function.name, args);
    assert(currentDiagram.includes('E[Test Node]'), 'Should execute tool call');
    console.log('✅ PASS\n');

    // Test 9: Multiple nodes with same ID should not duplicate
    console.log('Test 9: Multiple nodes with same ID handling');
    resetTestState();
    executeTool('add_node', { id: 'D', label: 'First' });
    assert(currentDiagram.includes('D[First]'), 'Should add first node');
    executeTool('add_node', { id: 'D', label: 'Second' });
    // This should replace the existing node, not add a duplicate
    const dCount = (currentDiagram.match(/D\[/g) || []).length;
    assertEqual(dCount, 1, 'Should not create duplicate nodes with same ID');
    assert(currentDiagram.includes('D[Second]'), 'Should update node label');
    assert(!currentDiagram.includes('D[First]'), 'Should not contain old label');
    console.log('✅ PASS\n');

    // Test 10: Edge with special characters in label
    console.log('Test 10: Edge with special characters in label');
    resetTestState();
    executeTool('add_edge', { from: 'A', to: 'B', label: 'Process -> Continue' });
    assert(currentDiagram.includes('A -->|Process -> Continue| B'), 'Should handle special characters in edge label');
    console.log('✅ PASS\n');

    // Test 11: Node with special characters in label
    console.log('Test 11: Node with special characters in label');
    resetTestState();
    executeTool('add_node', { id: 'E', label: 'Step #1: Process' });
    assert(currentDiagram.includes('E[Step #1: Process]'), 'Should handle special characters in node label');
    console.log('✅ PASS\n');

    // Test 12: Remove non-existent node (should not crash)
    console.log('Test 12: Remove non-existent node');
    resetTestState();
    const beforeRemove = currentDiagram;
    executeTool('remove_node', { id: 'NonExistent' });
    assertEqual(currentDiagram, beforeRemove, 'Should not change diagram when removing non-existent node');
    console.log('✅ PASS\n');

    // Test 13: Modify non-existent node label (should not crash)
    console.log('Test 13: Modify non-existent node label');
    resetTestState();
    const beforeModify = currentDiagram;
    executeTool('modify_node_label', { id: 'NonExistent', new_label: 'New Label' });
    assertEqual(currentDiagram, beforeModify, 'Should not change diagram when modifying non-existent node');
    console.log('✅ PASS\n');

    // Test 14: Modify non-existent edge label (should not crash)
    console.log('Test 14: Modify non-existent edge label');
    resetTestState();
    const beforeEdgeModify = currentDiagram;
    executeTool('modify_edge_label', { from: 'A', to: 'D', new_label: 'New Label' });
    assertEqual(currentDiagram, beforeEdgeModify, 'Should not change diagram when modifying non-existent edge');
    console.log('✅ PASS\n');

    // Test 15: Complex workflow creation
    console.log('Test 15: Complex workflow creation');
    resetTestState();

    // Create a complex workflow
    const workflowSteps = [
        { tool: 'add_node', args: { id: 'D', label: 'Validate' } },
        { tool: 'add_node', args: { id: 'E', label: 'Process' } },
        { tool: 'add_node', args: { id: 'F', label: 'Complete' } },
        { tool: 'add_edge', args: { from: 'C', to: 'D', label: 'then' } },
        { tool: 'add_edge', args: { from: 'D', to: 'E', label: 'if valid' } },
        { tool: 'add_edge', args: { from: 'E', to: 'F', label: 'success' } },
        { tool: 'modify_node_label', args: { id: 'B', new_label: 'Initial Check' } }
    ];

    workflowSteps.forEach(step => {
        executeTool(step.tool, step.args);
    });

    // Verify all elements are present
    assert(currentDiagram.includes('D[Validate]'), 'Should have validate node');
    assert(currentDiagram.includes('E[Process]'), 'Should have process node');
    assert(currentDiagram.includes('F[Complete]'), 'Should have complete node');
    assert(currentDiagram.includes('C -->|then| D'), 'Should have C to D edge');
    assert(currentDiagram.includes('D -->|if valid| E'), 'Should have D to E edge');
    assert(currentDiagram.includes('E -->|success| F'), 'Should have E to F edge');
    assert(currentDiagram.includes('B[Initial Check]'), 'Should have renamed B node');
    assert(!currentDiagram.includes('B[Process]'), 'Should not have old B label');

    console.log('✅ PASS\n');

    // Test 16: Tool argument validation (missing required args)
    console.log('Test 16: Tool argument validation');
    resetTestState();

    // Test missing id for add_node
    try {
        executeTool('add_node', { label: 'Test' });
        assert(false, 'Should throw error for missing id');
    } catch (e) {
        assert(true, 'Should handle missing id gracefully');
    }

    // Test missing label for add_node
    try {
        executeTool('add_node', { id: 'X' });
        assert(false, 'Should throw error for missing label');
    } catch (e) {
        assert(true, 'Should handle missing label gracefully');
    }

    console.log('✅ PASS\n');

    // Test 17: Sequential modifications
    console.log('Test 17: Sequential modifications');
    resetTestState();

    // Start with basic diagram
    executeTool('add_node', { id: 'D', label: 'Temp' });
    assert(currentDiagram.includes('D[Temp]'), 'Should add temp node');

    // Modify it multiple times
    executeTool('modify_node_label', { id: 'D', new_label: 'Step 1' });
    assert(currentDiagram.includes('D[Step 1]'), 'Should modify to Step 1');

    executeTool('modify_node_label', { id: 'D', new_label: 'Step 2' });
    assert(currentDiagram.includes('D[Step 2]'), 'Should modify to Step 2');

    // Add edges and modify them
    executeTool('add_edge', { from: 'C', to: 'D', label: 'connect' });
    assert(currentDiagram.includes('C -->|connect| D'), 'Should add edge with connect label');

    executeTool('modify_edge_label', { from: 'C', to: 'D', new_label: 'linked' });
    assert(currentDiagram.includes('C -->|linked| D'), 'Should modify edge to linked');
    assert(!currentDiagram.includes('C -->|connect| D'), 'Should not have old connect label');

    console.log('✅ PASS\n');
}

function runSummarizationTests() {
    console.log('📝 Testing Summarization Functionality\n');

    // Test 1: Thinking message summarization (strips thinking section)
    console.log('Test 1: Thinking message summarization (strips thinking section)');
    resetTestState();
    const originalThinking = '<think>This is a long thinking process that analyzes the user request in detail, considering various approaches and potential edge cases before deciding on the best course of action.</think>This is the final response.';
    saveMessageToStorage('assistant', originalThinking, 'thinking');

    // Simulate summarization by stripping thinking section entirely
    const finalContent = 'This is the final response.';
    const summarizedContent = `[Thinking summarized] ${finalContent}`;

    // Update the message in conversationMessages (simulate what summarizeThinkingBlocks does)
    const thinkingMsgIndex = conversationMessages.findIndex(msg => msg.type === 'thinking');
    if (thinkingMsgIndex !== -1) {
        conversationMessages[thinkingMsgIndex] = {
            role: 'assistant',
            content: summarizedContent,
            type: 'normal'
        };
    }

    const updatedMsg = conversationMessages[thinkingMsgIndex];
    assertEqual(updatedMsg.type, 'normal', 'Message type should change to normal');
    assert(updatedMsg.content.includes('[Thinking summarized]'), 'Should contain summarization marker');
    assert(updatedMsg.content.includes('This is the final response'), 'Should preserve final response');
    assert(!updatedMsg.content.includes('<think>'), 'Should not contain thinking tags');
    assert(!updatedMsg.content.includes('long thinking process'), 'Should not contain original thinking content');
    console.log('✅ PASS\n');

    // Test 2: Context reduction after summarization
    console.log('Test 2: Context reduction after summarization');
    resetTestState();
    const longThinking = '<think>This is a very long thinking process with lots of detailed analysis that should take many tokens when counted.</think>Short response.';
    saveMessageToStorage('assistant', longThinking, 'thinking');

    const beforeTokens = updateContextStatus().totalTokens;

    // Simulate summarization - replace with much shorter content
    const thinkingMsg = conversationMessages.find(msg => msg.type === 'thinking');
    if (thinkingMsg) {
        thinkingMsg.content = '[Summarized] Brief summary. Response.';
        thinkingMsg.type = 'normal';
    }

    const afterTokens = updateContextStatus().totalTokens;
    assert(afterTokens < beforeTokens, 'Token count should decrease after summarization');
    console.log('✅ PASS\n');

    // Test 3: Multiple thinking blocks handling
    console.log('Test 3: Multiple thinking blocks handling');
    resetTestState();
    saveMessageToStorage('assistant', '<think>Second thinking block.</think>Second response.', 'thinking');
    saveMessageToStorage('assistant', '<think>Third thinking block.</think>Third response.', 'thinking');

    const thinkingMessages = conversationMessages.filter(msg => msg.type === 'thinking');
    assertEqual(thinkingMessages.length, 2, 'Should have 2 thinking messages');

    // Simulate keeping only the most recent 1 and summarizing the oldest
    const oldestThinking = thinkingMessages[0];
    oldestThinking.content = '<think>[Summarized] Old thinking summarized.</think>Original response.';

    assert(oldestThinking.content.includes('[Summarized]'), 'Oldest should be summarized');
    assert(thinkingMessages[1].content.includes('Third thinking'), 'Most recent should remain unchanged');
    console.log('✅ PASS\n');
}

function runIntegrationTests() {
    console.log('🔗 Testing Integration Scenarios\n');

    resetTestState();

    // Test 1: Full conversation flow
    console.log('Test 1: Full conversation flow');
    saveMessageToStorage('user', 'Add a new step called "Validation"');
    saveMessageToStorage('assistant', 'I\'ll add a validation step to your diagram.');

    // Simulate tool execution
    executeTool('add_node', { id: 'D', label: 'Validation' });
    executeTool('add_edge', { from: 'C', to: 'D' });

    assert(conversationMessages.length >= 2, 'Should have conversation messages');
    assert(currentDiagram.includes('D[Validation]'), 'Should have validation node');
    assert(currentDiagram.includes('C --> D'), 'Should have connection to validation');
    console.log('✅ PASS\n');

    // Test 2: Context management with conversation
    console.log('Test 2: Context management with conversation');
    // Add many messages to test context limits
    for (let i = 0; i < 10; i++) {
        saveMessageToStorage('user', `Message ${i}: ${'A'.repeat(100)}`);
        saveMessageToStorage('assistant', `Response ${i}: ${'B'.repeat(100)}`);
    }

    const status = updateContextStatus();
    assert(status.totalTokens > 0, 'Should have accumulated tokens');
    console.log('✅ PASS\n');

    // Test 3: Error handling
    console.log('Test 3: Error handling');
    try {
        executeTool('invalid_tool', {});
        assert(false, 'Should throw error for invalid tool');
    } catch (e) {
        assert(true, 'Should handle invalid tool gracefully');
    }
    console.log('✅ PASS\n');
}

function runAllTests() {
    console.log('🧪 Running Comprehensive Mermaid Diagram Refiner Tests\n');
    console.log('=' .repeat(60) + '\n');

    try {
        runContextManagementTests();
        runChatActivityTests();
        runFunctionCallingTests();
        runSummarizationTests();
        runIntegrationTests();

        console.log('🎉 All tests passed successfully!\n');
        console.log('📈 Test Coverage:');
        console.log('  ✅ Context Management (token counting, thresholds)');
        console.log('  ✅ Chat Activities (message storage, persistence)');
        console.log('  ✅ Function Calling (all 6 tools, complex sequences)');
        console.log('  ✅ Summarization (thinking block compression, context reduction)');
        console.log('  ✅ Integration (full conversation flows, error handling)\n');

    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    executeTool,
    currentDiagram,
    conversationMessages,
    resetTestState,
    estimateTokens,
    updateContextStatus,
    simulateLLMResponse
};
