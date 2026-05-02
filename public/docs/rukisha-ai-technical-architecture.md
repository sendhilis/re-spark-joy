# Lipafo AI — Technical Architecture & Flow Implementation Document

**Version:** 1.0  
**Date:** March 2, 2026  
**System:** Lipafo — AI powered wallet designed by Kenyans for Kenyans  
**Component:** Lipafo AI — Diaspora Financial Assistant  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Inventory](#3-component-inventory)
4. [Frontend Implementation](#4-frontend-implementation)
   - 4.1 [Widget Component Structure](#41-widget-component-structure)
   - 4.2 [State Management](#42-state-management)
   - 4.3 [Wallet Context Integration](#43-wallet-context-integration)
   - 4.4 [Quick Actions System](#44-quick-actions-system)
   - 4.5 [Proactive Nudge Engine](#45-proactive-nudge-engine)
   - 4.6 [SSE Streaming Parser](#46-sse-streaming-parser)
   - 4.7 [Message Rendering Pipeline](#47-message-rendering-pipeline)
   - 4.8 [Conversation Persistence Layer](#48-conversation-persistence-layer)
   - 4.9 [UI Components & Layout](#49-ui-components--layout)
5. [Backend Implementation](#5-backend-implementation)
   - 5.1 [Edge Function Overview](#51-edge-function-overview)
   - 5.2 [Request Payload Modes](#52-request-payload-modes)
   - 5.3 [System Prompt Architecture](#53-system-prompt-architecture)
   - 5.4 [Dynamic Context Injection](#54-dynamic-context-injection)
   - 5.5 [Action-Specific Prompt Routing](#55-action-specific-prompt-routing)
   - 5.6 [AI Gateway Integration](#56-ai-gateway-integration)
   - 5.7 [Error Handling & Status Codes](#57-error-handling--status-codes)
6. [Database Schema](#6-database-schema)
   - 6.1 [chat_messages Table](#61-chat_messages-table)
   - 6.2 [Row Level Security Policies](#62-row-level-security-policies)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
   - 7.1 [Standard Chat Flow](#71-standard-chat-flow)
   - 7.2 [Quick Action Flow](#72-quick-action-flow)
   - 7.3 [Proactive Nudge Flow](#73-proactive-nudge-flow)
   - 7.4 [History Persistence Flow](#74-history-persistence-flow)
8. [Configuration](#8-configuration)
9. [Security Model](#9-security-model)
10. [Performance Considerations](#10-performance-considerations)
11. [Appendix A — Complete System Prompt](#appendix-a--complete-system-prompt)
12. [Appendix B — Quick Action Registry](#appendix-b--quick-action-registry)
13. [Appendix C — Proactive Nudge Corpus](#appendix-c--proactive-nudge-corpus)

---

## 1. System Overview

Lipafo AI is a conversational financial assistant embedded as a floating widget in the Lipafo Wallet application. It provides personalized diaspora financial guidance using real-time wallet data, streaming AI responses, and persistent conversation history.

### Key Characteristics

| Property | Value |
|---|---|
| **Architecture** | 3-layer: React Widget → Backend Edge Function → Managed AI Gateway |
| **AI Model** | `google/gemini-3-flash-preview` |
| **Response Mode** | Server-Sent Events (SSE) streaming for chat; JSON for one-shot |
| **Persistence** | PostgreSQL via Backend (`chat_messages` table) |
| **Auth Requirement** | Edge function: `verify_jwt = false`; Persistence: requires authenticated user |
| **Deployment** | Auto-deployed via the managed backend |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              RukishaAIWidget (React Component)            │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │ State    │  │ WalletContext│  │ AuthContext        │  │   │
│  │  │ Manager  │  │ (useMemo)    │  │ (userId)          │  │   │
│  │  └──────────┘  └──────────────┘  └───────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │ SSE      │  │ Quick Action │  │ Nudge Engine      │  │   │
│  │  │ Parser   │  │ Dispatcher   │  │ (15s timer)       │  │   │
│  │  └──────────┘  └──────────────┘  └───────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ Persistence Layer (Backend JS SDK)              │    │   │
│  │  │ • loadHistory() • persistMessage() • clearHistory│    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                    POST /functions/v1/rukisha-ai                 │
│                    Authorization: Bearer <anon_key>              │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND EDGE FUNCTION                        │
│                   edge-functions/rukisha-ai/index.ts        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐     │
│  │ CORS Handler │  │ Payload      │  │ System Prompt     │     │
│  │              │  │ Parser       │  │ Builder           │     │
│  │              │  │ (dual mode)  │  │ (base + context + │     │
│  │              │  │              │  │  action)          │     │
│  └──────────────┘  └──────────────┘  └───────────────────┘     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Context Injector                                     │       │
│  │ • walletContext.balances → formatted markdown        │       │
│  │ • walletContext.salaryTransfers → date/amount list   │       │
│  │ • walletContext.loanRepayments → date/amount list    │       │
│  │ • walletContext.recentTransactions → activity feed   │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                    POST https://ai.gateway.internal/v1/...   │
│                    Authorization: Bearer <AI_GATEWAY_API_KEY>       │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MANAGED AI GATEWAY                            │
│                                                                 │
│   Model: google/gemini-3-flash-preview                          │
│   Protocol: OpenAI-compatible chat/completions                  │
│   Auth: AI_GATEWAY_API_KEY (auto-provisioned)                      │
│   Output: SSE stream or JSON (based on stream param)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Inventory

| File | Layer | Purpose |
|---|---|---|
| `src/components/ai/RukishaAIWidget.tsx` | Frontend | Main widget: UI, state, streaming, persistence |
| `src/contexts/WalletContext.tsx` | Frontend | Provides live balances & transaction data |
| `src/contexts/AuthContext.tsx` | Frontend | Provides authenticated `user.id` for persistence |
| `edge-functions/rukisha-ai/index.ts` | Backend | Edge function: prompt assembly, AI gateway proxy |
| `edge-functions/config.toml` | Config | Function registration, JWT verification settings |
| `src/integrations/backend/client.ts` | Frontend | Auto-generated Backend SDK client |
| Database: `public.chat_messages` | Database | Persistent conversation storage |

---

## 4. Frontend Implementation

### 4.1 Widget Component Structure

**File:** `src/components/ai/RukishaAIWidget.tsx`  
**Export:** Named export `RukishaAIWidget`  
**Mount Point:** `src/App.tsx` — rendered globally inside `<WalletProvider>` and `<AuthProvider>`

The widget renders three mutually exclusive UI states:

| State | Condition | Renders |
|---|---|---|
| **FAB (Floating Action Button)** | `!isOpen` | 56px gradient button, bottom-right, green pulse indicator |
| **Nudge Bubble** | `showNudge && !isOpen` | Dismissible card above FAB with random financial tip |
| **Chat Panel** | `isOpen` | Full-screen overlay with header, messages, input |

### 4.2 State Management

All state is managed via React `useState` hooks within the widget component. No external state library is used.

| State Variable | Type | Default | Purpose |
|---|---|---|---|
| `isOpen` | `boolean` | `false` | Controls chat panel visibility |
| `messages` | `Msg[]` | `[]` | Chat message history (role + content) |
| `input` | `string` | `""` | Current user input text |
| `isLoading` | `boolean` | `false` | Streaming in progress flag |
| `showNudge` | `boolean` | `false` | Proactive nudge bubble visibility |
| `currentNudge` | `number` | `0` | Index into `proactiveNudges` array |
| `historyLoaded` | `boolean` | `false` | Prevents re-fetching history on re-open |

**Refs:**

| Ref | Type | Purpose |
|---|---|---|
| `messagesEndRef` | `HTMLDivElement` | Scroll-to-bottom anchor |

### 4.3 Wallet Context Integration

The widget reads live financial data from `WalletContext` using a `useMemo` hook that recomputes only when `balances` or `transactions` change.

**Context Extraction Logic:**

```typescript
const walletContext = useMemo(() => {
  if (!walletData) return undefined;
  const { balances, transactions } = walletData;
  
  // Filter salary transfers by description keyword
  const salaryTransfers = transactions
    .filter(t => t.description?.toLowerCase().includes('salary transfer'))
    .map(t => ({ amount, description, timestamp, status }));
  
  // Filter loan repayments by description keyword
  const loanRepayments = transactions
    .filter(t => t.description?.toLowerCase().includes('loan repayment'))
    .map(t => ({ amount, description, timestamp, status }));
  
  // Take last 15 transactions
  const recentTransactions = transactions.slice(0, 15)
    .map(t => ({ type, amount, description, timestamp, status }));
  
  return { balances, salaryTransfers, loanRepayments, recentTransactions };
}, [walletData?.balances, walletData?.transactions]);
```

**walletContext Payload Shape:**

```typescript
{
  balances: {
    main: number;
    education: number;
    medical: number;
    holiday: number;
    retirement: number;
    pension: number;
  };
  salaryTransfers: Array<{
    amount: number;
    description: string;
    timestamp: Date;
    status: string;
  }>;
  loanRepayments: Array<{...same shape...}>;
  recentTransactions: Array<{
    type: string;    // transaction_type enum
    amount: number;
    description: string;
    timestamp: Date;
    status: string;
  }>;
}
```

**Safe Access Pattern:** Both `useWallet()` and `useAuth()` are wrapped in try-catch blocks to allow the widget to function (without personalization) even if contexts are unavailable.

### 4.4 Quick Actions System

7 pre-defined quick action buttons that trigger specific AI analysis modes.

**Registry:**

| ID | Label | Icon | Description (sent as user message) |
|---|---|---|---|
| `salary_repay_history` | Repay History | `<History>` | View salary loan repayment history |
| `loan_health` | Loan Health Check | `<Heart>` | Review your diaspora loan status |
| `repay_reminder` | Repay Reminders | `<Bell>` | Set up payment reminders |
| `repay_monitor` | Repay Monitor | `<TrendingUp>` | Track repayment progress |
| `remittance` | Send Money Home | `<Globe>` | Remittance guidance & rates |
| `wallet_setup` | Wallet Optimizer | `<Wallet>` | Optimize your sub-wallets |
| `exchange_rates` | Exchange Rates | `<CreditCard>` | KES exchange rate info |

**Dispatch Flow:**

1. User taps quick action button
2. `action.description` is added as a user message to the conversation
3. User message is persisted to database
4. `streamChat()` is called with both `messages` array AND `action.id` string
5. Edge function receives `action` param and injects action-specific system prompt

**UI Placement:**
- **Empty state:** Full 2-column grid of all 7 actions
- **In-conversation:** Horizontal scrollable strip showing first 4 actions

### 4.5 Proactive Nudge Engine

A timer-based system that displays contextual financial tips to inactive users.

**Nudge Corpus (6 items):**

| # | Emoji | Nudge Text |
|---|---|---|
| 0 | 🏠 | Have you checked your diaspora mortgage health recently? I can run a quick review. |
| 1 | ⏰ | Setting up automatic repay reminders can help you never miss a payment. Want me to help? |
| 2 | 💰 | Your remittance fees could be lower with Lipafo. Let me show you how much you'd save. |
| 3 | 📊 | I can monitor your loan repayments and alert you to any concerns. Interested? |
| 4 | 🎯 | Your sub-wallets could be working harder for you. Let me suggest an optimal allocation. |
| 5 | 💳 | I can show you your salary loan repayment history. Want to see your progress? |

**Timer Logic:**

```
Component mounts → 
  IF (isOpen === false AND messages.length === 0) THEN
    setTimeout(15000ms) → 
      setShowNudge(true)
      setCurrentNudge(random index 0-5)
```

**Nudge Click Handler:**

1. Hide nudge bubble
2. Open chat panel
3. Strip emoji prefix from nudge text
4. Create user message with stripped text
5. Persist message to database
6. Start streaming AI response

### 4.6 SSE Streaming Parser

The widget implements a robust line-by-line SSE parser that handles the OpenAI-compatible streaming format.

**Parser Algorithm:**

```
1. Fetch POST to CHAT_URL → get ReadableStream
2. Create TextDecoder for UTF-8 chunk decoding
3. Initialize textBuffer = ""
4. LOOP: read chunks from stream
   a. Append decoded chunk to textBuffer
   b. INNER LOOP: scan for newline characters
      i.   Extract line before newline
      ii.  Handle CRLF (strip trailing \r)
      iii. Skip SSE comments (lines starting with ":")
      iv.  Skip empty lines
      v.   Skip non-data lines (not starting with "data: ")
      vi.  Extract JSON string after "data: " prefix
      vii. Check for "[DONE]" sentinel → break
      viii. Parse JSON → extract choices[0].delta.content
      ix.  If content exists → call upsert(content)
      x.   On JSON.parse failure → re-buffer line (partial JSON) → break inner loop
5. On stream end → persist final assistant message
6. Set isLoading = false
```

**Upsert Pattern (prevents message flickering):**

```typescript
const upsert = (chunk: string) => {
  assistantSoFar += chunk;  // accumulate full response
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (last?.role === "assistant") {
      // UPDATE last assistant message content
      return prev.map((m, i) => 
        i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
      );
    }
    // First token: CREATE new assistant message
    return [...prev, { role: "assistant", content: assistantSoFar }];
  });
};
```

### 4.7 Message Rendering Pipeline

| Message Role | Rendering | Styling |
|---|---|---|
| `user` | Plain `<p>` text | `bg-primary text-primary-foreground`, right-aligned, `rounded-br-md` |
| `assistant` | `<ReactMarkdown>` with prose classes | `glass-card text-foreground`, left-aligned, `rounded-bl-md` |
| Loading indicator | 3 animated dots | `glass-card`, bouncing dots with staggered delays (0/150/300ms) |

**Loading Indicator Condition:**  
Shows only when `isLoading === true` AND the last message is NOT already an assistant message (prevents double-rendering during streaming).

### 4.8 Conversation Persistence Layer

**Storage:** Backend `public.chat_messages` table  
**Scope:** Per authenticated user  
**Limit:** Last 50 messages loaded on widget open

**Operations:**

| Operation | Trigger | SQL Equivalent |
|---|---|---|
| `loadHistory` | Widget opens (once per session) | `SELECT role, content FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 50` |
| `persistMessage` | After user sends; after assistant stream completes | `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)` |
| `clearHistory` | User clicks Trash icon | `DELETE FROM chat_messages WHERE user_id = $1` |

**Session Guard:** `historyLoaded` flag ensures history is fetched only once per widget lifecycle. Reopening the widget without page refresh does not re-fetch.

**Unauthenticated Users:** All persistence operations silently no-op when `userId` is `undefined`. The widget functions normally as a stateless chatbot.

### 4.9 UI Components & Layout

**FAB (Floating Action Button):**
- Position: `fixed bottom-6 right-4 z-50`
- Size: `w-14 h-14`
- Style: `rounded-2xl bg-gradient-to-br from-primary to-primary-light`
- Shadow: `shadow-lg shadow-primary/30`
- Indicator: `w-4 h-4` green pulse dot (`bg-success`)

**Nudge Bubble:**
- Position: `fixed bottom-24 right-4 z-50`
- Max width: `280px`
- Animation: `animate-in slide-in-from-bottom-4 fade-in duration-500`
- Dismiss: `X` button at `-top-2 -right-2`

**Chat Panel:**
- Position: `fixed inset-0 z-50` (full-screen overlay)
- Background: `bg-background/95 backdrop-blur-xl`
- Animation: `animate-in slide-in-from-bottom duration-300`
- Layout: Flexbox column (header → messages → quick strip → input)
- Safe areas: `safe-top safe-bottom` classes for mobile notch/gesture bar

---

## 5. Backend Implementation

### 5.1 Edge Function Overview

**File:** `edge-functions/rukisha-ai/index.ts`  
**Runtime:** Deno (Backend Edge Functions)  
**Framework:** `std@0.168.0/http/server.ts`  
**JWT Verification:** Disabled (`verify_jwt = false` in config.toml)

### 5.2 Request Payload Modes

The edge function accepts two distinct payload formats:

**Mode 1: Streaming Chat (Widget)**

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "action": "loan_health",          // optional
  "walletContext": { ... }           // optional
}
```

- Response: `text/event-stream` (SSE)
- Stream flag: `true`

**Mode 2: One-Shot JSON (Programmatic)**

```json
{
  "message": "Check my loan status",
  "conversationHistory": [            // optional
    { "role": "user", "content": "..." }
  ]
}
```

- Response: `application/json` → `{ "reply": "..." }`
- Stream flag: `false`

**Detection Logic:**

```typescript
const isOneShot = typeof body.message === "string";
// If body.messages is an array → streaming mode
// If body.message is a string → one-shot mode
```

### 5.3 System Prompt Architecture

The system prompt is built as an array of system messages:

```
systemMessages = [
  { role: "system", content: BASE_SYSTEM_PROMPT },      // Always present
  { role: "system", content: LIVE_FINANCIAL_DATA },      // If walletContext provided
  { role: "system", content: ACTION_SPECIFIC_PROMPT },   // If action provided
]
```

**Base System Prompt (~1,500 tokens):**

Defines 7 sections:
1. **Identity** — Name (Lipafo AI), personality (warm, knowledgeable), tone (professional, occasional Swahili)
2. **Core Capabilities** — 7 numbered capabilities (diaspora guidance, loan health, repay reminders, repay monitoring, wallet engagement, diaspora flows, salary tracking)
3. **Proactive Behaviors** — 6 nudge behaviors (loan status checks, reminder suggestions, savings diversification, exchange rate alerts, pension contributions, repayment formatting)
4. **Key Knowledge** — Fee structures (2.4% vs 3%), Save-As-You-Spend formula (5% → 50/30/20 split), supported corridors (7 countries), loan types (5 types), Quick Repay flow
5. **Response Guidelines** — Format rules (2-4 paragraphs, bullet points, KES formatting, follow-up questions)

### 5.4 Dynamic Context Injection

When `walletContext` is present in the request, the edge function formats it into a human-readable markdown system message.

**4 Context Sections (conditionally included):**

| Section | Source Field | Format |
|---|---|---|
| Current Wallet Balances | `walletContext.balances` | Bullet list: `- Main Wallet: KES X` for each of 6 wallet types |
| Salary Transfer History | `walletContext.salaryTransfers` | Count + total + dated list: `- 5 Jan 2026: KES 45,000 — Monthly salary transfer` |
| Loan Repayment History | `walletContext.loanRepayments` | Count + total repaid + dated list |
| Recent Transactions | `walletContext.recentTransactions` | Last 10 items with type, amount, description, status |

**Date Formatting:** `en-KE` locale with `{ day: 'numeric', month: 'short', year: 'numeric' }`

**Number Formatting:** `Number.toLocaleString()` for thousands separators

### 5.5 Action-Specific Prompt Routing

When an `action` string is provided, an additional system message is injected with targeted instructions.

| Action ID | Additional System Instruction |
|---|---|
| `loan_health` | Use actual wallet balances and loan repayment history. Show repayment pattern, total repaid, concerns. |
| `repay_reminder` | Reference actual repayment history. Suggest optimal timing based on salary transfer pattern. |
| `repay_monitor` | Show ACTUAL salary transfer and loan repayment history from provided data. Calculate totals, highlight patterns, project payoff timeline. |
| `salary_repay_history` | Show clear summary of ALL salary transfers and loan repayments. Include dates, amounts, running totals. Highlight Quick Repay flow steps. |
| `remittance` | Ask about corridor (country), amount, preferred method. Compare fees and rates. |
| `wallet_setup` | Use actual balances to guide through sub-wallet system. Suggest improvements. |
| `exchange_rates` | Provide guidance on best times and methods to send money to Kenya. |

### 5.6 AI Gateway Integration

**Endpoint:** `https://ai.gateway.internal/v1/chat/completions`  
**Protocol:** OpenAI Chat Completions API (compatible)  
**Authentication:** `Authorization: Bearer ${AI_GATEWAY_API_KEY}`  
**Secret Source:** `Deno.env.get("AI_GATEWAY_API_KEY")` — auto-provisioned by the managed backend

**Request Payload:**

```json
{
  "model": "google/gemini-3-flash-preview",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true
}
```

**Response (streaming):** SSE stream with `data: {"choices":[{"delta":{"content":"token"}}]}` lines, terminated by `data: [DONE]`

**Response (one-shot):** JSON `{"choices":[{"message":{"content":"full response"}}]}`

### 5.7 Error Handling & Status Codes

| HTTP Status | Condition | User-Facing Message |
|---|---|---|
| 400 | Invalid request payload | "Invalid request: provide messages array or message string" |
| 429 | Rate limited by AI gateway | "Too many requests. Please wait a moment and try again." |
| 402 | Credits exhausted | "AI credits exhausted. Please top up your workspace credits." |
| 500 (gateway error) | Non-429/402 AI gateway failure | "AI service temporarily unavailable." |
| 500 (function error) | Unhandled exception in edge function | Error message from exception |

**Client-Side Error Handling:**
- Non-OK HTTP response → parse error JSON → show destructive toast
- Network/stream error → catch block → show "Connection error" toast

---

## 6. Database Schema

### 6.1 chat_messages Table

```sql
CREATE TABLE public.chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created 
  ON public.chat_messages (user_id, created_at);
```

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NO | — | References authenticated user |
| `role` | `TEXT` | NO | — | Either `'user'` or `'assistant'` |
| `content` | `TEXT` | NO | — | Full message text (markdown for assistant) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | Insertion timestamp |

### 6.2 Row Level Security Policies

```sql
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read only their own messages
CREATE POLICY "Users can view own chat messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert only their own messages
CREATE POLICY "Users can insert own chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own messages (for clear history)
CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 7. Data Flow Diagrams

### 7.1 Standard Chat Flow

```
User types message → presses Send
  │
  ├─ 1. setMessages([...prev, userMsg])         ← optimistic UI
  ├─ 2. setInput("")                             ← clear input
  ├─ 3. persistMessage(userMsg)                  ← async INSERT to DB
  │
  └─ 4. streamChat(allMessages)
         │
         ├─ 5. setIsLoading(true)
         ├─ 6. Build request body:
         │     { messages, action: undefined, walletContext }
         │
         ├─ 7. POST → Edge Function
         │      │
         │      ├─ 8. Parse payload (messages mode)
         │      ├─ 9. Build systemMessages:
         │      │     [BASE_PROMPT] + [WALLET_DATA?]
         │      ├─ 10. POST → AI Gateway (stream: true)
         │      └─ 11. Pipe SSE stream back to client
         │
         ├─ 12. Parse SSE line-by-line:
         │      for each "data: {json}" line:
         │        extract delta.content → upsert()
         │
         ├─ 13. On stream end:
         │      persistMessage(assistantMsg)     ← async INSERT
         │
         └─ 14. setIsLoading(false)
```

### 7.2 Quick Action Flow

```
User taps Quick Action button
  │
  ├─ 1. Create userMsg from action.description
  ├─ 2. setMessages([...prev, userMsg])
  ├─ 3. persistMessage(userMsg)
  │
  └─ 4. streamChat(allMessages, action.id)
         │
         ├─ 5. Request body includes action param
         │
         └─ Edge Function:
            ├─ 6. Build systemMessages with BASE + WALLET_DATA
            ├─ 7. Lookup action in actionPrompts map
            ├─ 8. Append action-specific system message
            └─ 9. POST to AI Gateway with augmented prompt
```

### 7.3 Proactive Nudge Flow

```
Widget mounted (isOpen=false, messages=[])
  │
  ├─ setTimeout(15000ms)
  │
  └─ Timer fires:
     ├─ setShowNudge(true)
     ├─ setCurrentNudge(random 0-5)
     │
     └─ User clicks nudge bubble:
        ├─ setShowNudge(false)
        ├─ setIsOpen(true)
        ├─ Strip emoji prefix from nudge text
        ├─ Create userMsg with stripped text
        ├─ setMessages([userMsg])
        ├─ persistMessage(userMsg)
        └─ streamChat([userMsg])
```

### 7.4 History Persistence Flow

```
Widget opens (isOpen transitions to true)
  │
  ├─ Guard: if (historyLoaded || !userId) → skip
  │
  ├─ SELECT role, content FROM chat_messages
  │   WHERE user_id = $userId
  │   ORDER BY created_at ASC
  │   LIMIT 50
  │
  ├─ If rows returned → setMessages(rows)
  └─ setHistoryLoaded(true)

Clear History (user clicks Trash icon):
  │
  ├─ DELETE FROM chat_messages WHERE user_id = $userId
  ├─ setMessages([])
  └─ Show success toast
```

---

## 8. Configuration

### edge-functions/config.toml

```toml
project_id = "ejrttghgscfhbezvobhv"

[functions.rukisha-ai]
verify_jwt = false
```

**`verify_jwt = false`:** Allows the widget to call the edge function with just the anon key, without requiring a user JWT. This is intentional because:
- The AI chat should be accessible to unauthenticated users (without persistence)
- The anon key is a publishable key, not a secret
- RLS policies on `chat_messages` still protect persisted data

### Environment Variables

| Variable | Source | Used In |
|---|---|---|
| `VITE_BACKEND_URL` | `.env` (auto-generated) | Frontend: build CHAT_URL |
| `VITE_BACKEND_PUBLISHABLE_KEY` | `.env` (auto-generated) | Frontend: Authorization header |
| `AI_GATEWAY_API_KEY` | Backend secret (auto-provisioned) | Edge function: AI gateway auth |

---

## 9. Security Model

| Layer | Protection |
|---|---|
| **Edge Function Access** | Anon key required (publishable, not secret) |
| **AI Gateway** | `AI_GATEWAY_API_KEY` server-side only, never exposed to client |
| **Chat Persistence** | RLS policies: `auth.uid() = user_id` for SELECT, INSERT, DELETE |
| **Wallet Data** | Sent per-request from client memory; never stored server-side in edge function |
| **No UPDATE policy** | Messages are immutable once persisted (no edit capability) |

---

## 10. Performance Considerations

| Aspect | Implementation | Rationale |
|---|---|---|
| **walletContext memoization** | `useMemo` keyed on `balances` + `transactions` | Prevents re-serialization on every render |
| **History fetch guard** | `historyLoaded` boolean flag | Single DB query per session, not per widget open |
| **SSE line-by-line parsing** | Process tokens immediately, don't buffer events | Minimizes time-to-first-token in UI |
| **Message upsert pattern** | Update last array element instead of appending | Prevents React reconciliation of entire list per token |
| **Transaction limit** | 15 recent, all salary/loan filtered client-side | Balances payload size vs completeness |
| **History limit** | 50 messages loaded | Prevents excessive DB reads for long conversations |
| **Stateless edge function** | No DB reads, no session storage | Cold start ≈ 50ms, no connection pooling needed |

---

## Appendix A — Complete System Prompt

```
You are Lipafo AI — the intelligent financial assistant for Lipafo Wallet
— an AI powered wallet designed by Kenyans for Kenyans, serving local and diaspora users.

## Your Identity
- Name: Lipafo AI
- Personality: Warm, knowledgeable, proactive. You understand the unique
  challenges of managing money across borders.
- Tone: Professional yet approachable. Use simple language. Occasionally
  use Swahili greetings (Habari, Karibu, Asante) naturally.

## Your Core Capabilities
1. Diaspora Financial Guidance
2. Loan Health Checks
3. Repay Reminders
4. Repay Monitoring
5. Wallet Engagement
6. Diaspora-Specific Flows
7. Salary Loan Repayment Tracking

## Proactive Behaviors
- Nudge about loan status
- Suggest automatic reminders
- Recommend sub-wallet diversification
- Alert about favorable exchange rates
- Encourage pension contributions
- Format repayment history clearly

## Key Knowledge
- Lipafo: 2.4% fee vs M-Pesa: 3% fee
- Fee difference → Taifa Pension (CPF)
- Save-As-You-Spend: 5% → 50% retirement, 30% pension, 20% education
- Corridors: UAE, USA, UK, Canada, Australia, Germany, South Africa
- Loan types: Diaspora Mortgage, Business, Education, Emergency, Chama
- Quick Repay: Link card → Transfer salary → Repay loan → Auto-debit

## Response Guidelines
- 2-4 paragraphs max
- Bullet points for lists
- KES with thousands separators
- End with follow-up question or suggestion
- Include interest rate and monthly payment for loans
- Table/list format for salary repayment history
```

---

## Appendix B — Quick Action Registry

```typescript
const quickActions: QuickAction[] = [
  {
    id: "salary_repay_history",
    label: "Repay History",
    icon: <History />,
    description: "View salary loan repayment history"
  },
  {
    id: "loan_health",
    label: "Loan Health Check",
    icon: <Heart />,
    description: "Review your diaspora loan status"
  },
  {
    id: "repay_reminder",
    label: "Repay Reminders",
    icon: <Bell />,
    description: "Set up payment reminders"
  },
  {
    id: "repay_monitor",
    label: "Repay Monitor",
    icon: <TrendingUp />,
    description: "Track repayment progress"
  },
  {
    id: "remittance",
    label: "Send Money Home",
    icon: <Globe />,
    description: "Remittance guidance & rates"
  },
  {
    id: "wallet_setup",
    label: "Wallet Optimizer",
    icon: <Wallet />,
    description: "Optimize your sub-wallets"
  },
  {
    id: "exchange_rates",
    label: "Exchange Rates",
    icon: <CreditCard />,
    description: "KES exchange rate info"
  }
];
```

---

## Appendix C — Proactive Nudge Corpus

| Index | Emoji | Message |
|---|---|---|
| 0 | 🏠 | Have you checked your diaspora mortgage health recently? I can run a quick review. |
| 1 | ⏰ | Setting up automatic repay reminders can help you never miss a payment. Want me to help? |
| 2 | 💰 | Your remittance fees could be lower with Lipafo. Let me show you how much you'd save. |
| 3 | 📊 | I can monitor your loan repayments and alert you to any concerns. Interested? |
| 4 | 🎯 | Your sub-wallets could be working harder for you. Let me suggest an optimal allocation. |
| 5 | 💳 | I can show you your salary loan repayment history. Want to see your progress? |

---

*End of Document*
