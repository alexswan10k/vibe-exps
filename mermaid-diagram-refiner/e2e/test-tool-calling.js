// End-to-End Test: Tool Calling Functionality
// Tests that tools are called correctly and modify diagrams as expected

// Tool functions (pure data manipulation)
let currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;

function executeTool(name, args) {
    switch (name) {
        case 'add_node':
            currentDiagram += `\n${args.id}[${args.label}]`;
            break;
        case 'add_edge':
            const edgeLabel = args.label ? `|${args.label}|` : '';
            currentDiagram += `\n${args.from} -->${edgeLabel} ${args.to}`;
            break;
        case 'remove_node':
            const nodeRegex = new RegExp(`\\n${args.id}\\[.*?\\]`, 'g');
            currentDiagram = currentDiagram.replace(nodeRegex, '');
            break;
        case 'modify_node_label':
            const labelRegex = new RegExp(`(${args.id})\\[(.*?)\\]`, 'g');
            currentDiagram = currentDiagram.replace(labelRegex, `$1[${args.new_label}]`);
            break;
    }
    return true;
}

// Mock LLM responses for tool calling
function mockLLMResponse(messages) {
    const lastMessage = messages[messages.length - 1];

    // Simulate tool calling based on user input
    if (lastMessage.content.includes('add a new node') || lastMessage.content.includes('add a node')) {
        return {
            choices: [{
                message: {
                    content: 'I\'ll add a node to your diagram.',
                    tool_calls: [{
                        id: 'call_1',
                        function: {
                            name: 'add_node',
                            arguments: '{"id": "D", "label": "New Node"}'
                        }
                    }]
                }
            }]
        };
    } else if (lastMessage.content.includes('add an edge')) {
        return {
            choices: [{
                message: {
                    content: 'I\'ll add an edge to your diagram.',
                    tool_calls: [{
                        id: 'call_2',
                        function: {
                            name: 'add_edge',
                            arguments: '{"from": "C", "to": "D", "label": "connects to"}'
                        }
                    }]
                }
            }]
        };
    }

    return {
        choices: [{
            message: {
                content: 'I understand your request.'
            }
        }]
    };
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

function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected "${substring}" in "${text}"`);
    }
}

async function testToolCallingEndToEnd() {
    console.log('🔧 Testing Tool Calling End-to-End\n');

    // Reset diagram
    currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;

    const initialDiagram = currentDiagram;

    // Test 1: Add node tool call
    console.log('Test 1: Add node tool execution');
    const messages1 = [
        { role: 'system', content: `Current diagram: ${currentDiagram}` },
        { role: 'user', content: 'Please add a new node called "Review" with ID "D"' }
    ];

    const response1 = mockLLMResponse(messages1);
    assert(response1.choices[0].message.tool_calls, 'Should have tool calls');
    assertEqual(response1.choices[0].message.tool_calls[0].function.name, 'add_node', 'Should call add_node');

    // Execute the tool
    const toolCall1 = response1.choices[0].message.tool_calls[0];
    const args1 = JSON.parse(toolCall1.function.arguments);
    executeTool(toolCall1.function.name, args1);

    assertContains(currentDiagram, 'D[New Node]', 'Diagram should contain the new node');
    assert(currentDiagram !== initialDiagram, 'Diagram should be modified');

    console.log('✅ Add node tool test passed\n');

    // Test 2: Add edge tool call
    console.log('Test 2: Add edge tool execution');
    const messages2 = [
        { role: 'system', content: `Current diagram: ${currentDiagram}` },
        { role: 'user', content: 'Please add an edge from C to D with label "connects to"' }
    ];

    const response2 = mockLLMResponse(messages2);
    assert(response2.choices[0].message.tool_calls, 'Should have tool calls');
    assertEqual(response2.choices[0].message.tool_calls[0].function.name, 'add_edge', 'Should call add_edge');

    // Execute the tool
    const toolCall2 = response2.choices[0].message.tool_calls[0];
    const args2 = JSON.parse(toolCall2.function.arguments);
    executeTool(toolCall2.function.name, args2);

    assertContains(currentDiagram, 'C -->|connects to| D', 'Diagram should contain the new edge with label');

    console.log('✅ Add edge tool test passed\n');

    // Test 3: Complex multi-tool scenario
    console.log('Test 3: Complex multi-tool scenario');
    currentDiagram = `graph TD
A[Start] --> B[Process]`;

    // Simulate multiple tool calls in sequence
    const toolsToExecute = [
        { name: 'add_node', args: { id: 'C', label: 'Review' } },
        { name: 'add_edge', args: { from: 'B', to: 'C', label: 'then' } },
        { name: 'add_node', args: { id: 'D', label: 'End' } },
        { name: 'add_edge', args: { from: 'C', to: 'D' } }
    ];

    toolsToExecute.forEach(tool => {
        executeTool(tool.name, tool.args);
    });

    const expectedDiagram = `graph TD
A[Start] --> B[Process]
C[Review]
B -->|then| C
D[End]
C --> D`;

    // Normalize whitespace for comparison
    const normalizedActual = currentDiagram.replace(/\s+/g, ' ').trim();
    const normalizedExpected = expectedDiagram.replace(/\s+/g, ' ').trim();

    assertEqual(normalizedActual, normalizedExpected, 'Complex multi-tool scenario should produce correct diagram');

    console.log('✅ Complex multi-tool test passed\n');

    console.log('🎉 Tool Calling End-to-End Test PASSED!\n');
}

// Run the test
if (require.main === module) {
    testToolCallingEndToEnd().catch(error => {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = { testToolCallingEndToEnd };
