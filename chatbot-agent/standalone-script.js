// Standalone Chatbot Script using Transformers.js with SmolLM2-135M-Instruct
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js';

const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');
const chatWindow = document.getElementById('chat-window');
const spinner = document.getElementById('spinner');
const clearButton = document.getElementById('clear-button');

let generator;
let conversationHistory = [];

async function initModel() {
  console.log('Loading SmolLM2-135M-Instruct model...');
  spinner.style.display = 'block';
  try {
    generator = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-135M-Instruct');
    console.log('Model loaded.');
  } catch (error) {
    console.error('Error loading model:', error);
    displayMessage('Error loading model: ' + error.message, 'assistant');
  }
  spinner.style.display = 'none';
}

sendButton.addEventListener('click', sendMessage);
clearButton.addEventListener('click', clearChat);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function formatChatTemplate(messages) {
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

    const output = await generator(prompt, {
      max_new_tokens: 150,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      pad_token_id: 2,
      eos_token_id: 2
    });

    console.log('=== RAW MODEL OUTPUT ===');
    console.log('Full response:', output[0].generated_text);
    console.log('=== END RAW OUTPUT ===');

    // Create a plain text version of the conversation for subtraction
    let plainPrompt = '';
    if (conversationHistory.length === 0 || conversationHistory[0].role !== 'system') {
      plainPrompt = 'system\nYou are a helpful AI assistant named SmolLM, trained by Hugging Face\n';
    }

    conversationHistory.forEach(msg => {
      plainPrompt += `${msg.role}\n${msg.content}\n`;
    });
    plainPrompt += 'assistant\n';

    console.log('=== SUBTRACTION DEBUG ===');
    console.log('Plain prompt for subtraction:', plainPrompt);
    console.log('Plain prompt length:', plainPrompt.length);

    // Subtract the plain text prompt from the response
    const fullResponse = output[0].generated_text;
    const assistantResponse = fullResponse.substring(plainPrompt.length).trim();

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
