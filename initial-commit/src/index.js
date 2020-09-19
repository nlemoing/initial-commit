// Test out the DOM helpers
dh.a(
    dh.g("main-body"),
    [
        dh.c("h1", { 
            id: "main-title", 
            style: "background: red; color:white;",
            innerText: "Second Commit",
        }),
        dh.c("p", { innerText: "Test child" }, [dh.c("span")])
    ]
);
