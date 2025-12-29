# YouTube Content Filter Extension — Technical Specification

**Version:** 1.1  
**Date:** December 2024  
**Status:** Ready for Implementation

---

## A Note to the Implementing Agent

This spec represents our best current thinking, but **you are empowered to make better choices**. If you see a smarter architecture, cleaner abstraction, or more robust approach than what's described here — go for it. 

**What's fixed (the "contract"):**
- The user-facing behavior (videos get classified and blurred)
- The LLM integration approach (Anthropic API with tool use)
- The core UX (blur overlay with "show anyway" button)
- Fail-open error handling (never break YouTube)

**What's flexible (implementation details):**
- File structure, naming conventions, code organization
- Specific DOM selectors (these change frequently anyway)
- State management approach
- Exact CSS styling
- Batching/debouncing strategies
- Anything in the "Reference Implementation" sections

When in doubt, optimize for: **maintainability > simplicity > performance > spec compliance**.

---

## 1. Project Goals

### What We're Building
A Chrome extension that uses Claude (Haiku) to automatically classify YouTube videos and blur/hide unproductive content before the user watches it.

### Why It Matters
YouTube's algorithm optimizes for engagement, not learning. Users who want to use YouTube intentionally face constant friction. This extension shifts the default from "resist distractions" to "opt into distractions."

### Success Looks Like
- User spends less time on content they didn't intend to watch
- User trusts the filtering decisions (because they're explained)
- Extension doesn't break YouTube or slow it down noticeably
- Setup takes < 1 minute (just paste API key)

### Design Principles
1. **Intentional by default** — Blur first, user can override
2. **Explainable** — Every filter decision has a visible reason
3. **User sovereignty** — "Show anyway" always available
4. **Fail-open** — If anything breaks, show the content (never block YouTube)
5. **Low friction** — Works out of the box with sensible defaults

---

## 2. Requirements

### Must Have (MVP)
- [ ] Classify videos on YouTube home page using Claude Haiku
- [ ] Blur videos classified as unproductive
- [ ] Show category + reason on blurred videos
- [ ] "Show anyway" button to reveal blurred videos
- [ ] Popup UI to enter/save Anthropic API key
- [ ] On/off toggle
- [ ] Fail-open on any error (show video if classification fails)
- [ ] Block Shorts entirely without API call (known time-sink)

### Should Have (Phase 2)
- [ ] Watch page sidebar recommendations
- [ ] Search results page
- [ ] Basic session stats in popup

### Nice to Have (Future)
- [ ] Channel whitelist ("always allow this channel")
- [ ] Classification caching (don't re-classify same video)
- [ ] Category preference customization
- [ ] Heuristics to reduce API calls

### Out of Scope
- Mobile app support
- Video content analysis (transcript, frames)
- Cross-device sync
- User accounts / backend

---

## 3. Core Architecture

### High-Level Flow

```
User loads YouTube
       ↓
Content script extracts visible videos (title, channel, video ID)
       ↓
Background worker batches videos → Anthropic API (tool use)
       ↓
Claude classifies each video (category + allow/block + reason)
       ↓
Content script applies blur overlay to blocked videos
       ↓
User can click "Show anyway" to reveal
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Manifest version | v3 | Required for new extensions |
| LLM | Claude Haiku | Fast, cheap, good enough for this task |
| Structured output | Tool use | Reliable JSON schema enforcement |
| Storage | chrome.storage.local | Simple, no backend needed |
| Batching | Yes, all visible videos | Reduces API calls, context window is plenty big |
| Fail behavior | Fail-open | Never break the user's YouTube experience |

---

## 4. LLM Integration (Required Approach)

This is the most critical part of the spec. The tool definition ensures Claude returns structured, parseable classifications.

### Model
```
claude-haiku-4-5-20251001
```

### Tool Definition

```javascript
{
  name: "classify_videos",
  description: "Classify YouTube videos as productive or unproductive. Productive = tutorials, lectures, documentaries, educational content. Unproductive = entertainment, reactions, gaming, drama, clickbait. You MUST return a classification for every video provided.",
  input_schema: {
    type: "object",
    properties: {
      classifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            video_id: { 
              type: "string",
              description: "The video ID exactly as provided"
            },
            category: { 
              type: "string",
              enum: ["tutorial", "lecture", "documentary", "news", "entertainment", "reaction", "gaming", "shorts", "other"]
            },
            allow: { 
              type: "boolean",
              description: "true = productive (show), false = unproductive (blur)"
            },
            reason: { 
              type: "string",
              description: "One sentence explanation"
            }
          },
          required: ["video_id", "category", "allow"]
        }
      }
    },
    required: ["classifications"]
  }
}
```

### Prompt Structure

Send videos in a clear format that maps to the response:

```
Classify these YouTube videos:

1. [id: VIDEO_ID_HERE] "Video Title" — Channel Name
2. [id: VIDEO_ID_HERE] "Video Title" — Channel Name
...

