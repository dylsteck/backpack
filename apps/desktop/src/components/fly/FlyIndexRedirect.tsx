import { Navigate } from "@tanstack/react-router";

export function FlyIndexRedirect() {
	return <Navigate to="/fly/browser" replace />;
}
