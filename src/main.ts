import createEl from './common/createEl';
import { router } from './common/router';
import { pages } from './pages';
import sideBar from './sidebar';
import './style/main.css';

const _app = document.getElementById('app')!;
const pagesArr = Object.keys(pages);
_app.appendChild(sideBar(pagesArr));
const _canvas = createEl({ tagName: 'canvas', className: 'canvas' });
_app.appendChild(_canvas);

let pause: void | (() => void);
const loadPage = (url?: string) => {
    pause?.();
    let key = (url ?? location.pathname).replace('/', '');
    if (!key) return router.replace(pagesArr[0]);
    pages[key as keyof typeof pages]?.().then(async ({ render }) => {
        pause = await render?.(_canvas);
    });
};
router.after(loadPage);
loadPage();
