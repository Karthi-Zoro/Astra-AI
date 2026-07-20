// app.js - Astra AI Chatbot Logic

// Global State
let state = {
  conversations: [],
  activeConversationId: null,
  apiKey: '',
  systemInstruction: 'You are Astra, a helpful, precise, and highly capable AI assistant developed by Gemini. You write clear, well-formatted, and detailed responses, and when writing code you format it using appropriate markdown code blocks.',
  model: 'gemini-2.5-flash'
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const clearAllChatsBtn = document.getElementById('clearAllChatsBtn');
const chatTitle = document.getElementById('chatTitle');
const activeModelLabel = document.getElementById('activeModelLabel');
const settingsIconBtn = document.getElementById('settingsIconBtn');
const chatWindow = document.getElementById('chatWindow');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messagesContainer');
const apiKeyWarning = document.getElementById('apiKeyWarning');
const warningSetupBtn = document.getElementById('warningSetupBtn');
const chatBottom = document.getElementById('chatBottom');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatContextBtn = document.getElementById('clearChatContextBtn');

// Settings Modal Elements
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const systemInstructionInput = document.getElementById('systemInstructionInput');

// Configure Marked.js Custom Renderer for Code Blocks
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }) {
  const validLanguage = lang || 'text';
  // Escape HTML tags to prevent execution
  const escapedCode = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return `
    <div class="code-block-container">
      <div class="code-block-header">
        <span class="code-lang">${validLanguage}</span>
        <button class="copy-code-btn" onclick="window.copyCodeToClipboard(this)">
          <i data-lucide="copy"></i>
          <span>Copy</span>
        </button>
      </div>
      <pre><code class="language-${validLanguage}">${escapedCode}</code></pre>
    </div>
  `;
};
marked.setOptions({ renderer });

// Make copy code globally accessible
window.copyCodeToClipboard = async function(button) {
  const container = button.closest('.code-block-container');
  const codeElement = container.querySelector('code');
  const codeText = codeElement.textContent;

  try {
    await navigator.clipboard.writeText(codeText);
    const span = button.querySelector('span');
    const icon = button.querySelector('i');
    
    // Success feedback
    span.textContent = 'Copied!';
    button.style.color = 'var(--success)';
    
    setTimeout(() => {
      span.textContent = 'Copy';
      button.style.color = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy code: ', err);
  }
};

// Initialize Application
function init() {
  loadLocalStorage();
  setupEventListeners();
  
  // Render initial list
  renderConversationsList();
  
  // Choose correct view state
  if (state.activeConversationId) {
    switchConversation(state.activeConversationId);
  } else {
    showWelcomeScreen();
  }
  
  // Initialize Lucide Icons
  lucide.createIcons();
}

// Helper: Check if active model has necessary configuration
function hasActiveAPI() {
  return !!state.apiKey;
}

// Load configurations and conversations from localStorage
function loadLocalStorage() {
  const storedConversations = localStorage.getItem('astra_conversations');
  if (storedConversations) {
    try {
      state.conversations = JSON.parse(storedConversations);
    } catch (e) {
      state.conversations = [];
    }
  }

  const storedActiveId = localStorage.getItem('astra_active_id');
  if (storedActiveId && state.conversations.some(c => c.id === storedActiveId)) {
    state.activeConversationId = storedActiveId;
  }

  state.apiKey = localStorage.getItem('astra_api_key') || '';
  state.systemInstruction = localStorage.getItem('astra_system_instruction') || state.systemInstruction;
  state.model = 'gemini-2.5-flash';
  
  // Update UI components
  updateModelLabel(state.model);
  
  // Update warning cards
  if (hasActiveAPI()) {
    apiKeyWarning.style.display = 'none';
  } else {
    apiKeyWarning.style.display = 'flex';
  }
}

// Save state to Local Storage
function saveState() {
  localStorage.setItem('astra_conversations', JSON.stringify(state.conversations));
  localStorage.setItem('astra_active_id', state.activeConversationId || '');
  localStorage.setItem('astra_api_key', state.apiKey);
  localStorage.setItem('astra_system_instruction', state.systemInstruction);
  localStorage.setItem('astra_model', state.model);
}

// Event Listeners Setup
function setupEventListeners() {
  // Mobile Sidebar Toggles
  menuBtn.addEventListener('click', toggleSidebar);
  closeSidebarBtn.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', toggleSidebar);

  // New Chat Creation
  newChatBtn.addEventListener('click', () => {
    createNewConversation();
    if (window.innerWidth <= 768) toggleSidebar();
  });

  // Clear Chats Button
  clearAllChatsBtn.addEventListener('click', clearAllConversations);

  // Auto-resize chat input textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight - 16) + 'px';
    
    const hasValue = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasValue || !hasActiveAPI();
  });

  // Input Send Triggers
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);
  
  // Clear Current Chat Context (refresh/restart current chat)
  clearChatContextBtn.addEventListener('click', clearCurrentChatMessages);

  // Suggestion Card clicks
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      chatInput.value = prompt;
      // Trigger resizing
      chatInput.dispatchEvent(new Event('input'));
      // Automatically send
      handleSend();
    });
  });
}

