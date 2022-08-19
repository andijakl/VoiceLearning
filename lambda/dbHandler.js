"use strict";
const AWS = require("aws-sdk");

// Configure AWS DynamoDB
AWS.config.update({ region: "eu-west-1" });
const DB_TABLE_TRAININGS = "LearningAssistantTrainings";
const DB_TABLE_QUESTIONS = "LearningAssistantQuestions";
const DB_TABLE_ANSWERS = "LearningAssistantAnswers";
let ddbInstance = null;



function connectToDb() {
    if (ddbInstance === null) {
        ddbInstance = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });
    }
    return ddbInstance;
}

module.exports.getTrainingList = async function getTrainingList(language) {
    const params = {
        TableName: DB_TABLE_TRAININGS
    };
    try {
        const db = connectToDb();
        let data = await db.scan(params).promise();
        // Remove trainings not available in the specified language
        // (This could probably be done in the db query already)
        let trainingItems = data.Items;
        //console.log("db getTrainingList: " + JSON.stringify(trainingItems));
        //console.log("Removing all items not available in language: " + language);

        for (let [key, value] of Object.entries(trainingItems)) {
            // DynamoDB returns an interesting object for the StringSet used for storing the languages, 
            // containing "type", "values" and "wrapperName"
            // Accessing Object.values()[1] gives an array with just the plain strings, which
            // seems to be the easiest way for accessing this.
            if (!(Object.values(value.Languages)[1]).some(lng => lng === language)) {
                delete trainingItems[key];
            }
        }
        //console.log("List of available trainings for language " + language + ": " + JSON.stringify(trainingItems));
        return trainingItems;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
};

module.exports.getTrainingNames = async function getTrainingNames(language) {
    let trainings = await module.exports.getTrainingList(language);
    //console.log("got trainings: " + JSON.stringify(trainings));
    // Well, I'm sure there is some more elegant alternative for this in JS.
    let trainingNames = [];
    trainings.forEach((item) => {
        trainingNames.push(item.TrainingName);
    });
    return trainingNames;
};

module.exports.getTrainingNamesForSpeech = async function getTrainingNamesForSpeech(language, lastSeparator) {
    let trainingNames = await module.exports.getTrainingNames(language);
    return {
        numTrainings: trainingNames.length,
        availableTrainings: module.exports.getTrainingNamesForSpeechListAvailable(trainingNames, lastSeparator)
    };
};

module.exports.getTrainingNamesForSpeechListAvailable = function getTrainingNamesForSpeechListAvailable(trainingNames, lastSeparator) {
    if (trainingNames.length === 1) {
        return trainingNames[0];
    }
    return trainingNames.slice(0, -1).join(", ") + lastSeparator + trainingNames.slice(-1);
};

module.exports.getQuestionIdListForTraining = async function getQuestionIdListForTraining(trainingId) {
    const params = {
        TableName: DB_TABLE_QUESTIONS,
        "KeyConditionExpression": "TrainingId = :tid",
        "ExpressionAttributeValues": {
            ":tid": trainingId
        },
        "ProjectionExpression": "QuestionId"
    };
    try {
        const db = connectToDb();
        const data = await db.query(params).promise();
        //console.log("Got question list: " + JSON.stringify(data));
        let questionIdList = [];
        data.Items.forEach((item) => {
            questionIdList.push(item.QuestionId);
        });
        //console.log("Extracted question IDs: " + questionIdList);
        return questionIdList;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
};

module.exports.getQuestion = async function getQuestion(trainingId, questionId, language) {
    const params = {
        TableName: DB_TABLE_QUESTIONS,
        Key: {
            "TrainingId": trainingId,
            "QuestionId": questionId
        },
    };
    try {
        const db = connectToDb();
        let data = await db.get(params).promise();
        // Overwrite question text with locale specific version if available
        const localeQuestionKey = "QuestionText-" + language;
        if (data.Item[localeQuestionKey]) {
            data.Item["QuestionText"] = data.Item[localeQuestionKey];
            //console.log("Overwriting QuestionText with: " + data.Item["QuestionText"]);
        }
        // Overwrite answer text with locale specific version if available
        const localeAnswersKey = "PossibleAnswers-" + language;
        if (data.Item[localeAnswersKey]) {
            data.Item["PossibleAnswers"] = data.Item[localeAnswersKey];
            //console.log("Overwriting PossibleAnswers with: " + data.Item["PossibleAnswers"]);
        }
        return data.Item;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
};

module.exports.logAnswerForUser = async function logAnswerForUser(userId, trainingId, questionId, isCorrect) {
    // Get current value
    //let updateCount = isCorrect === true ? "CorrectCount" : "WrongCount";
    const propertyToUpdateName = isCorrect === true ? "CorrectCount" : "WrongCount";
    const params = {
        TableName: DB_TABLE_ANSWERS,
        Key: {
            "UserTrainingId": `${userId}#${trainingId}`,
            //"TrainingId": trainingId, 
            "QuestionId": questionId
        },
        //UpdateExpression: "SET my_value = if_not_exists(#counter, :start) + :inc",
        UpdateExpression: "ADD #counter :increment",
        ExpressionAttributeNames: { "#counter": propertyToUpdateName },
        ExpressionAttributeValues: { ":increment": 1 },
        ReturnValues: "UPDATED_NEW"
    };
    try {
        const db = connectToDb();
        const data = await db.update(params).promise();
        //console.log("Updated answer count: " + JSON.stringify(data));
        return data.Item;
    } catch (err) {
        console.log("Error updating answer count in db: " + err.message);
    }
};

module.exports.getAnswersForUser = async function getAnswersForUser(userId, trainingId) {
    const params = {
        TableName: DB_TABLE_ANSWERS,
        "KeyConditionExpression": "UserTrainingId = :utid",
        "ExpressionAttributeValues": {
            ":utid": `${userId}#${trainingId}`
        },
        //"ProjectionExpression": "QuestionId"
        // TODO: remove retrieving UserTrainingId from returned objects to save data!
    };
    try {
        const db = connectToDb();
        const data = await db.query(params).promise();
        //console.log("Got answers list: " + JSON.stringify(data.Items));
        return data.Items;
    } catch (err) {
        console.log("Error getting answers list from db: " + err.message);
    }
};