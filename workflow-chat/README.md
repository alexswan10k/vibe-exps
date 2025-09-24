# Workflow Chat Prototype

An interactive chat interface that guides users through completing structured workflows using LLM-powered conversations. The system engages users in natural dialogue to gather required information, then calls a "complete" tool to return structured results to the originating application.

## 🎯 Overview

The Workflow Chat prototype enables applications to delegate complex, interactive tasks to an LLM-powered chat interface. Instead of rigid forms, users engage in natural conversations where the AI asks clarifying questions and guides them through the process.

### Key Features

- **Interactive Conversations**: Natural language dialogue instead of rigid forms
- **Tool Calling**: Structured completion using LLM tool calling capabilities
- **Schema Validation**: Ensures returned data matches expected format
- **Base64 Encoding**: Safe URL parameter passing
- **Streaming Responses**: Real-time message updates with thinking indicators
- **React Components**: Built with React using the same patterns as the meal planner
- **Error Handling**: Comprehensive validation and user-friendly error messages

## 🏗️ Architecture

### Core Components

```
workflow-chat/
├── index.html              # Main application entry point
├── test.html               # Test page for isolated testing
├── styles.css              # Application styling
├── domain.d.ts             # TypeScript type definitions
├── workflow-domain.js      # Workflow logic and validation
├── llm-service.js          # LLM integration service
└── components/
    ├── WorkflowChat.js     # Main chat component
    ├── MessageList.js      # Message display component
    └── MessageInput.js     # User input component
```

### Data Flow

1. **URL Parameters**: Application launches chat with base64-encoded `prompt`, `schema`, and `returnUrl`
2. **Parameter Parsing**: Chat decodes and validates parameters
3. **LLM Initialization**: System prompt guides AI behavior based on workflow requirements
4. **Interactive Chat**: User engages in natural conversation with AI
5. **Tool Calling**: When complete, AI calls "complete" tool with validated payload
6. **Redirect**: Chat redirects back to originating application with results

## 🚀 Usage

### Basic Integration

```javascript
// Encode workflow parameters
const params = new URLSearchParams({
    prompt: btoa("Create a recipe with available ingredients"),
    schema: btoa(JSON.stringify({
        type: "object",
        properties: {
            name: { type: "string" },
            ingredients: { type: "array" }
        },
        required: ["name", "ingredients"]
    })),
    returnUrl: "/meal-planner"
});

// Launch workflow chat
window.location.href = `workflow-chat/index.html?${params}`;
```

### Handling Results

```javascript
// Check for workflow results on page load
const urlParams = new URLSearchParams(window.location.search);
const payload = urlParams.get('payload');

if (payload) {
    const result = JSON.parse(atob(payload));
    // Process the workflow result
    handleWorkflowResult(result);
}
```

## 📋 URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | Base64 string | Yes | Workflow description and instructions for the LLM |
| `schema` | Base64 JSON | Yes | JSON schema defining expected output structure |
| `returnUrl` | String | Yes | URL to redirect to after workflow completion |

### Parameter Encoding

All parameters must be base64 encoded to avoid URL escaping issues:

```javascript
// Correct encoding
const prompt = btoa("Create a recipe");
const schema = btoa(JSON.stringify({ name: "string" }));

// Incorrect - will cause URL parsing issues
const prompt = "Create a recipe";  // Contains spaces
const schema = '{"name":"string"}'; // Contains special characters
```

## 🔧 Configuration

### LLM Setup

The system supports LMStudio and OpenRouter providers:

```javascript
// Default configuration
const llmConfig = {
    provider: 'lmStudio',           // 'lmStudio' or 'openRouter'
    lmStudioEndpoint: 'http://localhost:1234',
    lmStudioModel: 'qwen/qwen3-4b-thinking-2507',
    openRouterApiKey: '',
    openRouterModel: ''
};
```

### System Requirements

- **LMStudio**: Running on localhost:1234 with compatible model loaded
- **OpenRouter**: Valid API key and model access
- **Browser**: Modern browser with ES6+ support
- **React**: Version 17+ (included via CDN)

## 🧪 Testing

### Test Page

Open `test.html` in your browser to test different workflow scenarios:

- **Recipe Creation**: Interactive recipe building
- **Shopping List**: Generate shopping lists from meal plans
- **Inventory Update**: Update inventory quantities
- **Custom Workflow**: Test custom prompts and schemas

### Manual Testing

```bash
# Start local web server
cd workflow-chat
python3 -m http.server 8000

# Open test page
# http://localhost:8000/test.html
```

## 📝 API Reference

### WorkflowDomain

