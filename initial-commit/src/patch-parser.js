function parsePatch(patchString) {
    try {
        const patches = getPatchTree(patchString);
        return getHtmlFromPatchTree(patches);
    } catch (e) {
        // Missing or invalid patches will throw an error. When we actually
        // build the HTML for the patch, should also display some kind of error
        // with something like:
        // We weren't able to display the diff for this file. The file might
        // have an unsupported format, or something may have broken on our end.
        // For now, since there's no HTML anywhere, just log it and move on.
        console.error(e);
        return dh.f();
    }
    
}

function getPatchTree(patchString) {
    if (!patchString) return [];

    const lines = patchString.split("\n");

    // All headers are lines that look like this:
    // "@@ -(oldStartLine),(oldLineCount) +(newStartLine),(newLineCount) @@(...scope)"
    // Scope is a weird GitHub addition that allows you to see the first line of the
    // current scope so that there's more context when reviewing code where the scope
    // is defined before the patch starts. We don't need to worry about supporting it
    // for now.
    const headerRegex = /^@@ -(?<os>[0-9]+),(?<oc>[0-9]+) \+(?<ns>[0-9]+),(?<nc>[0-9]+) @@/;
    
    // Take a first pass through the lines and identify where the headers are.
    // We could do this all in one pass instead of two, but this drastically
    // simplifies the logic for tying up the info from one patch and
    // transitioning to the next. Plus, the number of lines that start with
    // "@@" should be very low in practice so this check should be fairly quick
    const headerIndices = [];
    for (let i = 0; i < lines.length; i++) {
        if (headerRegex.test(lines[i])) {
            headerIndices.push(i);
        }
    }

    // If the first line isn't a header, that's a problem
    if (headerIndices[0] !== 0) {
        throw new Error("Invalid patch format: first line is not a header");
    }

    const patches = [];
    for (let hi = 0; hi < headerIndices.length; hi++) {
        const header = lines[headerIndices[hi]];
        const headerMatch = header.match(headerRegex);

        // The header tells us the start line and lines changed for both the
        // LHS and RHS (referred to here as old and new). This will help us
        // sanity check that nothing is wrong with our code or the patch
        // since we can verify that the actual number of lines changed was
        // accurate. This also lets us keep track of the line number for
        // each change.
        const oldStart = parseInt(headerMatch.groups.os);
        const newStart = parseInt(headerMatch.groups.ns);
        const oldCount = parseInt(headerMatch.groups.oc);
        const newCount = parseInt(headerMatch.groups.nc);

        // Lower bound and upper bound for the lines that belong to this header
        const lb = headerIndices[hi] + 1;
        const ub = headerIndices[hi + 1] || lines.length;

        // Changes is an array of arrays. Each subarray has length 3 and the
        // following format: [lhsChange | null, rhsChange | null, change?]
        // 
        // lhsChange and rhsChange are objects that have the associated line
        // number (line) and the line of code (change). Either one can be null,
        // indicating that there was no corresponding change on the other side,
        // but they can't both be null.
        //
        // change? indicates whether the two lines are actually different. This
        // is necessary since the patch includes lines that aren't different,
        // but we still need to include both a lhs and rhs change in this case
        // to get line number information.
        const changes = [];

        let oldLine = oldStart, newLine = newStart;
        let currentBlock = null;
        const unwindCurrentBlock = () => {
            if (!currentBlock) return;
            const { additions, deletions } = currentBlock;

            const upperBound = Math.max(additions.length, deletions.length);
            for (let j = 0; j < upperBound; j++) {
                changes.push([
                    deletions[j] || null,
                    additions[j] || null,
                    true
                ]);
            }

            currentBlock = null;
        }
        for (let i = lb; i < ub; i++) {
            const l = lines[i];
            // These lines show up if we get a patch that ends the file
            // No need to handle them for now
            if (["", "\\ No newline at end of file"].includes(l)) {
                continue;
            }

            const type = l[0], change = l.slice(1);
            if (type === "-") {
                // Instead of pushing deletions right away, we store them in
                // the current block and push after we've seen all the additions.
                if (!currentBlock) currentBlock = { additions: [], deletions: [] }
                currentBlock.deletions.push({ line: oldLine++, change });
            } else if (type === "+") {
                if (!currentBlock) currentBlock = { additions: [], deletions: [] }
                currentBlock.additions.push({ line: newLine++, change });
            } else if (type === " ") {
                unwindCurrentBlock();
                changes.push([
                    { line: oldLine++, change },
                    { line: newLine++, change },
                    false
                ]);
            } else {
                throw new Error(`Invalid line change type: ${type} (line: ${l})`)
            }
        }

        // Clean up any leftovers
        unwindCurrentBlock();

        // Some sanity checks to make sure that the patch format is valid.
        // This also serves as a sanity check for our own code, since that's a
        // lot more likely to be broken than the patch. For example, when I was
        // testing this out on the linux repo, they had some files that
        // contained patch headers in them, which my regex mistakenly picked
        // up because it wasn't checking that the header was on the first page.
        // I probably wouldn't have noticed if these counts hadn't been way off.
        if (oldLine - oldStart !== oldCount || newLine - newStart !== newCount) {
            throw new Error(`Mismatch in lines changed count (header: ${header}, actual count: ${oldLine - oldStart},${newLine - newStart})`);
        } 
        
        patches.push({
            header,
            changes,
        });
    }

    return patches;
}

function getHtmlFromPatchTree(patches) {
    const getHtmlFromPatch = p => dh.f([
        dh.c('tr', { class: 'patch-header-row' }, [
            dh.c('td', { colspan: '4' }, [dh.t(p.header)])
        ]),
        ...p.changes.map(c => {
            const createLineSegment = (change, leftSide) => {
                let className;
                let contents = change ? change.change : '';
                let lineNumber = change ? change.line : '';
                if (change && c[2] && leftSide) {
                    className = 'removed';
                } else if (change && c[2]) {
                    className = 'added';
                } else if (change) {
                    className = 'unchanged';
                } else {
                    className = 'empty';
                }

                return [
                    dh.c('td', { class: `patch-change-segment line-number ${className}`}, [dh.t(lineNumber)]),
                    dh.c('td', { class: `patch-change-segment contents ${className}` }, [dh.t(contents)])
                ];
            }

            return dh.c('tr', { class: 'patch-change-row' }, [
                ...createLineSegment(c[0], true),
                ...createLineSegment(c[1], false)
            ]);
        })
    ]);

    return dh.c('table', { class: 'diff-viewer' }, [
        dh.c('colgroup', {}, [
            dh.c('col'),
            dh.c('col', { style: 'width: 50%; '}),
            dh.c('col'),
            dh.c('col', { style: 'width: 50%; '})
        ]),
        dh.c('tbody', {}, patches.map(getHtmlFromPatch))
    ])
}
