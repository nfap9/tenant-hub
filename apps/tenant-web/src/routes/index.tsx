import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from '@/components/RequireAuth';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: '/',
        element: <Dashboard />,
      },
      {
        path: '/apartments',
        element: <NotFound />,
      },
      {
        path: '/tenants',
        element: <NotFound />,
      },
      {
        path: '/leases',
        element: <NotFound />,
      },
      {
        path: '/bills',
        element: <NotFound />,
      },
      {
        path: '/maintenance',
        element: <NotFound />,
      },
      {
        path: '/settings',
        element: <NotFound />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
