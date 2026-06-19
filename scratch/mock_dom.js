// Mock DOM for running chess game tests in NodeJS.
const elementsById = new Map();

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this._id = '';
        this.className = '';
        this.textContent = '';
        this._innerHTML = '';
        this.children = [];
        this.parentNode = null;
        this.classList = {
            classes: new Set(),
            add: (c) => this.classList.classes.add(c),
            remove: (c) => this.classList.classes.delete(c),
            contains: (c) => this.classList.classes.has(c),
            toggle: (c) => {
                if (this.classList.classes.has(c)) {
                    this.classList.classes.delete(c);
                    return false;
                } else {
                    this.classList.classes.add(c);
                    return true;
                }
            }
        };
        this.dataset = {};
        this.attributes = {};
        this.listeners = {};
    }

    get id() {
        return this._id;
    }

    set id(val) {
        if (this._id) {
            elementsById.delete(this._id);
        }
        this._id = val;
        if (val) {
            elementsById.set(val, this);
        }
    }

    get localName() {
        return this.tagName.toLowerCase();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = val;
        this.children = [];
        if (val === '') {
            this.textContent = '';
            return;
        }
        const rawTags = val.match(/<[a-z1-6]+[^>]*>/gi) || [];
        rawTags.forEach(tagStr => {
            const tagNameMatch = tagStr.match(/<([a-z1-6]+)/i);
            if (!tagNameMatch) return;
            const tagName = tagNameMatch[1];
            const el = new MockElement(tagName);
            
            const idMatch = tagStr.match(/id\s*=\s*["']([^"']+)["']/i);
            if (idMatch) {
                el.id = idMatch[1];
            }
            
            const classMatch = tagStr.match(/class\s*=\s*["']([^"']+)["']/i);
            if (classMatch) {
                el.className = classMatch[1];
                classMatch[1].split(/\s+/).forEach(c => {
                    if (c) el.classList.add(c);
                });
            }
            
            const actionMatch = tagStr.match(/data-action\s*=\s*["']([^"']+)["']/i);
            if (actionMatch) {
                el.dataset.action = actionMatch[1];
                el.setAttribute("data-action", actionMatch[1]);
            }
            
            const titleMatch = tagStr.match(/title\s*=\s*["']([^"']+)["']/i);
            if (titleMatch) {
                el.setAttribute("title", titleMatch[1]);
            }
            
            this.appendChild(el);
        });
    }

    appendChild(child) {
        if (!child) return;
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    insertBefore(newChild, refChild) {
        if (!newChild) return;
        if (newChild.parentNode) {
            newChild.parentNode.removeChild(newChild);
        }
        newChild.parentNode = this;
        const refIndex = refChild ? this.children.indexOf(refChild) : -1;
        if (refIndex > -1) {
            this.children.splice(refIndex, 0, newChild);
        } else {
            this.children.push(newChild);
        }
        return newChild;
    }

    append(...children) {
        children.forEach(child => {
            if (typeof child === 'string') {
                const textNode = new MockElement('#text');
                textNode.textContent = child;
                this.appendChild(textNode);
            } else {
                this.appendChild(child);
            }
        });
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    addEventListener(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    click() {
        this.dispatchEvent({ type: 'click', target: this });
    }

    dispatchEvent(event) {
        const type = event.type;
        if (this.listeners[type]) {
            const cbs = [...this.listeners[type]];
            cbs.forEach(cb => cb(event));
        }
        if (this.parentNode) {
            this.parentNode.dispatchEvent(event);
        }
    }

    querySelector(selector) {
        if (selector === 'img') {
            return this.children.find(c => c.tagName === 'IMG') || null;
        }
        if (selector === '.highlight') {
            return this.children.find(c => c.classList.contains('highlight')) || null;
        }
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this.children.find(c => c.classList.contains(cls)) || null;
        }
        return null;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    insertAdjacentElement(position, element) {
        if (this.parentNode) {
            this.parentNode.appendChild(element);
        } else {
            this.appendChild(element);
        }
        return element;
    }
}

const documentMock = {
    body: new MockElement('body'),
    createElement: (tagName) => {
        return new MockElement(tagName);
    },
    getElementById: (id) => {
        return elementsById.get(id) || null;
    },
    querySelector: (selector) => {
        const search = (node) => {
            if (!node) return null;
            if (node.tagName && selector.toLowerCase() === node.tagName.toLowerCase()) return node;
            if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) return node;
            if (selector.startsWith('#') && node.id === selector.slice(1)) return node;
            if (selector.includes('=')) {
                const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
                if (match) {
                    const attr = match[1];
                    const val = match[2];
                    if (node.getAttribute(attr) === val) return node;
                }
            }
            for (let child of node.children) {
                const res = search(child);
                if (res) return res;
            }
            return null;
        };
        return search(documentMock.body);
    },
    querySelectorAll: (selector) => {
        const results = [];
        const search = (node) => {
            if (!node) return;
            let matches = false;
            if (selector === '.square' && node.classList.contains('square')) {
                matches = true;
            } else if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) {
                matches = true;
            } else if (node.tagName && selector.toLowerCase() === node.tagName.toLowerCase()) {
                matches = true;
            }
            if (matches) results.push(node);
            for (let child of node.children) {
                search(child);
            }
        };
        search(documentMock.body);
        return results;
    }
};

// Create a root div immediately
const root = documentMock.createElement('div');
root.id = 'root';
documentMock.body.appendChild(root);

global.document = documentMock;
global.window = {};

export { documentMock, root, elementsById };
