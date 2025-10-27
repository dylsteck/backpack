import Image from "next/image";

export default function CortexIcon({ size = 24 }: { size?: number }) {
	return (
		<Image
			src="/cortex-app-icon.png"
			alt="Cortex"
			width={size}
			height={size}
			className="rounded-md"
		/>
	);
}

