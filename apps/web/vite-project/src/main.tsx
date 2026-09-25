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
import {ProjectOffers} from "./pages/project-offers.tsx";
import {Calculations} from "./pages/calculations.tsx";
import {ProjectEconomics} from "./pages/project-economics.tsx";
import {ProjectResult} from "./pages/project-result.tsx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <BrowserRouter>
          <Routes>
              <Route element={<AppLayout />}>
                  <Route index element={<App />} />
                  <Route path="/projects" element={<Project/>} />
                  <Route path="/projects/offers" element={<ProjectOffers />} />
                  <Route path="/projects/economics" element={<ProjectEconomics />} />
                  <Route path="/projects/result" element={<ProjectResult />} />
                  <Route path="/robots" element={<Robots />} />
                  <Route path="/robots/:id" element={<RobotDetail />} />
                  <Route path="/calculations" element={<Calculations />} />
                  <Route path="/settings" element={<Placeholder title="Настройки" />} />
              </Route>

              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Login />} />
          </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
  </StrictMode>,
)
