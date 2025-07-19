import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Link, Play, Loader2, CheckCircle, AlertCircle, Globe } from 'lucide-react';

interface VideoDetails {
  success: boolean;
  videoUrl?: string;
  thumbnail?: string;
  title?: string;
  error?: string;
  platform?: string;
}

export function VideoDownloader() {
  const [url, setUrl] = useState('');
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const platformColors: Record<string, string> = {
    instagram: 'bg-platform-instagram',
    tiktok: 'bg-platform-tiktok border border-foreground',
    facebook: 'bg-platform-facebook',
    twitter: 'bg-platform-twitter',
    reddit: 'bg-platform-reddit',
    pinterest: 'bg-platform-pinterest',
    terabox: 'bg-platform-terabox',
  };

  const detectPlatform = (url: string): string => {
    if (url.includes('terabox')) return 'terabox';
    if (url.includes('instagram')) return 'instagram';
    if (url.includes('facebook')) return 'facebook';
    if (url.includes('tiktok')) return 'tiktok';
    if (url.includes('x.com') || url.includes('twitter')) return 'twitter';
    if (url.includes('reddit')) return 'reddit';
    if (url.includes('pinterest')) return 'pinterest';
    return 'unknown';
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const platform = detectPlatform(url);
      
      if (platform === 'unknown') {
        toast({
          title: "Unsupported Platform",
          description: "This platform is not supported yet",
          variant: "destructive",
        });
        return;
      }

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-video', {
        body: { url }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch video details');
      }

      const response = data as VideoDetails;

      setVideoDetails(response);
      setProgress(100);
      
      toast({
        title: "Success!",
        description: "Video details extracted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to extract video details",
        variant: "destructive",
      });
      setVideoDetails({
        success: false,
        error: "Failed to extract video details"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (videoDetails?.videoUrl) {
      toast({
        title: "Download Started",
        description: "Your video download has begun",
      });
      // Implement actual download logic here
    }
  };

  const currentPlatform = url ? detectPlatform(url) : null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-primary opacity-10" />
      
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4 animate-glow-pulse">
              <Download className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Video Downloader
            </h1>
            <p className="text-muted-foreground text-lg">
              Download videos from Instagram, TikTok, Facebook, and more
            </p>
          </div>

          {/* Main Form */}
          <Card className="backdrop-blur-lg bg-card/50 border-border/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Paste Video URL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="https://www.instagram.com/p/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-input/50 border-border/50 focus:border-primary transition-colors pr-20"
                  />
                  {currentPlatform && currentPlatform !== 'unknown' && (
                    <Badge 
                      className={`absolute right-2 top-1/2 -translate-y-1/2 ${platformColors[currentPlatform]} text-white`}
                    >
                      {currentPlatform}
                    </Badge>
                  )}
                </div>
                
                {isLoading && (
                  <Progress value={progress} className="w-full" />
                )}
                
                <Button 
                  onClick={handleExtract}
                  disabled={isLoading || !url.trim()}
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 mr-2" />
                      Extract Video
                    </>
                  )}
                </Button>
              </div>

              {/* Supported Platforms */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Supported platforms:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(platformColors).map((platform) => (
                    <Badge
                      key={platform}
                      variant="outline"
                      className="capitalize border-border/50"
                    >
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Details */}
          {videoDetails && (
            <Card className="backdrop-blur-lg bg-card/50 border-border/50 shadow-2xl animate-slide-up">
              <CardContent className="p-6">
                {videoDetails.success ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <h3 className="font-semibold text-lg">Video Ready!</h3>
                        {videoDetails.title && (
                          <p className="text-muted-foreground">{videoDetails.title}</p>
                        )}
                      </div>
                    </div>

                    {videoDetails.thumbnail && (
                      <div className="relative overflow-hidden rounded-lg">
                        {videoDetails.videoUrl && videoDetails.videoUrl !== videoDetails.thumbnail ? (
                          <video
                            src={videoDetails.videoUrl}
                            poster={videoDetails.thumbnail}
                            controls
                            className="w-full h-48 object-cover"
                            preload="metadata"
                          >
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <>
                            <img
                              src={videoDetails.thumbnail}
                              alt="Video thumbnail"
                              className="w-full h-48 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Play className="w-12 h-12 text-white opacity-80" />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={handleDownload}
                        className="flex-1 bg-gradient-accent hover:opacity-90 transition-opacity"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Video
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setVideoDetails(null)}
                        className="border-border/50"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-destructive">Error</h3>
                      <p className="text-muted-foreground">
                        {videoDetails.error || 'Failed to extract video details'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}