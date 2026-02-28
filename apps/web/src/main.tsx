import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { App } from "./App";
import { TimelinePage, SourcesPage, SettingsPage, SetupPage } from "./App";
import "./index.css";

render(
	() => (
		<Router root={App}>
			<Route path="/sources" component={SourcesPage} />
			<Route path="/settings" component={SettingsPage} />
			<Route path="/setup" component={SetupPage} />
			<Route path="/" component={TimelinePage} />
		</Router>
	),
	document.getElementById("root")!
);
