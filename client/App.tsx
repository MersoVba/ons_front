import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import AvisoDebito from "./pages/AvisoDebito";
import AvisoCredito from "./pages/AvisoCredito";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Forbidden from "./pages/Forbidden";

const queryClient = new QueryClient();

// Seed lightweight mock data for prototype (only when using mock mode)
const seedMockData = () => {
  try {
    if (localStorage.getItem('mock:initialized')) return;

    // sample AVDs (Avisos de Débito)
    const avds = [
      { id: 'AVD001', mes: '2024-11', parcela: '15', tipo: 'ordinaria', valor: 150000, status: 'aberto', usuario: 'Usuário Transmissão Norte' },
      { id: 'AVD002', mes: '2024-11', parcela: '25', tipo: 'ordinaria', valor: 85000, status: 'aberto', usuario: 'Empresa Energia DEF' },
      { id: 'AVD003', mes: '2024-10', parcela: '05', tipo: 'extraordinaria', valor: 220000, status: 'vencido', usuario: 'Concessionária ABC Ltda' }
    ];

    const chats = [
      { id: 'CHT001', avdId: 'AVD001', messages: [ { from: 'AVD', text: 'Preciso confirmar dados bancários para pagamento', at: new Date().toISOString() }, { from: 'AVC', text: 'Enviamos atualização por favor verifique', at: new Date().toISOString() } ], unread: 1 },
      { id: 'CHT002', avdId: 'AVD003', messages: [ { from: 'AVD', text: 'Solicitação de renegociação', at: new Date().toISOString() } ], unread: 0 }
    ];

    const cnabUploads = JSON.parse(localStorage.getItem('cnabUploads') || '[]');

    const payments = [
      { id: 'PAY001', avdId: 'AVD001', method: 'boleto', amount: 150000, status: 'confirmado', when: new Date().toISOString() },
      { id: 'PAY002', avdId: 'AVD002', method: 'cnab', amount: 85000, status: 'pendente', when: new Date().toISOString() },
      { id: 'PAY003', avdId: 'AVD003', method: 'pix', amount: 220000, status: 'confirmado', when: new Date().toISOString() },
      { id: 'PAY004', avdId: 'AVD002', method: 'pix', amount: 85000, status: 'confirmado', when: new Date().toISOString() },
      { id: 'PAY005', avdId: 'AVD004', method: 'boleto', amount: 175000, status: 'pendente', when: new Date().toISOString() }
    ];

    const guarantees = [
      { id: 'G001', clienteId: '1', empresa: 'Empresa Energia Norte Ltda', valorSolicitado: 200000, status: 'pendente', solicitadoEm: new Date().toISOString() }
    ];

    localStorage.setItem('avds', JSON.stringify(avds));
    localStorage.setItem('chats', JSON.stringify(chats));
    localStorage.setItem('payments', JSON.stringify(payments));
    localStorage.setItem('guarantees', JSON.stringify(guarantees));
    localStorage.setItem('cnabUploads', JSON.stringify(cnabUploads));
    localStorage.setItem('mock:initialized', '1');
  } catch (e) {
    // ignore
  }
};

seedMockData();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Routes that require authentication and the main Layout */}
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/aviso-debito" element={<AvisoDebito />} />
            <Route path="/aviso-credito" element={<AvisoCredito />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/forbidden" element={<Forbidden />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Ensure we create the root only once (prevents duplicate createRoot calls during HMR)
const container = document.getElementById("root");
if (container) {
  const w = window as any;
  if (!w.__REACT_ROOT__) {
    w.__REACT_ROOT__ = createRoot(container);
  }
  w.__REACT_ROOT__.render(<App />);
}
