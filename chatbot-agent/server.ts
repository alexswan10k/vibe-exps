import express from 'express';
import multer from 'multer';
import axios from 'axios';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// UTCP Type definitions
const UTCPEndpointSchema = z.object({
  type: z.literal('http'),
  endpoint: z.string().url(),
  method: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
  })).optional(),
});

const UTCPToolSchema = z.object({
  toolId: z.string(),
  name: z.string(),
  description: z.string(),
  provider: UTCPEndpointSchema,
});

type UTCPEndpoint = z.infer<typeof UTCPEndpointSchema>;
type UTCPTool = z.infer<typeof UTCPToolSchema>;

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

// Storage for registered custom UTCP tools
const customUTCPTools: Map<string, UTCPTool> = new Map();

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

// UTCP Tool definitions
const utcpTools: UTCPTool[] = [
  {
    toolId: 'make_rest_call',
    name: 'make_rest_call',
    description: 'Make a generic REST API call',
    provider: {
      type: 'http',
      endpoint: 'https://httpbin.org/anything', // Placeholder, will be overridden
      method: 'POST',
      parameters: [
        { name: 'method', type: 'string', required: true, description: 'HTTP method' },
        { name: 'url', type: 'string', required: true, description: 'URL' },
        { name: 'headers', type: 'object', required: false, description: 'Headers' },
        { name: 'body', type: 'object', required: false, description: 'Body' }
      ]
    }
  },
  {
    toolId: 'search_web',
    name: 'search_web',
    description: 'Search the web for information using a search engine API',
    provider: {
      type: 'http',
      endpoint: 'https://api.duckduckgo.com/',
      method: 'GET',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'The search query' },
        { name: 'engine', type: 'string', required: false, description: 'Search engine' }
      ]
    }
  },
  {
    toolId: 'get_weather',
    name: 'get_weather',
    description: 'Get current weather information for a location',
    provider: {
      type: 'http',
      endpoint: 'https://api.openweathermap.org/data/2.5/weather',
      method: 'GET',
      parameters: [
        { name: 'location', type: 'string', required: true, description: 'City name' }
      ]
    }
  },
  {
    toolId: 'register_tool',
    name: 'register_tool',
    description: 'Register a new custom tool with REST endpoint capabilities',
    provider: {
      type: 'http',
      endpoint: 'http://localhost:3000/register', // Internal endpoint
      method: 'POST',
      parameters: [
        { name: 'name', type: 'string', required: true, description: 'Tool name' },
        { name: 'description', type: 'string', required: true, description: 'Description' },
        { name: 'endpoint', type: 'string', required: true, description: 'REST endpoint' },
        { name: 'method', type: 'string', required: false, description: 'HTTP method' },
        { name: 'parameters', type: 'object', required: false, description: 'Parameters' }
      ]
    }
  }
];

