import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export default api;

export async function uploadImage(file) {
  const form = new FormData();
  form.append('myImage', file);
  const { data } = await axios.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.imageUrl;
}
