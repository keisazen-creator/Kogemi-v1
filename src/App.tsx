import axios from 'axios';
import Hls from 'hls.js';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, ChevronRight, History, Zap, TrendingUp, X, SkipForward, SkipBack, LayoutGrid, Star, Clock, Info, List, Heart, Share2, MessageSquare, Flame, Trophy, Settings, Maximize, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API = "https://kogemi-api-3.onrender.com";

interface AnimeTitle {
  romaji: string;
  english: string;
  native: string;
}

interface Anime {
  id: string;
  title: AnimeTitle;
  coverImage: {
    large: string;
  };
  description?: string;
  type?: string;
  status?: string;
  releaseDate?: number;
}

interface Episode {
  number?: number;
  title?: string;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [episodeList, setEpisodeList] = useState<Episode[]>([]);
  const [currentEp, setCurrentEp] = useState(1);
  const [currentImdb, setCurrentImdb] = useState<string | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [isHls, setIsHls] = useState(false);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [server, setServer] = useState('primary');
  const [currentSeason, setCurrentSeason] = useState(1);
  const [sections, setSections] = useState<{ title: string, icon: React.ReactNode, items: Anime[] }[]>([]);
  const [autoNext, setAutoNext] = useState(true);
  const [sidebarTrending, setSidebarTrending] = useState<Anime[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!autoNext || !playerVisible) return;
    
    const interval = setInterval(() => {
      // This is a mock detection since we can't truly detect end of cross-origin iframe
      // but we follow the user's logic pattern if the URL were to change
      if (window.location.hash === '#next') {
        nextEp();
        window.location.hash = '';
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoNext, playerVisible, currentEp]);

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setLoading(false);
        console.warn("Loading timed out after 120s");
      }, 120000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const [loadingStatus, setLoadingStatus] = useState("Fetching magic...");
  const [continueWatching, setContinueWatching] = useState<any[]>([]);

