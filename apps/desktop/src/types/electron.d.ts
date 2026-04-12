interface WebviewHTMLElement extends HTMLElement {
	capturePage: () => Promise<Electron.NativeImage>;
	getTitle: () => string;
	getURL: () => string;
	loadURL: (url: string) => Promise<void>;
	goBack: () => void;
	goForward: () => void;
	reload: () => void;
	canGoBack: () => boolean;
	canGoForward: () => boolean;
}

declare namespace JSX {
	interface IntrinsicElements {
		webview: React.DetailedHTMLProps<
			React.HTMLAttributes<WebviewHTMLElement> & {
				src?: string;
				preload?: string;
				partition?: string;
				allowpopups?: string;
				nodeintegration?: string;
			},
			WebviewHTMLElement
		>;
	}
}
