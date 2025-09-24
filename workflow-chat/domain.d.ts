// LLM Provider Types
export type LLMProvider = 'lmStudio' | 'openRouter';

export interface LLMConfig {
  provider: LLMProvider;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
}

// Workflow Types
export interface WorkflowParameters {
  prompt: string;
  schema: any;
  returnUrl: string;
}

export interface WorkflowPayload {
  [key: string]: any;
}

// Chat Message Types
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  type?: 'normal' | 'thinking' | 'thinking-summary';
  timestamp?: number;
}

export interface LLMMessage {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
}

// Tool Calling Types
export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompleteToolArgs {
  payload: WorkflowPayload;
}

// Component Props Interfaces
export interface WorkflowChatProps {
  workflowParams: WorkflowParameters;
  llmConfig: LLMConfig;
  onComplete: (payload: WorkflowPayload) => void;
}

export interface MessageListProps {
  messages: ChatMessage[];
}

export interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Component Declarations
export declare function WorkflowChat(props: WorkflowChatProps): any;
export declare function MessageList(props: MessageListProps): any;
export declare function MessageInput(props: MessageInputProps): any;

// Utility Types
export type WorkflowStatus = 'initializing' | 'active' | 'completed' | 'error';

export interface WorkflowState {
  status: WorkflowStatus;
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
}

// URL Parameter Types
export interface URLParameters {
  prompt?: string;
  schema?: string;
  returnUrl?: string;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Tool Definition Types
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}
