import { NextRequest, NextResponse } from "next/server";

// This API route acts as a proxy to forward requests to the main server
export async function GET(
	request: NextRequest,
	{ params }: { params: { path: string[] } }
) {
	const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
	const path = params.path.join("/");
	const searchParams = request.nextUrl.searchParams.toString();
	const url = `${serverUrl}/${path}${searchParams ? `?${searchParams}` : ""}`;

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				...Object.fromEntries(request.headers),
				host: new URL(serverUrl!).host,
			},
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to proxy request" },
			{ status: 500 }
		);
	}
}

export async function POST(
	request: NextRequest,
	{ params }: { params: { path: string[] } }
) {
	const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
	const path = params.path.join("/");
	const url = `${serverUrl}/${path}`;
	const body = await request.text();

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				...Object.fromEntries(request.headers),
				host: new URL(serverUrl!).host,
			},
			body,
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to proxy request" },
			{ status: 500 }
		);
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: { path: string[] } }
) {
	const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
	const path = params.path.join("/");
	const url = `${serverUrl}/${path}`;
	const body = await request.text();

	try {
		const response = await fetch(url, {
			method: "PUT",
			headers: {
				...Object.fromEntries(request.headers),
				host: new URL(serverUrl!).host,
			},
			body,
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to proxy request" },
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { path: string[] } }
) {
	const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
	const path = params.path.join("/");
	const url = `${serverUrl}/${path}`;

	try {
		const response = await fetch(url, {
			method: "DELETE",
			headers: {
				...Object.fromEntries(request.headers),
				host: new URL(serverUrl!).host,
			},
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to proxy request" },
			{ status: 500 }
		);
	}
}

