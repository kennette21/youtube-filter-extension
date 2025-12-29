import type { Classification, VideoInfo, VideoCategory } from '@/utils/types';
import { addDebugLog } from '@/utils/debug';
import { getBlockedCategories } from '@/utils/storage';

function log(message: string) {
  console.log('[YTF]', message);
  addDebugLog('content', message);
}

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  main() {
    log('Content script loaded on: ' + window.location.href);

    // Track processed videos to avoid re-classification
    const processedVideos = new Set<string>();
    // Track videos shown by user choice
    const userShownVideos = new Set<string>();
    // Store classifications for re-applying after profile change
    const classificationCache = new Map<string, Classification>();
    // Store element references by video ID
    const elementCache = new Map<string, HTMLElement>();
    // Pending videos waiting for classification
    let pendingVideos: VideoInfo[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // Current blocked categories
    let blockedCategories: VideoCategory[] = [];

    // Load initial blocked categories and then start scanning
    getBlockedCategories().then((cats) => {
      blockedCategories = cats;
      log('Loaded blocked categories: ' + cats.join(', '));
      // Start initial scan after categories are loaded
      scanForVideos();
    });

    // Listen for storage changes to update blocked categories
    browser.storage.onChanged.addListener((changes) => {
      if (changes.profile || changes.customBlockedCategories) {
        getBlockedCategories().then((cats) => {
          blockedCategories = cats;
          log('Updated blocked categories: ' + cats.join(', '));
          // Re-apply overlays with new settings
          reapplyOverlays();
        });
      }
    });

    // Inject styles for overlay
    injectStyles();

    // Start observing with throttling
    let scanScheduled = false;
    const observer = new MutationObserver(() => {
      if (!scanScheduled) {
        scanScheduled = true;
        setTimeout(() => {
          scanForVideos();
          scanScheduled = false;
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial scan
    setTimeout(scanForVideos, 500);
    // Periodic re-scan for infinite scroll (catches lazy-loaded content)
    setInterval(scanForVideos, 2000);

    // Handle YouTube SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Clear caches on navigation
        processedVideos.clear();
        classificationCache.clear();
        elementCache.clear();
        setTimeout(scanForVideos, 500);
      }
    }).observe(document, { subtree: true, childList: true });

    function reapplyOverlays() {
      // Remove existing overlays (but not loading overlays - those are for pending videos)
      document.querySelectorAll('.ytf-overlay, .ytf-hide-btn').forEach((el) => el.remove());

      // Re-apply based on new settings
      for (const [videoId, classification] of classificationCache) {
        const element = elementCache.get(videoId);
        if (element && !userShownVideos.has(videoId)) {
          if (shouldBlock(classification.category)) {
            applyOverlay(element, classification);
          }
        }
      }
    }

    function shouldBlock(category: VideoCategory): boolean {
      return blockedCategories.includes(category);
    }

    function scanForVideos() {
      // Find video cards on the page
      const videoCards = document.querySelectorAll(
        'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer'
      );

      const newVideos: VideoInfo[] = [];

      videoCards.forEach((card) => {
        const videoInfo = extractVideoInfo(card as HTMLElement);
        if (!videoInfo) return;

        // Skip if we couldn't extract title (might load later via lazy loading)
        if (videoInfo.title === 'Unknown Title') return;

        // Skip if already processed
        if (processedVideos.has(videoInfo.videoId)) return;

        processedVideos.add(videoInfo.videoId);
        elementCache.set(videoInfo.videoId, videoInfo.element);

        // Check if it's a Short - block immediately without API call
        if (isShort(videoInfo, card as HTMLElement)) {
          const classification: Classification = {
            video_id: videoInfo.videoId,
            category: 'shorts',
            allow: false,
            reason: 'Shorts are blocked to reduce distractions',
          };
          classificationCache.set(videoInfo.videoId, classification);
          if (shouldBlock('shorts')) {
            applyOverlay(videoInfo.element, classification);
          }
        } else {
          // Apply loading overlay immediately (blur-first approach)
          applyLoadingOverlay(videoInfo.element, videoInfo.videoId);
          newVideos.push(videoInfo);
        }
      });

      if (newVideos.length > 0) {
        log('Queuing ' + newVideos.length + ' new videos for classification');
        pendingVideos.push(...newVideos);
        debouncedClassify();
      }
    }

    function applyLoadingOverlay(element: HTMLElement, videoId: string) {
      // Don't apply if user already chose to show this video
      if (userShownVideos.has(videoId)) return;

      // Check if already has any overlay
      if (element.querySelector('.ytf-overlay, .ytf-loading-overlay')) return;

      // Make container relative for positioning
      element.style.position = 'relative';

      const overlay = document.createElement('div');
      overlay.className = 'ytf-loading-overlay';
      overlay.setAttribute('data-video-id', videoId);
      overlay.innerHTML = `
        <div class="ytf-loading-content">
          <div class="ytf-loading-spinner"></div>
          <div class="ytf-loading-text">Classifying...</div>
        </div>
      `;

      element.appendChild(overlay);
    }

    function removeLoadingOverlay(videoId: string) {
      const overlay = document.querySelector(`.ytf-loading-overlay[data-video-id="${videoId}"]`);
      if (overlay) {
        overlay.remove();
      }
    }

    function debouncedClassify() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (pendingVideos.length === 0) return;

        const videosToClassify = [...pendingVideos];
        pendingVideos = [];

        // Send to background for classification
        const videosData = videosToClassify.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          channel: v.channel,
        }));

        log('Sending ' + videosData.length + ' videos to API');

        try {
          const response = await browser.runtime.sendMessage({
            type: 'CLASSIFY',
            videos: videosData,
          });

          if (response?.classifications) {
            const blocked = response.classifications.filter((c: Classification) => !c.allow).length;
            log('Got ' + response.classifications.length + ' results, ' + blocked + ' blocked');
            applyClassifications(videosToClassify, response.classifications);
          } else {
            log('No classifications in response');
          }
        } catch (error) {
          log('ERROR: ' + (error as Error).message);
          console.error('[YTF] Classification error:', error);
          // Fail-open: don't apply any overlays
        }
      }, 300);
    }

    function extractVideoInfo(card: HTMLElement): VideoInfo | null {
      // Try multiple selectors for the video link
      const linkElement = card.querySelector('a#video-title-link')
        || card.querySelector('a#video-title')
        || card.querySelector('a[href*="/watch?v="]')
        || card.querySelector('ytd-thumbnail a');

      const href = linkElement?.getAttribute('href');

      if (!href) {
        return null;
      }

      // Extract video ID
      const videoIdMatch = href.match(/\/watch\?v=([^&]+)/) || href.match(/\/shorts\/([^?]+)/);
      if (!videoIdMatch) {
        return null;
      }
      const videoId = videoIdMatch[1];

      // Get title - try MANY selectors since YouTube changes often
      let title = 'Unknown Title';
      const titleSelectors = [
        '#video-title',
        '#video-title-link',
        'a#video-title',
        'yt-formatted-string#video-title',
        '[id="video-title"]',
        'h3 a',
        'h3 yt-formatted-string',
        'span#video-title',
        '.title',
      ];
      for (const sel of titleSelectors) {
        const el = card.querySelector(sel);
        const text = el?.textContent?.trim() || el?.getAttribute('title');
        if (text && text.length > 0 && text !== 'Unknown Title') {
          title = text;
          break;
        }
      }

      // Also try the title attribute on the link
      if (title === 'Unknown Title' && linkElement) {
        const linkTitle = linkElement.getAttribute('title');
        if (linkTitle) title = linkTitle;
      }

      // Get channel name - try multiple selectors
      let channel = 'Unknown Channel';
      const channelSelectors = [
        'ytd-channel-name #text',
        'ytd-channel-name yt-formatted-string',
        '#channel-name #text',
        '#channel-name yt-formatted-string',
        '#channel-name',
        '.ytd-channel-name',
        'a.yt-formatted-string[href*="/@"]',
        'a[href*="/@"]',
        '#text.ytd-channel-name',
      ];
      for (const sel of channelSelectors) {
        const el = card.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text && text.length > 0 && text !== 'Unknown Channel') {
          channel = text;
          break;
        }
      }

      // Debug: log what we found in the card's HTML if extraction fails
      if (title === 'Unknown Title' || channel === 'Unknown Channel') {
        console.log('[YTF] Extraction incomplete for', videoId);
        console.log('[YTF] Card HTML snippet:', card.innerHTML.substring(0, 500));
      }

      // Find the thumbnail container to overlay
      const thumbnail = card.querySelector('ytd-thumbnail') as HTMLElement
        || card.querySelector('#thumbnail') as HTMLElement
        || card.querySelector('#dismissible') as HTMLElement;
      const element = thumbnail || card;

      return { videoId, title, channel, element };
    }

    function isShort(video: VideoInfo, card: HTMLElement): boolean {
      // Check URL for /shorts/
      const links = card.querySelectorAll('a');
      for (const link of links) {
        if (link.href.includes('/shorts/')) return true;
      }

      // Check for Shorts badge/overlay
      if (card.querySelector('[overlay-style="SHORTS"]')) return true;

      // Check for short video indicator in the UI
      const overlays = card.querySelectorAll('ytd-thumbnail-overlay-time-status-renderer');
      for (const overlay of overlays) {
        if (overlay.getAttribute('overlay-style') === 'SHORTS') return true;
      }

      return false;
    }

    function applyClassifications(
      videos: VideoInfo[],
      classifications: Classification[]
    ) {
      const classificationMap = new Map(
        classifications.map((c) => [c.video_id, c])
      );

      let blocked = 0;
      let allowed = 0;
      for (const video of videos) {
        const classification = classificationMap.get(video.videoId);

        // Remove loading overlay first
        removeLoadingOverlay(video.videoId);

        if (classification) {
          // Cache the classification for later
          classificationCache.set(video.videoId, classification);
          elementCache.set(video.videoId, video.element);

          // Check if this category should be blocked based on user's profile
          if (shouldBlock(classification.category)) {
            applyOverlay(video.element, classification);
            blocked++;
          } else {
            allowed++;
          }
        }
      }
      log('Classified: ' + blocked + ' blocked, ' + allowed + ' allowed');
    }

    function applyOverlay(element: HTMLElement, classification: Classification) {
      // Don't overlay if user already chose to show
      if (userShownVideos.has(classification.video_id)) return;

      // Check if already has overlay
      if (element.querySelector('.ytf-overlay')) return;

      // Make container relative for positioning
      element.style.position = 'relative';

      const overlay = document.createElement('div');
      overlay.className = 'ytf-overlay';
      overlay.innerHTML = `
        <div class="ytf-overlay-content">
          <div class="ytf-category">${formatCategory(classification.category)}</div>
          <div class="ytf-reason">${classification.reason || 'Unproductive content'}</div>
          <button class="ytf-show-btn">Show Anyway</button>
        </div>
      `;

      // Handle "Show Anyway" click
      const btn = overlay.querySelector('.ytf-show-btn');
      btn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        userShownVideos.add(classification.video_id);
        overlay.remove();

        // Add a small "Hide" button to re-hide
        const hideBtn = document.createElement('button');
        hideBtn.className = 'ytf-hide-btn';
        hideBtn.textContent = 'Hide';
        hideBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          userShownVideos.delete(classification.video_id);
          hideBtn.remove();
          applyOverlay(element, classification);
        });
        element.appendChild(hideBtn);
      });

      element.appendChild(overlay);
    }

    function formatCategory(category: string): string {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }

    function injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .ytf-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 12px;
        }

        .ytf-overlay-content {
          text-align: center;
          color: white;
          padding: 16px;
          max-width: 90%;
        }

        .ytf-category {
          font-size: 14px;
          font-weight: 600;
          color: #f87171;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ytf-reason {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 12px;
          line-height: 1.4;
        }

        .ytf-show-btn {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ytf-show-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .ytf-hide-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          z-index: 100;
        }

        .ytf-hide-btn:hover {
          background: rgba(0, 0, 0, 0.9);
        }

        /* Loading overlay */
        .ytf-loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 12px;
        }

        .ytf-loading-content {
          text-align: center;
          color: white;
        }

        .ytf-loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: ytf-spin 0.8s linear infinite;
          margin: 0 auto 8px;
        }

        @keyframes ytf-spin {
          to { transform: rotate(360deg); }
        }

        .ytf-loading-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
        }
      `;
      document.head.appendChild(style);
    }
  },
});
