import axios from 'axios';
import { z } from 'zod';

// UTCP Type definitions
export const UTCPEndpointSchema = z.object({
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

export const UTCPToolSchema = z.object({
  toolId: z.string(),
  name: z.string(),
  description: z.string(),
  provider: UTCPEndpointSchema,
});

export type UTCPEndpoint = z.infer<typeof UTCPEndpointSchema>;
export type UTCPTool = z.infer<typeof UTCPToolSchema>;

// Tool definitions
export const utcpTools: UTCPTool[] = [
  {
    toolId: 'search_web',
    name: 'search_web',
    description: 'Search the web for information using DuckDuckGo API',
    provider: {
      type: 'http',
      endpoint: 'https://api.duckduckgo.com/',
      method: 'GET',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'The search query' },
        { name: 'format', type: 'string', required: false, description: 'Response format (json or xml)' }
      ]
    }
  },
  {
    toolId: 'todo_list',
    name: 'todo_list',
    description: 'Manage a todo list with add, remove, list, and complete operations',
    provider: {
      type: 'http',
      endpoint: 'http://localhost:3000/todo', // Internal endpoint
      method: 'POST',
      parameters: [
        { name: 'action', type: 'string', required: true, description: 'Action: add, remove, list, complete' },
        { name: 'task', type: 'string', required: false, description: 'Task description (for add/remove/complete)' },
        { name: 'index', type: 'number', required: false, description: 'Task index (for remove/complete)' }
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
        { name: 'location', type: 'string', required: true, description: 'City name' },
        { name: 'appid', type: 'string', required: true, description: 'OpenWeatherMap API key' }
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

// In-memory todo list storage
let todoList: { task: string; completed: boolean }[] = [];

// Function to execute tool
export async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'search_web':
      return await executeSearchWeb(args);
    case 'todo_list':
      return await executeTodoList(args);
    case 'get_weather':
      return await executeGetWeather(args);
    case 'register_tool':
      return await executeRegisterTool(args);
    default:
      return { error: 'Unknown tool' };
  }
}

// Implement search_web tool
async function executeSearchWeb(args: any): Promise<any> {
  try {
    const { query, format = 'json' } = args;
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: format,
        no_html: 1,
        skip_disambig: 1
      }
    });

    if (format === 'json') {
      return {
        query,
        results: response.data.RelatedTopics?.slice(0, 5) || [],
        abstract: response.data.Abstract || 'No abstract available'
      };
    }

    return response.data;
  } catch (error) {
    return { error: `Search failed: ${(error as Error).message}` };
  }
}

// Implement todo_list tool
async function executeTodoList(args: any): Promise<any> {
  const { action, task, index } = args;

  switch (action) {
    case 'add':
      if (!task) return { error: 'Task description required' };
      todoList.push({ task, completed: false });
      return { success: true, message: `Added task: ${task}`, total: todoList.length };

    case 'remove':
      if (typeof index !== 'number' || index < 0 || index >= todoList.length) {
        return { error: 'Invalid task index' };
      }
      const removed = todoList.splice(index, 1)[0];
      return { success: true, message: `Removed task: ${removed.task}`, total: todoList.length };

    case 'complete':
      if (typeof index !== 'number' || index < 0 || index >= todoList.length) {
        return { error: 'Invalid task index' };
      }
      todoList[index].completed = true;
      return { success: true, message: `Completed task: ${todoList[index].task}` };

    case 'list':
      return {
        tasks: todoList.map((item, idx) => ({
          index: idx,
          task: item.task,
          completed: item.completed
        })),
        total: todoList.length
      };

    default:
      return { error: 'Invalid action. Use: add, remove, complete, or list' };
  }
}

// Implement get_weather tool
async function executeGetWeather(args: any): Promise<any> {
  try {
    const { location, appid } = args;
    if (!appid) {
      return { error: 'OpenWeatherMap API key required' };
    }

    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: location,
        appid: appid,
        units: 'metric'
      }
    });

    return {
      location: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      wind_speed: response.data.wind.speed
    };
  } catch (error) {
    return { error: `Weather fetch failed: ${(error as Error).message}` };
  }
}

// Implement register_tool
async function executeRegisterTool(args: any): Promise<any> {
  // This will be handled in server.ts as it needs access to the tools array
  return { error: 'Register tool should be handled by server' };
}
