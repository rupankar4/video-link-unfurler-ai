import { corsHeaders } from '../_shared/cors.ts';

interface VideoDetails {
  success: boolean;
  videoUrl?: string;
  thumbnail?: string;
  title?: string;
  error?: string;
  platform?: string;
}

// Platform-specific extractors
const extractors = {
  terabox: async (url: string): Promise<Partial<VideoDetails>> => {
    try {
      console.log('Fetching TeraBox page:', url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.terabox.com/',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      const html = await response.text();
      console.log('HTML response length:', html.length);
      
      // Extract title and clean it
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let title = titleMatch?.[1]?.trim().replace(/&amp;/g, '&') || 'TeraBox Video';
      title = title.replace(/\s*-\s*Share Files Online.*$/i, '').trim();
      
      let videoUrl = null;
      let thumbnail = null;
      
      // Method 1: Look for videoInfo in script tags (similar to Puppeteer approach)
      const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gis);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          const scriptContent = script.replace(/<\/?script[^>]*>/gi, '');
          
          // Look for videoInfo patterns
          if (scriptContent.includes('videoInfo') || scriptContent.includes('playUrl')) {
            console.log('Found videoInfo script');
            
            // Extract playUrl pattern
            const playUrlMatch = scriptContent.match(/"playUrl"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/);
            if (playUrlMatch) {
              videoUrl = decodeURIComponent(playUrlMatch[1]);
              console.log('Found playUrl:', videoUrl);
              break;
            }
            
            // Alternative patterns
            const altPatterns = [
              /"url"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/,
              /"dlink"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/,
              /"download_url"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/
            ];
            
            for (const pattern of altPatterns) {
              const match = scriptContent.match(pattern);
              if (match) {
                videoUrl = decodeURIComponent(match[1]);
                console.log('Found video URL with pattern:', videoUrl);
                break;
              }
            }
            
            if (videoUrl) break;
          }
        }
      }
      
      // Method 2: Look for file data in yunData or similar
      const yunDataMatch = html.match(/yunData\s*=\s*({[^}]+})/);
      if (!videoUrl && yunDataMatch) {
        try {
          const yunData = JSON.parse(yunDataMatch[1]);
          if (yunData.file_list && yunData.file_list[0] && yunData.file_list[0].dlink) {
            videoUrl = yunData.file_list[0].dlink;
            console.log('Found yunData link:', videoUrl);
          }
        } catch (e) {
          console.log('Failed to parse yunData:', e);
        }
      }
      
      // Method 3: Look for any .mp4 URLs in the HTML
      if (!videoUrl) {
        const mp4Matches = html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);
        if (mp4Matches && mp4Matches.length > 0) {
          // Filter out obvious non-video URLs
          const validMp4 = mp4Matches.find(url => 
            !url.includes('placeholder') && 
            !url.includes('sample') && 
            url.length > 50 // Likely to be a real download link
          );
          if (validMp4) {
            videoUrl = validMp4;
            console.log('Found mp4 URL:', videoUrl);
          }
        }
      }
      
      // Extract thumbnail
      const thumbPatterns = [
        /thumb_url["']?\s*:\s*["']([^"']+)["']/i,
        /"thumbnail"\s*:\s*"([^"]+)"/i,
        /"cover"\s*:\s*"([^"]+)"/i
      ];
      
      for (const pattern of thumbPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          thumbnail = match[1];
          break;
        }
      }
      
      // Fallback thumbnail
      if (!thumbnail) {
        thumbnail = 'https://via.placeholder.com/400x300/6366f1/white?text=TeraBox+Video';
      }
      
      console.log('Extraction result:', { videoUrl, title, thumbnail });
      
      return {
        videoUrl: videoUrl,
        title: title,
        thumbnail: thumbnail
      };
    } catch (error) {
      throw new Error(`TeraBox extraction failed: ${error.message}`);
    }
  },

  instagram: async (url: string): Promise<Partial<VideoDetails>> => {
    // Instagram requires more complex extraction
    throw new Error('Instagram extraction requires additional setup');
  },

  tiktok: async (url: string): Promise<Partial<VideoDetails>> => {
    // TikTok extraction would go here
    throw new Error('TikTok extraction requires additional setup');
  },

  facebook: async (url: string): Promise<Partial<VideoDetails>> => {
    // Facebook extraction would go here
    throw new Error('Facebook extraction requires additional setup');
  },

  twitter: async (url: string): Promise<Partial<VideoDetails>> => {
    // Twitter extraction would go here
    throw new Error('Twitter extraction requires additional setup');
  },

  reddit: async (url: string): Promise<Partial<VideoDetails>> => {
    // Reddit extraction would go here
    throw new Error('Reddit extraction requires additional setup');
  },

  pinterest: async (url: string): Promise<Partial<VideoDetails>> => {
    // Pinterest extraction would go here
    throw new Error('Pinterest extraction requires additional setup');
  }
};

function detectPlatform(url: string): string {
  if (url.includes('terabox')) return 'terabox';
  if (url.includes('instagram')) return 'instagram';
  if (url.includes('facebook')) return 'facebook';
  if (url.includes('tiktok')) return 'tiktok';
  if (url.includes('x.com') || url.includes('twitter')) return 'twitter';
  if (url.includes('reddit')) return 'reddit';
  if (url.includes('pinterest')) return 'pinterest';
  return 'unknown';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const platform = detectPlatform(url);
    
    if (platform === 'unknown') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported platform' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Extracting video from ${platform}: ${url}`);

    const extractor = extractors[platform as keyof typeof extractors];
    const videoData = await extractor(url);

    const result: VideoDetails = {
      success: true,
      platform,
      ...videoData
    };

    console.log('Extraction successful:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Video extraction error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to extract video details' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});