  // Load continue watching from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('continueWatching');
    if (saved) {
      try {
        setContinueWatching(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse continue watching", e);
      }
    }
  }, []);

  const saveContinueWatching = (anime: any, ep: number) => {
    const newItem = {
      id: anime.id,
      title: anime.title?.english || anime.title?.romaji || anime.title,
      image: anime.coverImage?.large || anime.image,
      episode: ep,
      timestamp: Date.now()
    };
    
    setContinueWatching(prev => {
      const filtered = prev.filter(item => item.id !== anime.id);
      const updated = [newItem, ...filtered].slice(0, 10);
      localStorage.setItem('continueWatching', JSON.stringify(updated));
      return updated;
    });
  };

  const safeFetch = async (url: string, timeout = 60000, status?: string) => {
    if (status) setLoadingStatus(status);
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(url, { 
          timeout,
          headers: { 'Accept': 'application/json' }
        });
        return response.data;
      } catch (e: any) {
        attempts++;
        const isTimeout = e.code === 'ECONNABORTED' || e.message?.includes('timeout');
        console.warn(`Attempt ${attempts} failed for ${url}:`, e.message);
        
        if (attempts >= maxAttempts) {
          console.error(`Fetch failed for ${url} after ${maxAttempts} attempts`);
          return null;
        }
        
        if (status) setLoadingStatus(`${status} (Retrying...)`);
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    return null;
  };

  const loadInitialData = async () => {
    if (sections.length > 0 || loading) return;
    setLoading(true);
    setLoadingStatus("Waking up the server...");
    
    try {
      // First, try to wake up the API with trending
      const trendingData = await safeFetch(`${API}/search?q=trending`, 60000, "Loading trending anime...");
      
      // Even if trending fails, we try the others
      const [popularData, seasonalData, actionData, romanceData] = await Promise.all([
        safeFetch(`${API}/search?q=popular`, 45000),
        safeFetch(`${API}/search?q=2026`, 45000),
        safeFetch(`${API}/search?q=action`, 45000),
        safeFetch(`${API}/search?q=romance`, 45000)
      ]);
      
      const filterLiveAction = (list: any[]) => {
        if (!Array.isArray(list)) return [];
        return list.filter(item => {
          const title = (typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji || item.title?.native || "")).toLowerCase();
          return !title.includes("live action");
        });
      };

      const newSections = [];
      const filteredTrending = filterLiveAction(trendingData);
      const filteredSeasonal = filterLiveAction(seasonalData);
      const filteredPopular = filterLiveAction(popularData);
      const filteredAction = filterLiveAction(actionData);
      const filteredRomance = filterLiveAction(romanceData);

      if (filteredTrending.length > 0) {
        newSections.push({ title: 'Trending Now', icon: <Flame className="text-orange-500" size={20} />, items: filteredTrending.slice(0, 8) });
      }
      if (filteredSeasonal.length > 0) {
        newSections.push({ title: 'New in 2026', icon: <Star className="text-blue-400" size={20} />, items: filteredSeasonal.slice(0, 8) });
      }
      if (filteredPopular.length > 0) {
        newSections.push({ title: 'Top Airing', icon: <Trophy className="text-yellow-500" size={20} />, items: filteredPopular.slice(0, 8) });
      }
      if (filteredAction.length > 0) {
        newSections.push({ title: 'Action', icon: <Zap className="text-brand" size={20} />, items: filteredAction.slice(0, 8) });
      }
      if (filteredRomance.length > 0) {
        newSections.push({ title: 'Romance', icon: <Heart className="text-pink-500" size={20} />, items: filteredRomance.slice(0, 8) });
      }

      if (newSections.length > 0) {
        setSections(newSections);
      } else {
        console.warn("No sections loaded from API");
      }
      
      if (filteredTrending.length > 8) {
        setSidebarTrending(filteredTrending.slice(8, 18));
      } else if (filteredPopular.length > 0) {
        setSidebarTrending(filteredPopular.slice(0, 10));
      }
    } catch (e) {
      console.error("Failed to load initial data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setLoadingStatus(`Searching for "${searchQuery}"...`);
    try {
      const data = await safeFetch(`${API}/search?q=${encodeURIComponent(searchQuery)}`, 60000);
      if (Array.isArray(data)) {
        // Filter out live action from search results too
        const filtered = data.filter(item => {
          const title = (typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji || item.title?.native || "")).toLowerCase();
          return !title.includes("live action");
        });
        setResults(filtered);
      } else {
        setResults([]);
      }
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setLoading(false);
    }
  };

  const selectAnime = async (anime: any, initialEpisode?: number) => {
    const titleObj = anime.title;
    const title = typeof titleObj === 'string' ? titleObj : (titleObj?.english || titleObj?.romaji || titleObj?.native || "");
    
    // Improved title cleaning: don't split if it's a "Live Action" title
    let cleanTitle = title;
    if (!title.toLowerCase().includes("live action")) {
      cleanTitle = title.split(":")[0].trim();
    }
    
    if (!cleanTitle) {
      console.error("Invalid anime title");
      return;
    }

    setLoading(true);
    setLoadingStatus(`Loading ${cleanTitle}...`);

    try {
      const lowerTitle = cleanTitle.toLowerCase();
      const isOnePiece = lowerTitle === "one piece" || (lowerTitle.includes("one piece") && !lowerTitle.includes("live action"));
      
      // Use cleanTitle for anime-info
      const animeInfoTitle = isOnePiece ? "One Piece" : cleanTitle;

      // Reduced timeout for One Piece meta since we have the hardcoded IMDB ID
      const [meta, imdbData] = await Promise.all([
        safeFetch(`${API}/anime-info?title=${encodeURIComponent(animeInfoTitle)}`, isOnePiece ? 20000 : 45000),
        isOnePiece ? Promise.resolve({ imdb: "tt0388629" }) : safeFetch(`${API}/imdb?title=${encodeURIComponent(cleanTitle)}`, 45000)
      ]);

      let finalImdbId = imdbData?.imdb;
      
      // If IMDB search failed or returned the Live Action (tt11737520), try a fallback
      if (!finalImdbId || (finalImdbId === "tt11737520" && !isOnePiece)) {
        // Try searching with "anime" suffix for better results
        const fallbackData = await safeFetch(`${API}/imdb?title=${encodeURIComponent(cleanTitle + " anime")}`, 45000);
        finalImdbId = fallbackData?.imdb;
        
        // If still no IMDB, try one last time with the original title but longer timeout
        if (!finalImdbId) {
          const lastResort = await safeFetch(`${API}/imdb?title=${encodeURIComponent(title)}`, 60000);
          finalImdbId = lastResort?.imdb;
        }
      }

      // Final safety check for One Piece
      if (isOnePiece) finalImdbId = "tt0388629";

      if (!finalImdbId) {
        console.warn("No stream found for this anime.");
        setLoading(false);
        return;
      }

      setCurrentImdb(finalImdbId);
      
      // Fallback metadata for One Piece if API fails
      const finalMeta = meta || (isOnePiece ? {
        totalEpisodes: 1100,
        title: { english: "One Piece", romaji: "One Piece", native: "ワンピース" },
        coverImage: { large: anime.coverImage?.large || anime.image }
      } : {});

      setSelectedAnime({ ...anime, ...finalMeta, imdbId: finalImdbId });
      processSelection(finalMeta, finalImdbId, cleanTitle, initialEpisode);

    } catch (e) {
      console.error("Selection error:", e);
    } finally {
      setLoading(false);
    }
  };

  const processSelection = (meta: any, imdbId: string, cleanTitle: string, initialEpisode?: number) => {
    // BUILD episodeList
    let list: Episode[] = [];
    let totalEpsCount = 0;
    
    if (meta) {
      totalEpsCount = Number(meta.totalEpisodes || (Array.isArray(meta.episodes) ? meta.episodes.length : meta.episodes)) || 0;
    }

    // Fallback logic from user example - Improved to handle "1 episode" bug
    const t = cleanTitle.toLowerCase();
    if (t.includes("one piece")) {
      totalEpsCount = Math.max(totalEpsCount, 1100);
    } else if (t.includes("naruto shippuden")) {
      totalEpsCount = Math.max(totalEpsCount, 500);
    } else if (t.includes("naruto")) {
      totalEpsCount = Math.max(totalEpsCount, 220);
    } else if (t.includes("bleach")) {
      totalEpsCount = Math.max(totalEpsCount, 366);
    } else if (totalEpsCount <= 1 && meta && !meta.type?.toLowerCase().includes("movie")) {
      totalEpsCount = 24; 
    }

    // If meta.episodes is incomplete, generate the full list
    if (meta && Array.isArray(meta.episodes) && meta.episodes.length >= totalEpsCount) {
      list = meta.episodes;
    } else {
      list = Array.from({ length: Math.max(1, totalEpsCount) }, (_, i) => ({ number: i + 1 }));
    }

    if (list.length === 0) {
      console.error("Episodes not available for this title");
      setLoading(false);
      return;
    }

    setEpisodeList(list);
    setPlayerVisible(true);
    setLoading(false);

    // Auto load progress
    if (initialEpisode) {
      playEpisode(initialEpisode, imdbId);
    } else {
      const saved = localStorage.getItem(imdbId);
      if (saved) {
        playEpisode(Number(saved), imdbId);
      } else {
        playEpisode(1, imdbId);
      }
    }
  };

  const playEpisode = async (ep: number, imdbId?: string, currentServer?: string) => {
    const id = imdbId || currentImdb;
    if (!id) return;

    const activeServer = currentServer || server;
    setCurrentEp(ep);
    localStorage.setItem(id, ep.toString());
    
    if (selectedAnime) {
      saveContinueWatching(selectedAnime, ep);
    }

    try {
      const data = await safeFetch(`${API}/stream?imdb=${id}&ep=${ep}`);
      
      if (data && data.videoUrl) {
        setStreamUrl(data.videoUrl);
        setSubtitles(data.subtitles || []);
        setIsHls(true);
      } else if (data) {
        // Fallback to iframe URLs
        setIsHls(false);
        setStreamUrl(activeServer === 'primary' ? data.primary : data.backup);
      } else {
        // Complete fallback
        setIsHls(false);
        setStreamUrl(`https://vidsrc.to/embed/anime/${id}/${ep}`);
      }
    } catch (e) {
      console.error("Stream fetch error", e);
      setIsHls(false);
      setStreamUrl(`https://vidsrc.to/embed/anime/${id}/${ep}`);
    }
  };

  useEffect(() => {
    if (isHls && streamUrl && videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(e => console.log("Autoplay blocked", e));
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = streamUrl;
      }
    }
  }, [streamUrl, isHls]);

  const handleVideoEnded = () => {
    if (autoNext) {
      nextEp();
    }
  };

  const handleServerChange = (newServer: string) => {
    setServer(newServer);
    if (currentImdb) playEpisode(currentEp, currentImdb, newServer);
  };

  const nextEp = () => {
    if (currentEp < episodeList.length) playEpisode(currentEp + 1);
  };

  const prevEp = () => {
    if (currentEp > 1) playEpisode(currentEp - 1);
  };

  const skipIntro = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 85;
    }
  };

  const closePlayer = () => {
    setPlayerVisible(false);
    setStreamUrl('');
    setSelectedAnime(null);
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-zinc-100 selection:bg-brand/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => { 
              setResults([]); 
              setSearchQuery('');
              loadInitialData(); 
            }}
          >
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-110 transition-transform">
              <Zap className="text-white fill-white" size={24} />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">KOGEMI</span>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:bg-white/10 transition-all placeholder:text-zinc-600"
            />
          </form>

          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => { setResults([]); setSearchQuery(''); loadInitialData(); }}
              className="text-sm font-semibold hover:text-brand transition-colors"
            >
              Home
            </button>
            <button className="text-sm font-semibold hover:text-brand transition-colors">Trending</button>
            <button className="text-sm font-semibold hover:text-brand transition-colors">Movies</button>
            <button className="bg-brand hover:bg-brand/80 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand/20">Login</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 font-medium animate-pulse">{loadingStatus}</p>
            <button 
              onClick={() => { 
                setLoading(false); 
                if (results.length === 0) loadInitialData(); 
              }}
              className="mt-4 text-xs text-zinc-600 hover:text-brand underline"
            >
              Taking too long? Click to cancel
            </button>
          </div>
        )}

        {!loading && sections.length === 0 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
              <Info className="text-zinc-500" size={32} />
            </div>
            <h3 className="text-xl font-bold">No content found</h3>
            <p className="text-zinc-500 max-w-xs">The API might be waking up. Please try again in a few seconds.</p>
            <button 
              onClick={() => loadInitialData()}
              className="mt-4 bg-brand hover:bg-brand/80 px-8 py-3 rounded-xl text-sm font-bold transition-all"
            >
              Retry Loading
            </button>
          </div>
        )}

        {!loading && (sections.length > 0 || results.length > 0) && (
          <div className="space-y-12">
            {/* Continue Watching Section */}
            {continueWatching.length > 0 && !searchQuery && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand/10 rounded-xl">
                      <Clock className="text-brand" size={20} />
                    </div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">Continue Watching</h2>
                  </div>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('continueWatching');
                      setContinueWatching([]);
                    }}
                    className="text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {continueWatching.map((item) => (
                    <motion.div 
                      key={item.id}
                      whileHover={{ y: -5 }}
                      onClick={() => {
                        const fullAnime = sections.flatMap(s => s.items).find(a => a.id === item.id);
                        selectAnime(fullAnime || { id: item.id, title: item.title, image: item.image }, item.episode);
                      }}
                      className="group cursor-pointer"
                    >
                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl mb-3">
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent flex items-end p-3">
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-black text-brand uppercase tracking-wider">Episode {item.episode}</span>
                              <Play size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
                            </div>
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-brand w-2/3"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <h3 className="font-bold text-xs truncate group-hover:text-brand transition-colors leading-tight">
                        {item.title}
                      </h3>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="flex-1 space-y-12">
              {results.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <LayoutGrid className="text-brand" /> Search Results
                    </h2>
                    <button onClick={() => setResults([])} className="text-zinc-500 hover:text-white text-sm font-medium">Clear</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {results.map((anime) => (
                      <AnimeCard key={anime.id} anime={anime} onClick={() => selectAnime(anime)} />
                    ))}
                  </div>
                </section>
              )}

              {results.length === 0 && sections.map((section, idx) => (
                <section key={idx} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      {section.icon}
                      {section.title}
                    </h2>
                    <button className="text-zinc-500 hover:text-white text-sm font-medium flex items-center gap-1">
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {section.items.map((anime) => (
                      <AnimeCard key={anime.id} anime={anime} onClick={() => selectAnime(anime)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Sidebar */}
            {results.length === 0 && (
              <aside className="w-full lg:w-80 space-y-8">
                <div className="glass rounded-3xl p-6 border border-white/5">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="text-brand" /> Top 10
                  </h3>
                  <div className="space-y-4">
                    {sidebarTrending.map((anime, i) => (
                      <div 
                        key={anime.id} 
                        className="flex items-center gap-4 group cursor-pointer"
                        onClick={() => selectAnime(anime)}
                      >
                        <span className={`text-2xl font-black italic ${i < 3 ? 'text-brand' : 'text-zinc-700'}`}>
                          {(i + 1).toString().padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate group-hover:text-brand transition-colors">
                            {anime.title.english || anime.title.romaji || anime.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                            <span>{anime.type || 'TV'}</span>
                            <span>•</span>
                            <span>{anime.status || 'Finished'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-3xl p-6 border border-white/5">
                  <h3 className="text-xl font-bold mb-4">Join our community</h3>
                  <p className="text-zinc-500 text-sm mb-6">Connect with thousands of anime fans and share your thoughts.</p>
                  <button className="w-full bg-[#5865F2] hover:bg-[#4752C4] py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                    Join Discord
                  </button>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </main>

      {/* Player Modal */}
      <AnimatePresence>
        {playerVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/98 flex flex-col backdrop-blur-sm"
          >
            {/* Player Header */}
            <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-4 min-w-0">
                <button 
                  onClick={closePlayer} 
                  className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"
                  title="Close"
                >
                  <X size={22} className="text-zinc-400" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm md:text-base truncate leading-tight text-zinc-100">
                    {selectedAnime?.title.english || selectedAnime?.title.romaji || selectedAnime?.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-brand/10 text-brand text-[9px] font-black rounded uppercase tracking-wider border border-brand/20">EPISODE {currentEp}</span>
                    <span className="text-zinc-700 text-xs">•</span>
                    <div className="relative group/server">
                      <select 
                        value={server} 
                        onChange={(e) => handleServerChange(e.target.value)}
                        className="bg-transparent text-[9px] font-black uppercase tracking-widest text-zinc-500 focus:outline-none cursor-pointer hover:text-zinc-300 transition-colors appearance-none pr-4"
                      >
                        <option value="primary">Primary (Kogemi)</option>
                        <option value="backup">Backup (Kogemi)</option>
                        <option value="vidsrc.to">Server 1 (Vidsrc)</option>
                        <option value="vidsrc.me">Server 2 (Vidsrc)</option>
                        <option value="vidsrc.xyz">Server 3 (Vidsrc)</option>
                        <option value="embed.su">Server 4 (Embed.su)</option>
                      </select>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600 group-hover/server:text-zinc-400">
                        <ChevronRight size={10} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/5">
                  <button 
                    onClick={prevEp} 
                    className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-10 disabled:cursor-not-allowed text-zinc-400" 
                    disabled={currentEp <= 1}
                  >
                    <SkipBack size={16} fill="currentColor" />
                  </button>
                  <button 
                    onClick={nextEp} 
                    className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-10 disabled:cursor-not-allowed text-zinc-400" 
                    disabled={currentEp >= episodeList.length}
                  >
                    <SkipForward size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Video Area */}
              <div className="flex-1 bg-black relative flex flex-col overflow-y-auto lg:overflow-hidden no-scrollbar">
                <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center p-0 md:p-4 lg:p-8">
                  <div className="relative aspect-video w-full max-h-[80vh] bg-zinc-900 shadow-2xl shadow-black/50 rounded-none md:rounded-2xl overflow-hidden border border-white/5">
                    {streamUrl ? (
                      isHls ? (
                        <div className="w-full h-full relative">
                          <video 
                            ref={videoRef}
                            className="w-full h-full"
                            onEnded={handleVideoEnded}
                            controls
                            crossOrigin="anonymous"
                          >
                            {subtitles.map((sub, i) => (
                              <track 
                                key={i}
                                kind="subtitles"
                                src={sub.file}
                                label={sub.label}
                                default={i === 0}
                              />
                            ))}
                          </video>
                        </div>
                      ) : (
                        <iframe 
                          src={streamUrl} 
                          className="w-full h-full border-none"
                          allowFullScreen
                          allow="autoplay; encrypted-media"
                        ></iframe>
                      )
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900">
                        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Loading stream...</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Player Footer Controls - Mobile Optimized */}
                  <div className="mt-4 px-4 md:px-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar w-full sm:w-auto">
                      <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-zinc-400 hover:text-brand transition-colors whitespace-nowrap">
                        <Heart size={16} /> Favorite
                      </button>
                      <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-zinc-400 hover:text-brand transition-colors whitespace-nowrap">
                        <Share2 size={16} /> Share
                      </button>
                      <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-zinc-400 hover:text-brand transition-colors whitespace-nowrap">
                        <MessageSquare size={16} /> Comments
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                      {isHls && (
                        <button 
                          onClick={skipIntro}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand hover:text-white transition-colors"
                        >
                          <Zap size={14} fill="currentColor" /> Skip Intro
                        </button>
                      )}
                      {isHls && <div className="h-4 w-px bg-white/10"></div>}
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Auto Next</div>
                        <div 
                          onClick={() => setAutoNext(!autoNext)}
                          className={`w-9 h-5 rounded-full relative cursor-pointer transition-all duration-300 ${autoNext ? 'bg-brand shadow-lg shadow-brand/20' : 'bg-zinc-800'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${autoNext ? 'right-1' : 'left-1'}`}></div>
                        </div>
                      </div>
                      <div className="sm:hidden h-4 w-px bg-white/10"></div>
                      <div className="sm:hidden flex items-center gap-4">
                        <button onClick={prevEp} disabled={currentEp <= 1} className="text-zinc-400 disabled:opacity-20"><SkipBack size={18} fill="currentColor" /></button>
                        <button onClick={nextEp} disabled={currentEp >= episodeList.length} className="text-zinc-400 disabled:opacity-20"><SkipForward size={18} fill="currentColor" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Episode Sidebar */}
              <div className="w-full lg:w-96 bg-zinc-900/50 border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col h-[40vh] lg:h-full">
                <div className="p-5 border-b border-white/5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <List size={18} className="text-brand" /> 
                      Episodes
                    </h4>
                    <span className="bg-white/5 px-2 py-1 rounded text-[10px] font-mono text-zinc-500 border border-white/5">
                      {episodeList.length} Total
                    </span>
                  </div>
                  
                  {episodeList.length > 50 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                      {Array.from({ length: Math.ceil(episodeList.length / 50) }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSeason(i + 1)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${
                            currentSeason === i + 1 
                              ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20' 
                              : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
                          }`}
                        >
                          {i * 50 + 1}-{Math.min((i + 1) * 50, episodeList.length)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-4 gap-2.5 content-start no-scrollbar">
                  {episodeList.slice((currentSeason - 1) * 50, currentSeason * 50).map((ep, index) => {
                    const epNum = ep.number || ((currentSeason - 1) * 50 + index + 1);
                    const isActive = currentEp === epNum;
                    return (
                      <button
                        key={index}
                        onClick={() => playEpisode(epNum)}
                        className={`aspect-square flex items-center justify-center rounded-xl text-xs font-black transition-all duration-300 border ${
                          isActive 
                            ? 'bg-brand border-brand text-white shadow-xl shadow-brand/30 scale-105 z-10' 
                            : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {epNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/5 py-12 mt-20 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="text-brand" />
          <span className="text-xl font-black tracking-tighter">KOGEMI</span>
        </div>
        <div className="flex justify-center gap-8 mb-8 text-sm text-zinc-500 font-medium">
          <a href="#" className="hover:text-white transition-colors">A-Z List</a>
          <a href="#" className="hover:text-white transition-colors">Recently Added</a>
          <a href="#" className="hover:text-white transition-colors">Upcoming</a>
          <a href="#" className="hover:text-white transition-colors">Most Watched</a>
        </div>
        <p className="text-zinc-600 text-sm">© 2026 Kogemi Streaming. Built for anime lovers.</p>
      </footer>
    </div>
  );
}

function AnimeCard({ anime, onClick }: { anime: any, onClick: () => void, key?: any }) {
  const title = anime.title?.english || anime.title?.romaji || anime.title;
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl mb-3">
        <img 
          src={anime.coverImage?.large || anime.image} 
          alt={typeof title === 'string' ? title : ""}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-4">
          <div className="w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <button className="w-full bg-brand py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 shadow-xl shadow-brand/40">
              <Play size={14} fill="currentColor" /> WATCH NOW
            </button>
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] font-black text-white border border-white/10">
          HD
        </div>
        {anime.type && (
          <div className="absolute top-2 left-2 bg-brand/90 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] font-black text-white shadow-lg">
            {anime.type}
          </div>
        )}
      </div>
      <h3 className="font-bold text-xs md:text-sm truncate group-hover:text-brand transition-colors leading-tight">
        {title}
      </h3>
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex items-center gap-1 text-[9px] font-black text-zinc-500 uppercase tracking-wider">
          <Star size={10} className="text-yellow-500" fill="currentColor" />
          <span>{anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '8.5'}</span>
        </div>
        <span className="text-zinc-800 text-xs">•</span>
        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">Sub | Dub</span>
      </div>
    </motion.div>
  );
}
