import { requestAdapter } from './common/compatiblity';
import createEl from './common/createEl';
import { router } from './common/router';
import { pages } from './pages';
import sideBar from './sidebar';
import './style/main.css';

import '@/utils/frame';

const _app = document.getElementById('app')!;
const _canvas = createEl({ tagName: 'canvas', className: 'canvas' });
const _canvasContainer = createEl({ className: 'canvas-container', children: [_canvas] });
const _errPage = createEl({ className: 'err-page', txt: 'WEBGPU NOT SUPPORT!' });
_app.appendChild(_canvasContainer);
const pagesArr = Object.keys(pages);
_app.appendChild(sideBar(pagesArr));
requestAdapter().then(undefined, () => {
    _canvasContainer.appendChild(_errPage);
});

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
