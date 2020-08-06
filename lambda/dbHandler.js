"use strict";
const AWS = require("aws-sdk");

// Configure AWS DynamoDB
AWS.config.update({region: "eu-west-1"});
const DB_TABLE_TRAININGS = "LearningAssistantTrainings";
const DB_TABLE_QUESTIONS = "LearningAssistantQuestions";
const DB_TABLE_ANSWERS = "LearningAssistantAnswers";
let ddbInstance = null;



function connectToDb() {
    if (ddbInstance === null) {
        ddbInstance = new AWS.DynamoDB.DocumentClient({apiVersion: "2012-08-10"});
    }
    return ddbInstance;
}

module.exports.getTrainingList = async function getTrainingList() {
    const params = {
        TableName: DB_TABLE_TRAININGS
    };
    try {
        const db = connectToDb();
        const data = await db.scan(params).promise();
        console.log("db getTrainingList: " + JSON.stringify(data.Items));
        return data.Items;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
};

module.exports.getTrainingNamesForSpeech = async function getTrainingNamesForSpeech() {
    let trainings = await module.exports.getTrainingList();
    //console.log("got trainings: " + JSON.stringify(trainings));
    // Well, I'm sure there is some more elegant alternative for this in JS.
    let trainingNames = [];
    trainings.forEach((item) => {
        trainingNames.push(item.TrainingName);
    });
    return trainingNames.join(", ");
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

module.exports.getQuestion = async function getQuestion(trainingId, questionId) {
    const params = {
        TableName: DB_TABLE_QUESTIONS,
        Key: {
            "TrainingId": trainingId, 
            "QuestionId": questionId
        }, 
    };
    try {
        const db = connectToDb();
        const data = await db.get(params).promise();
        console.log("Got question: " + JSON.stringify(data.Item));
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
        ExpressionAttributeNames: {"#counter": propertyToUpdateName},
        ExpressionAttributeValues: {":increment": 1},
        ReturnValues: "UPDATED_NEW"
    };
    try {
        const db = connectToDb();
        const data = await db.update(params).promise();
        console.log("Updated answer count: " + JSON.stringify(data));
        return data.Item;
    } catch (err) {
        console.log("Error updating answer count in db: " + err.message);
    }
};

// module.exports.getAnswersForUser = async function getAnswersForUser(userId, trainingId) {

// };