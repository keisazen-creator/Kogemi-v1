import axios from 'axios';
import { AnimeInfo, StreamData } from '../types';

export const animeService = {
  async search(query: string) {
    const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  async getInfo(id: string): Promise<AnimeInfo> {
    const response = await axios.get(`/api/anime/${id}`);
    return response.data;
  },

  async getStream(episodeId: string): Promise<StreamData> {
    const response = await axios.get(`/api/watch/${episodeId}`);
    return response.data;
  }
};
