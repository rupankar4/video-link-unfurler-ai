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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const html = await response.text();
      console.log('HTML response length:', html.length);
      
      // TeraBox often uses JavaScript variables to store file info
      let videoUrl = '';
      
      // Look for common TeraBox patterns in the HTML/JS
      const patterns = [
        // Direct video URLs
        /https?:\/\/[^"'\s]*\.terabox[^"'\s]*\.mp4[^"'\s]*/g,
        /https?:\/\/[^"'\s]*dubox[^"'\s]*\.mp4[^"'\s]*/g,
        // JSON data patterns
        /"dlink":"([^"]*\.mp4[^"]*)"/,
        /"video_url":"([^"]+)"/,
        /"server_filename":"[^"]*\.mp4"/,
        // JavaScript variable patterns
        /window\.yunData\s*=.*?"dlink":"([^"]*\.mp4[^"]*)"/s,
        /fileInfo.*?"dlink":"([^"]*\.mp4[^"]*)"/s
      ];
      
      for (const pattern of patterns) {
        const matches = html.match(pattern);
        if (matches) {
          if (pattern.flags?.includes('g')) {
            // For global patterns, find the first .mp4 URL
            for (const match of matches) {
              if (match.includes('.mp4')) {
                videoUrl = match;
                break;
              }
            }
          } else {
            videoUrl = matches[1] || matches[0];
          }
          if (videoUrl) {
            console.log('Found video URL with pattern:', pattern, 'URL:', videoUrl);
            break;
          }
        }
      }
      
      // Clean up the URL if found
      if (videoUrl) {
        // Decode URL if it's encoded
        try {
          videoUrl = decodeURIComponent(videoUrl);
        } catch (e) {
          // If decoding fails, use original
        }
        
        // Remove any trailing characters that might not be part of the URL
        videoUrl = videoUrl.split('&')[0].split('?')[0];
        if (!videoUrl.endsWith('.mp4')) {
          videoUrl += '.mp4';
        }
      }
      
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      
      // For TeraBox, if we can't extract direct video URL, return null videoUrl
      // so the UI shows thumbnail instead of trying to play the sharing page
      return {
        videoUrl: videoUrl && videoUrl !== url ? videoUrl : null,
        title: titleMatch?.[1]?.trim().replace(/&amp;/g, '&') || 'TeraBox Video',
        thumbnail: 'https://via.placeholder.com/400x300/1f2937/white?text=TeraBox+Video'
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