import React from 'react';
import { useAuth } from '../context/AuthContext.js'; // <-- Added .js extension
import { Navigate, Outlet } from 'react-router-dom';

/*
... existing code ...
*/
export function ProtectedRoute() {
/*
... existing code ...
*/
  return <Outlet />;
}
/*
... existing code ...
*/
export function PublicOnlyRoute() {
/*
... existing code ...
*/
  return <Outlet />;
}
