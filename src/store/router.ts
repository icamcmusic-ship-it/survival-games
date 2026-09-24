/**
 * UX-14: real navigation.
 *
 * The screen used to live only in `view` state, so the URL never moved and the
 * browser's back button did nothing at all — the single most-used control on
 * the page was inert.
 *
 * This is a hash router rather than a History-API path router, and rather than
 * a dependency. The app ships to GitHub Pages under `/survival-games/`, which
 * serves static files with no SPA rewrite: a deep link to `/survival-games/arena`
 * would 404 on refresh, while `#/arena` always resolves to index.html. Hash
 * routing also leaves `location.search` untouched, so the seed-replay links
 * ShareButton builds (`?seed=…&arena=…`) keep working exactly as before.
 */
import { ViewName, gameActions, gameStore } from './gameStore';

/** The one place a screen's name and its URL are tied together. */
const ROUTES: Array<{ view: ViewName; path: string }> = [
    { view: 'setup', path: '/' },
    // §(requests 5): the roster is a tab inside the arena now. The path is kept
    // so an old bookmark resolves instead of 404ing; it lands on the reaping
    // while one is open, and on the arena once the Games are running.
    { view: 'roster', path: '/roster' },
    { view: 'game', path: '/arena' },
    // A3: the chronicle as a page of its own, not a scrollbox inside the arena.
    { view: 'chronicle', path: '/chronicle' },
    { view: 'hallOfFame', path: '/hall-of-fame' },
    // §(requests 4): always reachable, run or no run.
    { view: 'howToPlay', path: '/how-to-play' },
];

/**
 * What a route needs before it can render anything.
 *
 * `roster` needs a cast; `arena` needs a run that has actually left the reaping,
 * because before that GameScreen has no Games to show. Deep-linking into either
 * without it is a redirect, not a blank page.
 */
export function routeIsAvailable(view: ViewName): boolean {
    const { gameState } = gameStore.getState();
    // §(requests 5): only the reaping still renders here. Everything the old
    // roster page did lives in the arena's Roster tab.
    if (view === 'roster') return !!gameState && gameState.phase === 'reaping';
    if (view === 'game') return !!gameState && gameState.phase !== 'reaping';
    // §(requests 7): confirming the reaping lands on the chronicle, which at
    // that point has no pages yet and offers the button that starts the run.
    if (view === 'chronicle') return !!gameState && gameState.phase !== 'reaping';
    return true;
}

/** Where a route falls back to when it can't render. */
export function fallbackFor(view: ViewName): ViewName {
    const { gameState } = gameStore.getState();
    if (!gameState) return 'setup';
    // A run still on the plates goes to the reaping; anything else to the arena.
    if (gameState.phase === 'reaping') return 'roster';
    if (view === 'roster') return 'game';
    return 'setup';
}

export function pathForView(view: ViewName): string {
    return ROUTES.find(r => r.view === view)?.path ?? '/';
}

export function viewForPath(path: string): ViewName | null {
    const normalised = path.replace(/\/+$/, '') || '/';
    return ROUTES.find(r => r.path === normalised)?.view ?? null;
}

/**
 * The view the current URL is asking for, or null if the hash names no route.
 *
 * Only hashes that look like a path (`#/arena`) are routes. Plain fragment
 * links — the skip-to-content link is one — must be left alone, or focusing
 * the main region would navigate the app back to setup.
 */
export function viewFromLocation(): ViewName | null {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash.startsWith('/')) return null;
    // A3: `#/chronicle?day=4&phase=night` is a deep link into a chronicle
    // page. The query belongs to the screen, not to the route, so it is
    // stripped before the path is matched.
    const q = hash.indexOf('?');
    return viewForPath(q < 0 ? hash : hash.slice(0, q));
}

/** True when the hash is a fragment link rather than a route. */
function hashIsFragment(): boolean {
    const hash = window.location.hash.replace(/^#/, '');
    return hash.length > 0 && !hash.startsWith('/');
}

/**
 * Deep-linking into `#/arena` with nothing to simulate used to be impossible
 * only because deep-linking was impossible. Now it has to fail gracefully:
 * a screen that needs a run and hasn't got one falls back to setup.
 */
export function resolveView(target: ViewName | null): ViewName {
    if (!target) return 'setup';
    return routeIsAvailable(target) ? target : fallbackFor(target);
}

// AUDIT-11 U4: a query waiting to ride along with the next view change.
let pendingQuery: string | null = null;

function writeUrl(view: ViewName, replace: boolean) {
    const query = pendingQuery ? `?${pendingQuery}` : '';
    pendingQuery = null;
    const url = `${window.location.pathname}${window.location.search}#${pathForView(view)}${query}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
}

// Set while the router itself is writing the view, so the store subscription
// doesn't push a history entry for a change the URL already describes.
let applyingFromUrl = false;

function setViewSilently(view: ViewName, replaceUrl: boolean) {
    applyingFromUrl = true;
    try {
        gameStore.setState({ view });
    } finally {
        applyingFromUrl = false;
    }
    if (replaceUrl) writeUrl(view, true);
}

/**
 * Send the app somewhere it can actually render, without leaving a history
 * entry — a redirect the reader never asked for must not become a step they
 * have to press Back through.
 */
export function redirectView(view: ViewName) {
    setViewSilently(view, true);
}

/**
 * Wires the store and the address bar together in both directions.
 *
 * @param adoptUrl false when something has already decided the view this load
 *        (a seed-replay link booting straight into a run), in which case the
 *        URL is corrected to match instead of the other way round.
 */
export function initRouter(adoptUrl = true): () => void {
    const applyUrl = () => {
        if (hashIsFragment()) return;
        const target = viewFromLocation();
        const resolved = resolveView(target);
        // A redirected or unrecognised route shouldn't leave a stale URL behind,
        // and shouldn't add a history entry the reader never asked for.
        setViewSilently(resolved, resolved !== target);
    };

    if (adoptUrl) applyUrl();
    else writeUrl(gameStore.getState().view, true);

    let lastView = gameStore.getState().view;
    const unsubscribe = gameStore.subscribe(() => {
        const view = gameStore.getState().view;
        if (view === lastView) return;
        lastView = view;
        if (applyingFromUrl) return;
        writeUrl(view, false);
    });

    const onHashChange = () => {
        applyUrl();
        lastView = gameStore.getState().view;
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
        window.removeEventListener('hashchange', onHashChange);
        unsubscribe();
    };
}

/**
 * AUDIT-11 U4: navigate to a view *with* a screen query
 * (`#/chronicle?day=4&phase=night`). Setting the hash and then calling
 * `setView` used to let the router push a bare `#/chronicle` over it, so the
 * chronicle opened at page 0. The query now travels with the push.
 */
export function navigate(view: ViewName, query?: string) {
    const { view: current } = gameStore.getState();
    if (current === view) {
        const url = `${window.location.pathname}${window.location.search}#${pathForView(view)}${query ? `?${query}` : ''}`;
        window.history.pushState(null, '', url);
        window.dispatchEvent(new CustomEvent('sg:route-query'));
        return;
    }
    pendingQuery = query ?? null;
    gameActions.setView(view);
    pendingQuery = null;
}
