import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adsTxtProxy from './adstxt-proxy.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adsTxtProxy()],
})
