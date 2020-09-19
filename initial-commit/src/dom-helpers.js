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
        Object.entries(params).forEach(([param, value]) => elem[param] = value);
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
    }
};
