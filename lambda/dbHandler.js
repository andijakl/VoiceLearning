'use strict';
const AWS = require('aws-sdk');

// Configure AWS DynamoDB
// TODO: probably set db region?
//AWS.config.update({region: 'REGION'});
const DB_TABLE_TRAININGS = 'LearningAssistantTrainings';
const DB_TABLE_QUESTIONS = 'LearningAssistantQuestions';
let ddbInstance = null;



function connectToDb() {
    if (ddbInstance === null) {
        ddbInstance = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
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
        //console.log("db get success!: " + JSON.stringify(data));
        return data.Items;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
}

module.exports.getTrainingNamesForSpeech = async function getTrainingNamesForSpeech() {
    let trainings = await module.exports.getTrainingList();
    //console.log("got trainings: " + JSON.stringify(trainings));
    // Well, I'm sure there is some more elegant alternative for this in JS.
    let trainingNames = [];
    //for (let item in trainings) {
    trainings.forEach((item) => {
        trainingNames.push(item.TrainingName);
    });
    return trainingNames.join(", ");
}

module.exports.getQuestionListForTraining = async function getQuestionListForTraining(trainingId) {
    const params = {
        TableName: DB_TABLE_QUESTIONS,
        "KeyConditionExpression": "TrainingId = :v1",
        "ExpressionAttributeValues": {
            ":v1": {"N": trainingId}
        },
        "ProjectionExpression": "QuestionId"
    };
    // TODO: might need to update params for DocumentClient interface
    try {
        const db = connectToDb();
        const data = await db.query(params).promise();
        console.log("Got question list: " + JSON.stringify(data.Items));
        return data.Items;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
}

module.exports.getQuestion = async function getQuestion(trainingId, questionId) {
    // const params = {
    //     TableName: DB_TABLE_QUESTIONS,
    //     Key: {
    //         "TrainingId": {"N": trainingId}, 
    //         "QuestionId": {"N": questionId}
    //     }, 
    // };
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
        console.log("Got question: " + JSON.stringify(data.Items));
        return data.Items;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
}