import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin de DEV apenas (nunca roda em `vite build`/produção — configureServer
// só é chamado pelo servidor de desenvolvimento): monta api/radar-buscar.js
// como middleware do próprio Vite, para `npm run dev` conseguir testar o
// Radar sem precisar instalar/autenticar a Vercel CLI. Em produção, a
// Vercel detecta api/*.js automaticamente como Function — este plugin não
// interfere nisso.
function radarApiDevMiddleware() {
  return {
    name: 'radar-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/radar-buscar', async (req, res) => {
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
            const { default: handler } = await server.ssrLoadModule('/api/radar-buscar.js')
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
  plugins: [react(), tailwindcss(), radarApiDevMiddleware()],
  server: {
    host: true,
  },
})
