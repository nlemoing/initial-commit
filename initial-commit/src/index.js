function parseDate(dateString) {
    const d = new Date(dateString);
    return {
        date: d.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }),
        time: d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: 'numeric'
        })
    }
}

function createChangesElement({ files }) {
    fileChanges = files.map(({ filename, additions, deletions, patch }) => {
        const heading = dh.c('p', {}, [
            dh.c('b', {}, [dh.t(filename)]),
            dh.t(': '),
            dh.c('span', { class: 'file-addition-count' }, [dh.t(`+${additions}`)]),
            dh.t(', '),
            dh.c('span', { class: 'file-deletion-count' }, [dh.t(`-${deletions}`)])
        ]);

        const changes = parsePatch(patch);

        return dh.c('div', {}, [ heading, changes ]);
    })
    return dh.c('div', { class: 'commit-changes' }, fileChanges);
}

// Use the DOM helpers to display the commits
fetchCommits()
    .then(([ commits, meta ]) => {
        dh.a(
            dh.g("commits"),
            commits.map(({ commit, sha }) => {
                const toggleChangesButton = dh.c(
                    'button',
                    { class: 'see-changes-button'},
                    [dh.t('See changes')]
                );
                let changes, hidden = true;
                toggleChangesButton.addEventListener('click', () => {
                    hidden = !hidden;
                    let changesPromise;
                    if (!changes) {
                        changesPromise = fetchCommit(sha).then(r => {
                            changes = createChangesElement(r);
                            dh.g(`commit-message-${sha}`).after(changes);
                        });
                    } else {
                        changesPromise = Promise.resolve();
                    }

                    changesPromise.then(() => {
                        const style = `display: ${hidden ? 'none' : 'inherit'};`;
                        changes.setAttribute('style', style)
                        toggleChangesButton.innerText = hidden ? 'Show changes' : 'Hide changes'
                    });
                });

                const { title, body } = parseMessage(commit.message);
                title.setAttribute('class', 'commit-title');
                const { date, time } = parseDate(commit.author.date);
                return dh.c('div', { class: 'commit', id: `commit-${sha}` }, [
                    dh.c('div', { class: 'commit-message', id: `commit-message-${sha}` }, [
                        title,
                        dh.c('p', { class: 'commit-author' }, [dh.t(
                            `Written by ${commit.author.name} on ${date} at ${time}`
                        )]),
                        body,
                        toggleChangesButton,
                    ]),
                    dh.c('hr'),
                ])
            })
        );

        dh.g("header").replaceChild(
            dh.f([
                dh.c('h1', {}, [dh.t(meta.repo)]),
                dh.c('p', {}, [dh.t(`by ${meta.owner}`)])
            ]),
            dh.g('title-placeholder')
        );

        dh.a(
            dh.g('links'),
            [
                meta.prevLink
                    ? dh.c('a', { href: meta.prevLink }, [dh.t('Back')])
                    : dh.c('span'),
                dh.t(`Page ${meta.page} of ${meta.lastPage}`),
                meta.nextLink
                    ? dh.c('a', { href: meta.nextLink }, [dh.t('Next')]) 
                    : dh.c('span')
            ]
        )
    });