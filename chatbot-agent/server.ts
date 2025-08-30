import express from 'express';
import multer from 'multer';
import axios from 'axios';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Type definitions
interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

interface CustomToolConfig {
  endpoint: string;
  method: string;
  parameters: Record<string, any>;
}

interface ChatRequest {
  message: string;
  base64Image?: string;
}

interface ChatResponse {
  response: string;
}

interface UploadResponse {
  base64Image: string;
}

interface ToolsResponse {
  tools: {
    name: string;
    description: string;
    parameters: any;
  }[];
}

interface CustomToolsResponse {
  custom_tools: {
    name: string;
    endpoint: string;
    method: string;
    parameters: any;
  }[];
}

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Multer for image uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// LMStudio API endpoint (assuming local server)
const LMSTUDIO_URL = 'http://localhost:1234/v1/chat/completions'; // Adjust if different

// Context storage (in-memory for simplicity)
let conversationHistory: Message[] = [];

// Tool definitions
const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'make_rest_call',
      description: 'Make a generic REST API call',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          url: { type: 'string' },
          headers: { type: 'object' },
          body: { type: 'object' }
        },
        required: ['method', 'url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web for information using a search engine API',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          engine: { type: 'string', enum: ['google', 'bing', 'duckduckgo'], default: 'duckduckgo' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather information for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or coordinates' }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'register_tool',
      description: 'Register a new custom tool with REST endpoint capabilities',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tool name' },
          description: { type: 'string', description: 'Tool description' },
          endpoint: { type: 'string', description: 'REST endpoint URL' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
          parameters: { type: 'object', description: 'Tool parameters schema' }
        },
        required: ['name', 'description', 'endpoint']
      }
    }
  }
];

// Storage for registered custom tools
const customTools: Map<string, CustomToolConfig> = new Map();

// Function to call LMStudio
async function callLMStudio(messages: any[], tools?: any[]): Promise<any> {
  try {
    const payload: any = {
      model: 'google/gemma-3-4b', // Specify the model
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };
    if (tools) payload.tools = tools;

    const response = await axios.post(LMSTUDIO_URL, payload);
    return response.data.choices[0].message;
  } catch (error) {
    console.error('Error calling LMStudio:', error);
    return { content: 'Error communicating with LMStudio.' };
  }
}

// Function to execute tool
async function executeTool(toolCall: any): Promise<any> {
  const { name, arguments: args } = toolCall;

  if (name === 'make_rest_call') {
    try {
      const { method, url, headers = {}, body } = args;
      const config: any = { method, url, headers };
      if (body) config.data = body;
      const response = await axios(config);
      return response.data;
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  if (name === 'search_web') {
    try {
      const { query, engine = 'duckduckgo' } = args;
      // Using DuckDuckGo instant answer API as a simple search
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await axios.get(searchUrl);
      return {
        query,
        engine,
        results: response.data.AbstractText ? [response.data.AbstractText] : [],
        related_topics: response.data.RelatedTopics?.slice(0, 3) || []
      };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  if (name === 'get_weather') {
    try {
      const { location } = args;
      // Using OpenWeatherMap API (you'll need to add your API key)
      const apiKey = process.env.OPENWEATHER_API_KEY || 'demo';
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
      const response = await axios.get(weatherUrl);
      return {
        location: response.data.name,
        temperature: response.data.main.temp,
        description: response.data.weather[0].description,
        humidity: response.data.main.humidity,
        wind_speed: response.data.wind.speed
      };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  if (name === 'register_tool') {
    try {
      const { name: toolName, description, endpoint, method = 'GET', parameters = {} } = args;

      const newTool: Tool = {
        type: 'function',
        function: {
          name: toolName,
          description,
          parameters: {
            type: 'object',
            properties: parameters,
            required: Object.keys(parameters).filter(key => parameters[key].required)
          }
        }
      };

      // Store the custom tool configuration
      customTools.set(toolName, { endpoint, method, parameters });

      // Add to tools array if not already present
      if (!tools.find(t => t.function.name === toolName)) {
        tools.push(newTool);
      }

      return { success: true, tool: toolName, message: 'Tool registered successfully' };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  // Check if it's a custom registered tool
  if (customTools.has(name)) {
    try {
      const toolConfig = customTools.get(name);
      if (!toolConfig) return { error: 'Tool not found' };
      const { method, endpoint } = toolConfig;
      const config: any = { method, url: endpoint };

      if (method === 'GET' && args) {
        // Add query parameters for GET requests
        const params = new URLSearchParams();
        Object.entries(args).forEach(([key, value]) => {
          params.append(key, String(value));
        });
        config.url += `?${params.toString()}`;
      } else if (['POST', 'PUT', 'PATCH'].includes(method) && args) {
        config.data = args;
        config.headers = { 'Content-Type': 'application/json' };
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  return { error: 'Unknown tool' };
}

// Chat endpoint
app.post('/chat', async (req: express.Request, res: express.Response) => {
  const { message, base64Image } = req.body;

  // Add user message to history
  if (base64Image) {
    conversationHistory.push({
      role: 'user',
      content: [
        { type: 'text', text: message },
        { type: 'image_url', image_url: { url: base64Image } }
      ]
    });
  } else {
    conversationHistory.push({ role: 'user', content: message });
  }

  // Call LMStudio
  const response = await callLMStudio(conversationHistory, tools);

  // Check for tool calls
  if (response.tool_calls) {
    for (const toolCall of response.tool_calls) {
      const toolResult = await executeTool(toolCall);
      conversationHistory.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });
      conversationHistory.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: toolCall.id });
    }
    // Get final response after tool execution
    const finalResponse = await callLMStudio(conversationHistory);
    conversationHistory.push({ role: 'assistant', content: finalResponse.content });
    res.json({ response: finalResponse.content });
  } else {
    conversationHistory.push({ role: 'assistant', content: response.content });
    res.json({ response: response.content });
  }
});

// Image upload endpoint
app.post('/upload', upload.single('image'), (req: express.Request, res: express.Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Read the file and convert to base64
  const imagePath = req.file.path;
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = req.file.mimetype;

  // Clean up the uploaded file
  fs.unlinkSync(imagePath);

  res.json({ base64Image: `data:${mimeType};base64,${base64Image}` });
});

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Endpoint to list available tools
app.get('/tools', (req: express.Request, res: express.Response) => {
  const toolList = tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters
  }));
  res.json({ tools: toolList });
});

// Endpoint to get registered custom tools
app.get('/custom-tools', (req: express.Request, res: express.Response) => {
  const customToolList = Array.from(customTools.entries()).map(([name, config]) => ({
    name,
    endpoint: config.endpoint,
    method: config.method,
    parameters: config.parameters
  }));
  res.json({ custom_tools: customToolList });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
