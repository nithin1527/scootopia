export function show(e) { e.classList.remove('hidden'); }
export function hide(e) { e.classList.add('hidden'); }

export function toggleActive(e) { e.classList.toggle('active'); }
export function toggleHidden(e) { e.classList.toggle('hidden'); }

export function activate(e) { e.classList.add('active'); }
export function deactivate(e) { e.classList.remove('active'); }

export function toggleActiveState(icon) { return function() { toggleActive(icon); } }
export function toggleUniqueActiveState(icon, iconList) { 
    return function() {
        iconList.forEach(icon => deactivate(icon));
        activate(icon);
    } 
}

export function toggleStyles(e, from, to) {
    e.classList.remove(from);
    e.classList.add(to);
}