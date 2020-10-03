// Use the DOM helpers to display the commits
fetchCommits()
    .then(commits => {
        dh.a(
            dh.g("main-body"),
            commits.map(({ commit }) => {
                const { title, body } = parseMessage(commit.message);
                return dh.c('div', {}, [
                    title,
                    body,
                ])
            })
        );
    });