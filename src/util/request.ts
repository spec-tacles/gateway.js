import axios, { AxiosInstance } from 'axios';

export default (token: string): AxiosInstance => axios.create({
  baseURL: 'https://discordapp.com/api/v6/',
  headers: { Authorization: token }
});
