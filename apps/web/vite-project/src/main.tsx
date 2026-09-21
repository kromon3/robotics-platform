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
import {Robots} from "./pages/robot.tsx";
import {RobotDetail} from "./pages/robot-detail.tsx";
import {Project} from "./pages/project.tsx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <BrowserRouter>
          <Routes>
              <Route element={<AppLayout />}>
                  <Route index element={<App />} />
                  <Route path="/projects" element={<Project/>} />
                  <Route path="/robots" element={<Robots />} />
                  <Route path="/robots/:id" element={<RobotDetail />} />
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
