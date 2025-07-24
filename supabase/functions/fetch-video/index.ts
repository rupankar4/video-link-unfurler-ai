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
      console.log('=== STARTING TERABOX EXTRACTION ===');
      console.log('Input URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.terabox.com/',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      console.log('HTML response length:', html.length);
      
      let videoUrl = null;
      let title = 'TeraBox Video';
      let thumbnail = 'https://via.placeholder.com/400x300/6366f1/white?text=TeraBox+Video';
      
      // === METHOD 1: Extract surl parameter from URL or HTML ===
      console.log('=== METHOD 1: surl Parameter Extraction ===');
      let surl = null;
      
      // Extract from URL path
      const surlFromUrl = url.match(/\/s\/([^\/\?]+)/);
      if (surlFromUrl) {
        surl = surlFromUrl[1];
        console.log('surl extracted from URL:', surl);
      }
      
      // Extract from HTML if not found in URL
      if (!surl) {
        const surlPatterns = [
          /"surl"\s*:\s*"([^"]+)"/i,
          /surl=([^&"'\s]+)/i,
          /shareKey["']?\s*:\s*["']([^"']+)/i
        ];
        
        for (const pattern of surlPatterns) {
          const match = html.match(pattern);
          if (match) {
            surl = match[1];
            console.log('surl extracted from HTML:', surl);
            break;
          }
        }
      }
      
      // === METHOD 2: API Endpoint Calls ===
      if (surl) {
        console.log('=== METHOD 2: API Endpoint Calls ===');
        const apiEndpoints = [
          `https://www.terabox.com/api/download?surl=${surl}`,
          `https://1024terabox.com/api/download?surl=${surl}`,
          `https://www.terabox.com/share/download?surl=${surl}`,
          `https://1024terabox.com/share/download?surl=${surl}`,
          `https://www.terabox.com/api/streaming?surl=${surl}`,
        ];
        
        for (const apiUrl of apiEndpoints) {
          try {
            console.log('Trying API endpoint:', apiUrl);
            const apiResponse = await fetch(apiUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url,
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest',
              }
            });
            
            if (apiResponse.ok) {
              const apiData = await apiResponse.json();
              console.log('API Response keys:', Object.keys(apiData));
              
              if (apiData.list && Array.isArray(apiData.list)) {
                for (const file of apiData.list) {
                  console.log('Processing file from API:', Object.keys(file));
                  if (file.dlink && !file.dlink.includes('.js')) {
                    videoUrl = file.dlink;
                    title = file.server_filename || file.filename || title;
                    console.log('✅ FOUND VIDEO URL via API:', videoUrl);
                    break;
                  }
                }
              }
              
              if (videoUrl) break;
            } else {
              console.log('API endpoint failed:', apiResponse.status);
            }
          } catch (apiError) {
            console.log('API call error:', apiError.message);
          }
        }
      }
      
      // === METHOD 3: window._pvda JavaScript Variable ===
      if (!videoUrl) {
        console.log('=== METHOD 3: window._pvda Extraction ===');
        const _pvdaMatch = html.match(/window\._pvda\s*=\s*({.*?});/s);
        
        if (_pvdaMatch) {
          try {
            console.log('Found window._pvda data');
            const videoData = JSON.parse(_pvdaMatch[1]);
            console.log('_pvda keys:', Object.keys(videoData));
            
            if (videoData.resolutions && Array.isArray(videoData.resolutions)) {
              console.log('Found resolutions array:', videoData.resolutions.length);
              for (const resolution of videoData.resolutions) {
                const url = resolution.url || resolution.download_link;
                if (url && !url.includes('.js') && (url.includes('.mp4') || url.includes('.webm') || url.includes('stream'))) {
                  videoUrl = url;
                  console.log('✅ FOUND VIDEO URL via _pvda:', videoUrl);
                  break;
                }
              }
            }
            
            if (videoData.title) title = videoData.title;
            if (videoData.thumbnail) thumbnail = videoData.thumbnail;
            
          } catch (e) {
            console.log('Failed to parse _pvda:', e.message);
          }
        } else {
          console.log('window._pvda not found');
        }
      }
      
      // === METHOD 4: window.pvda JavaScript Variable ===
      if (!videoUrl) {
        console.log('=== METHOD 4: window.pvda Extraction ===');
        const pvdaMatch = html.match(/window\.pvda\s*=\s*({.*?});/s);
        
        if (pvdaMatch) {
          try {
            console.log('Found window.pvda data');
            const videoData = JSON.parse(pvdaMatch[1]);
            console.log('pvda keys:', Object.keys(videoData));
            
            if (videoData.resolutions && Array.isArray(videoData.resolutions)) {
              for (const resolution of videoData.resolutions) {
                const url = resolution.url || resolution.download_link;
                if (url && !url.includes('.js') && (url.includes('.mp4') || url.includes('.webm') || url.includes('stream'))) {
                  videoUrl = url;
                  console.log('✅ FOUND VIDEO URL via pvda:', videoUrl);
                  break;
                }
              }
            }
          } catch (e) {
            console.log('Failed to parse pvda:', e.message);
          }
        } else {
          console.log('window.pvda not found');
        }
      }
      
      // === METHOD 5: yunData Variable ===
      if (!videoUrl) {
        console.log('=== METHOD 5: yunData Extraction ===');
        const yunDataPatterns = [
          /yunData\s*=\s*({.*?});/s,
          /window\.yunData\s*=\s*({.*?});/s,
          /var\s+yunData\s*=\s*({.*?});/s,
        ];
        
        for (const pattern of yunDataPatterns) {
          const match = html.match(pattern);
          if (match) {
            try {
              const yunData = JSON.parse(match[1]);
              console.log('Found yunData with keys:', Object.keys(yunData));
              
              if (yunData.file_list && Array.isArray(yunData.file_list)) {
                for (const file of yunData.file_list) {
                  const url = file.dlink || file.download_url || file.real_link;
                  if (url && !url.includes('.js') && (url.includes('.mp4') || url.includes('.webm') || url.includes('stream'))) {
                    videoUrl = url;
                    title = file.server_filename || file.filename || title;
                    console.log('✅ FOUND VIDEO URL via yunData:', videoUrl);
                    break;
                  }
                }
              }
              
              if (videoUrl) break;
            } catch (e) {
              console.log('Failed to parse yunData:', e.message);
            }
          }
        }
      }
      
      // === METHOD 6: Script Tag Analysis ===
      if (!videoUrl) {
        console.log('=== METHOD 6: Script Tag Analysis ===');
        const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gis);
        
        if (scriptMatches) {
          for (const script of scriptMatches) {
            const scriptContent = script.replace(/<\/?script[^>]*>/gi, '');
            
            // Look for video URL patterns in scripts
            const videoPatterns = [
              /"dlink"\s*:\s*"([^"]+\.mp4[^"]*)"/g,
              /"download_url"\s*:\s*"([^"]+\.mp4[^"]*)"/g,
              /"stream_url"\s*:\s*"([^"]+)"/g,
              /"real_link"\s*:\s*"([^"]+\.mp4[^"]*)"/g,
            ];
            
            for (const pattern of videoPatterns) {
              const matches = [...scriptContent.matchAll(pattern)];
              for (const match of matches) {
                let candidateUrl = match[1];
                
                if (candidateUrl && !candidateUrl.includes('.js')) {
                  candidateUrl = candidateUrl.replace(/\\u0026/g, '&')
                                           .replace(/\\"/g, '"')
                                           .replace(/\\\//g, '/');
                  
                  if (candidateUrl.includes('.mp4') || candidateUrl.includes('.webm') || candidateUrl.includes('stream')) {
                    videoUrl = candidateUrl;
                    console.log('✅ FOUND VIDEO URL in script:', videoUrl);
                    break;
                  }
                }
              }
              if (videoUrl) break;
            }
            if (videoUrl) break;
          }
        }
      }
      
      // === METHOD 7: Iframe and Embed Detection ===
      if (!videoUrl) {
        console.log('=== METHOD 7: Iframe/Embed Detection ===');
        const iframePatterns = [
          /<iframe[^>]*src=["']([^"']*terabox[^"']*)["']/gi,
          /<embed[^>]*src=["']([^"']*terabox[^"']*)["']/gi,
          /"embed_url"\s*:\s*"([^"]+)"/gi,
        ];
        
        for (const pattern of iframePatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            const embedUrl = match[1];
            if (embedUrl && !embedUrl.includes('.js')) {
              console.log('Found embed URL:', embedUrl);
              // Try to extract from embed URL
              try {
                const embedResponse = await fetch(embedUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': url,
                  }
                });
                
                if (embedResponse.ok) {
                  const embedHtml = await embedResponse.text();
                  const videoMatch = embedHtml.match(/src=["']([^"']*\.mp4[^"']*)["']/i);
                  if (videoMatch) {
                    videoUrl = videoMatch[1];
                    console.log('✅ FOUND VIDEO URL in embed:', videoUrl);
                    break;
                  }
                }
              } catch (e) {
                console.log('Failed to fetch embed URL:', e.message);
              }
            }
          }
          if (videoUrl) break;
        }
      }
      
      // === FINAL VALIDATION ===
      console.log('=== FINAL VALIDATION ===');
      console.log('Extracted videoUrl:', videoUrl);
      
      if (videoUrl) {
        // Strict validation
        const isValidVideo = (
          (videoUrl.includes('.mp4') || videoUrl.includes('.webm') || videoUrl.includes('.m3u8') || videoUrl.includes('stream')) &&
          !videoUrl.includes('.js') &&
          !videoUrl.includes('.css') &&
          !videoUrl.includes('static/node-static') &&
          videoUrl.length > 30
        );
        
        console.log('URL validation check:', {
          hasVideoExtension: videoUrl.includes('.mp4') || videoUrl.includes('.webm') || videoUrl.includes('.m3u8') || videoUrl.includes('stream'),
          notJsFile: !videoUrl.includes('.js'),
          notCssFile: !videoUrl.includes('.css'),
          notStaticFile: !videoUrl.includes('static/node-static'),
          hasMinLength: videoUrl.length > 30,
          isValid: isValidVideo
        });
        
        if (!isValidVideo) {
          console.log('❌ REJECTING invalid URL:', videoUrl);
          videoUrl = null;
        } else {
          console.log('✅ URL PASSED validation');
        }
      }
      
      // Extract title if not found
      if (title === 'TeraBox Video') {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim()
            .replace(/&amp;/g, '&')
            .replace(/\s*-\s*Share Files Online.*$/i, '')
            .trim();
        }
      }
      
      console.log('=== EXTRACTION COMPLETE ===');
      console.log('Final result:', { 
        success: !!videoUrl, 
        videoUrl, 
        title, 
        thumbnail,
        extractionMethods: videoUrl ? 'Success' : 'All methods failed'
      });
      
      return {
        videoUrl: videoUrl,
        title: title,
        thumbnail: thumbnail
      };
    } catch (error) {
      console.error('=== EXTRACTION FAILED ===');
      console.error('Error:', error.message);
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
  if (url.includes('terabox') || url.includes('1024terabox')) return 'terabox';
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
      success: videoData.videoUrl ? true : false,
      platform,
      videoUrl: videoData.videoUrl || undefined,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      error: videoData.videoUrl ? undefined : 'No valid video URL found'
    };

    console.log('Extraction result:', result);

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