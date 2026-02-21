import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { App } from "./App";
import { TimelinePage, ConnectionsPage, SettingsPage } from "./App";
import "./index.css";

render(
	() => (
		<Router root={App}>
			<Route path="/connections" component={ConnectionsPage} />
			<Route path="/settings" component={SettingsPage} />
			<Route path="/" component={TimelinePage} />
		</Router>
	),
	document.getElementById("root")!
);