// Function to convert UTCP tool to LMStudio tool format
function convertUTCPToLMStudio(utcpTool: UTCPTool): Tool {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (utcpTool.provider.parameters) {
    utcpTool.provider.parameters.forEach(param => {
      properties[param.name] = {
        type: param.type,
        description: param.description
      };
      if (param.required) required.push(param.name);
    });
  }

  return {
    type: 'function',
    function: {
      name: utcpTool.name,
      description: utcpTool.description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  };
}

// Tool definitions (converted from UTCP)
const tools: Tool[] = utcpTools.map(convertUTCPToLMStudio);

// Storage for registered custom tools
const customTools: Map<string, CustomToolConfig> = new Map();

// Function to call LMStudio with streaming
async function callLMStudio(messages: any[], tools?: any[], stream: boolean = false): Promise<any> {
  try {
    const payload: any = {
      model: 'google/gemma-3-4b', // Specify the model
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: stream
    };
    if (tools) payload.tools = tools;

    console.log('Calling LMStudio with payload:', JSON.stringify(payload, null, 2));
    console.log('Stream mode:', stream);

    const response = await axios.post(LMSTUDIO_URL, payload, {
      responseType: stream ? 'stream' : 'json',
      timeout: 60000 // 60 second timeout for streaming
    });

    console.log('LMStudio response status:', response.status);

    if (stream) {
      console.log('Stream response received, returning stream object');
      return response.data; // Return the stream
    } else {
      console.log('Non-stream response:', response.data);
      return response.data.choices[0].message;
    }
  } catch (error: any) {
    console.error('Error calling LMStudio:', error.message);
    console.error('Error details:', error.response?.data || error.code);
    return stream ? null : { content: 'Error communicating with LMStudio.' };
  }
}

// Function to execute UTCP tool
async function executeUTCPCall(utcpTool: UTCPTool, args: any): Promise<any> {
  try {
    let { endpoint, method, headers = {} } = utcpTool.provider;

    // Special handling for make_rest_call: use dynamic URL
    if (utcpTool.name === 'make_rest_call') {
      method = args.method || 'GET';
      endpoint = args.url;
      headers = args.headers || {};
    }

    const config: any = { method, url: endpoint, headers };

    if (method === 'GET' && args) {
      // Add query parameters for GET requests
      const params = new URLSearchParams();
      Object.entries(args).forEach(([key, value]) => {
        if (key !== 'method' && key !== 'url' && key !== 'headers' && key !== 'body') {
          params.append(key, String(value));
        }
      });
      if (params.toString()) config.url += `?${params.toString()}`;
    } else if (['POST', 'PUT', 'PATCH'].includes(method) && args) {
      config.data = args.body || args;
      config.headers = { ...config.headers, 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// Function to execute tool
async function executeTool(toolCall: any): Promise<any> {
  const { name, arguments: args } = toolCall;

  // Find the UTCP tool
  let utcpTool = utcpTools.find(t => t.name === name) || customUTCPTools.get(name);

  if (utcpTool) {
    return await executeUTCPCall(utcpTool, JSON.parse(args));
  }

  // Special handling for register_tool
  if (name === 'register_tool') {
    try {
      const { name: toolName, description, endpoint, method = 'GET', parameters = {} } = JSON.parse(args);

      // Create UTCP tool
      const newUTCPTool: UTCPTool = {
        toolId: toolName,
        name: toolName,
        description,
        provider: {
          type: 'http',
          endpoint,
          method,
          parameters: Object.entries(parameters).map(([key, value]: [string, any]) => ({
            name: key,
            type: value.type || 'string',
            required: value.required || false,
            description: value.description || ''
          }))
        }
      };

      // Store the custom UTCP tool
      customUTCPTools.set(toolName, newUTCPTool);

      // Convert to LMStudio format and add to tools
      const newTool = convertUTCPToLMStudio(newUTCPTool);
      if (!tools.find(t => t.function.name === toolName)) {
        tools.push(newTool);
      }

      return { success: true, tool: toolName, message: 'Tool registered successfully' };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  return { error: 'Unknown tool' };
}

// Chat endpoint (non-streaming)
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



// Streaming chat endpoint
app.get('/chat/stream', async (req: express.Request, res: express.Response) => {
  const message = req.query.message as string;
  const base64Image = req.query.base64Image as string;

  console.log('Streaming endpoint called with message:', message);

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.flushHeaders(); // Flush headers immediately

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

  try {
    console.log('Calling LMStudio with streaming...');
    // Call LMStudio with streaming
    const stream = await callLMStudio(conversationHistory, tools, true);

    if (!stream) {
      console.error('No stream returned from LMStudio');
      res.write(`data: ${JSON.stringify({ error: 'Failed to get streaming response' })}\n\n`);
      res.end();
      return;
    }

    console.log('Stream obtained, setting up event handlers...');

    let fullContent = '';
    let hasToolCalls = false;
    let toolCalls: any[] = [];
    let buffer = '';

    // Process the stream
    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);

          if (data === '[DONE]') {
            // Stream finished
            if (hasToolCalls) {
              // Handle tool calls
              handleToolCallsStream(toolCalls, res, fullContent);
            } else {
              // Add to conversation history
              conversationHistory.push({ role: 'assistant', content: fullContent });
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              res.end();
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            console.log('Parsed streaming data:', parsed);
            const delta = parsed.choices?.[0]?.delta;

            if (delta) {
              if (delta.content) {
                console.log('Sending token:', delta.content);
                fullContent += delta.content;
                res.write(`data: ${JSON.stringify({ token: delta.content })}\n\n`);
              }

              if (delta.tool_calls) {
                hasToolCalls = true;
                // Accumulate tool calls
                delta.tool_calls.forEach((toolCall: any, index: number) => {
                  if (!toolCalls[index]) {
                    toolCalls[index] = { ...toolCall, function: { ...toolCall.function, arguments: '' } };
                  }
                  if (toolCall.function?.arguments) {
                    toolCalls[index].function.arguments += toolCall.function.arguments;
                  }
                });
              }
            }
          } catch (e) {
            // Skip invalid JSON or empty lines
            if (data && !data.startsWith('{')) {
              console.log('Skipping non-JSON data:', data);
            }
          }
        }
      }
    });

    stream.on('error', (error: Error) => {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Error in streaming endpoint:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to process streaming request' })}\n\n`);
    res.end();
  }
});

// Helper function to handle tool calls in streaming
async function handleToolCallsStream(toolCalls: any[], res: express.Response, initialContent: string) {
  try {
    // Execute tool calls
    for (const toolCall of toolCalls) {
      const toolResult = await executeTool(toolCall.function);
      conversationHistory.push({
        role: 'assistant',
        content: initialContent,
        tool_calls: toolCalls
      });
      conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(toolResult),
        tool_call_id: toolCall.id
      });
    }

    // Get final response after tool execution
    const finalStream = await callLMStudio(conversationHistory, tools, true);

    if (!finalStream) {
      res.write(`data: ${JSON.stringify({ error: 'Failed to get final response' })}\n\n`);
      res.end();
      return;
    }

    let finalContent = '';

    finalStream.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            conversationHistory.push({ role: 'assistant', content: finalContent });
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta;

            if (delta && delta.content) {
              finalContent += delta.content;
              res.write(`data: ${JSON.stringify({ token: delta.content })}\n\n`);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    });

    finalStream.on('error', (error: Error) => {
      console.error('Final stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Final stream error occurred' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Error handling tool calls:', error);
    res.write(`data: ${JSON.stringify({ error: 'Error processing tool calls' })}\n\n`);
    res.end();
  }
}

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
  const customToolList = Array.from(customUTCPTools.entries()).map(([name, utcpTool]) => ({
    name: utcpTool.name,
    endpoint: utcpTool.provider.endpoint,
    method: utcpTool.provider.method,
    parameters: utcpTool.provider.parameters
  }));
  res.json({ custom_tools: customToolList });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
