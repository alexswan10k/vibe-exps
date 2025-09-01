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

function formatPrompt(messages) {
  let prompt = 'You are a helpful AI assistant. ';

  messages.forEach(msg => {
    if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n`;
    }
  });

  prompt += 'Assistant: ';
  return prompt;
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
    const prompt = formatPrompt(conversationHistory);
    console.log('=== FORMATTED PROMPT ===');
    console.log(prompt);
    console.log('=== END PROMPT ===');

    const output = await generator(prompt, {
      max_new_tokens: 100,
      do_sample: true,
      temperature: 0.8,
      stop: ['\nUser:', '\nAssistant:']  // Stop at next user/assistant turn
    });

    console.log('=== RAW MODEL OUTPUT ===');
    console.log('Full response:', output[0].generated_text);
    console.log('=== END RAW OUTPUT ===');

    // Extract the assistant's response by subtracting the prompt
    const fullResponse = output[0].generated_text;
    const generatedOnly = fullResponse.substring(prompt.length);

    console.log('=== PARSING DEBUG ===');
    console.log('Generated only:', generatedOnly);

    // Clean up the response - remove extra whitespace and stop sequences
    let assistantResponse = generatedOnly
      .replace(/\nUser:.*/s, '')  // Remove any following User: lines
      .replace(/\nAssistant:.*/s, '')  // Remove any following Assistant: lines
      .trim();

    console.log('Cleaned response:', assistantResponse);
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
