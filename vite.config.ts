import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueDevTools from 'vite-plugin-vue-devtools'

import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

const apiProxyTarget = process.env.HYSELF_API_PROXY_TARGET || 'http://127.0.0.1:8000'
const wsProxyTarget = process.env.HYSELF_WS_PROXY_TARGET || apiProxyTarget.replace(/^http/i, 'ws')

function isIgnorableWsProxyError(error: NodeJS.ErrnoException) {
    return error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error.code === 'EPIPE'
}

function suppressBenignProxyErrors(proxy: any) {
    const errorListeners = proxy.listeners('error') as Array<(...args: unknown[]) => void>
    if (!errorListeners.length) {
        return
    }
    proxy.removeAllListeners('error')
    proxy.on('error', (...args: unknown[]) => {
        const error = args[0] as NodeJS.ErrnoException | undefined
        if (error && isIgnorableWsProxyError(error)) {
            return
        }
        for (const listener of errorListeners) {
            listener(...args)
        }
    })
}

function resolveManualChunk(id: string) {
    if (!id.includes('node_modules')) {
        return undefined
    }
    if (id.includes('ant-design-vue') || id.includes('@ant-design/icons-vue')) {
        return 'ui'
    }
    if (id.includes('/@vue/') || id.includes('/vue/') || id.includes('pinia') || id.includes('vue-router')) {
        return 'framework'
    }
    if (id.includes('axios') || id.includes('dayjs') || id.includes('spark-md5')) {
        return 'shared'
    }
    if (id.includes('hls.js') || id.includes('plyr') || id.includes('cropperjs') || id.includes('vue-cropper')) {
        return 'media'
    }
    return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // vueDevTools(),
        Components({
            resolvers: [AntDesignVueResolver({ importStyle: false })],
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    build: {
        target: 'es2020',
        cssCodeSplit: true,
        sourcemap: false,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
            output: {
                entryFileNames: 'js/[name]-[hash].js',
                chunkFileNames: 'js/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                manualChunks: resolveManualChunk,
            },
        },
    },
    esbuild: {
        drop: ['debugger'],
    },
    server: {
        // allowedHosts: ['frp-end.com'],
        proxy: {
            '/api': {
                target: apiProxyTarget,
                changeOrigin: true
            },
            '/ws/': {
                target: wsProxyTarget,
                ws: true,
                changeOrigin: true,
                configure(proxy) {
                    suppressBenignProxyErrors(proxy)
                }
            },
            '/uploads': {
                target: apiProxyTarget,
                changeOrigin: true
            }
        }
    }
})
