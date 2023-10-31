var challengesCompleted = [];

function addToStore(id) {
    console.log("Adding to Challenges Completed: id = " + id);
    challengesCompleted.push(id);
}

function removeFromStore(id) {
    const index = challengesCompleted.indexOf(id);
    if (index !== -1) {
        console.log("Removing from Challenges Completed: id = " + id);
        challengesCompleted.splice(index, 1);
    }
}

function isChallengeCompleted(id) {
    return challengesCompleted.includes(id);
}

function getCompletedChallenges() {
    return challengesCompleted;
}

export default {
    addToStore,
    removeFromStore,
    isChallengeCompleted,
    getCompletedChallenges
};
