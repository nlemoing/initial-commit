const {
    fetchCommits,
} = (() => {
    const GH_API = "https://api.github.com";
    const defaults = {
        repo: "initial-commit",
        owner: "nlemoing",
        page: 1,
        perPage: 10,
    };
    const overrides = Object.fromEntries(new URL(window.location).searchParams);
    if (!parseInt(overrides.page)) delete overrides.page;
    if (!parseInt(overrides.perPage)) delete overrides.perPage;
    const params = Object.assign({}, defaults, overrides);

    const COMMIT_API = `${GH_API}/repos/${params.owner}/${params.repo}/commits`;
    const headers = {
        'accept': 'application/vnd.github.v3+json',
    };

    const lastLinkHeaderRegex = /<(.+)>; rel="last"/;
    function countCommits() {
        const url = new URL(COMMIT_API);
        url.searchParams.append('per_page', 1);
        return fetch(url.toString(), {
            method: 'HEAD',
            headers,   
        }).then(response => {
            // The link header has the following format:
            // <{url1}>; rel="{rel1}", <{url2}>; rel="{rel2}", ...
            // We can split the header by commas to get each chunk,
            // then do a regex test against the pattern below to get
            // the "last" link.
            const linkHeader = response.headers.get('link') || "";
            return linkHeader.split(",").reduce((count, link) => {
                const matches = link.match(lastLinkHeaderRegex)
                if (!matches) return count;
                try {
                    return parseInt(new URL(matches[1]).searchParams.get('page'));
                } catch {
                    return count;
                }
            }, 0);
        }).catch(() => 0);
    }

    function fetchCommitPage(commitCount) {
        // This will be true only if there was something wrong with our fetch of
        // the commit count, or if some weird/invalid params get passed in
        if (
            !commitCount || 
            commitCount <= 0 || 
            parseInt(params.perPage) <= 0 || 
            parseInt(params.page) <= 0
        ) return [];

        // We want to get the last {params.perPage} commits, but since the API goes
        // in reverse order, we instead have to make two requests: 1 for the 
        // {Math.floor(commitCount / params.perPage)}th page, and 1 for the next page
        // to grab any stragglers
        const page = Math.floor(commitCount / params.perPage) - params.page + 1;
        if (page < 0) return [];
        const formatURL = p => {
            const url = new URL(COMMIT_API);
            url.searchParams.append('page', p);
            url.searchParams.append('per_page', params.perPage);
            return url.toString();
        }
        return Promise.all([
            page ? fetch(formatURL(page), { headers }) : { json: () => [] },
            fetch(formatURL(page + 1), { headers })
        ]).then((results) => {
            return Promise.all(results.map(r => r.json()));
        }).then(([firstPage, secondPage]) => {
            return firstPage.slice(commitCount % params.perPage)
                .concat(secondPage.slice(0, commitCount % params.perPage))
                .reverse();
        }).catch(() => []);
    }

    const fetchCommits = () => countCommits().then(fetchCommitPage);

    return {
        fetchCommits,
    }
})();

