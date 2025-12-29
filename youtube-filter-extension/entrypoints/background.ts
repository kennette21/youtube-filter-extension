import { classifyVideos } from '@/utils/api';
import { getApiKey, isEnabled } from '@/utils/storage';
import { addDebugLog } from '@/utils/debug';
import type { Classification, Message, VideoInfo } from '@/utils/types';

function log(message: string) {
  console.log('[YTF Background]', message);
  addDebugLog('background', message);
}

export default defineBackground(() => {
  log('Background service started');

  // Listen for messages from content script
  browser.runtime.onMessage.addListener(
    (
      message: Message,
      _sender: unknown,
      sendResponse: (response: { type: string; classifications?: Classification[]; settings?: { apiKey: string; enabled: boolean } }) => void
    ) => {
      if (message.type === 'CLASSIFY') {
        log('Received ' + message.videos.length + ' videos to classify');
        handleClassify(message.videos).then((classifications) => {
          const blocked = classifications.filter(c => !c.allow).length;
          log('Classified: ' + blocked + '/' + classifications.length + ' blocked');
          sendResponse({ type: 'RESULTS', classifications });
        });
        return true; // Indicates async response
      }

      if (message.type === 'GET_SETTINGS') {
        Promise.all([getApiKey(), isEnabled()]).then(([apiKey, enabled]) => {
          sendResponse({ type: 'SETTINGS', settings: { apiKey, enabled } });
        });
        return true;
      }

      return false;
    }
  );
});

async function handleClassify(
  videos: Omit<VideoInfo, 'element'>[]
): Promise<Classification[]> {
  const [apiKey, enabled] = await Promise.all([getApiKey(), isEnabled()]);

  // If disabled or no API key, allow all videos
  if (!enabled) {
    log('Filtering disabled, allowing all');
    return videos.map((v) => ({
      video_id: v.videoId,
      category: 'other' as const,
      allow: true,
      reason: 'Filtering disabled',
    }));
  }

  if (!apiKey) {
    log('No API key, allowing all');
    return videos.map((v) => ({
      video_id: v.videoId,
      category: 'other' as const,
      allow: true,
      reason: 'No API key configured',
    }));
  }

  // Call Anthropic API
  log('Calling Anthropic API...');
  const result = await classifyVideos(apiKey, videos);
  return result;
}
