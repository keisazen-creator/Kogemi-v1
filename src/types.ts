export interface AnimeTitle {
  romaji: string;
  english: string;
  native: string;
}

export interface Episode {
  id: string;
  title: string;
  description?: string;
  number: number;
  image: string;
  airDate?: string;
}

export interface Relation {
  id: number;
  relationType: string;
  title: AnimeTitle;
  status: string;
  episodes: number;
  image: string;
  type: string;
}

export interface AnimeInfo {
  id: string;
  title: AnimeTitle;
  image: string;
  cover: string;
  description: string;
  status: string;
  releaseDate: number;
  totalEpisodes: number;
  currentEpisode: number;
  type: string;
  genres: string[];
  season: string;
  relations: Relation[];
  episodes: Episode[];
}

export interface StreamSource {
  url: string;
  isM3U8: boolean;
  quality: string;
}

export interface Subtitle {
  url: string;
  lang: string;
}

export interface StreamData {
  headers: Record<string, string>;
  sources: StreamSource[];
  subtitles: Subtitle[];
}
