import type { Classification, VideoInfo } from './types';
import { addDebugLog } from './debug';

function log(message: string) {
  console.log('[YTF API]', message);
  addDebugLog('api', message);
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const classifyVideosTool = {
  name: 'classify_videos',
  description:
    'Classify YouTube videos as productive or unproductive. Productive = tutorials, lectures, documentaries, educational content. Unproductive = entertainment, reactions, gaming, drama, clickbait. You MUST return a classification for every video provided.',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
              description: 'The video ID exactly as provided',
            },
            category: {
              type: 'string',
              enum: [
                'tutorial',
                'lecture',
                'documentary',
                'news',
                'entertainment',
                'reaction',
                'gaming',
                'shorts',
                'other',
              ],
            },
            allow: {
              type: 'boolean',
              description: 'true = productive (show), false = unproductive (blur)',
            },
            reason: {
              type: 'string',
              description: 'One sentence explanation',
            },
          },
          required: ['video_id', 'category', 'allow'],
        },
      },
    },
    required: ['classifications'],
  },
};

function buildPrompt(videos: Omit<VideoInfo, 'element'>[]): string {
  const videoList = videos
    .map((v, i) => `${i + 1}. [id: ${v.videoId}] "${v.title}" — ${v.channel}`)
    .join('\n');

  return `Classify these YouTube videos:\n\n${videoList}\n\nUse the classify_videos tool to return your classifications.`;
}

export async function classifyVideos(
  apiKey: string,
  videos: Omit<VideoInfo, 'element'>[]
): Promise<Classification[]> {
  log('classifyVideos called with ' + videos.length + ' videos');

  if (!apiKey || videos.length === 0) {
    log('Skipping - no API key or no videos');
    return [];
  }

  const prompt = buildPrompt(videos);
  // Log first few videos to debug
  const sample = videos.slice(0, 3).map(v => `${v.videoId}: "${v.title}" by ${v.channel}`);
  log('Sample videos: ' + sample.join(' | '));
  console.log('[YTF API] Full prompt:', prompt);

  try {
    log('Fetching from Anthropic API...');
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [classifyVideosTool],
        tool_choice: { type: 'tool', name: 'classify_videos' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    log('Response status: ' + response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log('API ERROR: ' + response.status + ' - ' + errorText.substring(0, 200));
      // Fail-open: return allow=true for all videos
      return videos.map((v) => ({
        video_id: v.videoId,
        category: 'other' as const,
        allow: true,
        reason: 'API error: ' + response.status,
      }));
    }

    const data = await response.json();
    log('Got response, parsing...');

    // Find the tool_use block
    const toolUse = data.content?.find(
      (block: { type: string }) => block.type === 'tool_use'
    );

    if (!toolUse?.input?.classifications) {
      log('ERROR: No classifications in response');
      console.error('[YTF API] Full response:', data);
      // Fail-open
      return videos.map((v) => ({
        video_id: v.videoId,
        category: 'other' as const,
        allow: true,
        reason: 'Parse error - showing by default',
      }));
    }

    const classifications = toolUse.input.classifications as Classification[];
    const blocked = classifications.filter(c => !c.allow).length;
    log('Success! ' + classifications.length + ' videos, ' + blocked + ' blocked');
    return classifications;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log('FETCH ERROR: ' + errMsg);
    console.error('[YTF API] Full error:', error);
    // Fail-open: return allow=true for all videos
    return videos.map((v) => ({
      video_id: v.videoId,
      category: 'other' as const,
      allow: true,
      reason: 'Network error - showing by default',
    }));
  }
}
