import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import RedirecionamentoRaiz from './components/RedirecionamentoRaiz'
import Login from './pages/Login'
import NaoEncontrado from './pages/NaoEncontrado'
import Dashboard from './pages/Dashboard'
import Prospeccao from './pages/Prospeccao'
import Crm from './pages/Crm'
import Clientes from './pages/Clientes'
import Projetos from './pages/Projetos'
import Comercial from './pages/Comercial'
import Marketing from './pages/Marketing'
import Integracoes from './pages/Integracoes'
import IaAutomacoes from './pages/IaAutomacoes'
import Interface from './pages/Interface'
import Configuracoes from './pages/Configuracoes'
import Conta from './pages/Conta'

// Rotas do Moraes.Dev Control. Diferente do App.jsx original (que tinha
// "/" e "/avaliar/:id" públicos, para o formulário de chamado e a tela de
// avaliação), aqui todo CONTEÚDO fica atrás de login — não existe formulário
// público equivalente nesta fase. "/" e "*" não são rotas públicas de
// conteúdo: "/" só redireciona (para /login ou /dashboard conforme a sessão,
// ver RedirecionamentoRaiz.jsx) e "*" é a página 404 (NaoEncontrado.jsx) —
// sem elas, qualquer URL sem correspondência exata deixava a aplicação em
// branco ("No routes matched location").
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RedirecionamentoRaiz />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="prospeccao" element={<Prospeccao />} />
            <Route path="crm" element={<Crm />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="projetos" element={<Projetos />} />
            <Route path="comercial" element={<Comercial />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="integracoes" element={<Integracoes />} />
            <Route path="ia-automacoes" element={<IaAutomacoes />} />
            <Route path="interface" element={<Interface />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="conta" element={<Conta />} />
          </Route>
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
