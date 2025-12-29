# YouTube Content Filter - Ideas & Future Improvements

## Current Status
MVP complete with:
- Home page video classification via Claude Haiku
- Blur overlay with category/reason
- Show/Hide toggle per video
- Shorts auto-blocking
- On/off toggle in popup
- **Filter profiles** (Productive, Learning, Relax, Custom)
- **Custom category selection**
- **Blur-first loading state** (prevents distraction while classifying)
- **Infinite scroll support**
- **Live profile switching** (no page refresh needed)

---

## Planned Improvements

### High Priority

#### Custom Prompt Instructions (Phase C)
- [ ] Let users add personal context to classification
- [ ] Examples: "I'm a programmer", "Learning Spanish", "Researching woodworking"
- [ ] Appended to the classification prompt for better personalization

#### Caching & Performance
- [ ] Cache classifications by video ID (don't re-classify same video)
- [ ] Store in chrome.storage.local with TTL
- [ ] Reduces API costs significantly for repeat visits

### Medium Priority

#### More YouTube Surfaces (from spec Phase 2)
- [ ] Watch page sidebar recommendations
- [ ] Search results page
- [ ] Subscriptions page

#### Channel Whitelist/Blacklist
- [ ] "Always allow this channel" button on overlay
- [ ] "Always block this channel" option
- [ ] Manage lists in options page

#### Keyboard Shortcuts
- [ ] Quick toggle on/off without opening popup
- [ ] Keyboard shortcut to reveal hovered video

### Low Priority / Nice to Have

#### Session Statistics
- [ ] Count of videos filtered this session
- [ ] Show in popup: "12 videos filtered, 3 shown anyway"
- [ ] Daily/weekly stats

#### Cost Tracking
- [ ] Show estimated API cost in popup
- [ ] Track tokens used per session

#### Visual Improvements
- [ ] Custom overlay themes (dark, light, minimal)
- [ ] Adjustable blur intensity
- [ ] Animation when revealing/hiding

#### Export/Import Settings
- [ ] Export profile configurations
- [ ] Share profiles with others
- [ ] Sync across devices (would need backend)

---

## Technical Debt / Refactoring

- [ ] Remove excessive debug logging before production release
- [x] Remove hardcoded API key before public release
- [ ] Add proper error boundaries
- [ ] Unit tests for classification logic
- [ ] E2E tests with mock API

---

## Completed Features

- [x] Preset profiles (Productive, Learning, Relax, Custom)
- [x] Custom category selection (pick which categories to block)
- [x] Quick profile switcher in popup
- [x] Blur-first approach with loading spinner
- [x] Auto-start on page load
- [x] Re-hide button after revealing video
- [x] Infinite scroll detection
- [x] Live profile updates without refresh

---

## Out of Scope (Per Original Spec)

- Mobile app support
- Video content analysis (transcript, frames)
- Cross-device sync
- User accounts / backend

---

## Ideas Backlog

Add new ideas here as they come up:

1. Batch size limit - Don't send more than X videos per API call
2. "Block this channel" button directly on overlay
3. Different blur intensity based on category
4. _____

---

*Last updated: December 2025*