Use the classify_videos tool to return your classifications.
```

### Forcing Tool Use

Use `tool_choice: { type: "tool", name: "classify_videos" }` to ensure Claude always responds with the tool rather than plain text.

### Response Parsing

The response will contain a `tool_use` content block. Extract `input.classifications` from it. Each classification has `video_id` that maps back to your original videos.

---

## 5. Default Classification Rules

These are the **default** behaviors. User customization is a future feature.

| Category | Action | Why |
|----------|--------|-----|
| tutorial | ✅ Show | Skill-building |
| lecture | ✅ Show | Deep learning |
| documentary | ✅ Show | Informative |
| news | ✅ Show | Awareness |
| entertainment | ❌ Blur | Time-sink |
| reaction | ❌ Blur | Low signal |
| gaming | ❌ Blur | Entertainment |
| shorts | ❌ Blur | High addiction |
| other | ❌ Blur | Default cautious |

**Shorts special case:** Block Shorts without calling the API. They're a known productivity killer and easy to detect (URL pattern `/shorts/` or specific DOM elements).

---

## 6. User Interface Requirements

### Blur Overlay (on blocked videos)

**Must include:**
- Visual blur/obscure of the thumbnail
- Category label (e.g., "Entertainment")
- Brief reason (from LLM)
- "Show Anyway" button

**Behavior:**
- Clicking "Show Anyway" removes overlay for that video (session only)
- Overlay should not break YouTube's layout
- Should work on different video card sizes (home vs sidebar)

### Popup

**Must include:**
- API key input (masked/password field)
- Save button (or auto-save)
- On/off toggle
- Status indicator (working / error / disabled)

**Nice to have:**
- Session stats (X videos filtered)
- Link to options page (future)

---

## 7. Error Handling

### The Golden Rule: Fail Open

If ANYTHING goes wrong, show the video. Never block content due to an error.

### Specific Cases

| Error | Handling |
|-------|----------|
| No API key configured | Show all videos, prompt in popup |
| API request fails | Show all videos in that batch |
| API returns malformed response | Show all videos in that batch |
| Can't parse video from DOM | Skip that video, continue others |
| Rate limited | Show videos, maybe retry later |

### Logging

Log errors to console for debugging. Consider a debug mode that shows classification decisions.

---

## 8. Implementation Phases

### Phase 1: MVP
Focus exclusively on:
- Home page filtering
- Core classification flow
- Basic popup with API key

Ship this first. Get it working end-to-end before expanding scope.

### Phase 2: More Surfaces
- Watch page sidebar
- Search results
- Handle YouTube's SPA navigation (page doesn't fully reload)

### Phase 3: User Control
- Channel whitelist
- Persistent preferences
- Options page

---

## 9. Reference Implementation

> **Note:** This section contains suggested approaches, not requirements. Feel free to deviate if you have better ideas.

### Suggested File Structure

```
youtube-content-filter/
├── manifest.json
├── background.js          # Service worker, API calls
├── content.js             # DOM observation, overlay injection
├── content.css            # Overlay styles
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/
    └── ...
```

### Suggested DOM Observation Approach

Use MutationObserver to detect new videos (infinite scroll). Debounce to batch API calls. Track processed video IDs to avoid re-classification.

YouTube's DOM structure changes periodically. You'll need to inspect the current DOM structure and write selectors that extract:
- Video ID (from link href)
- Title
- Channel name

### Suggested Overlay Approach

Inject a positioned overlay element as a child of each video card. The overlay should cover the thumbnail area.

### Suggested Message Passing

Content script ↔ Background worker communication via `chrome.runtime.sendMessage`. Something like:

```javascript
// Content → Background
{ type: 'CLASSIFY', videos: [...] }

// Background → Content  
{ type: 'RESULTS', classifications: [...] }
```

---

## 10. Testing Checklist

### Manual Testing (MVP)

- [ ] Fresh install: popup prompts for API key
- [ ] After entering key: home page videos are classified
- [ ] Educational videos remain visible
- [ ] Entertainment videos are blurred with reason shown
- [ ] "Show anyway" reveals the video
- [ ] Scrolling loads more videos → they get classified
- [ ] Toggle off → all videos visible
- [ ] Toggle on → filtering resumes
- [ ] Invalid API key → fails gracefully, videos shown
- [ ] Network offline → fails gracefully, videos shown

---

## Appendix: Example API Exchange

### Request to Anthropic

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "tools": [{ "name": "classify_videos", "...": "..." }],
  "tool_choice": { "type": "tool", "name": "classify_videos" },
  "messages": [{
    "role": "user",
    "content": "Classify these YouTube videos:\n\n1. [id: abc123] \"Python Tutorial for Beginners\" — Corey Schafer\n2. [id: def456] \"I Spent 50 Hours Buried Alive\" — MrBeast"
  }]
}
```

### Response from Anthropic

```json
{
  "content": [{
    "type": "tool_use",
    "name": "classify_videos",
    "input": {
      "classifications": [
        {
          "video_id": "abc123",
          "category": "tutorial",
          "allow": true,
          "reason": "Programming tutorial for skill development"
        },
        {
          "video_id": "def456", 
          "category": "entertainment",
          "allow": false,
          "reason": "Entertainment stunt video"
        }
      ]
    }
  }],
  "stop_reason": "tool_use"
}
```

---

## Questions for the Implementing Agent

If you need clarification on intent, here's how to think about it:

1. **"Should I do X or Y?"** → Which is simpler to maintain? Do that.
2. **"The spec says X but Y would be better"** → Do Y, document why.
3. **"This YouTube selector doesn't work"** → Expected. Inspect current DOM and update.
4. **"Should I add feature Z?"** → Is it in MVP scope? If not, skip it for now.

---

*End of Specification*
