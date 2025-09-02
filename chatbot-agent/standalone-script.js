// Standalone Chatbot Script using Transformers.js with multiple models
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js';

const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');
const chatWindow = document.getElementById('chat-window');
const spinner = document.getElementById('spinner');
const clearButton = document.getElementById('clear-button');
const modelSelect = document.getElementById('model-select');
const loadModelButton = document.getElementById('load-model-button');

let generator;
let currentModel = 'smollm';
let conversationHistory = [];

const models = {
  smollm: {
    name: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    chatTemplate: 'smollm'
  },
  lille: {
    name: 'Nikity/lille-130m-instruct',
    chatTemplate: 'lille'
  }
};

async function initModel(modelKey = 'smollm') {
  const model = models[modelKey];
  console.log(`Loading ${model.name} model...`);
  spinner.style.display = 'block';
  loadModelButton.disabled = true;
  try {
    generator = await pipeline('text-generation', model.name);
    currentModel = modelKey;
    console.log('Model loaded.');
    displayMessage(`Model ${model.name} loaded successfully.`, 'assistant');
  } catch (error) {
    console.error('Error loading model:', error);
    displayMessage('Error loading model: ' + error.message, 'assistant');
  }
  spinner.style.display = 'none';
  loadModelButton.disabled = false;
}

sendButton.addEventListener('click', sendMessage);
clearButton.addEventListener('click', clearChat);
loadModelButton.addEventListener('click', () => {
  const selectedModel = modelSelect.value;
  initModel(selectedModel);
});
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function formatChatTemplate(messages) {
  if (currentModel === 'lille') {
    return formatLilleTemplate(messages);
  } else {
    return formatSmolLMTemplate(messages);
  }
}

function formatSmolLMTemplate(messages) {
  let formatted = '';

  // If first message is not system, add default system message
  if (messages.length === 0 || messages[0].role !== 'system') {
    formatted = '<|im_start|>system\nYou are a helpful AI assistant named SmolLM, trained by Hugging Face<|im_end|>\n';
  }

  // Format each message
  messages.forEach(msg => {
    formatted += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  });

  // Add generation prompt
  formatted += '<|im_start|>assistant\n';

  return formatted;
}

function formatLilleTemplate(messages) {
  let formatted = '<|startoftext|>';

  // Add system message if not present
  if (messages.length === 0 || messages[0].role !== 'system') {
    formatted += '<|user|>You are a helpful AI assistant.<|assistant|>';
  }

  // Format each message
  messages.forEach(msg => {
    if (msg.role === 'user') {
      formatted += `<|user|>${msg.content}`;
    } else if (msg.role === 'assistant') {
      formatted += `<|assistant|>${msg.content}`;
    }
  });

  // Add generation prompt
  formatted += '<|assistant|>';

  return formatted;
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  console.log('=== NEW MESSAGE ===');
  console.log('User input:', message);

  displayMessage(message, 'user');
  conversationHistory.push({ role: 'user', content: message });

  console.log('Conversation history:', conversationHistory);

  spinner.style.display = 'block';
  sendButton.disabled = true;

  try {
    const prompt = formatChatTemplate(conversationHistory);
    console.log('=== FORMATTED PROMPT ===');
    console.log(prompt);
    console.log('=== END PROMPT ===');

    const generationOptions = currentModel === 'lille' ? {
      max_new_tokens: 150,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9
    } : {
      max_new_tokens: 150,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      pad_token_id: 2,
      eos_token_id: 2
    };

    const output = await generator(prompt, generationOptions);

    console.log('=== RAW MODEL OUTPUT ===');
    console.log('Full response:', output[0].generated_text);
    console.log('=== END RAW OUTPUT ===');

    // Create a plain text version of the conversation for subtraction
    let plainPrompt = '';
    if (currentModel === 'lille') {
      plainPrompt = '<|startoftext|>';
      if (conversationHistory.length === 0 || conversationHistory[0].role !== 'system') {
        plainPrompt += '<|user|>You are a helpful AI assistant.<|assistant|>';
      }
      conversationHistory.forEach(msg => {
        if (msg.role === 'user') {
          plainPrompt += `<|user|>${msg.content}`;
        } else if (msg.role === 'assistant') {
          plainPrompt += `<|assistant|>${msg.content}`;
        }
      });
      plainPrompt += '<|assistant|>';
    } else {
      if (conversationHistory.length === 0 || conversationHistory[0].role !== 'system') {
        plainPrompt = 'system\nYou are a helpful AI assistant named SmolLM, trained by Hugging Face\n';
      }
      conversationHistory.forEach(msg => {
        plainPrompt += `${msg.role}\n${msg.content}\n`;
      });
      plainPrompt += 'assistant\n';
    }

    console.log('=== SUBTRACTION DEBUG ===');
    console.log('Plain prompt for subtraction:', plainPrompt);
    console.log('Plain prompt length:', plainPrompt.length);

    // Subtract the plain text prompt from the response
    const fullResponse = output[0].generated_text;
    let assistantResponse = '';
    if (currentModel === 'lille') {
      // For lille, find the last <|assistant|> and take from there
      const lastAssistantIndex = fullResponse.lastIndexOf('<|assistant|>');
      if (lastAssistantIndex !== -1) {
        assistantResponse = fullResponse.substring(lastAssistantIndex + '<|assistant|>'.length).trim();
      } else {
        assistantResponse = fullResponse.substring(plainPrompt.length).trim();
      }
    } else {
      assistantResponse = fullResponse.substring(plainPrompt.length).trim();
    }

    console.log('Full response starts with plain prompt?', fullResponse.startsWith(plainPrompt));
    console.log('Assistant response:', assistantResponse);
    console.log('=== END SUBTRACTION DEBUG ===');

    console.log('=== PARSING DEBUG ===');
    console.log('Prompt length:', prompt.length);
    console.log('Full response length:', fullResponse.length);
    console.log('Assistant response:', assistantResponse);
    console.log('=== END PARSING DEBUG ===');

    console.log('=== PARSED RESPONSE ===');
    console.log('Assistant response:', assistantResponse.trim());
    console.log('=== END PARSED RESPONSE ===');

    displayMessage(assistantResponse.trim(), 'assistant');
    conversationHistory.push({ role: 'assistant', content: assistantResponse.trim() });

    console.log('Updated conversation history:', conversationHistory);
  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error generating response:', error);
    displayMessage('Error generating response: ' + error.message, 'assistant');
  }

  spinner.style.display = 'none';
  sendButton.disabled = false;
  messageInput.value = '';
}

function displayMessage(content, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;

  const timestamp = new Date().toLocaleTimeString();
  messageDiv.innerHTML = `<div class="message-content">${content}</div><div class="timestamp">${timestamp}</div>`;

  messagesDiv.appendChild(messageDiv);
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

function clearChat() {
  messagesDiv.innerHTML = '';
  conversationHistory = [];
}

// Initialize
document.addEventListener('DOMContentLoaded', initModel);
