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
    if (!url) return router.push(pagesArr[0]);
    let key = (url ?? location.pathname).replace('/', '');
    pages[key as keyof typeof pages]?.().then(async ({ render }) => {
        pause = await render?.(_canvas);
    });
};
router.after(loadPage);
loadPage();
