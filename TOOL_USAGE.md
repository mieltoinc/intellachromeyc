# How to Trigger Tools

## Overview

Tools are automatically triggered when:
1. **AI Model Decides**: When you ask questions that require tool usage, the AI model will automatically decide to call the appropriate tools
2. **Manual Execution**: You can execute tools directly via the Tool Registry

## Setup (Already Done)

The tool providers are automatically registered when the extension loads. The `MemoryToolsProvider` is initialized in the background script.

## How Tools Are Triggered Automatically

### Example 1: Asking About Memories

When you chat with Intella and ask questions about your browsing history, the AI will automatically use tools:

```typescript
// User asks: "What articles did I read about AI?"
// The AI model will automatically:
// 1. Call the search_memories tool with query="AI"
// 2. Receive results
// 3. Generate a response based on the memory results
```

**Try it:**
- Open Intella sidebar (`Cmd+Shift+I`)
- Ask: "Search my memories for AI articles"
- Ask: "What was the last article I read?"
- Ask: "Find memories about machine learning"

The AI will automatically call `search_memories` tool when needed.

### Example 2: Manual Tool Execution

You can also execute tools directly:

```typescript
import { toolRegistry } from '@/utils/tool-registry';

// Execute search_memories tool
const result = await toolRegistry.executeTool('search_memories', {
  query: 'AI articles',
  limit: 5
});

if (result.success) {
  console.log('Found memories:', result.result);
}
```

## Available Tools

### Memory Tools (from `memory-tools` provider)

1. **`search_memories`**
   - Searches through stored memories
   - Parameters: `query` (string, required), `limit` (number, optional)
   - Example: `{ query: "AI", limit: 10 }`

2. **`get_recent_memories`**
   - Gets recently captured memories
   - Parameters: `limit` (number, optional, default: 5)
   - Example: `{ limit: 10 }`

3. **`get_memory_by_url`**
   - Gets a specific memory by URL
   - Parameters: `url` (string, required)
   - Example: `{ url: "https://example.com/article" }`

### Web Tools (from `web-tools` provider)

**Note**: Web tools only work in content scripts (on web pages), not in background scripts.

1. **`get_current_url`** - Get current page URL
2. **`get_page_title`** - Get current page title
3. **`scroll_to_element`** - Scroll to element by CSS selector
4. **`click_element`** - Click element by CSS selector
5. **`extract_text`** - Extract text from element by CSS selector

## Testing Tools

### Test 1: Via Chat Interface

1. Open Intella sidebar
2. Ask: "What memories do I have?"
3. The AI will call `get_recent_memories` automatically

### Test 2: Check Tool Registry

```typescript
// In browser console or background script
import { toolRegistry } from '@/utils/tool-registry';

// List all available tools
console.log(toolRegistry.getAllTools());

// Get enabled tools
console.log(toolRegistry.getEnabledTools());

// Check execution history
console.log(toolRegistry.getExecutionHistory(10));
```

### Test 3: Direct Execution (Background Script)

```typescript
// In background/index.ts or any background context
const result = await toolRegistry.executeTool('search_memories', {
  query: 'test',
  limit: 5
});

console.log('Tool result:', result);
```

## How It Works

1. **Registration**: Providers register their tools on extension startup
2. **AI SDK Integration**: When `enableTools: true`, the AI SDK includes tool definitions in API calls
3. **Automatic Calling**: The AI model decides when to use tools based on the conversation
4. **Execution**: Tools are executed via the Tool Registry
5. **Response**: Tool results are returned to the AI model, which generates the final response

## Example Conversation Flow

```
User: "What did I read about AI yesterday?"

AI Model thinks: "I need to search memories for AI articles"
→ Calls: search_memories({ query: "AI" })
→ Receives: [memory1, memory2, memory3]
→ Generates response: "Based on your memories, you read..."
```

## Debugging

Check the browser console for:
- `✅ Registered tool provider: Memory Tools`
- `✅ Registered tool: search_memories`
- Tool execution logs when tools are called

To see tool calls in action, check the execution history:

```typescript
const history = toolRegistry.getExecutionHistory();
console.table(history);
```

