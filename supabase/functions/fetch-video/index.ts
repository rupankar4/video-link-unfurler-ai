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
      
      // Method 1: Look for window._pvda (NEW PATTERN)
      const _pvdaMatch = html.match(/window\._pvda\s*=\s*({.*?});/s);
      console.log('Looking for window._pvda pattern...');
      console.log('_pvdaMatch found:', !!_pvdaMatch);
      
      if (_pvdaMatch) {
        try {
          console.log('Found window._pvda data');
          const videoDataStr = _pvdaMatch[1];
          console.log('Raw _pvda string length:', videoDataStr.length);
          console.log('First 200 chars of _pvda:', videoDataStr.substring(0, 200));
          
          const videoData = JSON.parse(videoDataStr);
          console.log('Parsed _pvda data keys:', Object.keys(videoData));
          
          // Extract video URL from resolutions (highest quality)
          if (videoData.resolutions && Array.isArray(videoData.resolutions) && videoData.resolutions.length > 0) {
            console.log('Found resolutions array with length:', videoData.resolutions.length);
            console.log('All resolutions:', videoData.resolutions);
            
            const highestQuality = videoData.resolutions[videoData.resolutions.length - 1];
            console.log('Highest quality resolution object:', highestQuality);
            
            videoUrl = highestQuality.url || highestQuality.download_link;
            console.log('Extracted video URL from _pvda resolutions:', videoUrl);
          }
          
          // Extract metadata
          if (videoData.title) title = videoData.title;
          else if (videoData.filename) title = videoData.filename;
          else if (videoData.server_filename) title = videoData.server_filename;
          
          if (videoData.thumbnail) thumbnail = videoData.thumbnail;
          else if (videoData.poster) thumbnail = videoData.poster;
          
        } catch (parseError) {
          console.error('Failed to parse window._pvda data:', parseError);
        }
      }
      
      // Method 2: Look for window.pvda JavaScript variable (FALLBACK)
      if (!videoUrl) {
        const pvdaMatch = html.match(/window\.pvda\s*=\s*({.*?});/s);
        if (pvdaMatch) {
          try {
            console.log('Found window.pvda data (fallback)');
            const videoDataStr = pvdaMatch[1];
            const videoData = JSON.parse(videoDataStr);
            
            console.log('Parsed pvda data keys:', Object.keys(videoData));
            
            // Extract video URL from resolutions (highest quality)
            if (videoData.resolutions && Array.isArray(videoData.resolutions) && videoData.resolutions.length > 0) {
              const highestQuality = videoData.resolutions[videoData.resolutions.length - 1];
              videoUrl = highestQuality.url || highestQuality.download_link;
              console.log('Found video URL from pvda resolutions:', videoUrl);
            }
            
            // Extract metadata
            if (videoData.title) title = videoData.title;
            else if (videoData.filename) title = videoData.filename;
            else if (videoData.server_filename) title = videoData.server_filename;
            
            if (videoData.thumbnail) thumbnail = videoData.thumbnail;
            else if (videoData.poster) thumbnail = videoData.poster;
            
          } catch (parseError) {
            console.error('Failed to parse window.pvda data:', parseError);
          }
        }
      }
      
      // Method 3: Look for API endpoints and AJAX patterns
      if (!videoUrl) {
        console.log('Trying to find API endpoints and AJAX patterns');
        
        // Look for share config or file info API patterns
        const apiPatterns = [
          /shareconfig\?surl=([^"&]+)/gi,
          /file\/info\?url=([^"&]+)/gi,
          /getfileinfo\?([^"&]+)/gi,
          /"surl"\s*:\s*"([^"]+)"/gi,
          /"fs_id"\s*:\s*(\d+)/gi,
        ];
        
        let shareParams = {};
        
        for (const pattern of apiPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            console.log('Found API pattern match:', match[0]);
            
            if (match[0].includes('surl')) {
              shareParams['surl'] = match[1];
            }
            if (match[0].includes('fs_id')) {
              shareParams['fs_id'] = match[1];
            }
          }
        }
        
        console.log('Share parameters found:', shareParams);
        
        // Try to construct API URLs if we have parameters
        if (shareParams['surl']) {
          const apiUrls = [
            `https://www.terabox.com/share/download?surl=${shareParams['surl']}`,
            `https://1024terabox.com/share/download?surl=${shareParams['surl']}`,
            `https://www.terabox.com/api/download?surl=${shareParams['surl']}`,
          ];
          
          console.log('Attempting API calls to:', apiUrls);
          
          for (const apiUrl of apiUrls) {
            try {
              console.log('Trying API call to:', apiUrl);
              const apiResponse = await fetch(apiUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Referer': url,
                  'Accept': 'application/json, text/plain, */*',
                }
              });
              
              if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                console.log('API response received:', Object.keys(apiData));
                
                if (apiData.list && Array.isArray(apiData.list)) {
                  for (const file of apiData.list) {
                    if (file.dlink || file.download_url) {
                      videoUrl = file.dlink || file.download_url;
                      console.log('Found video URL from API:', videoUrl);
                      break;
                    }
                  }
                }
                
                if (videoUrl) break;
              }
            } catch (apiError) {
              console.log('API call failed:', apiError.message);
            }
          }
        }
      }
      
      // Method 4: Look for yunData approach
      if (!videoUrl) {
        console.log('Primary methods failed, trying yunData approach');
        
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
              console.log('Found yunData object with keys:', Object.keys(yunData));
              
              // Look for video URLs in file_list with resolutions
              if (yunData.file_list && Array.isArray(yunData.file_list)) {
                console.log('yunData file_list length:', yunData.file_list.length);
                for (const file of yunData.file_list) {
                  console.log('Processing file:', Object.keys(file));
                  
                  // Check for resolutions array
                  if (file.resolutions && Array.isArray(file.resolutions) && file.resolutions.length > 0) {
                    console.log('Found resolutions in yunData:', file.resolutions.length);
                    const highestRes = file.resolutions[file.resolutions.length - 1];
                    videoUrl = highestRes.url || highestRes.download_link;
                    console.log('Found video URL in yunData resolutions:', videoUrl);
                    break;
                  }
                  // Fallback to direct links
                  if (file.dlink || file.download_url || file.real_link) {
                    videoUrl = file.dlink || file.download_url || file.real_link;
                    console.log('Found video URL in yunData file_list:', videoUrl);
                    break;
                  }
                }
              }
              
              if (videoUrl) break;
            } catch (e) {
              console.log('Failed to parse yunData:', e);
            }
          }
        }
      }
      
      // Method 5: Extract title from HTML if not found in JS data
      if (title === 'TeraBox Video') {
        const titlePatterns = [
          /<title[^>]*>([^<]+)<\/title>/i,
          /"title"\s*:\s*"([^"]+)"/i,
          /"filename"\s*:\s*"([^"]+)"/i,
          /"server_filename"\s*:\s*"([^"]+)"/i,
        ];
        
        for (const pattern of titlePatterns) {
          const titleMatch = html.match(pattern);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim()
              .replace(/&amp;/g, '&')
              .replace(/\s*-\s*Share Files Online.*$/i, '')
              .trim();
            console.log('Extracted title:', title);
            break;
          }
        }
      }
      
      // Method 5: Enhanced fallback extraction methods
      if (!videoUrl) {
        console.log('Trying enhanced fallback extraction methods');
        
        // Look for direct MP4 URLs in script tags with better patterns
        const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gis);
        if (scriptMatches) {
          for (const script of scriptMatches) {
            const scriptContent = script.replace(/<\/?script[^>]*>/gi, '');
            
            // Enhanced video URL patterns
            const videoPatterns = [
              /"dlink"\s*:\s*"([^"]+)"/g,
              /"download_url"\s*:\s*"([^"]+)"/g,
              /"play_url"\s*:\s*"([^"]+)"/g,
              /"real_link"\s*:\s*"([^"]+)"/g,
              /"url"\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/g,
              /"videoUrl"\s*:\s*"([^"]+)"/g,
              /"stream_url"\s*:\s*"([^"]+)"/g,
            ];
            
            for (const pattern of videoPatterns) {
              const matches = [...scriptContent.matchAll(pattern)];
              for (const match of matches) {
                let candidateUrl = match[1];
                
                if (candidateUrl) {
                  // Clean up the URL
                  candidateUrl = candidateUrl.replace(/\\u0026/g, '&')
                                           .replace(/\\"/g, '"')
                                           .replace(/\\\//g, '/');
                  
                  try {
                    candidateUrl = decodeURIComponent(candidateUrl);
                  } catch (e) {
                    // If decoding fails, use the original
                  }
                  
                  // Validate the URL
                  if ((candidateUrl.includes('.mp4') || candidateUrl.includes('stream')) && 
                      candidateUrl.startsWith('http') &&
                      candidateUrl.length > 30 &&
                      !candidateUrl.includes('placeholder') &&
                      !candidateUrl.includes('example.com')) {
                    
                    videoUrl = candidateUrl;
                    console.log('Found video URL with enhanced fallback method:', videoUrl);
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
      
      // Method 6: Direct regex search in HTML for proper video URLs only
      if (!videoUrl) {
        console.log('Trying direct HTML regex search for video URLs');
        const directUrlPatterns = [
          // Look for direct MP4, WebM, M3U8 URLs
          /https?:\/\/[^"\s]*\.mp4(?:\?[^"\s]*)?/gi,
          /https?:\/\/[^"\s]*\.webm(?:\?[^"\s]*)?/gi,
          /https?:\/\/[^"\s]*\.m3u8(?:\?[^"\s]*)?/gi,
          // Look for streaming URLs with video indicators
          /https?:\/\/[^"\s]*\/video\/[^"\s]*\.mp4/gi,
          /https?:\/\/[^"\s]*\/stream\/[^"\s]*\.mp4/gi,
        ];
        
        for (const pattern of directUrlPatterns) {
          const matches = html.match(pattern);
          if (matches && matches.length > 0) {
            for (const match of matches) {
              // Validate that this is actually a video URL, not a JS file
              if (match.length > 50 && 
                  !match.includes('placeholder') && 
                  !match.includes('.js') && 
                  !match.includes('.css') &&
                  !match.includes('static') &&
                  (match.includes('.mp4') || match.includes('.webm') || match.includes('.m3u8') || match.includes('/video/') || match.includes('/stream/'))) {
                videoUrl = match;
                console.log('Found valid video URL with direct regex search:', videoUrl);
                break;
              }
            }
            if (videoUrl) break;
          }
        }
      }
      
      // Method 7: Final validation - reject JS files and static assets
      if (videoUrl) {
        console.log('Final URL validation check...');
        console.log('Current videoUrl:', videoUrl);
        console.log('URL includes .js:', videoUrl.includes('.js'));
        console.log('URL includes .css:', videoUrl.includes('.css'));
        console.log('URL includes static/node-static:', videoUrl.includes('static/node-static'));
        
        if (videoUrl.includes('.js') || videoUrl.includes('.css') || videoUrl.includes('static/node-static')) {
          console.log('REJECTING invalid URL (JS/CSS/static file):', videoUrl);
          videoUrl = null;
        } else {
          console.log('URL passed validation checks');
        }
      }
      
      console.log('Final extraction result:', { videoUrl, title, thumbnail });
      
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