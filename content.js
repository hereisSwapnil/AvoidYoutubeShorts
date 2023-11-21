const addNoShorts = () => {
    console.log("Shorts Guard content script loaded");
    let noShortsHeading = document.createElement("h1");
    noShortsHeading.classList.add("noShorts")
    noShortsHeading.textContent = "No Shorts 😂";
    document.body.appendChild(noShortsHeading);
}

addNoShorts();