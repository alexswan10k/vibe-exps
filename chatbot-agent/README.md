# Chatbot Agent with Enhanced Tool System

A web-based chatbot agent with an extensible tool system that allows registering and using REST endpoints.

## Features

### Built-in Tools
- **make_rest_call**: Make generic REST API calls
- **search_web**: Search the web using DuckDuckGo API
- **get_weather**: Get weather information (requires OpenWeatherMap API key)
- **register_tool**: Register new custom tools with REST endpoints

### Custom Tool Registration
You can dynamically register new tools by asking the chatbot to use the `register_tool` function. For example:
- "Register a tool called 'github_user' that gets user info from GitHub API"
- "Create a tool for fetching random jokes from a joke API"

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

4. Open your browser to `http://localhost:3001`

## API Endpoints

- `GET /tools` - List all available tools
- `GET /custom-tools` - List registered custom tools
- `POST /chat` - Send chat messages (supports tool calling)
- `POST /upload` - Upload images for vision-enabled chat

## Tool System Architecture

The tool system is built on top of LMStudio's function calling capabilities and supports:

1. **Tool Definitions**: JSON schemas defining tool parameters and capabilities
2. **Tool Execution**: Server-side execution of tool calls with proper error handling
3. **Dynamic Registration**: Runtime registration of new tools via the `register_tool` function
4. **REST Integration**: Seamless integration with external REST APIs

## Example Usage

### Search the Web
```
User: Search for information about TypeScript
Assistant: (uses search_web tool) Found information about TypeScript...
```

### Register a Custom Tool
```
User: Register a tool called 'cat_facts' that gets random cat facts from https://catfact.ninja/fact
Assistant: (uses register_tool) Tool registered successfully!
```

### Use Registered Tool
```
User: Tell me a cat fact
Assistant: (uses cat_facts tool) Here's a cat fact: Cats have over 20 muscles that control their ears.
```

## Environment Variables

- `OPENWEATHER_API_KEY`: API key for weather functionality (optional)

## Development

The project uses:
- Express.js for the backend
- TypeScript for type safety
- LMStudio for LLM integration
- Axios for HTTP requests
- Multer for file uploads

## File Structure

```
chatbot-agent/
├── server.ts           # Main server file
├── public/
│   ├── index.html      # Frontend UI
│   ├── script.ts       # Frontend logic
│   └── styles.css      # Styling
├── dist/               # Compiled output
└── package.json        # Dependencies
