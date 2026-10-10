import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin de DEV apenas (nunca roda em `vite build`/produção — configureServer
// só é chamado pelo servidor de desenvolvimento): monta cada api/*.js como
// middleware do próprio Vite, para `npm run dev` conseguir testar as
// Vercel Functions sem precisar instalar/autenticar a Vercel CLI. Em
// produção, a Vercel detecta api/*.js automaticamente como Function — este
// plugin não interfere nisso. Generalizado na Fase 3B (antes só cobria
// /api/radar-buscar) para também cobrir /api/ia-radar, sem duplicar o
// encanamento de request/response a cada nova rota.
function apiDevMiddleware(rota, arquivo) {
  return {
    name: `${rota.replace(/\W/g, '-')}-dev-middleware`,
    configureServer(server) {
      server.middlewares.use(rota, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ status: 'erro', mensagemErro: 'Método não permitido.' }))
          return
        }
        let corpo = ''
        req.on('data', (chunk) => (corpo += chunk))
        req.on('end', async () => {
          try {
            req.body = corpo ? JSON.parse(corpo) : {}
            const { default: handler } = await server.ssrLoadModule(arquivo)
            const resposta = {
              _status: 200,
              status(codigo) {
                this._status = codigo
                return this
              },
              json(dados) {
                res.statusCode = this._status
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(dados))
              },
            }
            await handler(req, resposta)
          } catch (erro) {
            res.statusCode = 500
            res.end(JSON.stringify({ status: 'erro', mensagemErro: String(erro) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiDevMiddleware('/api/radar-buscar', '/api/radar-buscar.js'),
    apiDevMiddleware('/api/ia-radar', '/api/ia-radar.js'),
  ],
  server: {
    host: true,
  },
})
