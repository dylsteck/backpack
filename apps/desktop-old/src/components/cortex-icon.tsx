import { useState } from "react";

export default function CortexIcon({ size = 24 }: { size?: number }) {
	const [imageError, setImageError] = useState(false);

	const handleError = () => {
		console.error("[CortexIcon] Failed to load image:", "/cortex-app-icon.png");
		setImageError(true);
	};

	if (imageError) {
		return (
			<div
				className="rounded-md shrink-0 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold"
				style={{ width: size, height: size }}
			>
				C
			</div>
		);
	}

	return (
		<img
			src="/cortex-app-icon.png"
			alt="Cortex"
			width={size}
			height={size}
			className="rounded-md shrink-0"
			onError={handleError}
		/>
	);
}

