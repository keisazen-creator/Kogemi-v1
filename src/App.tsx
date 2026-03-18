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

  const loadInitialData = async () => {
    if (sections.length > 0) return;
    setLoading(true);
    try {
      const [trendingData, popularData, latestData, seasonalData, actionData, romanceData] = await Promise.all([
        fetch(`${API}/search?q=airing`).then(res => res.json()).catch(() => []),
        fetch(`${API}/search?q=popular`).then(res => res.json()).catch(() => []),
        fetch(`${API}/search?q=2026`).then(res => res.json()).catch(() => []),
        fetch(`${API}/search?q=winter 2026`).then(res => res.json()).catch(() => []),
        fetch(`${API}/search?q=action`).then(res => res.json()).catch(() => []),
        fetch(`${API}/search?q=romance`).then(res => res.json()).catch(() => [])
      ]);
      
      const newSections = [];
      if (Array.isArray(trendingData) && trendingData.length > 0) {
        newSections.push({ title: 'Trending Now', icon: <Flame className="text-orange-500" size={20} />, items: trendingData.slice(0, 8) });
      }
      if (Array.isArray(seasonalData) && seasonalData.length > 0) {
        newSections.push({ title: 'Winter 2026 Seasonal', icon: <Star className="text-blue-400" size={20} />, items: seasonalData.slice(0, 8) });
      }
      if (Array.isArray(latestData) && latestData.length > 0) {
        newSections.push({ title: 'New Releases 2026', icon: <Zap className="text-brand" size={20} />, items: latestData.slice(0, 8) });
      }
      if (Array.isArray(popularData) && popularData.length > 0) {
        newSections.push({ title: 'Top Airing', icon: <Trophy className="text-yellow-500" size={20} />, items: popularData.slice(0, 8) });
      }
      if (Array.isArray(actionData) && actionData.length > 0) {
        newSections.push({ title: 'Action', icon: <Zap className="text-brand" size={20} />, items: actionData.slice(0, 8) });
      }
      if (Array.isArray(romanceData) && romanceData.length > 0) {
        newSections.push({ title: 'Romance', icon: <Heart className="text-pink-500" size={20} />, items: romanceData.slice(0, 8) });
      }

      if (newSections.length > 0) {
        setSections(newSections);
      }
      
      if (Array.isArray(trendingData) && trendingData.length > 8) {
        setSidebarTrending(trendingData.slice(8, 18));
      } else if (Array.isArray(popularData) && popularData.length > 0) {
        setSidebarTrending(popularData.slice(0, 10));
      }
    } catch (e) {
      console.error("Failed to load sections", e);
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
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setLoading(false);
    }
  };

  const selectAnime = async (anime: any) => {
    const titleObj = anime.title;
    const title = typeof titleObj === 'string' ? titleObj : (titleObj?.english || titleObj?.romaji || titleObj?.native || "");
    const cleanTitle = title.split(":")[0].trim();
    
    if (!cleanTitle) {
      alert("Invalid anime title");
      return;
    }

    setLoading(true);

    try {
      const [metaRes, imdbRes] = await Promise.all([
        fetch(`${API}/anime-info?title=${encodeURIComponent(cleanTitle)}`),
        fetch(`${API}/imdb?title=${encodeURIComponent(cleanTitle)}`)
      ]);

      const meta = await metaRes.json();
      const imdbData = await imdbRes.json();

      if (!imdbData.imdb) {
        alert("No stream found for this anime");
        setLoading(false);
        return;
      }

      const imdbId = imdbData.imdb;
      setCurrentImdb(imdbId);
      setSelectedAnime({ ...anime, ...meta });

      // BUILD episodeList
      let list: Episode[] = [];
      let totalEpsCount = Number(meta.totalEpisodes || (Array.isArray(meta.episodes) ? meta.episodes.length : meta.episodes)) || 0;

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
      } else if (totalEpsCount <= 1 && !meta.type?.toLowerCase().includes("movie")) {
        totalEpsCount = 24; 
      }

      // If meta.episodes is incomplete, generate the full list
      if (Array.isArray(meta.episodes) && meta.episodes.length >= totalEpsCount) {
        list = meta.episodes;
      } else {
        list = Array.from({ length: totalEpsCount }, (_, i) => ({ number: i + 1 }));
      }

      if (list.length === 0) {
        alert("Episodes not available for this title");
        setLoading(false);
        return;
      }

      setEpisodeList(list);
      setPlayerVisible(true);

      // Auto load progress
      const saved = localStorage.getItem(imdbId);
      if (saved) {
        playEpisode(Number(saved), imdbId);
      } else {
        playEpisode(1, imdbId);
      }

    } catch (e) {
      console.error("Selection error:", e);
      alert("Failed to load anime info. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const playEpisode = async (ep: number, imdbId?: string, currentServer?: string) => {
    const id = imdbId || currentImdb;
    if (!id) return;

    const activeServer = currentServer || server;
    setCurrentEp(ep);
    localStorage.setItem(id, ep.toString());

    try {
      const res = await fetch(`${API}/stream?imdb=${id}&ep=${ep}`);
      const data = await res.json();
      
      // Check if it's a direct HLS stream (VidPro)
      if (data.videoUrl) {
        setStreamUrl(data.videoUrl);
        setSubtitles(data.subtitles || []);
        setIsHls(true);
      } else {
        // Fallback to iframe URLs
        setIsHls(false);
        setStreamUrl(activeServer === 'primary' ? data.primary : data.backup);
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
            <p className="text-zinc-500 font-medium animate-pulse">Fetching magic...</p>
          </div>
        )}

        {!loading && (
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
        )}
      </main>

      {/* Player Modal */}
      <AnimatePresence>
        {playerVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          >
            {/* Player Header */}
            <div className="glass border-b border-white/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={closePlayer} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
                <div>
                  <h3 className="font-bold text-lg truncate max-w-[200px] md:max-w-md">
                    {selectedAnime?.title.english || selectedAnime?.title.romaji || selectedAnime?.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-brand font-bold uppercase tracking-widest">Episode {currentEp}</p>
                    <span className="text-zinc-600">•</span>
                    <select 
                      value={server} 
                      onChange={(e) => handleServerChange(e.target.value)}
                      className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-zinc-400 focus:outline-none cursor-pointer hover:text-brand transition-colors"
                    >
                      <option value="primary">Primary (Kogemi)</option>
                      <option value="backup">Backup (Kogemi)</option>
                      <option value="vidsrc.to">Server 1 (Vidsrc)</option>
                      <option value="vidsrc.me">Server 2 (Vidsrc)</option>
                      <option value="vidsrc.xyz">Server 3 (Vidsrc)</option>
                      <option value="embed.su">Server 4 (Embed.su)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={prevEp} className="p-3 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30" disabled={currentEp <= 1}>
                  <SkipBack size={20} fill="currentColor" />
                </button>
                <button onClick={nextEp} className="p-3 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30" disabled={currentEp >= episodeList.length}>
                  <SkipForward size={20} fill="currentColor" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Video Area */}
              <div className="flex-1 bg-black relative flex flex-col">
                <div className="flex-1 relative group/player">
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
                      ></iframe>
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center animate-pulse text-zinc-700">
                      Loading stream...
                    </div>
                  )}
                </div>
                
                {/* Player Footer Controls */}
                <div className="glass border-t border-white/5 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button className="flex items-center gap-2 text-sm font-bold hover:text-brand transition-colors">
                      <Heart size={18} /> Favorite
                    </button>
                    <button className="flex items-center gap-2 text-sm font-bold hover:text-brand transition-colors">
                      <Share2 size={18} /> Share
                    </button>
                    <button className="flex items-center gap-2 text-sm font-bold hover:text-brand transition-colors">
                      <MessageSquare size={18} /> Comments
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Auto Next</div>
                    <div 
                      onClick={() => setAutoNext(!autoNext)}
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${autoNext ? 'bg-brand' : 'bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${autoNext ? 'right-1' : 'left-1'}`}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Episode Sidebar */}
              <div className="w-full md:w-80 glass border-l border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold flex items-center gap-2"><LayoutGrid size={18} className="text-brand" /> List of Episodes</h4>
                    <span className="text-xs text-zinc-500 font-mono">{episodeList.length} Total</span>
                  </div>
                  {episodeList.length > 50 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {Array.from({ length: Math.ceil(episodeList.length / 50) }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSeason(i + 1)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                            currentSeason === i + 1 
                              ? 'bg-brand text-white' 
                              : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                          }`}
                        >
                          EP {i * 50 + 1}-{Math.min((i + 1) * 50, episodeList.length)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 md:grid-cols-4 gap-2 content-start">
                  {episodeList.slice((currentSeason - 1) * 50, currentSeason * 50).map((ep, index) => {
                    const epNum = ep.number || ((currentSeason - 1) * 50 + index + 1);
                    return (
                      <button
                        key={index}
                        onClick={() => playEpisode(epNum)}
                        className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                          currentEp === epNum 
                            ? 'bg-brand text-white shadow-lg shadow-brand/40 scale-105' 
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400'
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
      whileHover={{ y: -8 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden glass border border-white/10 shadow-xl mb-3">
        <img 
          src={anime.coverImage?.large || anime.image} 
          alt={typeof title === 'string' ? title : ""}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <div className="w-full">
            <button className="w-full bg-brand py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand/40">
              <Play size={14} fill="currentColor" /> WATCH NOW
            </button>
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-brand/90 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-white shadow-lg">
          HD
        </div>
        <div className="absolute bottom-2 left-2 flex gap-1">
          <div className="bg-white/10 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase">
            {anime.type || 'TV'}
          </div>
        </div>
      </div>
      <h3 className="font-bold text-sm truncate group-hover:text-brand transition-colors">
        {title}
      </h3>
      <div className="flex items-center gap-2 mt-1 opacity-50">
        <Clock size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Sub | Dub</span>
      </div>
    </motion.div>
  );
}
