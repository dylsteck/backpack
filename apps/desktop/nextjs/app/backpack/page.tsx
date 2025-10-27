import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@cortex/auth";
import Backpack from "./backpack";

export default async function BackpackPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	return <Backpack session={session} />;
}

