import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './features/auth/AuthProvider';
import { RequireAuth } from './features/auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { LoginRoute } from './routes/LoginRoute';
import { WelcomeRoute } from './routes/WelcomeRoute';
import { HomeRoute } from './routes/HomeRoute';
import { NewIdeaRoute } from './routes/NewIdeaRoute';
import { IdeaRoute } from './routes/IdeaRoute';
import { IdeaVersionsRoute } from './routes/IdeaVersionsRoute';
import { QuestionsRoute } from './routes/QuestionsRoute';
import { ActivityRoute } from './routes/ActivityRoute';
import { TrashRoute } from './routes/TrashRoute';
import { SettingsRoute } from './routes/SettingsRoute';
import { IdeaPrintRoute } from './routes/IdeaPrintRoute';

/** Every route except /login sits behind RequireAuth (spec section 11: no public pages). */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<RequireAuth />}>
            <Route path="/welcome" element={<WelcomeRoute />} />
            <Route path="/ideas/:id/print" element={<IdeaPrintRoute />} />
            <Route element={<AppShell />}>
              <Route index element={<HomeRoute />} />
              <Route path="ideas/new" element={<NewIdeaRoute />} />
              <Route path="ideas/:id" element={<IdeaRoute />} />
              <Route path="ideas/:id/versions" element={<IdeaVersionsRoute />} />
              <Route path="questions" element={<QuestionsRoute />} />
              <Route path="activity" element={<ActivityRoute />} />
              <Route path="trash" element={<TrashRoute />} />
              <Route path="settings" element={<SettingsRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
