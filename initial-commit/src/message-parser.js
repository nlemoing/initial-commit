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
    // This regex has 3 parts:
    // Leading whitespace: 
    //    In this case, we accept any amount of whitespace to start the line
    // List marker:
    //    For unordered lists, it can be -, + or * (the first 3 cases).
    //    For ordered lists, it is a number followed by either . or )
    // Trailing whitespace:
    //    There has to be at one whitespace character after the list marker,
    //    but past that we accept any amount
    const listItemRegex =
        /^(?<leadingWS>\s*)(?<marker>(-|\+|\*|([0-9]+[.|\)])))(?<trailingWS>\s+)/;
    function _parseListItem(line) {
        // This function bundles the list item regex and subsequent parsing
        // into one convenient function
        const listItemMatch = line.match(listItemRegex);
        if (!listItemMatch) return null;
        const { leadingWS, marker, trailingWS } = listItemMatch.groups;
        const indentation = leadingWS.length + marker.length + trailingWS.length;
        const markerType = marker.slice(-1);
        const type = [')', '.'].includes(markerType) 
            ? 'orderedList'
            : 'unorderedList';
        const markerNumber = markerType == 'orderedList' 
            ? marker.slice(0, -1)
            : undefined;

        return {
            type,
            indentation,
            markerType,
            markerNumber,
        };
    }

    function _getBlockAst(context, index) {
        // Parse the message body by going through the message line by line
        const children = [];
        
        while (index < lines.length) {
            // Here, we'll handle the different types of lines we might encounter.
            // For now, all we need to do is check if the line is blank, since that
            // indicates a paragraph/list break, or if the line is a list item.
            const line = lines[index];
            const blankLine = blankLineRegex.test(line);
            const listItem = _parseListItem(line);

            switch (context.type) {
                case 'document':
                    if (listItem) {
                        [index, child] = _getBlockAst(listItem, index);
                        children.push(child);
                    } else if (!blankLine) {
                        // Parse the paragraph when we encounter a line that isn't blank.
                        // This also updates the index so that we restart where the paragraph
                        // left off.
                        [index, child] = _getBlockAst({ type: 'paragraph' }, index);
                        children.push(child);
                    }
                    break;
                case 'paragraph':
                    if (!blankLine && !listItem) {
                        // While the lines aren't blank, keep adding them as children
                        // of the current paragraph.
                        children.push({ type: 'line', line });
                    } else {
                        // When we see a blank line, we'll end the paragraph by exiting
                        // the paragraph context. We return the current index so our
                        // parent knows where we left off.
                        return [index - 1, Object.assign({ children }, context)];
                    }
                    break;
                case 'unorderedList':
                case 'orderedList':
                    if (blankLine) {
                        return [index - 1, Object.assign({ children }, context)];
                    }
                    if (listItem) {
                        const indentationDiff = listItem.indentation - context.indentation;
                        const sameMarker = listItem.markerType === context.markerType;
                        // If it's a different marker on the same indent, or a lower indent, 
                        // return since the line belongs to a different list
                        if (
                            (indentationDiff === 0 && !sameMarker) ||
                            indentationDiff < 0
                        ) {
                            return [index - 1, Object.assign({ children }, context)];
                        }
                        // If it's a higher indent, make a child list
                        // Otherwise, it's the same indent and marker, so make a list item
                        if (indentationDiff > 0) {
                            [index, child] = _getBlockAst(listItem, index);
                        } else {
                            [index, child] = _getBlockAst(
                                Object.assign({}, listItem, {
                                    type: 'listItem',
                                    firstLine: true,
                                }),
                                index
                            );
                        }
                        children.push(child);
                    }
                    break;
                case 'listItem':
                    // A blank line or another list item causes us to exit the
                    // current list item, since the list context is in charge of
                    // handling list items and a blank line ends the list context.
                    if (blankLine || (!context.firstLine && listItem)) {
                        return [index - 1, Object.assign({ children }, context)];
                    }
                    // If it's the first line in the list, strip off the list marker.
                    // Otherwise, strip off any leading whitespace.
                    children.push({ 
                        type: 'line', 
                        line: context.firstLine
                            ? line.slice(context.indentation)
                            : line.trimStart(),
                    });
                    context.firstLine = false; 
                    break;
            }
            index++;
        }
        return [index, Object.assign({ children }, context)];
    }

    // Start off in document context at the first line.
    const [_, blockAst] = _getBlockAst({ type: 'document' }, 0);

    // Once we have the block structure AST, run some post-processing
    // to combine adjacent 'line' items and then create the inline AST
    const SYMBOLS = {
        '**': 'bold',
        '__': 'bold',
        '*': 'emphasis',
        '_': 'emphasis',
        '`': 'codeFence',
    };
    // A link in Markdown has the form [text](link), but the regex is hard
    // to read because of all the escapes and special characters.
    const linkRegex = /^\[(?<linkText>.*)\]\((?<linkHref>.*)\)/;
    function _getInlineAst(ast) {
        // The way this code is laid out actually ends up being a bit
        // backwards since the 'line' nodes are only processed after they
        // are combined in the parent node even though this code comes
        // before the combination step. Rest assured that it all works out.
        if (ast.type === 'line') {
            // We'll handle all the inline stuff by keeping a stack of
            // special symbols that represent various inline rich text
            // features.
            const stack = [{ type: 'line', symbol: '', children: [] }];
            let index = 0;
            let buffer = '';
            while (index < ast.line.length) {
                // Check for a link first using the regex since it's not
                // as cut and dry to handle it using our character by 
                // character approach.
                const linkMatch = ast.line.slice(index).match(linkRegex);
                if (linkMatch) {
                    const { linkText, linkHref } = linkMatch.groups;
                    stack[stack.length - 1].children.push({ 
                        type: 'text',
                        buffer,
                        children: []
                    }, {
                        type: 'link',
                        linkText,
                        linkHref,
                        children: []
                    });
                    buffer = '';
                    index += linkMatch[0].length;
                    continue;
                }

                // Find the first matching symbol that starts the line, if there
                // is one.
                const symbol = Object.keys(SYMBOLS).reduce((match, symbol) => {
                    if (match) return match;
                    if (ast.line.slice(index).startsWith(symbol)) return symbol;
                    return null;
                }, null);

                if (symbol === stack[stack.length - 1].symbol) {
                    // If the symbol matches the top of the stack, we want to
                    // store the existing buffer and exit the current context 
                    if (buffer) { 
                        stack[stack.length - 1].children.push({ 
                            type: 'text',
                            buffer,
                            children: []
                        });
                    }
                    const childNode = stack.pop();
                    stack[stack.length - 1].children.push(childNode);
                    buffer = '';
                } else if (symbol) {
                    // If the symbol doesn't match, that means we want to enter
                    // a new context. Store the existing buffer on the stack
                    // and clear it. Then, push a new context onto the stack.
                    if (buffer) { 
                        stack[stack.length - 1].children.push({ 
                            type: 'text',
                            buffer,
                            children: []
                        });
                    }
                    stack.push({
                        type: SYMBOLS[symbol],
                        symbol,
                        children: []
                    });
                    buffer = '';
                } else {
                    // If no symbol was matched, add the first character to the buffer
                    buffer += ast.line[index];
                }
                
                index++;
            }
            // At the very end, unwind any remaining symbols that didn't match and
            // treat them as regular text.
            if (buffer) {
                stack[stack.length - 1].children.push({
                    type: 'text',
                    buffer,
                    children: []
                });
            }
            while (stack.length > 1) {
                const child = stack.pop();
                stack[stack.length - 1].children.push({ 
                    type: 'text', 
                    buffer: child.symbol,
                    children: child.children
                });
            }
            return stack[0];
        }

        // Process the children by combining any adjacent line items,
        // then doing recursion
        ast.children = (ast.children || [])
            .reduce((children, child) => {
                if (
                    children.length &&
                    children[children.length - 1].type === 'line' &&
                    child.type === 'line'
                ) {
                    // Prepend a space before each new line we add
                    children[children.length - 1].line += ` ${child.line}`;
                } else {
                    children.push(child);
                }
                return children;
            }, [])
            .map(_getInlineAst);
        return ast;
    }

    const ast = _getInlineAst(blockAst);

    return ast;
}

function getHtmlFromAst(ast) {
    // To create the HTML, we'll go through the AST recursively and
    // use the DOM helpers to create the appropriate DOM node for each
    // type of AST node.

    const children = ast.children.map(getHtmlFromAst);

    switch (ast.type) {
        case 'text':
            return dh.t(ast.buffer);
        case 'paragraph':
            return dh.c('p', {}, children);
        case 'unorderedList':
            return dh.c('ul', {}, children);
        case 'orderedList':
            return dh.c('ol', {}, children);
        case 'listItem':
            return dh.c('li', {}, children);
        case 'bold':
            return dh.c('b', {}, children);
        case 'emphasis':
            return dh.c('em', {}, children);
        case 'codeFence':
            return dh.c('code', {}, children);
        case 'link':
            return dh.c('a', { href: ast.linkHref }, [dh.t(ast.linkText)]);
        case 'line':
        case 'document':
            return dh.f(children);
        default:
            console.warn(`Unsupported Node Type ${ast.type}`);
            return dh.f();
    }
}
