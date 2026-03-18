import React from 'react';
import { Episode } from '../types';
import { Play } from 'lucide-react';

interface EpisodeListProps {
  episodes: Episode[];
  currentEpisodeId: string | null;
  onSelect: (episode: Episode) => void;
}

export const EpisodeList: React.FC<EpisodeListProps> = ({ episodes, currentEpisodeId, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {episodes.map((ep) => (
        <button
          key={ep.id}
          onClick={() => onSelect(ep)}
          className={`group relative flex flex-col bg-zinc-900 rounded-xl overflow-hidden border transition-all hover:border-violet-500/50 ${
            currentEpisodeId === ep.id ? 'border-violet-500 ring-1 ring-violet-500' : 'border-white/5'
          }`}
        >
          <div className="relative aspect-video overflow-hidden">
            <img 
              src={ep.image} 
              alt={ep.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="text-white fill-white" size={32} />
            </div>
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-mono text-white">
              EP {ep.number}
            </div>
          </div>
          <div className="p-3 text-left">
            <h4 className="text-sm font-medium text-zinc-100 truncate group-hover:text-violet-400 transition-colors">
              {ep.title || `Episode ${ep.number}`}
            </h4>
            {ep.airDate && (
              <p className="text-xs text-zinc-500 mt-1">{new Date(ep.airDate).toLocaleDateString()}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
