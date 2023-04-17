export default function createEl<K extends keyof HTMLElementTagNameMap = 'div'>(
    { tagName = 'div' as K, className, txt, children } = {} as {
        tagName?: K;
        className?: string;
        txt?: string;
        children?: Node[];
    }
): HTMLElementTagNameMap[K] {
    const div = document.createElement<K>(tagName);
    className && (div.className = className);
    txt && (div.innerText = txt);
    children?.length && div.append(...children);
    return div;
}
