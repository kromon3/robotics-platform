import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {BrowserRouter, Route, Routes} from "react-router";
import './index.css';
import App from './App';
import {Auth} from "./pages/auth.tsx";
import {Login} from "./pages/login.tsx";
import {Placeholder} from "./pages/placeholder.tsx";
import {AppLayout} from "./layouts/AppLayout.tsx";
import {Toaster} from "sonner";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <BrowserRouter>
          <Routes>
              <Route element={<AppLayout />}>
                  <Route index element={<App />} />
                  <Route path="/projects" element={<Placeholder title="Проекты" />} />
                  <Route path="/robots" element={<Placeholder title="Роботы" />} />
                  <Route path="/calculations" element={<Placeholder title="Расчёты" />} />
                  <Route path="/settings" element={<Placeholder title="Настройки" />} />
              </Route>

              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Login />} />
          </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
  </StrictMode>,
)
