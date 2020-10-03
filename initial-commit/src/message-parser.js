function parseMessage(message) {
    // Treat the first line of the message like the title and the remaining
    // lines like post body. We'll interpret these as rich text messages.
    const split = message.indexOf("\n");
    const title = split === -1 ? message : message.slice(0, split);
    const lines = split === -1 ? [] : message.slice(split + 1).split("\n");

    const ast = getRichTextAst(lines);
    const body = getHtmlFromAst(ast);

    return {
        title: dh.c('h2', {}, [dh.t(title)]),
        body,
    }
}

function getRichTextAst(lines) {
    const blankLineRegex = /^[\s]*$/;
    function _getRichTextAst(context, index) {
        // Parse the message body by going through the message line by line
        const children = [];
        
        while (index < lines.length) {
            // Here, we'll handle the different types of lines we might encounter.
            // For now, all we need to do is check if the line is blank, since that
            // indicates a paragraph break
            const line = lines[index];
            const blankLine = blankLineRegex.test(line);

            switch (context.type) {
                case 'document':
                    if (!blankLine) {
                        // Parse the paragraph when we encounter a line that isn't blank.
                        // This also updates the index so that we restart where the paragraph
                        // left off.
                        [index, child] = _getRichTextAst({ type: 'paragraph' }, index);
                        children.push(child);
                    }
                    break;
                case 'paragraph':
                    if (!blankLine) {
                        // While the lines aren't blank, keep adding them as children
                        // of the current paragraph.
                        children.push({ type: 'line', line });
                    } else {
                        // When we see a blank line, we'll end the paragraph by exiting
                        // the paragraph context. We return the current index so our
                        // parent knows where we left off.
                        return [index, Object.assign({ children }, context)];
                    }
                    break;
            }
            index++;
        }
        return [index, Object.assign({ children }, context)];
    }

    // Start off in document contex at the first line.
    const [_, ast] = _getRichTextAst({ type: 'document' }, 0);
    return ast;
}

function getHtmlFromAst(ast) {
    // To create the HTML, we'll go through the AST recursively and
    // use the DOM helpers to create the appropriate DOM node for each
    // type of AST node.
    switch (ast.type) {
        case 'line':
            return dh.t(ast.line + " ");
        case 'paragraph':
            return dh.c('p', {}, ast.children.map(getHtmlFromAst));
        case 'document':
            return dh.f(ast.children.map(getHtmlFromAst));
    }
}
