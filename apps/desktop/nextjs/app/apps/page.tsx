import { redirect } from "next/navigation";
import Apps from "./apps";
import { headers } from "next/headers";
import { auth } from "@cortex/auth";

export default async function AppsPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	return <Apps session={session} />;
}

