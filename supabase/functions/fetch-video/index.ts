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
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const html = await response.text();
      
      // Look for various video URL patterns in TeraBox
      let videoUrl = '';
      
      // Try different patterns to find the video URL
      const patterns = [
        /"videoUrl":"([^"]+)"/,
        /"video_url":"([^"]+)"/,
        /"url":"([^"]*\.mp4[^"]*)"/,
        /src="([^"]*\.mp4[^"]*)"/,
        /https?:\/\/[^"'\s]*\.mp4[^"'\s]*/
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          videoUrl = match[1];
          break;
        }
      }
      
      // If no direct video URL found, try to find download links
      if (!videoUrl) {
        const downloadMatch = html.match(/download[^"]*["']([^"']*\.mp4[^"']*)/i);
        if (downloadMatch && downloadMatch[1]) {
          videoUrl = downloadMatch[1];
        }
      }
      
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      
      return {
        videoUrl: videoUrl || url, // Fallback to original URL if no direct video URL found
        title: titleMatch?.[1]?.trim().replace(/&amp;/g, '&') || 'TeraBox Video',
        thumbnail: videoUrl ? videoUrl.replace(/\.mp4.*$/, '.jpg') : 'https://i.terabox.com/preview.jpg'
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