// Use the DOM helpers to display the commits
fetchCommits()
    .then(commits => {
        dh.a(
            dh.g("main-body"),
            commits.map(({ commit }) => {
                return dh.c('div', {}, [
                    dh.c('p', { innerText: `Message: ${commit.message}` }),
                    dh.c('p', { innerText: `By ${commit.author.name} on ${commit.author.date}` }),
                ])
            })
        );
    });