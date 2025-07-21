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
      
      // Enhanced script parsing with more comprehensive patterns
      const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gis);
      if (scriptMatches) {
        console.log(`Found ${scriptMatches.length} script tags`);
        
        for (let i = 0; i < scriptMatches.length; i++) {
          const script = scriptMatches[i];
          const scriptContent = script.replace(/<\/?script[^>]*>/gi, '');
          
          // Log scripts that might contain video data
          if (scriptContent.includes('videoInfo') || 
              scriptContent.includes('playUrl') ||
              scriptContent.includes('dlink') ||
              scriptContent.includes('file_list') ||
              scriptContent.includes('.mp4')) {
            console.log(`Analyzing script ${i + 1}: Contains potential video data`);
          }
          
          // Enhanced pattern matching
          const videoPatterns = [
            // Direct playUrl patterns
            /"playUrl"\s*:\s*"([^"]+)"/g,
            /"play_url"\s*:\s*"([^"]+)"/g,
            
            // Download link patterns
            /"dlink"\s*:\s*"([^"]+)"/g,
            /"download_url"\s*:\s*"([^"]+)"/g,
            /"real_link"\s*:\s*"([^"]+)"/g,
            
            // Generic URL patterns
            /"url"\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/g,
            /"src"\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/g,
            
            // TeraBox specific patterns
            /"video_url"\s*:\s*"([^"]+)"/g,
            /"stream_url"\s*:\s*"([^"]+)"/g,
            
            // CDN patterns
            /https?:\/\/[a-zA-Z0-9.-]+\.terabox[^"'\s]*\.mp4[^"'\s]*/g,
            /https?:\/\/[a-zA-Z0-9.-]+\.dubox[^"'\s]*\.mp4[^"'\s]*/g,
            /https?:\/\/[a-zA-Z0-9.-]+\.baidupcs[^"'\s]*\.mp4[^"'\s]*/g,
          ];
          
          for (const pattern of videoPatterns) {
            const matches = [...scriptContent.matchAll(pattern)];
            for (const match of matches) {
              let candidateUrl = match[1];
              
              // Clean up the URL
              if (candidateUrl) {
                candidateUrl = candidateUrl.replace(/\\u0026/g, '&').replace(/\\"/g, '"');
                candidateUrl = decodeURIComponent(candidateUrl);
                
                // Validate it's a proper video URL
                if (candidateUrl.includes('.mp4') && 
                    candidateUrl.startsWith('http') &&
                    candidateUrl.length > 30 &&
                    !candidateUrl.includes('placeholder')) {
                  
                  videoUrl = candidateUrl;
                  console.log('Found video URL with pattern:', pattern.source.slice(0, 50) + '...');
                  console.log('Video URL:', videoUrl);
                  break;
                }
              }
            }
            if (videoUrl) break;
          }
          
          if (videoUrl) break;
        }
      }
      
      // Method 2: Enhanced yunData parsing
      if (!videoUrl) {
        const yunDataPatterns = [
          /yunData\s*=\s*(\{.*?\})/s,
          /window\.yunData\s*=\s*(\{.*?\})/s,
          /var\s+yunData\s*=\s*(\{.*?\})/s,
        ];
        
        for (const pattern of yunDataPatterns) {
          const match = html.match(pattern);
          if (match) {
            try {
              const yunData = JSON.parse(match[1]);
              console.log('Found yunData object');
              
              // Look for video URLs in various places in yunData
              if (yunData.file_list && Array.isArray(yunData.file_list)) {
                for (const file of yunData.file_list) {
                  if (file.dlink || file.download_url || file.real_link) {
                    videoUrl = file.dlink || file.download_url || file.real_link;
                    console.log('Found video URL in yunData.file_list:', videoUrl);
                    break;
                  }
                }
              }
              
              if (!videoUrl && yunData.video_info) {
                videoUrl = yunData.video_info.play_url || yunData.video_info.url;
                if (videoUrl) {
                  console.log('Found video URL in yunData.video_info:', videoUrl);
                }
              }
              
              if (videoUrl) break;
            } catch (e) {
              console.log('Failed to parse yunData:', e);
            }
          }
        }
      }
      
      // Method 3: Enhanced direct URL extraction
      if (!videoUrl) {
        console.log('Searching for direct MP4 URLs in HTML...');
        
        // More comprehensive MP4 URL patterns
        const mp4Patterns = [
          /https?:\/\/[a-zA-Z0-9.-]+\.terabox[^"'\s]*\.mp4[^"'\s]*/g,
          /https?:\/\/[a-zA-Z0-9.-]+\.dubox[^"'\s]*\.mp4[^"'\s]*/g,
          /https?:\/\/[a-zA-Z0-9.-]+\.baidupcs[^"'\s]*\.mp4[^"'\s]*/g,
          /https?:\/\/[^"'\s]+\.mp4(?:\?[^"'\s]*)?/g,
        ];
        
        for (const pattern of mp4Patterns) {
          const matches = [...html.matchAll(pattern)];
          console.log(`Pattern found ${matches.length} matches`);
          
          for (const match of matches) {
            const candidateUrl = match[0];
            
            // Enhanced validation
            if (candidateUrl.length > 50 && 
                !candidateUrl.includes('placeholder') && 
                !candidateUrl.includes('sample') &&
                !candidateUrl.includes('preview') &&
                (candidateUrl.includes('terabox') || 
                 candidateUrl.includes('dubox') || 
                 candidateUrl.includes('baidupcs') ||
                 candidateUrl.includes('cdn'))) {
              
              videoUrl = candidateUrl;
              console.log('Found valid MP4 URL:', videoUrl);
              break;
            }
          }
          
          if (videoUrl) break;
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