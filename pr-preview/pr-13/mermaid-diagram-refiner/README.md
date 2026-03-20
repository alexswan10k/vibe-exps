# Mermaid Diagram Refiner

An agentic web application for refining Mermaid diagrams using AI.

## Features

- Interactive chat interface to communicate with an AI agent
- Real-time diagram rendering on the right panel
- AI agent uses tools to modify diagram sections based on user requests
- Integrates with LMStudio for local AI inference

## Requirements

- LMStudio installed and running on `localhost:1234`
- Model: `qwen/qwen3-4b-thinking-2507` loaded in LMStudio

## Setup

1. Install and start LMStudio
2. Load the `qwen/qwen3-4b-thinking-2507` model
3. Start the local server in LMStudio (default port 1234)
4. Open `index.html` in a web browser

## Usage

- Type messages in the left panel to describe changes to the diagram
- The AI will use tools to modify the diagram and update the display
- The current diagram code is always available in the system prompt
- Thinking process is shown in real-time during streaming responses
- **Skip Thinking**: During thinking, click "⏭️ Skip Thinking" to force completion of the thinking phase and get the final response
- **Stop**: Cancel the current request at any time
- **Summarize**: Compress old thinking blocks to save context space (shows summarized version in UI, sends summarized version to LLM context)

## Tools Available

- `add_node`: Add a new node
- `remove_node`: Remove a node
- `add_edge`: Add an edge between nodes
- `remove_edge`: Remove an edge
- `modify_node_label`: Change a node's label
- `modify_edge_label`: Change an edge's label

## Testing

### Unit Tests

Run comprehensive unit tests with no external dependencies:

```bash
node test-unit.js
```

### End-to-End Tests

Run individual end-to-end tests that verify complete functionality:

```bash
cd e2e && node run-e2e-tests.js <test-name>
```

Available E2E tests:
- `summarization` - Tests thinking block summarization functionality
- `tool-calling` - Tests tool execution and diagram modification
- `integration-real` - Tests real LLM integration (requires LMStudio running)

Example:
```bash
cd e2e && node run-e2e-tests.js summarization
```

**⚠️ Real integration tests require:**
- LMStudio running on `localhost:1234`
- Model `qwen/qwen3-4b-thinking-2507` loaded
- These tests verify semantic behavior rather than exact content

### Test Coverage

**Unit & Mock Integration Tests:**
- ✅ Context Management (token counting, thresholds)
- ✅ Chat Activities (storage, persistence, parsing)
- ✅ Function Calling (all 6 tools, complex sequences)
- ✅ Summarization (thinking section removal, context reduction)
- ✅ Integration Scenarios (full flows, error handling)

**Real LLM Integration Tests:**
- ✅ LLM Connectivity & Response Format
- ✅ Tool Calling Logic & Conditions
- ✅ Thinking Behavior & Control
- ✅ Skip Thinking Simulation
- ✅ Context Management & Accumulation

Tests use mocked localStorage and simulate LLM responses to ensure comprehensive coverage without requiring LMStudio to be running.

## Initial Diagram

Starts with a simple flowchart: Start -> Process -> End