// Sidebar Navigation toggle
function toggleSidebar() {
  sidebar.classList.toggle('active');
}

// Update model label display
function updateModelLabel(modelName) {
  activeModelLabel.textContent = 'Gemini 2.5 Flash';
}

// Show onboarding screen
function showWelcomeScreen() {
  state.activeConversationId = null;
  saveState();
  
  chatTitle.textContent = 'New Chat';
  welcomeScreen.style.display = 'flex';
  messagesContainer.style.display = 'none';
  clearChatContextBtn.disabled = true;
  
  // Verify configuration existence
  if (hasActiveAPI()) {
    apiKeyWarning.style.display = 'none';
  } else {
    apiKeyWarning.style.display = 'flex';
  }
  
  renderConversationsList();
}

// Create New Conversation Object
function createNewConversation(initialMessage = null) {
  const newId = 'chat_' + Date.now();
  const newChat = {
    id: newId,
    title: initialMessage ? truncateString(initialMessage, 30) : 'New Chat',
    model: state.model,
    systemInstruction: state.systemInstruction,
    messages: []
  };

  state.conversations.unshift(newChat);
  state.activeConversationId = newId;
  saveState();
  
  switchConversation(newId);
}

// Switch between conversation tabs
function switchConversation(id) {
  state.activeConversationId = id;
  saveState();

  const conversation = state.conversations.find(c => c.id === id);
  if (!conversation) {
    showWelcomeScreen();
    return;
  }

  // Update UI Elements
  chatTitle.textContent = conversation.title;
  state.model = conversation.model || state.model;
  modelSelect.value = state.model;
  updateModelLabel(state.model);
  
  // Render Messages
  welcomeScreen.style.display = 'none';
  messagesContainer.style.display = 'flex';
  clearChatContextBtn.disabled = conversation.messages.length === 0;

  renderMessages(conversation.messages);
  renderConversationsList();
}

// Clear current chat's messages
function clearCurrentChatMessages() {
  if (!state.activeConversationId) return;
  const conversation = state.conversations.find(c => c.id === state.activeConversationId);
  if (conversation) {
    if (confirm('Are you sure you want to clear the conversation history? This cannot be undone.')) {
      conversation.messages = [];
      conversation.title = 'New Chat';
      saveState();
      switchConversation(state.activeConversationId);
    }
  }
}

// Clear all conversations
function clearAllConversations() {
  if (state.conversations.length === 0) return;
  
  if (confirm('Are you sure you want to delete ALL conversations? This action is permanent.')) {
    state.conversations = [];
    state.activeConversationId = null;
    saveState();
    showWelcomeScreen();
  }
}

// Delete a single conversation
function deleteConversation(id, event) {
  event.stopPropagation(); // Prevent trigger active switch
  
  state.conversations = state.conversations.filter(c => c.id !== id);
  
  if (state.activeConversationId === id) {
    state.activeConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
  }
  
  saveState();
  
  if (state.activeConversationId) {
    switchConversation(state.activeConversationId);
  } else {
    showWelcomeScreen();
  }
}

// Render conversations to sidebar list
function renderConversationsList() {
  chatHistoryList.innerHTML = '';
  
  if (state.conversations.length === 0) {
    chatHistoryList.innerHTML = '<div class="no-chats-msg">No conversations yet</div>';
    return;
  }

  state.conversations.forEach(chat => {
    const item = document.createElement('div');
    item.className = `history-item ${chat.id === state.activeConversationId ? 'active' : ''}`;
    item.addEventListener('click', () => switchConversation(chat.id));

    item.innerHTML = `
      <div class="history-item-content">
        <i data-lucide="message-square"></i>
        <span class="history-title">${escapeHTML(chat.title)}</span>
      </div>
      <div class="history-item-actions">
        <button class="history-action-btn delete" title="Delete Chat">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    // Hook delete event
    const deleteBtn = item.querySelector('.delete');
    deleteBtn.addEventListener('click', (e) => deleteConversation(chat.id, e));

    chatHistoryList.appendChild(item);
  });

  lucide.createIcons();
}

// Render messages in chat screen
function renderMessages(messages) {
  messagesContainer.innerHTML = '';
  
  if (messages.length === 0) {
    // Empty chat space placeholder
    messagesContainer.innerHTML = `
      <div class="empty-conversation-state">
        <p>Send a message to begin the conversation.</p>
      </div>
    `;
    return;
  }

  messages.forEach(msg => {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${msg.role}`;

    let avatarIcon = msg.role === 'user' ? 'user' : 'sparkles';
    let formattedContent = '';
    
    if (msg.role === 'user') {
      formattedContent = escapeHTML(msg.content).replace(/\n/g, '<br>');
    } else {
      // Use Marked parser to render Markdown securely
      formattedContent = marked.parse(msg.content);
    }

    messageEl.innerHTML = `
      <div class="avatar" title="${msg.role === 'user' ? 'You' : 'Astra'}">
        <i data-lucide="${avatarIcon}"></i>
      </div>
      <div class="message-wrapper">
        <div class="message-bubble">
          ${formattedContent}
        </div>
        <span class="message-time">${formatTime(msg.timestamp)}</span>
      </div>
    `;

    messagesContainer.appendChild(messageEl);
  });

  // Re-run syntax highlighting and render fresh Lucide icons
  Prism.highlightAllUnder(messagesContainer);
  lucide.createIcons();
  scrollToBottom();
}

