import { createFileRoute } from "@tanstack/react-router";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { useState } from "react";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const [showSignIn, setShowSignIn] = useState(false);

	return showSignIn ? (
		<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
	) : (
		<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
	);
}

