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
      
      let videoUrl = '';
      let thumbnail = '';
      
      // Try to extract the file ID from the URL for thumbnail
      const fileIdMatch = url.match(/\/s\/([a-zA-Z0-9_-]+)/);
      const fileId = fileIdMatch?.[1];
      
      // Generate a better thumbnail URL if we have file ID
      if (fileId) {
        thumbnail = `https://thumbnail.teraboxapp.com/thumbnail?fid=${fileId}&type=M&ismp4=1`;
      }
      
      // Look for download links in the HTML
      const downloadPatterns = [
        // Look for download buttons or links
        /href="([^"]*download[^"]*\.mp4[^"]*)"/gi,
        /data-url="([^"]*\.mp4[^"]*)"/gi,
        // Look for embedded video sources
        /"([^"]*cdn[^"]*\.mp4[^"]*)"/gi,
        /"([^"]*terabox[^"]*\.mp4[^"]*)"/gi,
        // Look for streaming URLs
        /stream[^"]*["']([^"']*\.mp4[^"']*)/gi
      ];
      
      for (const pattern of downloadPatterns) {
        const matches = Array.from(html.matchAll(pattern));
        for (const match of matches) {
          const potentialUrl = match[1];
          if (potentialUrl && potentialUrl.includes('.mp4') && !potentialUrl.includes('placeholder')) {
            videoUrl = potentialUrl;
            console.log('Found potential video URL:', videoUrl);
            break;
          }
        }
        if (videoUrl) break;
      }
      
      // If no direct URL found, create a download link
      if (!videoUrl && fileId) {
        // TeraBox download URL pattern
        videoUrl = `https://www.terabox.com/api/download?fid=${fileId}&type=M`;
      }
      
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const cleanTitle = titleMatch?.[1]?.trim().replace(/&amp;/g, '&').replace(' - Share Files Online & Send Larges Files with TeraBox', '') || 'TeraBox Video';
      
      return {
        videoUrl: videoUrl || url,
        title: cleanTitle,
        thumbnail: thumbnail || 'https://via.placeholder.com/400x300/6366f1/white?text=Video+Preview'
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