// Handle User Input Submission
async function handleSend() {
  const content = chatInput.value.trim();
  if (!content || !hasActiveAPI()) return;

  // Clear Input Box & disable controls
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  
  let currentConversation;
  
  if (!state.activeConversationId) {
    // Create new conversation on first prompt
    createNewConversation(content);
    currentConversation = state.conversations[0];
  } else {
    currentConversation = state.conversations.find(c => c.id === state.activeConversationId);
  }

  if (!currentConversation) return;

  // Add User Message to State
  const userMsg = {
    role: 'user',
    content: content,
    timestamp: Date.now()
  };
  
  currentConversation.messages.push(userMsg);
  
  // Update Chat Title if it was default
  if (currentConversation.title === 'New Chat' && currentConversation.messages.length === 1) {
    currentConversation.title = truncateString(content, 30);
    chatTitle.textContent = currentConversation.title;
  }

  // Update UI
  switchConversation(state.activeConversationId);
  
  // Show Typing Indicator
  showTypingIndicator();
  
  // Call API
  try {
    const aiResponse = await callGeminiAPI(currentConversation);
    removeTypingIndicator();
    
    // Add Assistant Message to State
    const assistantMsg = {
      role: 'model',
      content: aiResponse,
      timestamp: Date.now()
    };
    
    currentConversation.messages.push(assistantMsg);
    saveState();
    
    // Re-render UI
    switchConversation(state.activeConversationId);
    
  } catch (error) {
    removeTypingIndicator();
    console.error('Chat API Error:', error);
    
    // Display error block
    const errorMsg = {
      role: 'model',
      content: `⚠️ **API Request Failed**\n\n${error.message || 'An unknown error occurred.'}\n\nPlease check your settings and make sure your Gemini API key is configured correctly.`,
      timestamp: Date.now()
    };
    currentConversation.messages.push(errorMsg);
    saveState();
    switchConversation(state.activeConversationId);
  }
}

// Call Gemini API REST Endpoint
async function callGeminiAPI(conversation) {
  const model = conversation.model || 'gemini-2.5-flash';
  const apiKey = state.apiKey;
  const sysInstruction = conversation.systemInstruction || state.systemInstruction;
  
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // Format history payload into API representation
  const contents = conversation.messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const payload = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: sysInstruction }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  
  if (!response.ok) {
    let errorDetail = 'API Call Failed';
    if (data.error) {
      errorDetail = `${data.error.status}: ${data.error.message}`;
    }
    throw new Error(errorDetail);
  }

  // Parse response content
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Malformed API Response. No valid output matches.');
  }
}

// Manage Typing Loading Indicator
function showTypingIndicator() {
  removeTypingIndicator(); // Ensure no duplicates
  
  const typingEl = document.createElement('div');
  typingEl.className = 'message assistant typing-placeholder';
  typingEl.id = 'typingIndicator';
  
  typingEl.innerHTML = `
    <div class="avatar">
      <i data-lucide="sparkles"></i>
    </div>
    <div class="message-wrapper">
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  
  messagesContainer.appendChild(typingEl);
  lucide.createIcons();
  scrollToBottom();
}

function removeTypingIndicator() {
  const typingEl = document.getElementById('typingIndicator');
  if (typingEl) {
    typingEl.remove();
  }
}

// Modal handlers
function openSettings() {
  apiKeyInput.value = state.apiKey;
  systemInstructionInput.value = state.systemInstruction;
  settingsModal.classList.add('active');
}

function closeSettings() {
  settingsModal.classList.remove('active');
  // Reset visibility state
  apiKeyInput.setAttribute('type', 'password');
  const icon = toggleApiKeyVisibility.querySelector('i');
  icon.setAttribute('data-lucide', 'eye');
  lucide.createIcons();
}

function saveSettings() {
  state.apiKey = apiKeyInput.value.trim();
  state.systemInstruction = systemInstructionInput.value.trim() || state.systemInstruction;
  
  saveState();
  closeSettings();
  
  // Update model label if active
  updateModelLabel(state.model);
  
  // Re-enable sendBtn if active configuration exists
  if (hasActiveAPI()) {
    apiKeyWarning.style.display = 'none';
    const hasValue = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasValue;
  } else {
    apiKeyWarning.style.display = 'flex';
    sendBtn.disabled = true;
  }
  
  alert('Settings saved successfully!');
}

// Scroll chat panel to bottom anchor
function scrollToBottom() {
  chatBottom.scrollIntoView({ behavior: 'smooth' });
}

// Helper: Escape Special HTML tags to prevent XSS
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Helper: Truncate characters length
function truncateString(str, num) {
  if (str.length <= num) return str;
  return str.slice(0, num) + '...';
}

// Helper: Formatting local hour string
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Boot the App
document.addEventListener('DOMContentLoaded', init);
