import createEl from './common/createEl';
import { router } from './common/router';
import './style/sidebar.css';
import logoUrl from '/webgpu.svg?url'

export default function sideBar(items: string[]) {
    const _img = createEl({ tagName: 'img', className: 'logo' });
    _img.src = logoUrl;
    _img.alt = 'logo';

    const _githubLink = createEl({ tagName: 'a', txt: '🔗 GitHub', className: 'github-link' });
    // _githubLink.href = 'https://github.com/wzdong26/webgpu-samples';
    _githubLink.target = '_blank';
    _githubLink.addEventListener('click', () => {
        window.open('https://github.com/wzdong26/webgpu-samples', '_blank');
    });

    const _navItems = items?.map((item) => {
        return createEl({ className: 'nav-item', txt: item });
    });
    const _navbar = createEl({ className: 'navbar', children: _navItems });
    
    let activeItem: HTMLDivElement | undefined;
    if (location.hash) {
        activeItem = _navItems.find(e => e.innerText === location.hash.replace('#/', ''));
        activeItem?.classList.add('nav-item-active');
    }
    _navbar.addEventListener('click', ({ target }) => {
        const el = target as HTMLDivElement;
        if (el.className === 'nav-item' && el.innerText) {
            activeItem?.classList.remove('nav-item-active');
            router.replace(el.innerText);
            activeItem = el;
            activeItem.classList.add('nav-item-active');
        }
    });
    const _sidebar = createEl({ className: 'sidebar', children: [_img, _githubLink, _navbar] });
    return _sidebar;
}
