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

// Use the DOM helpers to display the commits
fetchCommits()
    .then(([ commits, meta ]) => {
        dh.a(
            dh.g("commit-messages"),
            commits.map(({ commit }) => {
                const sha = new URL(commit.url).pathname.split('/').pop();
                const { title, body } = parseMessage(commit.message);
                title.setAttribute('class', 'commit-title');
                const { date, time } = parseDate(commit.author.date);
                return dh.c('div', { class: 'commit-message' }, [
                    title,
                    dh.c('p', { class: 'commit-author' }, [dh.t(
                        `Written by ${commit.author.name} on ${date} at ${time}`
                    )]),
                    body,
                    dh.c(
                        'a', 
                        {
                            href: `https://github.com/${meta.owner}/${meta.repo}/commit/${sha}`,
                            class: "commit-changes-link",
                        },
                        [dh.t('See changes')]
                    ),
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