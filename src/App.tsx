import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './features/auth/AuthProvider';
import { RequireAuth } from './features/auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { LoginRoute } from './routes/LoginRoute';
import { WelcomeRoute } from './routes/WelcomeRoute';
import { HomeRoute } from './routes/HomeRoute';
import { ComingSoonRoute } from './routes/ComingSoonRoute';
import { NewIdeaRoute } from './routes/NewIdeaRoute';
import { IdeaRoute } from './routes/IdeaRoute';
import { IdeaVersionsRoute } from './routes/IdeaVersionsRoute';
import { QuestionsRoute } from './routes/QuestionsRoute';

/** Every route except /login sits behind RequireAuth (spec section 11: no public pages). */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<RequireAuth />}>
            <Route path="/welcome" element={<WelcomeRoute />} />
            <Route element={<AppShell />}>
              <Route index element={<HomeRoute />} />
              <Route path="ideas/new" element={<NewIdeaRoute />} />
              <Route path="ideas/:id" element={<IdeaRoute />} />
              <Route path="ideas/:id/versions" element={<IdeaVersionsRoute />} />
              <Route path="questions" element={<QuestionsRoute />} />
              <Route
                path="activity"
                element={<ComingSoonRoute titleKey="nav.activity" step={6} />}
              />
              <Route path="trash" element={<ComingSoonRoute titleKey="nav.trash" step={6} />} />
              <Route
                path="settings"
                element={<ComingSoonRoute titleKey="nav.settings" step={6} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
