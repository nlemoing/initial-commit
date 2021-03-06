const dh = {
    /**
     * Get a DOM element by its id
     * @param {string} id 
     */
    g(id) {
        return document.getElementById(id);
    },
    /**
     * Create a DOM element with a given type, params, and children
     * children should all be DOM nodes, else this will throw
     * @param {string} type 
     * @param {Object} params 
     * @param {DOMNode[]} children
     */
    c(type, params = {}, children = []) {
        const elem = document.createElement(type);
        Object.entries(params).forEach(([param, value]) => elem.setAttribute(param, value));
        children.forEach(child => elem.appendChild(child));
        return elem;
    },
    /**
     * Append children to an existing element
     * @param {DOMNode} container 
     * @param {DOMNode[]} child 
     */
    a(container, children) {
        children.forEach(child => container.appendChild(child));
    },
    /**
     * Create a document fragment with the specified children
     * @param {DOMNode[]} children
     */
    f(children = []) {
        const elem = document.createDocumentFragment();
        children.forEach(child => elem.appendChild(child));
        return elem;
    },
    /**
     * Create a text node with the provided string
     * @param {string} text
     */
    t(text) {
        return document.createTextNode(text);
    }
};