```javascript
// Parse URL parameters
const params = WorkflowDomain.parseWorkflowParameters(urlSearchParams);

// Validate parameters
const validation = WorkflowDomain.validateWorkflowParameters(params);

// Validate payload against schema
const isValid = WorkflowDomain.validatePayload(payload, schema);

// Complete workflow and redirect
WorkflowDomain.completeWorkflow(payload, returnUrl);
```

### LLMService

```javascript
// Send message to LLM
const result = await LLMService.sendMessage(messages, config, tools);

// Process streaming response
await LLMService.processStreamingResponse(response, onChunk, onComplete, onError);
```

## 🎨 Component API

### WorkflowChat Props

```typescript
interface WorkflowChatProps {
    workflowParams: {
        prompt: string;
        schema: any;
        returnUrl: string;
    };
    llmConfig: LLMConfig;
    onComplete?: (payload: any) => void;
}
```

### MessageList Props

```typescript
interface MessageListProps {
    messages: ChatMessage[];
}
```

### MessageInput Props

```typescript
interface MessageInputProps {
    onSendMessage: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}
```

## 🔄 Workflow Examples

### Recipe Creation Workflow

**Prompt:**
```
Create a new recipe. Ask the user for the recipe name, ingredients with quantities and units, and cooking instructions. Make sure ingredients are in lowercase and use standard grocery store names.
```

**Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "ingredients": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "quantity": { "type": "number" },
          "unit": { "type": "string" }
        },
        "required": ["name", "quantity", "unit"]
      }
    },
    "method": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["name", "ingredients"]
}
```

### Shopping List Workflow

**Prompt:**
```
Generate a shopping list. Ask the user what meals they plan to cook and what ingredients they already have. Create a list of items they need to buy with quantities.
```

**Schema:**
```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "quantity": { "type": "number" },
          "unit": { "type": "string" }
        },
        "required": ["name", "quantity", "unit"]
      }
    },
    "notes": { "type": "string" }
  },
  "required": ["items"]
}
```

## 🛠️ Development

### Project Structure

The prototype follows the same architectural patterns as the meal planner:

- **React Components**: Functional components using `React.createElement`
- **Domain Logic**: Pure functions for business logic
- **Service Layer**: External API integrations
- **TypeScript Definitions**: Comprehensive type safety

### Adding New Workflows

1. Define the workflow prompt and schema
2. Encode parameters as base64
3. Launch the workflow chat
4. Handle the returned payload in your application

### Extending Components

Components follow React best practices and can be easily extended:

```javascript
function CustomMessageList({ messages, customProp }) {
    // Custom message rendering logic
    return React.createElement('div', { className: 'custom-message-list' },
        // Custom implementation
    );
}
```

## 🚨 Error Handling

The system provides comprehensive error handling:

- **Parameter Validation**: Invalid URL parameters show helpful error messages
- **LLM Errors**: Connection issues and API errors are displayed to users
- **Schema Validation**: Payload validation with detailed error messages
- **Network Issues**: CORS and connectivity problems are handled gracefully

## 🔒 Security Considerations

- **Base64 Encoding**: Prevents URL injection attacks
- **Schema Validation**: Ensures returned data matches expected structure
- **Input Sanitization**: User inputs are validated before processing
- **CORS Handling**: Proper error messages for cross-origin issues

## 📈 Performance

- **Streaming Responses**: Real-time UI updates reduce perceived latency
- **Lazy Loading**: Components load only when needed
- **Efficient Rendering**: React's virtual DOM minimizes DOM updates
- **Memory Management**: Proper cleanup of event listeners and streams

## 🤝 Contributing

1. Follow the existing code patterns and architecture
2. Add comprehensive error handling
3. Include TypeScript definitions for new APIs
4. Test with the provided test page
5. Update documentation for any new features

## 📄 License

This prototype is part of the larger application suite and follows the same licensing terms.

---

## 🎯 Real-World Integration Example

```javascript
// In meal-planner/index.html - Add Recipe button
function launchRecipeWorkflow() {
    const prompt = "Create a new recipe for the meal planner. Ask for recipe name, ingredients with quantities/units, and step-by-step cooking instructions.";
    const schema = {
        type: "object",
        properties: {
            name: { type: "string" },
            ingredients: { type: "array", items: { /* ingredient schema */ } },
            method: { type: "array", items: { type: "string" } }
        },
        required: ["name", "ingredients"]
    };

    const params = new URLSearchParams({
        prompt: btoa(prompt),
        schema: btoa(JSON.stringify(schema)),
        returnUrl: window.location.href
    });

    window.location.href = `workflow-chat/index.html?${params}`;
}

// Handle workflow result
function handleWorkflowResult(recipe) {
    // Add recipe to meal planner
    addRecipe(recipe);
    alert(`Recipe "${recipe.name}" added successfully!`);
}
```

This integration allows the meal planner to delegate complex recipe creation to an interactive AI assistant, providing a much better user experience than traditional forms.
